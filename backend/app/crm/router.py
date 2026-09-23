import csv
import io
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.audit import record_audit_log
from app.users.models import User
from app.crm.models import Lead, LeadSource
from app.organizations.models import Company, Contact
from app.sales.models import Pipeline, PipelineStage, Opportunity
from app.reports.export import generate_csv_response
from app.crm.schemas import (
    LeadResponse, LeadCreate, LeadUpdate, LeadConvertRequest,
    LeadSourceResponse, LeadSourceCreate,
)

router = APIRouter()

def format_lead_response(lead: Lead) -> LeadResponse:
    r = LeadResponse.model_validate(lead)
    # company_name resolved below
    r.contact_name = lead.contact_name or (lead.contact.name if lead.contact else None)
    r.contact_email = lead.contact_email or (lead.contact.email if lead.contact else None)
    r.contact_phone = lead.contact_phone or (lead.contact.phone if lead.contact else None)
    r.company_name = lead.company_name or (lead.company.organization_name if lead.company else None)
    r.source_name = lead.source.name if lead.source else None
    r.owner_name = lead.owner.full_name if lead.owner else None
    return r

# --- LEAD SOURCES ---

@router.get("/lead-sources", response_model=List[LeadSourceResponse])
def get_lead_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.view")),
):
    return db.query(LeadSource).filter(LeadSource.is_active == True).all()

@router.post("/lead-sources", response_model=LeadSourceResponse)
def create_lead_source(
    data: LeadSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.create")),
):
    existing = db.query(LeadSource).filter(LeadSource.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Lead source already exists")
    source = LeadSource(**data.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    return source

# --- LEADS ---

@router.get("/leads", response_model=List[LeadResponse])
def list_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    owner_id: Optional[str] = None,
    segment: Optional[str] = Query(None, description="Business segment: EdTech, IT Services, Talent"),
    source_id: Optional[str] = None,
    scope: Optional[str] = Query(None, description="today_follow_ups, overdue_follow_ups, mine"),
    unassigned: Optional[bool] = Query(None, description="True for leads where owner_id is NULL"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.view")),
):
    query = db.query(Lead).filter(Lead.is_deleted == False)

    if status:
        query = query.filter(Lead.status == status)
    if priority:
        query = query.filter(Lead.priority == priority)
    if owner_id:
        query = query.filter(Lead.owner_id == owner_id)
    if segment:
        query = query.filter(Lead.business_segment == segment)
    if source_id:
        query = query.filter(Lead.source_id == source_id)
    if unassigned is True:
        query = query.filter(Lead.owner_id.is_(None))

    if scope:
        now_utc = datetime.now(timezone.utc)
        if scope == "today_follow_ups":
            start_of_today = datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0, tzinfo=timezone.utc)
            end_of_today = datetime(now_utc.year, now_utc.month, now_utc.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
            query = query.filter(
                Lead.next_follow_up_date >= start_of_today,
                Lead.next_follow_up_date <= end_of_today,
            )
        elif scope == "overdue_follow_ups":
            query = query.filter(
                Lead.next_follow_up_date < now_utc,
                Lead.status.notin_(["Converted", "Lost"]),
            )
        elif scope == "mine":
            query = query.filter(Lead.owner_id == current_user.id)

    if search:
        s = f"%{search}%"
        query = query.filter(
            (Lead.title.ilike(s)) |
            (Lead.description.ilike(s)) |
            (Lead.contact_name.ilike(s)) |
            (Lead.contact_email.ilike(s)) |
            (Lead.contact_phone.ilike(s)) |
            (Lead.company_name.ilike(s))
        )

    leads = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit).all()
    return [format_lead_response(lead) for lead in leads]

@router.post("/leads", response_model=LeadResponse)
def create_lead(
    data: LeadCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.create")),
):
    lead_data = data.model_dump()
    lead = Lead(
        **lead_data,
        created_by_id=current_user.id,
    )
    # If owner_id was not explicitly specified in the request payload, default to current_user
    request_data = data.model_dump(exclude_unset=True)
    if "owner_id" not in request_data and not lead.owner_id:
        lead.owner_id = current_user.id

    db.add(lead)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="LEAD",
        entity_id=lead.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(lead)

    return format_lead_response(lead)


@router.get("/leads/template")
def get_leads_template(
    current_user: User = Depends(require_permission("crm.leads.view")),
):
    headers = [
        "title",
        "contact_name",
        "company_name",
        "business_segment",
        "contact_email",
        "contact_phone",
        "status",
        "priority",
        "source",
        "expected_value",
        "next_action",
        "next_follow_up_date",
    ]
    sample_row = [
        "Sample Lead: Cloud Architecture Assessment",
        "Arun Kumar",
        "Apex Infotech Solutions",
        "IT Services",
        "arun.k@example.com",
        "+91 9876543210",
        "New",
        "High",
        "Website",
        "75000",
        "Initial Discovery Call",
        "2026-10-01",
    ]
    return generate_csv_response(
        filename="leads_template.csv",
        headers=headers,
        rows=[sample_row],
    )


@router.get("/leads/export")
def export_leads(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    owner_id: Optional[str] = None,
    segment: Optional[str] = Query(None, description="Business segment: EdTech, IT Services, Talent, Higher Education"),
    source_id: Optional[str] = None,
    scope: Optional[str] = Query(None, description="today_follow_ups, overdue_follow_ups, mine"),
    unassigned: Optional[bool] = Query(None, description="True for leads where owner_id is NULL"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.view")),
):
    query = db.query(Lead).filter(Lead.is_deleted == False)

    if status:
        query = query.filter(Lead.status == status)
    if priority:
        query = query.filter(Lead.priority == priority)
    if owner_id:
        query = query.filter(Lead.owner_id == owner_id)
    if segment:
        query = query.filter(Lead.business_segment == segment)
    if source_id:
        query = query.filter(Lead.source_id == source_id)
    if unassigned is True:
        query = query.filter(Lead.owner_id.is_(None))

    if scope:
        now_utc = datetime.now(timezone.utc)
        if scope == "today_follow_ups":
            start_of_today = datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0, tzinfo=timezone.utc)
            end_of_today = datetime(now_utc.year, now_utc.month, now_utc.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
            query = query.filter(
                Lead.next_follow_up_date >= start_of_today,
                Lead.next_follow_up_date <= end_of_today,
            )
        elif scope == "overdue_follow_ups":
            query = query.filter(
                Lead.next_follow_up_date < now_utc,
                Lead.status.notin_(["Converted", "Lost"]),
            )
        elif scope == "mine":
            query = query.filter(Lead.owner_id == current_user.id)

    if search:
        s = f"%{search}%"
        query = query.filter(
            (Lead.title.ilike(s)) |
            (Lead.description.ilike(s)) |
            (Lead.contact_name.ilike(s)) |
            (Lead.contact_email.ilike(s)) |
            (Lead.contact_phone.ilike(s)) |
            (Lead.company_name.ilike(s))
        )

    leads = query.order_by(Lead.created_at.desc()).all()

    headers = [
        "Lead Title",
        "Contact Name",
        "Company Name",
        "Business Segment",
        "Contact Email",
        "Contact Phone",
        "Status",
        "Priority",
        "Lead Source",
        "Owner",
        "Expected Value",
        "Next Action",
        "Next Follow-up Date",
        "Created At",
    ]

    rows = []
    for lead in leads:
        contact_name = lead.contact_name or (lead.contact.name if lead.contact else "")
        company_name = lead.company_name or (lead.company.organization_name if lead.company else "")
        contact_email = lead.contact_email or (lead.contact.email if lead.contact else "")
        contact_phone = lead.contact_phone or (lead.contact.phone if lead.contact else "")
        source_name = lead.source.name if lead.source else ""
        owner_name = lead.owner.full_name if lead.owner else ""
        exp_val = f"{lead.expected_value:.2f}" if lead.expected_value is not None else ""
        next_dt = lead.next_follow_up_date.strftime("%Y-%m-%d %H:%M") if lead.next_follow_up_date else ""
        created_dt = lead.created_at.strftime("%Y-%m-%d %H:%M") if lead.created_at else ""

        rows.append([
            lead.title or "",
            contact_name,
            company_name,
            lead.business_segment or "",
            contact_email,
            contact_phone,
            lead.status or "",
            lead.priority or "",
            source_name,
            owner_name,
            exp_val,
            lead.next_action or "",
            next_dt,
            created_dt,
        ])

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return generate_csv_response(
        filename=f"leads_export_{timestamp}.csv",
        headers=headers,
        rows=rows,
    )


@router.post("/leads/import")
async def import_leads(
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.create")),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV file.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Unable to decode CSV file. Please ensure it is UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty or has no header row.")

    # Canonical mapping of recognized business segments
    RECOGNIZED_SEGMENTS = {
        "edtech": "EdTech",
        "it services": "IT Services",
        "talent": "Talent",
        "talent / outsourcing": "Talent",
        "talent/outsourcing": "Talent",
        "higher education": "Higher Education",
        "higher ed": "Higher Education",
    }

    # Active lead sources lookup
    sources = db.query(LeadSource).filter(LeadSource.is_active == True).all()
    source_map = {s.name.strip().lower(): s.id for s in sources}

    # Pre-fetch existing emails and phones for duplicate detection (conservative: skip duplicate)
    existing_leads = db.query(Lead.contact_email, Lead.contact_phone).filter(Lead.is_deleted == False).all()
    existing_emails = {l[0].strip().lower() for l in existing_leads if l[0] and l[0].strip()}
    existing_phones = {l[1].strip() for l in existing_leads if l[1] and l[1].strip()}

    batch_emails = set()
    batch_phones = set()

    total_rows = 0
    imported_count = 0
    duplicates_count = 0
    row_errors = []

    # Supported date formats for follow_up_date
    date_formats = [
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]

    for raw_row in reader:
        total_rows += 1
        row_num = total_rows + 1  # 1-based index including header

        # Normalize column keys
        row = {k.strip().lower().replace(" ", "_"): (v.strip() if v else "") for k, v in raw_row.items() if k}

        # Resolve field aliases
        title = row.get("title") or row.get("lead_title") or ""
        contact_name = row.get("contact_name") or row.get("contact") or row.get("name") or ""
        company_name = row.get("company_name") or row.get("company") or row.get("organization") or ""
        raw_segment = row.get("business_segment") or row.get("segment") or ""
        email = row.get("contact_email") or row.get("email") or ""
        phone = row.get("contact_phone") or row.get("phone") or ""
        status_val = row.get("status") or "New"
        priority_val = row.get("priority") or "Medium"
        source_val = row.get("source") or row.get("lead_source") or ""
        raw_val = row.get("expected_value") or row.get("value") or ""
        next_action = row.get("next_action") or ""
        raw_date = row.get("next_follow_up_date") or row.get("follow_up_date") or ""

        # Title / Name validation
        if not title:
            if contact_name and company_name:
                title = f"Lead: {contact_name} ({company_name})"
            elif contact_name:
                title = f"Lead: {contact_name}"
            elif company_name:
                title = f"Lead: {company_name}"
            else:
                row_errors.append(f"Row {row_num}: Missing lead title or contact/company name.")
                continue

        # Segment validation (validate against recognized active segments)
        segment = None
        if raw_segment:
            norm_seg = raw_segment.strip().lower()
            if norm_seg in RECOGNIZED_SEGMENTS:
                segment = RECOGNIZED_SEGMENTS[norm_seg]
            else:
                row_errors.append(
                    f"Row {row_num}: Unrecognized business segment '{raw_segment}'. "
                    f"Must be one of: EdTech, IT Services, Talent, Higher Education."
                )
                continue

        # Source validation
        source_id = None
        if source_val:
            norm_source = source_val.strip().lower()
            if norm_source in source_map:
                source_id = source_map[norm_source]
            else:
                row_errors.append(f"Row {row_num}: Lead source '{source_val}' is not recognized.")
                continue

        # Duplicate check: conservative skip
        norm_email = email.strip().lower() if email else ""
        norm_phone = phone.strip() if phone else ""

        is_duplicate = False
        if norm_email and (norm_email in existing_emails or norm_email in batch_emails):
            is_duplicate = True
        elif norm_phone and (norm_phone in existing_phones or norm_phone in batch_phones):
            is_duplicate = True

        if is_duplicate:
            duplicates_count += 1
            row_errors.append(f"Row {row_num}: Duplicate lead with email '{email}' or phone '{phone}' skipped.")
            continue

        # Expected value parsing
        expected_val = 0.0
        if raw_val:
            try:
                clean_val = raw_val.replace("$", "").replace("₹", "").replace(",", "").strip()
                expected_val = float(clean_val)
            except ValueError:
                row_errors.append(f"Row {row_num}: Invalid expected value '{raw_val}'.")
                continue

        # Follow up date parsing
        follow_up_dt = None
        if raw_date:
            parsed = False
            for fmt in date_formats:
                try:
                    follow_up_dt = datetime.strptime(raw_date, fmt)
                    parsed = True
                    break
                except ValueError:
                    pass
            if not parsed:
                row_errors.append(f"Row {row_num}: Invalid next follow-up date '{raw_date}'.")
                continue

        # Safe company match (reuse existing Company records; do NOT auto-create clutter records)
        company_id = None
        if company_name:
            matched_company = db.query(Company).filter(
                (func.lower(Company.organization_name) == func.lower(company_name.strip())) |
                (func.lower(Company.code) == func.lower(company_name.strip())),
                Company.is_deleted == False
            ).first()
            if matched_company:
                company_id = matched_company.id

        new_lead = Lead(
            title=title,
            contact_name=contact_name or None,
            company_name=company_name or None,
            company_id=company_id,
            business_segment=segment,
            contact_email=email or None,
            contact_phone=phone or None,
            status=status_val,
            priority=priority_val,
            source_id=source_id,
            owner_id=current_user.id,
            expected_value=expected_val,
            next_action=next_action or None,
            next_follow_up_date=follow_up_dt,
            created_by_id=current_user.id,
        )
        db.add(new_lead)
        imported_count += 1

        if norm_email:
            batch_emails.add(norm_email)
        if norm_phone:
            batch_phones.add(norm_phone)

    if imported_count > 0:
        db.commit()
        record_audit_log(
            db=db,
            action="IMPORT",
            entity_type="LEAD",
            entity_id="batch",
            user_id=current_user.id,
            user_email=current_user.email,
            new_values={"total_rows": total_rows, "imported": imported_count, "duplicates": duplicates_count},
            request=request,
        )

    return {
        "total_rows": total_rows,
        "imported": imported_count,
        "duplicates": duplicates_count,
        "validation_errors": len(row_errors),
        "row_errors": row_errors,
    }


@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.view")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return format_lead_response(lead)

@router.put("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: str,
    data: LeadUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.edit")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_values = {k: getattr(lead, k) for k in data.model_dump(exclude_unset=True).keys()}
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="LEAD",
        entity_id=lead.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(lead)

    return format_lead_response(lead)

@router.post("/leads/{lead_id}/convert")
def convert_lead(
    lead_id: str,
    data: LeadConvertRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.edit")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == "Converted":
        raise HTTPException(status_code=400, detail="Lead is already converted")

    # Resolve Company / Organization
    company_id = data.company_id or lead.company_id
    if not company_id:
        org_name = data.company_name or lead.company_name
        if not org_name:
            if lead.contact_name:
                org_name = f"{lead.contact_name} (Individual)"
            else:
                raise HTTPException(
                    status_code=400,
                    detail="A company name must be selected or created to convert this lead",
                )

        existing_company = db.query(Company).filter(
            Company.organization_name == org_name,
            Company.is_deleted == False,
        ).first()

        if existing_company:
            company_id = existing_company.id
        else:
            code = data.company_code or f"ORG-{datetime.now().strftime('%Y%m%d%H%M%S%f')[:17]}"
            new_company = Company(
                organization_name=org_name,
                code=code,
                owner_id=lead.owner_id or current_user.id,
                created_by_id=current_user.id,
                status="Customer",
                type="Corporate" if lead.business_segment in ["IT Services", "Talent"] else "Engineering College",
                industry=lead.business_segment or "IT Services",
            )
            db.add(new_company)
            db.flush()
            company_id = new_company.id

    # Resolve Contact
    contact_id = lead.contact_id
    if not contact_id and lead.contact_name:
        match_query = db.query(Contact).filter(
            Contact.company_id == company_id,
            Contact.is_deleted == False,
        )
        matched_contact = None
        if lead.contact_email:
            matched_contact = match_query.filter(Contact.email == lead.contact_email).first()
        elif lead.contact_phone:
            matched_contact = match_query.filter(Contact.phone == lead.contact_phone).first()
        else:
            matched_contact = match_query.filter(Contact.name == lead.contact_name).first()

        if matched_contact:
            contact_id = matched_contact.id
        else:
            new_contact = Contact(
                company_id=company_id,
                name=lead.contact_name,
                email=lead.contact_email,
                phone=lead.contact_phone,
                is_primary=True,
                status="Active",
                created_by_id=current_user.id,
            )
            db.add(new_contact)
            db.flush()
            contact_id = new_contact.id

        lead.contact_id = contact_id

    # Resolve Pipeline and Stage
    pipeline = None
    if data.pipeline_id:
        pipeline = db.query(Pipeline).filter(Pipeline.id == data.pipeline_id).first()
    elif lead.business_segment:
        segment_pipeline_names = {
            "EdTech": "EdTech Pipeline",
            "IT Services": "IT Services Pipeline",
            "Talent": "Talent / Outsourcing Pipeline",
        }
        target_pipe_name = segment_pipeline_names.get(lead.business_segment)
        if target_pipe_name:
            pipeline = db.query(Pipeline).filter(Pipeline.name == target_pipe_name).first()

    if not pipeline:
        pipeline = db.query(Pipeline).filter(Pipeline.is_default == True).first()
    if not pipeline:
        pipeline = db.query(Pipeline).first()
    if not pipeline:
        raise HTTPException(status_code=400, detail="No active pipeline found in system")

    # Initial Stage Routing
    stage_id = data.stage_id
    if not stage_id:
        if not data.pipeline_id and lead.business_segment:
            segment_stage_names = {
                "EdTech": "Counselling",
                "IT Services": "Discovery",
                "Talent": "Requirement",
            }
            target_stage_name = segment_stage_names.get(lead.business_segment)
            if target_stage_name:
                stage = db.query(PipelineStage).filter(
                    PipelineStage.pipeline_id == pipeline.id,
                    PipelineStage.name == target_stage_name,
                ).first()
                if stage:
                    stage_id = stage.id

        if not stage_id:
            first_stage = db.query(PipelineStage).filter(
                PipelineStage.pipeline_id == pipeline.id,
            ).order_by(PipelineStage.order.asc()).first()
            if not first_stage:
                raise HTTPException(status_code=400, detail="No stages configured in pipeline")
            stage_id = first_stage.id

    # Create Opportunity
    opp_val = data.value if data.value is not None else (lead.expected_value or 0.0)
    opp_date = data.expected_close_date or lead.expected_close_date

    opp = Opportunity(
        company_id=company_id,
        contact_id=contact_id,
        title=data.opportunity_title,
        description=f"Converted from Lead: {lead.title}\n\n{lead.description or ''}",
        pipeline_id=pipeline.id,
        stage_id=stage_id,
        owner_id=lead.owner_id or current_user.id,
        value=opp_val,
        expected_close_date=opp_date,
        status="Open",
        created_by_id=current_user.id,
    )
    db.add(opp)
    db.flush()

    # Update Lead
    lead.status = "Converted"
    lead.qualification_status = "Qualified"
    lead.converted_opportunity_id = opp.id
    lead.converted_at = datetime.now(timezone.utc)
    lead.company_id = company_id

    record_audit_log(
        db=db,
        action="CONVERT",
        entity_type="LEAD",
        entity_id=lead.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"opportunity_id": opp.id, "company_id": company_id, "contact_id": contact_id},
        request=request,
    )
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="OPPORTUNITY",
        entity_id=opp.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"title": opp.title, "value": opp.value, "source_lead_id": lead.id},
        request=request,
    )
    db.commit()

    return {
        "message": "Lead successfully converted to Opportunity",
        "opportunity_id": opp.id,
        "company_id": company_id,
        "contact_id": contact_id,
        "pipeline_id": pipeline.id,
        "stage_id": stage_id,
    }

@router.delete("/leads/{lead_id}")
def delete_lead(
    lead_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.leads.edit")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.is_deleted == False).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="LEAD",
        entity_id=lead.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Lead deleted"}
