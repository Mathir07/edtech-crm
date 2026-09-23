import csv
import io
from typing import List, Optional
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.reports.export import generate_csv_response
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.audit import record_audit_log
from app.users.models import User
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.sales.models import Opportunity, Quotation, Contract, SalesOrder
from app.activities.models import Activity, Task, Meeting, Note
from app.audit.models import AuditLog
from app.organizations.schemas import (
    CompanyResponse, CompanyCreate, CompanyUpdate, Company360Response, TimelineItem,
    ContactResponse, ContactCreate, ContactUpdate, ContactDetailResponse,
)

router = APIRouter()

# --- COMPANIES ---

@router.get("/companies", response_model=List[CompanyResponse])
def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    industry: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    query = db.query(Company).filter(Company.is_deleted == False)

    if search:
        s = f"%{search}%"
        query = query.filter(
            (Company.organization_name.ilike(s))
            | (Company.code.ilike(s))
            | (Company.city.ilike(s))
            | (Company.website.ilike(s))
        )
    if status:
        query = query.filter(Company.status == status)
    if type:
        query = query.filter(Company.type == type)
    if industry:
        query = query.filter(Company.industry == industry)
    if state:
        query = query.filter(Company.state == state)

    companies = query.order_by(Company.organization_name.asc()).offset(skip).limit(limit).all()

    result = []
    for col in companies:
        resp = CompanyResponse.model_validate(col)
        resp.owner_name = col.owner.full_name if col.owner else None
        resp.contacts_count = len(col.contacts)
        resp.active_leads_count = len([l for l in col.leads if l.status not in ["Converted", "Lost"] and not l.is_deleted])
        resp.open_opportunities_count = len([o for o in col.opportunities if o.status == "Open" and not o.is_deleted])
        result.append(resp)
    return result

@router.post("/companies", response_model=CompanyResponse)
def create_company(
    data: CompanyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.create")),
):
    existing = db.query(Company).filter(Company.code == data.code, Company.is_deleted == False).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Company with code '{data.code}' already exists")

    company = Company(
        **data.model_dump(),
        created_by_id=current_user.id,
    )
    db.add(company)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="COMPANY",
        entity_id=company.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(),
        request=request,
    )
    db.commit()
    db.refresh(company)
    resp = CompanyResponse.model_validate(company)
    resp.owner_name = company.owner.full_name if company.owner else None
    return resp

@router.get("/companies/{company_id}", response_model=Company360Response)
def get_company_360(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    company = db.query(Company).filter(Company.id == company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    contacts = db.query(Contact).filter(Contact.company_id == company_id, Contact.is_deleted == False).all()
    leads = db.query(Lead).filter(Lead.company_id == company_id, Lead.is_deleted == False).all()
    opportunities = db.query(Opportunity).filter(Opportunity.company_id == company_id, Opportunity.is_deleted == False).all()
    quotations = db.query(Quotation).filter(Quotation.company_id == company_id, Quotation.is_deleted == False).all()
    contracts = db.query(Contract).filter(Contract.company_id == company_id, Contract.is_deleted == False).all()
    sales_orders = db.query(SalesOrder).filter(SalesOrder.company_id == company_id, SalesOrder.is_deleted == False).all()
    activities = db.query(Activity).filter(Activity.related_entity_type == "company", Activity.related_entity_id == company_id).all()
    tasks = db.query(Task).filter(Task.related_entity_type == "company", Task.related_entity_id == company_id).all()
    meetings = db.query(Meeting).filter(Meeting.related_entity_type == "company", Meeting.related_entity_id == company_id).all()
    notes = db.query(Note).filter(Note.related_entity_type == "company", Note.related_entity_id == company_id).all()
    audit_logs = db.query(AuditLog).filter(AuditLog.entity_type == "COMPANY", AuditLog.entity_id == company_id).order_by(AuditLog.created_at.desc()).all()
    from app.service.models import Ticket
    tickets = db.query(Ticket).filter(Ticket.company_id == company_id, Ticket.is_deleted == False).order_by(Ticket.created_at.desc()).all()
    from app.accounting.models import Invoice, CustomerPayment
    invoices = db.query(Invoice).filter(Invoice.company_id == company_id, Invoice.is_deleted == False).order_by(Invoice.created_at.desc()).all()
    payments = db.query(CustomerPayment).filter(CustomerPayment.company_id == company_id).order_by(CustomerPayment.created_at.desc()).all()
    from app.communication.models import CommunicationMessage
    comms = db.query(CommunicationMessage).filter(CommunicationMessage.company_id == company_id, CommunicationMessage.is_deleted == False).order_by(CommunicationMessage.created_at.desc()).all()

    # Build chronological timeline
    timeline: List[TimelineItem] = []
    for a in activities:
        timeline.append(TimelineItem(
            id=a.id,
            type="activity",
            title=f"Activity: {a.type} - {a.subject}",
            description=a.description,
            timestamp=a.due_at or a.created_at,
            author=a.created_by.full_name if a.created_by else None,
            metadata={"status": "completed" if a.is_completed else "pending", "type": a.type},
        ))
    for m in meetings:
        timeline.append(TimelineItem(
            id=m.id,
            type="meeting",
            title=f"Meeting: {m.title}",
            description=f"Status: {m.status} | Location: {m.location or 'Online'}",
            timestamp=m.start_time,
            author=m.organizer.full_name if m.organizer else None,
            metadata={"meeting_link": m.meeting_link, "status": m.status},
        ))
    for n in notes:
        timeline.append(TimelineItem(
            id=n.id,
            type="note",
            title="Note added",
            description=n.content,
            timestamp=n.created_at,
            author=n.author.full_name if n.author else None,
        ))
    for q in quotations:
        timeline.append(TimelineItem(
            id=q.id,
            type="quotation",
            title=f"Quotation: {q.quotation_number} ({q.status})",
            description=f"Amount: ₹{float(q.total_amount):,.2f}",
            timestamp=q.created_at,
            author=q.creator.full_name if q.creator else None,
            metadata={"status": q.status, "amount": float(q.total_amount)},
        ))
    for c in contracts:
        timeline.append(TimelineItem(
            id=c.id,
            type="contract",
            title=f"Contract: {c.contract_number} ({c.status})",
            description=f"{c.title} - Value: ₹{float(c.contract_value):,.2f}",
            timestamp=c.created_at,
            author=c.creator.full_name if c.creator else None,
            metadata={"status": c.status, "value": float(c.contract_value)},
        ))
    for so in sales_orders:
        timeline.append(TimelineItem(
            id=so.id,
            type="sales_order",
            title=f"Sales Order: {so.order_number} ({so.status})",
            description=f"Amount: ₹{float(so.total_amount):,.2f}",
            timestamp=so.created_at,
            author=so.creator.full_name if so.creator else None,
            metadata={"status": so.status, "amount": float(so.total_amount)},
        ))
    for l in audit_logs:
        timeline.append(TimelineItem(
            id=l.id,
            type="audit",
            title=f"Audit: {l.action}",
            description=f"Action by {l.user_email or 'System'}",
            timestamp=l.created_at,
            author=l.user_email,
            metadata={"action": l.action, "changes": l.new_values},
        ))
    for t in tickets:
        timeline.append(TimelineItem(
            id=t.id,
            type="ticket",
            title=f"Support Ticket: {t.ticket_number} ({t.status})",
            description=f"{t.subject} - Priority: {t.priority} | SLA: {t.sla_status}",
            timestamp=t.created_at,
            author=t.created_by.full_name if t.created_by else "Customer",
            metadata={"status": t.status, "priority": t.priority, "severity": t.severity},
        ))
    for inv in invoices:
        inv_ts = inv.created_at or datetime.combine(inv.invoice_date, datetime.min.time())
        if hasattr(inv_ts, "tzinfo") and inv_ts.tzinfo is not None:
            inv_ts = inv_ts.replace(tzinfo=None)
        timeline.append(TimelineItem(
            id=inv.id,
            type="invoice",
            title=f"Invoice: {inv.invoice_number} ({inv.status})",
            description=f"Total: ₹{float(inv.total_amount):,.2f} | Due: ₹{float(inv.amount_due):,.2f}",
            timestamp=inv_ts,
            author=inv.created_by.full_name if inv.created_by else "Finance",
            metadata={"status": inv.status, "total_amount": float(inv.total_amount), "amount_due": float(inv.amount_due)},
        ))
    for pay in payments:
        pay_ts = pay.created_at or datetime.combine(pay.payment_date, datetime.min.time())
        if hasattr(pay_ts, "tzinfo") and pay_ts.tzinfo is not None:
            pay_ts = pay_ts.replace(tzinfo=None)
        timeline.append(TimelineItem(
            id=pay.id,
            type="payment",
            title=f"Payment Receipt: {pay.payment_number}",
            description=f"Amount: ₹{float(pay.amount):,.2f} via {pay.payment_method}",
            timestamp=pay_ts,
            author=pay.created_by.full_name if pay.created_by else "Finance",
            metadata={"amount": float(pay.amount), "method": pay.payment_method},
        ))
    for cm in comms:
        cm_ts = cm.created_at
        if hasattr(cm_ts, "tzinfo") and cm_ts.tzinfo is not None:
            cm_ts = cm_ts.replace(tzinfo=None)
        preview = cm.subject or cm.body_text or f"{cm.channel} message"
        timeline.append(TimelineItem(
            id=cm.id,
            type="communication",
            title=f"{cm.channel} ({cm.direction}): {cm.subject or cm.recipient}",
            description=preview[:200],
            timestamp=cm_ts,
            author=cm.created_by.full_name if cm.created_by else (cm.sender if cm.direction == 'INBOUND' else 'Staff'),
            metadata={"channel": cm.channel, "direction": cm.direction, "status": cm.status},
        ))

    def _safe_sort_key(t_item):
        ts = t_item.timestamp
        if ts is None:
            return datetime.min
        if isinstance(ts, date) and not isinstance(ts, datetime):
            return datetime.combine(ts, datetime.min.time())
        if hasattr(ts, "tzinfo") and ts.tzinfo is not None:
            return ts.replace(tzinfo=None)
        return ts

    timeline.sort(key=_safe_sort_key, reverse=True)

    comp_resp = CompanyResponse.model_validate(company)
    comp_resp.owner_name = company.owner.full_name if company.owner else None
    comp_resp.contacts_count = len(contacts)
    comp_resp.active_leads_count = len([l for l in leads if l.status not in ["Converted", "Lost"]])
    comp_resp.open_opportunities_count = len([o for o in opportunities if o.status == "Open"])

    # Prepare structured objects
    leads_data = [
        {
            "id": l.id,
            "title": l.title,
            "status": l.status,
            "priority": l.priority,
            "expected_value": l.expected_value,
            "qualification_status": l.qualification_status,
            "owner_name": l.owner.full_name if l.owner else None,
            "created_at": l.created_at,
        } for l in leads
    ]
    opps_data = [
        {
            "id": o.id,
            "title": o.title,
            "stage_name": o.stage.name if o.stage else "Unknown",
            "value": o.value,
            "probability": o.probability,
            "expected_close_date": o.expected_close_date,
            "status": o.status,
            "owner_name": o.owner.full_name if o.owner else None,
            "created_at": o.created_at,
        } for o in opportunities
    ]
    quotations_data = [
        {
            "id": q.id,
            "quotation_number": q.quotation_number,
            "opportunity_title": q.opportunity.title if q.opportunity else None,
            "total_amount": float(q.total_amount),
            "status": q.status,
            "quotation_date": q.quotation_date,
            "creator_name": q.creator.full_name if q.creator else None,
            "created_at": q.created_at,
        } for q in quotations
    ]
    contracts_data = [
        {
            "id": c.id,
            "contract_number": c.contract_number,
            "title": c.title,
            "contract_value": float(c.contract_value),
            "status": c.status,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "creator_name": c.creator.full_name if c.creator else None,
            "created_at": c.created_at,
        } for c in contracts
    ]
    sales_orders_data = [
        {
            "id": so.id,
            "order_number": so.order_number,
            "total_amount": float(so.total_amount),
            "status": so.status,
            "order_date": so.order_date,
            "creator_name": so.creator.full_name if so.creator else None,
            "created_at": so.created_at,
        } for so in sales_orders
    ]
    activities_data = [
        {
            "id": act.id,
            "type": act.type,
            "subject": act.subject,
            "description": act.description,
            "due_at": act.due_at,
            "is_completed": act.is_completed,
            "assigned_to_name": act.assigned_to.full_name if act.assigned_to else None,
            "created_at": act.created_at,
        } for act in activities
    ]
    tasks_data = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date,
            "assigned_to_name": t.assigned_to.full_name if t.assigned_to else None,
        } for t in tasks
    ]
    meetings_data = [
        {
            "id": m.id,
            "title": m.title,
            "start_time": m.start_time,
            "end_time": m.end_time,
            "location": m.location,
            "status": m.status,
            "organizer_name": m.organizer.full_name if m.organizer else None,
        } for m in meetings
    ]
    notes_data = [
        {
            "id": n.id,
            "content": n.content,
            "author_name": n.author.full_name if n.author else None,
            "created_at": n.created_at,
        } for n in notes
    ]
    tickets_data = [
        {
            "id": t.id,
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "priority": t.priority,
            "severity": t.severity,
            "status": t.status,
            "sla_status": t.sla_status,
            "sla_breached": t.sla_breached,
            "assigned_to_name": t.assigned_to.full_name if t.assigned_to else "Unassigned",
            "contact_name": t.contact.name if t.contact else None,
            "created_at": t.created_at,
            "resolved_at": t.resolved_at,
            "due_at": t.due_at,
        } for t in tickets
    ]

    invoices_data = [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "total_amount": float(inv.total_amount),
            "amount_paid": float(inv.amount_paid),
            "amount_due": float(inv.amount_due),
            "status": inv.status,
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "created_at": inv.created_at,
        } for inv in invoices
    ]
    payments_data = [
        {
            "id": pay.id,
            "payment_number": pay.payment_number,
            "amount": float(pay.amount),
            "payment_method": pay.payment_method,
            "payment_date": pay.payment_date,
            "status": pay.status,
            "created_at": pay.created_at,
        } for pay in payments
    ]

    return Company360Response(
        company=comp_resp,
        contacts=[ContactResponse.model_validate(c) for c in contacts],
        leads=leads_data,
        opportunities=opps_data,
        activities=activities_data,
        tasks=tasks_data,
        meetings=meetings_data,
        notes=notes_data,
        timeline=timeline,
        quotations=quotations_data,
        contracts=contracts_data,
        sales_orders=sales_orders_data,
        tickets=tickets_data,
        invoices=invoices_data,
        payments=payments_data,
    )

@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: str,
    data: CompanyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    company = db.query(Company).filter(Company.id == company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    old_values = {k: getattr(company, k) for k in data.model_dump(exclude_unset=True).keys()}
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(company, key, value)
    company.updated_by_id = current_user.id

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="COMPANY",
        entity_id=company.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True),
        request=request,
    )
    db.commit()
    db.refresh(company)
    resp = CompanyResponse.model_validate(company)
    resp.owner_name = company.owner.full_name if company.owner else None
    return resp

@router.delete("/companies/{company_id}")
def delete_company(
    company_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.delete")),
):
    company = db.query(Company).filter(Company.id == company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="COMPANY",
        entity_id=company.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Company successfully deleted"}

# --- CONTACTS ---

def format_contact_response(c: Contact) -> ContactResponse:
    r = ContactResponse.model_validate(c)
    r.company_name = c.company.organization_name if c.company else None
    # company_name resolved from company
    return r

@router.get("/contacts", response_model=List[ContactResponse])
def list_contacts(
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    query = db.query(Contact).filter(Contact.is_deleted == False)
    if company_id:
        query = query.filter(Contact.company_id == company_id)
    if status:
        query = query.filter(Contact.status == status)
    if search:
        s = f"%{search}%"
        query = query.join(Company, Contact.company_id == Company.id, isouter=True).filter(
            (Contact.name.ilike(s))
            | (Contact.email.ilike(s))
            | (Contact.phone.ilike(s))
            | (Contact.designation.ilike(s))
            | (Company.organization_name.ilike(s))
        )
    contacts = query.order_by(Contact.name.asc()).all()
    return [format_contact_response(c) for c in contacts]


@router.get("/contacts/template")
def get_contacts_template(
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    headers = [
        "name",
        "company_name",
        "designation",
        "department",
        "email",
        "phone",
        "is_primary",
    ]
    sample_row = [
        "Priya Sharma",
        "Apex Infotech Solutions",
        "Vice President of Engineering",
        "Technology",
        "priya.s@example.com",
        "+91 9123456780",
        "true",
    ]
    return generate_csv_response(
        filename="contacts_template.csv",
        headers=headers,
        rows=[sample_row],
    )


@router.get("/contacts/export")
def export_contacts(
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    query = db.query(Contact).filter(Contact.is_deleted == False)
    if company_id:
        query = query.filter(Contact.company_id == company_id)
    if status:
        query = query.filter(Contact.status == status)
    if search:
        s = f"%{search}%"
        query = query.join(Company, Contact.company_id == Company.id, isouter=True).filter(
            (Contact.name.ilike(s))
            | (Contact.email.ilike(s))
            | (Contact.phone.ilike(s))
            | (Contact.designation.ilike(s))
            | (Company.organization_name.ilike(s))
        )
    contacts = query.order_by(Contact.name.asc()).all()

    headers = [
        "Name",
        "Company Name",
        "Designation",
        "Department",
        "Email",
        "Phone",
        "Status",
        "Is Primary",
        "Created At",
    ]

    rows = []
    for c in contacts:
        company_name = c.company.organization_name if c.company else ""
        is_primary_str = "Yes" if c.is_primary else "No"
        created_dt = c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else ""

        rows.append([
            c.name or "",
            company_name,
            c.designation or "",
            c.department or "",
            c.email or "",
            c.phone or "",
            c.status or "",
            is_primary_str,
            created_dt,
        ])

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return generate_csv_response(
        filename=f"contacts_export_{timestamp}.csv",
        headers=headers,
        rows=rows,
    )


@router.post("/contacts/import")
async def import_contacts(
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
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

    # Pre-fetch existing emails and phones
    existing_contacts = db.query(Contact.email, Contact.phone).filter(Contact.is_deleted == False).all()
    existing_emails = {c[0].strip().lower() for c in existing_contacts if c[0] and c[0].strip()}
    existing_phones = {c[1].strip() for c in existing_contacts if c[1] and c[1].strip()}

    batch_emails = set()
    batch_phones = set()

    total_rows = 0
    imported_count = 0
    duplicates_count = 0
    row_errors = []

    for raw_row in reader:
        total_rows += 1
        row_num = total_rows + 1

        row = {k.strip().lower().replace(" ", "_"): (v.strip() if v else "") for k, v in raw_row.items() if k}

        name = row.get("name") or row.get("contact_name") or row.get("full_name") or ""
        company_name = row.get("company_name") or row.get("company") or row.get("organization") or ""
        designation = row.get("designation") or row.get("title") or row.get("role") or ""
        department = row.get("department") or ""
        email = row.get("email") or row.get("contact_email") or ""
        phone = row.get("phone") or row.get("contact_phone") or ""
        is_primary_val = row.get("is_primary") or "false"
        is_primary = is_primary_val.lower() in ("true", "1", "yes", "y")

        if not name:
            row_errors.append(f"Row {row_num}: Missing contact name.")
            continue

        if not company_name:
            row_errors.append(f"Row {row_num}: Missing company/account name.")
            continue

        # Look up existing Company/Account
        matched_company = db.query(Company).filter(
            (func.lower(Company.organization_name) == func.lower(company_name)) |
            (func.lower(Company.code) == func.lower(company_name)),
            Company.is_deleted == False
        ).first()

        if not matched_company:
            row_errors.append(
                f"Row {row_num}: Company/Account '{company_name}' not found. Please create the Company/Account first."
            )
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
            row_errors.append(f"Row {row_num}: Duplicate contact with email '{email}' or phone '{phone}' skipped.")
            continue

        new_contact = Contact(
            name=name,
            company_id=matched_company.id,
            designation=designation or None,
            department=department or None,
            email=email or None,
            phone=phone or None,
            is_primary=is_primary,
            status="Active",
            created_by_id=current_user.id,
        )
        db.add(new_contact)
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
            entity_type="CONTACT",
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


@router.get("/contacts/{contact_id}", response_model=ContactDetailResponse)
def get_contact_detail(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.is_deleted == False).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    company_obj = contact.company
    company_data = None
    if company_obj:
        company_data = {
            "id": company_obj.id,
            "organization_name": company_obj.organization_name,
            "code": company_obj.code,
            "type": company_obj.type,
            "industry": company_obj.industry,
            "city": company_obj.city,
            "state": company_obj.state,
            "status": company_obj.status,
            "website": company_obj.website,
            "email": company_obj.email,
            "phone": company_obj.phone,
        }

    # Leads linked to this contact or by company + email/name
    leads = db.query(Lead).filter(
        (Lead.contact_id == contact_id) |
        ((Lead.company_id == contact.company_id) & ((Lead.contact_email == contact.email) | (Lead.contact_name == contact.name))),
        Lead.is_deleted == False,
    ).order_by(Lead.created_at.desc()).all()

    # Opportunities linked to this contact or associated with the company
    opps = db.query(Opportunity).filter(
        (Opportunity.contact_id == contact_id) | (Opportunity.company_id == contact.company_id),
        Opportunity.is_deleted == False,
    ).order_by(Opportunity.created_at.desc()).all()

    # Activities for this contact
    activities = db.query(Activity).filter(
        Activity.related_entity_type == "contact",
        Activity.related_entity_id == contact_id,
    ).order_by(Activity.due_at.desc()).all()

    # Tasks for this contact
    tasks = db.query(Task).filter(
        Task.related_entity_type == "contact",
        Task.related_entity_id == contact_id,
    ).order_by(Task.due_date.desc()).all()

    leads_data = [
        {
            "id": l.id,
            "title": l.title,
            "status": l.status,
            "priority": l.priority,
            "expected_value": l.expected_value,
            "next_action": l.next_action,
            "next_follow_up_date": l.next_follow_up_date.isoformat() if l.next_follow_up_date else None,
            "business_segment": l.business_segment,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in leads
    ]

    opps_data = [
        {
            "id": o.id,
            "title": o.title,
            "pipeline_name": o.pipeline.name if o.pipeline else None,
            "stage_name": o.stage.name if o.stage else None,
            "stage_color": o.stage.color if o.stage else None,
            "value": o.value,
            "probability": o.probability,
            "expected_close_date": o.expected_close_date.isoformat() if o.expected_close_date else None,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in opps
    ]

    activities_data = [
        {
            "id": a.id,
            "type": a.type,
            "subject": a.subject,
            "description": a.description,
            "due_at": a.due_at.isoformat() if a.due_at else None,
            "is_completed": a.is_completed,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "assigned_to_name": a.assigned_to.full_name if a.assigned_to else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in activities
    ]

    tasks_data = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "assigned_to_name": t.assigned_to.full_name if t.assigned_to else None,
        }
        for t in tasks
    ]

    return ContactDetailResponse(
        contact=format_contact_response(contact),
        company=company_data,
        leads=leads_data,
        opportunities=opps_data,
        activities=activities_data,
        tasks=tasks_data,
    )

@router.post("/contacts", response_model=ContactResponse)
def create_contact(
    data: ContactCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    contact = Contact(
        **data.model_dump(),
        created_by_id=current_user.id,
    )
    db.add(contact)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="CONTACT",
        entity_id=contact.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(),
        request=request,
    )
    db.commit()
    db.refresh(contact)
    return format_contact_response(contact)

@router.put("/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: str,
    data: ContactUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.is_deleted == False).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    old_values = {k: getattr(contact, k) for k in data.model_dump(exclude_unset=True).keys()}
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="CONTACT",
        entity_id=contact.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True),
        request=request,
    )
    db.commit()
    db.refresh(contact)
    return format_contact_response(contact)

@router.delete("/contacts/{contact_id}")
def delete_contact(
    contact_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.is_deleted == False).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="CONTACT",
        entity_id=contact.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Contact deleted"}
