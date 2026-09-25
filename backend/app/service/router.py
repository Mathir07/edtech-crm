import os
import re
import csv
import io
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.core.deps import require_permission, require_any_permission, get_current_user
from app.core.audit import record_audit_log
from app.core.storage import get_storage_backend, StorageBackend
from app.users.models import User, Team
from app.organizations.models import Company, Contact
from app.projects.models import Project
from app.sales.models import SalesOrder, Contract
from app.qa.models import Bug
from app.notifications.dispatcher import notify_ticket_assigned

from app.service.models import (
    ServiceCategory,
    ServiceSubcategory,
    SLAPolicy,
    Ticket,
    TicketComment,
    TicketAttachment,
    TicketStatusHistory,
    TicketAssignment,
    TicketEscalation,
)
from app.service.schemas import (
    ServiceCategoryResponse,
    ServiceCategoryCreate,
    ServiceCategoryUpdate,
    ServiceSubcategoryResponse,
    ServiceSubcategoryCreate,
    SLAPolicyResponse,
    SLAPolicyCreate,
    SLAPolicyUpdate,
    TicketCommentCreate,
    TicketCommentResponse,
    TicketAttachmentResponse,
    TicketStatusHistoryResponse,
    TicketAssignmentResponse,
    TicketEscalationResponse,
    TicketTimelineItem,
    TicketCreate,
    TicketUpdate,
    TicketStatusUpdate,
    TicketAssignmentUpdate,
    TicketPriorityUpdate,
    TicketSeverityUpdate,
    TicketEscalateRequest,
    TicketResolveRequest,
    TicketConfirmRequest,
    TicketReopenRequest,
    TicketLinkBugRequest,
    TicketListItemResponse,
    TicketDetailResponse,
    TicketListPaginationResponse,
    ServiceDashboardResponse,
    ServiceReportResponse,
)
from app.service.calculations import (
    generate_ticket_number,
    match_sla_policy,
    calculate_ticket_due_dates,
    update_ticket_sla_lifecycle,
    validate_status_transition,
    ensure_utc,
)

router = APIRouter()


@router.get("/service/status", tags=["Service & Support"])
@router.get("/extensions/service/status", tags=["Service & Support"])
def service_extension_status(db: Session = Depends(get_db)):
    total = db.query(Ticket).filter(Ticket.is_deleted == False).count()
    return {
        "module": "service_support",
        "status": "active",
        "version": "2.0",
        "total_tickets": total,
    }


# =====================================================================
# 1. SERVICE DASHBOARD & METRICS
# =====================================================================

@router.get("/service/dashboard", response_model=ServiceDashboardResponse, tags=["Service & Support"])
def get_service_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
):
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    # Base query of active tickets
    base_query = db.query(Ticket).filter(Ticket.is_deleted == False)

    all_tickets = base_query.all()

    # Dynamic SLA update for active tickets
    for t in all_tickets:
        update_ticket_sla_lifecycle(t, now)
    db.flush()

    total_open = 0
    new_today = 0
    unassigned = 0
    assigned = 0
    in_progress = 0
    waiting_customer = 0
    waiting_internal = 0
    resolved = 0
    customer_confirmation = 0
    closed = 0
    reopened = 0
    sla_at_risk = 0
    sla_breached = 0
    critical_count = 0
    high_count = 0
    completed_on_time = 0
    completed_total = 0

    recent_items = []
    at_risk_items = []

    for t in all_tickets:
        # Status counts
        if t.status in ("NEW", "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_INTERNAL", "REOPENED"):
            total_open += 1

        created_utc = ensure_utc(t.created_at)
        if created_utc and created_utc >= today_start:
            new_today += 1

        if not t.assigned_to_id and t.status in ("NEW", "OPEN"):
            unassigned += 1
        elif t.assigned_to_id and t.status == "ASSIGNED":
            assigned += 1

        if t.status == "IN_PROGRESS":
            in_progress += 1
        elif t.status == "WAITING_FOR_CUSTOMER":
            waiting_customer += 1
        elif t.status == "WAITING_FOR_INTERNAL":
            waiting_internal += 1
        elif t.status == "RESOLVED":
            resolved += 1
        elif t.status == "CUSTOMER_CONFIRMATION":
            customer_confirmation += 1
        elif t.status == "CLOSED":
            closed += 1
        elif t.status == "REOPENED":
            reopened += 1

        # SLA counts
        if t.sla_status == "AT_RISK":
            sla_at_risk += 1
            if len(at_risk_items) < 10:
                at_risk_items.append(_format_ticket_list_item(t))
        elif t.sla_status == "BREACHED" or t.sla_breached:
            sla_breached += 1

        # Severity & Priority
        if t.severity == "CRITICAL":
            critical_count += 1
        if t.priority in ("HIGH", "URGENT"):
            high_count += 1

        # Compliance
        if t.status in ("RESOLVED", "CUSTOMER_CONFIRMATION", "CLOSED"):
            completed_total += 1
            if not t.sla_breached:
                completed_on_time += 1

    # Sorted recent tickets
    sorted_recent = sorted(
        all_tickets,
        key=lambda x: ensure_utc(x.created_at) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True
    )[:10]
    recent_items = [_format_ticket_list_item(t) for t in sorted_recent]

    compliance_rate = round((completed_on_time / completed_total * 100), 1) if completed_total > 0 else 100.0

    priority_counts: Dict[str, int] = {}
    status_counts: Dict[str, int] = {}
    for t in all_tickets:
        p = t.priority or "MEDIUM"
        s = t.status or "NEW"
        priority_counts[p] = priority_counts.get(p, 0) + 1
        status_counts[s] = status_counts.get(s, 0) + 1

    return ServiceDashboardResponse(
        total_tickets=len(all_tickets),
        total_open_tickets=total_open,
        new_today=new_today,
        unassigned=unassigned,
        assigned=assigned,
        in_progress=in_progress,
        waiting_for_customer=waiting_customer,
        waiting_for_internal=waiting_internal,
        resolved=resolved,
        customer_confirmation=customer_confirmation,
        closed=closed,
        reopened=reopened,
        sla_at_risk=sla_at_risk,
        sla_breached=sla_breached,
        critical_tickets=critical_count,
        high_priority_tickets=high_count,
        sla_compliance_rate=compliance_rate,
        tickets_by_priority=priority_counts,
        tickets_by_status=status_counts,
        recent_tickets=recent_items,
        at_risk_tickets=at_risk_items,
    )


@router.get("/service/reports", response_model=ServiceReportResponse, tags=["Service & Support"])
def get_service_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view_reports")),
):
    tickets = db.query(Ticket).filter(Ticket.is_deleted == False).all()
    total = len(tickets)

    resolved_count = 0
    on_time_count = 0
    reopened_count = 0

    priority_map: Dict[str, int] = {}
    severity_map: Dict[str, int] = {}
    status_map: Dict[str, int] = {}
    category_map: Dict[str, int] = {}
    assignee_map: Dict[str, int] = {}
    company_map: Dict[str, int] = {}

    for t in tickets:
        priority_map[t.priority] = priority_map.get(t.priority, 0) + 1
        severity_map[t.severity] = severity_map.get(t.severity, 0) + 1
        status_map[t.status] = status_map.get(t.status, 0) + 1

        cat_name = t.category.name if t.category else "Uncategorized"
        category_map[cat_name] = category_map.get(cat_name, 0) + 1

        assignee_name = t.assigned_to.full_name if t.assigned_to else "Unassigned"
        assignee_map[assignee_name] = assignee_map.get(assignee_name, 0) + 1

        comp_name = t.company.organization_name if t.company else "Unknown"
        company_map[comp_name] = company_map.get(comp_name, 0) + 1

        if t.status in ("RESOLVED", "CUSTOMER_CONFIRMATION", "CLOSED"):
            resolved_count += 1
            if not t.sla_breached:
                on_time_count += 1

        if t.reopen_count > 0:
            reopened_count += 1

    res_rate = round((resolved_count / total * 100), 1) if total > 0 else 0.0
    comp_rate = round((on_time_count / resolved_count * 100), 1) if resolved_count > 0 else 100.0
    reopen_rate = round((reopened_count / total * 100), 1) if total > 0 else 0.0

    return ServiceReportResponse(
        total_tickets=total,
        resolution_rate=res_rate,
        sla_compliance_rate=comp_rate,
        reopened_rate=reopen_rate,
        tickets_by_priority=priority_map,
        tickets_by_severity=severity_map,
        tickets_by_status=status_map,
        tickets_by_category=category_map,
        tickets_by_assignee=assignee_map,
        tickets_by_company=company_map,
    )


# =====================================================================
# 2. CATEGORIES & SUBCATEGORIES MANAGEMENT
# =====================================================================

@router.get("/service/categories", response_model=List[ServiceCategoryResponse], tags=["Service & Support"])
def list_service_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
):
    return (
        db.query(ServiceCategory)
        .order_by(ServiceCategory.sort_order.asc(), ServiceCategory.name.asc())
        .all()
    )


@router.post("/service/categories", response_model=ServiceCategoryResponse, status_code=status.HTTP_201_CREATED, tags=["Service & Support"])
def create_service_category(
    data: ServiceCategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.manage_categories")),
):
    cat_data = data.model_dump()
    if not cat_data.get("code"):
        cat_data["code"] = re.sub(r"[^A-Z0-9]+", "_", data.name.upper()).strip("_")

    existing = db.query(ServiceCategory).filter(
        or_(ServiceCategory.name == data.name, ServiceCategory.code == cat_data["code"])
    ).first()
    if existing:
        return existing

    cat = ServiceCategory(**cat_data)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="SERVICE_CATEGORY",
        entity_id=cat.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=cat_data,
        request=request,
    )
    return cat


@router.put("/service/categories/{cat_id}", response_model=ServiceCategoryResponse, tags=["Service & Support"])
def update_service_category(
    cat_id: str,
    data: ServiceCategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.manage_categories")),
):
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    old_vals = {"name": cat.name, "code": cat.code, "is_active": cat.is_active}
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, val)

    db.commit()
    db.refresh(cat)
    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="SERVICE_CATEGORY",
        entity_id=cat.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=data.model_dump(exclude_unset=True),
        request=request,
    )
    return cat


@router.post("/service/categories/{cat_id}/subcategories", response_model=ServiceSubcategoryResponse, status_code=status.HTTP_201_CREATED, tags=["Service & Support"])
def create_service_subcategory(
    cat_id: str,
    data: ServiceSubcategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.manage_categories")),
):
    cat = db.query(ServiceCategory).filter(ServiceCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    sub_data = data.model_dump()
    if not sub_data.get("code"):
        sub_data["code"] = re.sub(r"[^A-Z0-9]+", "_", data.name.upper()).strip("_")

    existing_sub = db.query(ServiceSubcategory).filter(
        ServiceSubcategory.category_id == cat.id,
        or_(ServiceSubcategory.name == data.name, ServiceSubcategory.code == sub_data["code"])
    ).first()
    if existing_sub:
        return existing_sub

    sub = ServiceSubcategory(category_id=cat.id, **sub_data)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="SERVICE_SUBCATEGORY",
        entity_id=sub.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=sub_data,
        request=request,
    )
    return sub


# =====================================================================
# 3. SLA POLICIES MANAGEMENT
# =====================================================================

@router.get("/service/sla-policies", response_model=List[SLAPolicyResponse], tags=["Service & Support"])
def list_sla_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
):
    return db.query(SLAPolicy).order_by(SLAPolicy.resolution_minutes.asc()).all()


@router.post("/service/sla-policies", response_model=SLAPolicyResponse, status_code=status.HTTP_201_CREATED, tags=["Service & Support"])
def create_sla_policy(
    data: SLAPolicyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.manage_sla")),
):
    existing = db.query(SLAPolicy).filter(SLAPolicy.name == data.name).first()
    if existing:
        return existing

    dumped = data.model_dump()
    first_resp = dumped.get("first_response_target_minutes") or dumped.get("first_response_minutes") or 60
    res_min = dumped.get("resolution_target_minutes") or dumped.get("resolution_minutes") or 480
    policy_dict = {
        "name": data.name,
        "description": data.description,
        "priority": data.priority,
        "severity": data.severity,
        "first_response_minutes": first_resp,
        "resolution_minutes": res_min,
        "business_hours_only": data.business_hours_only,
        "active": data.active,
    }

    policy = SLAPolicy(**policy_dict)
    db.add(policy)
    db.commit()
    db.refresh(policy)
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="SLA_POLICY",
        entity_id=policy.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=policy_dict,
        request=request,
    )
    return policy


@router.put("/service/sla-policies/{policy_id}", response_model=SLAPolicyResponse, tags=["Service & Support"])
def update_sla_policy(
    policy_id: str,
    data: SLAPolicyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.manage_sla")),
):
    policy = db.query(SLAPolicy).filter(SLAPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="SLA Policy not found")

    old_vals = {"name": policy.name, "first_response_minutes": policy.first_response_minutes, "resolution_minutes": policy.resolution_minutes}
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(policy, field, val)

    db.commit()
    db.refresh(policy)
    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="SLA_POLICY",
        entity_id=policy.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=data.model_dump(exclude_unset=True),
        request=request,
    )
    return policy


# =====================================================================
# 4. TICKET LIST & CREATION
# =====================================================================

def _format_ticket_list_item(t: Ticket) -> TicketListItemResponse:
    rem_min = 0
    now = datetime.now(timezone.utc)
    due_utc = ensure_utc(t.due_at)
    if due_utc and t.status not in ("RESOLVED", "CUSTOMER_CONFIRMATION", "CLOSED"):
        rem_min = max(0, int((due_utc - now).total_seconds() / 60))

    return TicketListItemResponse(
        id=t.id,
        ticket_number=t.ticket_number,
        subject=t.subject,
        company_id=t.company_id,
        company_name=t.company.organization_name if t.company else "Unknown Company",
        contact_id=t.contact_id,
        contact_name=t.contact.name if t.contact else "Unknown Contact",
        category_name=t.category.name if t.category else None,
        subcategory_name=t.subcategory.name if t.subcategory else None,
        priority=t.priority,
        severity=t.severity,
        source=t.source,
        status=t.status,
        assigned_to_id=t.assigned_to_id,
        assigned_to_name=t.assigned_to.full_name if t.assigned_to else None,
        service_team_name=t.service_team.name if t.service_team else None,
        sla_status=t.sla_status,
        sla_breached=t.sla_breached,
        sla_policy_id=t.sla_policy_id,
        first_response_due_at=t.first_response_due_at,
        due_at=t.due_at,
        time_remaining_minutes=rem_min,
        created_at=t.created_at,
        updated_at=t.updated_at,
        reopen_count=t.reopen_count,
        is_escalated=t.is_escalated,
        project_id=t.project_id,
        project_number=t.project.project_number if t.project else None,
        linked_bug_id=t.linked_bug_id,
        linked_bug_number=t.linked_bug.bug_number if t.linked_bug else None,
    )


@router.get("/service/tickets", response_model=TicketListPaginationResponse, tags=["Service & Support"])
def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    severity: Optional[str] = None,
    sla_status: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    service_team_id: Optional[str] = None,
    company_id: Optional[str] = None,
    project_id: Optional[str] = None,
    category_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
):
    query = db.query(Ticket).filter(Ticket.is_deleted == False)

    # Search
    if search:
        s = f"%{search}%"
        query = query.join(Company, Ticket.company_id == Company.id).join(Contact, Ticket.contact_id == Contact.id).filter(
            or_(
                Ticket.ticket_number.ilike(s),
                Ticket.subject.ilike(s),
                Ticket.description.ilike(s),
                Company.organization_name.ilike(s),
                Contact.name.ilike(s),
            )
        )

    # Filters
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if severity:
        query = query.filter(Ticket.severity == severity)
    if sla_status:
        query = query.filter(Ticket.sla_status == sla_status)
    if assigned_to_id:
        query = query.filter(Ticket.assigned_to_id == assigned_to_id)
    if service_team_id:
        query = query.filter(Ticket.service_team_id == service_team_id)
    if company_id:
        query = query.filter(Ticket.company_id == company_id)
    if project_id:
        query = query.filter(Ticket.project_id == project_id)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)

    total = query.count()
    tickets = query.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # Dynamic SLA update
    now = datetime.now(timezone.utc)
    for t in tickets:
        update_ticket_sla_lifecycle(t, now)

    items = [_format_ticket_list_item(t) for t in tickets]
    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return TicketListPaginationResponse(
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        items=items,
    )


@router.post("/service/tickets", response_model=TicketDetailResponse, status_code=status.HTTP_201_CREATED, tags=["Service & Support"])
def create_ticket(
    data: TicketCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.create")),
):
    # 1. Validate Company
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # 2. Validate Contact belongs to Company
    contact = db.query(Contact).filter(
        Contact.id == data.contact_id,
        Contact.company_id == data.company_id,
        Contact.is_deleted == False
    ).first()
    if not contact:
        raise HTTPException(status_code=400, detail="Contact does not belong to the selected Company")

    # 3. Validate Project linkage if provided
    if data.project_id:
        project = db.query(Project).filter(Project.id == data.project_id, Project.is_deleted == False).first()
        if not project:
            raise HTTPException(status_code=404, detail="Linked Project not found")
        if project.company_id != data.company_id:
            raise HTTPException(status_code=400, detail="Linked Project does not belong to the specified Company")

    # 4. Generate Server-Side Ticket Number TKT-YYYY-XXXX
    ticket_number = generate_ticket_number(db)

    # 5. Match SLA Policy and compute due dates
    policy = match_sla_policy(db, priority=data.priority, severity=data.severity)
    created_at = datetime.now(timezone.utc)
    first_resp_due, res_due = calculate_ticket_due_dates(policy, created_at=created_at)

    ticket = Ticket(
        ticket_number=ticket_number,
        subject=data.subject,
        description=data.description,
        company_id=data.company_id,
        contact_id=data.contact_id,
        project_id=data.project_id,
        sales_order_id=data.sales_order_id,
        contract_id=data.contract_id,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        priority=data.priority,
        severity=data.severity,
        source=data.source,
        status="OPEN" if data.assigned_to_id else "NEW",
        assigned_to_id=data.assigned_to_id,
        assigned_by_id=current_user.id if data.assigned_to_id else None,
        assigned_at=created_at if data.assigned_to_id else None,
        service_team_id=data.service_team_id,
        created_by_id=current_user.id,
        sla_policy_id=policy.id if policy else None,
        first_response_due_at=first_resp_due,
        due_at=res_due,
        sla_status="ON_TRACK",
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(ticket)
    db.flush()

    # Record creation in Status History
    status_hist = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=None,
        new_status=ticket.status,
        changed_by_id=current_user.id,
        reason="Ticket created",
    )
    db.add(status_hist)

    # Record assignment history if assigned
    if data.assigned_to_id:
        assign_hist = TicketAssignment(
            ticket_id=ticket.id,
            assigned_to_id=data.assigned_to_id,
            assigned_by_id=current_user.id,
            team_id=data.service_team_id,
            notes="Initial ticket assignment",
        )
        db.add(assign_hist)
        if data.assigned_to_id != current_user.id:
            assignee_u = db.query(User).filter(User.id == data.assigned_to_id).first()
            if assignee_u:
                notify_ticket_assigned(db, ticket, assignee_u, current_user)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={
            "ticket_number": ticket_number,
            "subject": ticket.subject,
            "company_id": ticket.company_id,
            "priority": ticket.priority,
            "severity": ticket.severity,
        },
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


# =====================================================================
# 5. TICKET DETAIL, UPDATE & WORKFLOW
# =====================================================================

@router.get("/service/tickets/{ticket_id}", response_model=TicketDetailResponse, tags=["Service & Support"])
def get_ticket_detail(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["service.view", "crm.companies.view"])),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    now = datetime.now(timezone.utc)
    update_ticket_sla_lifecycle(ticket, now)
    db.flush()

    # Permission check for Internal Notes: strictly filter out unless permission present
    perms = current_user.get_permission_codes()
    can_view_internal_notes = "*" in perms or "service.view_internal_notes" in perms or "service.notes.view_internal" in perms

    comments_list = []
    for c in ticket.comments:
        if c.comment_type == "INTERNAL_NOTE" and not can_view_internal_notes:
            continue
        comments_list.append(
            TicketCommentResponse(
                id=c.id,
                ticket_id=c.ticket_id,
                user_id=c.user_id,
                user_name=c.user.full_name if c.user else "System",
                comment_type=c.comment_type,
                message=c.message,
                body=c.message,
                is_customer_visible=(c.comment_type != "INTERNAL_NOTE"),
                created_at=c.created_at,
            )
        )

    attachments_list = [
        TicketAttachmentResponse(
            id=a.id,
            ticket_id=a.ticket_id,
            filename=a.filename,
            file_name=a.filename,
            file_size=a.file_size,
            content_type=a.content_type,
            uploaded_by_id=a.uploaded_by_id,
            uploaded_by_name=a.uploaded_by.full_name if a.uploaded_by else "System",
            created_at=a.created_at,
        ) for a in ticket.attachments
    ]

    rem_min = 0
    due_utc = ensure_utc(ticket.due_at)
    if due_utc and ticket.status not in ("RESOLVED", "CUSTOMER_CONFIRMATION", "CLOSED"):
        rem_min = max(0, int((due_utc - now).total_seconds() / 60))

    return TicketDetailResponse(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        subject=ticket.subject,
        description=ticket.description,
        company_id=ticket.company_id,
        company_name=ticket.company.organization_name if ticket.company else "Unknown Company",
        company_code=ticket.company.code if ticket.company else None,
        contact_id=ticket.contact_id,
        contact_name=ticket.contact.name if ticket.contact else "Unknown Contact",
        contact_email=ticket.contact.email if ticket.contact else None,
        contact_phone=ticket.contact.phone if ticket.contact else None,
        project_id=ticket.project_id,
        project_name=ticket.project.name if ticket.project else None,
        project_number=ticket.project.project_number if ticket.project else None,
        sales_order_id=ticket.sales_order_id,
        sales_order_number=ticket.sales_order.order_number if ticket.sales_order else None,
        contract_id=ticket.contract_id,
        contract_number=ticket.contract.contract_number if ticket.contract else None,
        category_id=ticket.category_id,
        category_name=ticket.category.name if ticket.category else None,
        subcategory_id=ticket.subcategory_id,
        subcategory_name=ticket.subcategory.name if ticket.subcategory else None,
        priority=ticket.priority,
        severity=ticket.severity,
        source=ticket.source,
        status=ticket.status,
        assigned_to_id=ticket.assigned_to_id,
        assigned_to_name=ticket.assigned_to.full_name if ticket.assigned_to else None,
        assigned_by_name=ticket.assigned_by.full_name if ticket.assigned_by else None,
        assigned_at=ticket.assigned_at,
        service_team_id=ticket.service_team_id,
        service_team_name=ticket.service_team.name if ticket.service_team else None,
        created_by_id=ticket.created_by_id,
        created_by_name=ticket.created_by.full_name if ticket.created_by else None,
        sla_policy_id=ticket.sla_policy_id,
        sla_policy_name=ticket.sla_policy.name if ticket.sla_policy else None,
        first_response_at=ticket.first_response_at,
        first_responded_at=ticket.first_response_at,
        first_response_due_at=ticket.first_response_due_at,
        acknowledged_at=ticket.acknowledged_at,
        due_at=ticket.due_at,
        sla_status=ticket.sla_status,
        sla_breached=ticket.sla_breached,
        sla_breached_at=ticket.sla_breached_at,
        sla_paused_at=ticket.sla_paused_at,
        total_paused_minutes=ticket.total_paused_minutes,
        time_remaining_minutes=rem_min,
        is_escalated=ticket.is_escalated,
        escalation_level=ticket.escalation_level,
        escalation_reason=ticket.escalation_reason,
        escalated_to_name=ticket.escalated_to.full_name if ticket.escalated_to else None,
        escalated_at=ticket.escalated_at,
        resolution_summary=ticket.resolution_summary,
        resolved_at=ticket.resolved_at,
        resolved_by_name=ticket.resolved_by.full_name if ticket.resolved_by else None,
        customer_confirmed_at=ticket.customer_confirmed_at,
        customer_confirmed_by=ticket.customer_confirmed_by,
        closed_at=ticket.closed_at,
        closed_by_name=ticket.closed_by.full_name if ticket.closed_by else None,
        reopen_count=ticket.reopen_count,
        last_reopened_at=ticket.last_reopened_at,
        last_reopened_reason=ticket.last_reopened_reason,
        linked_bug_id=ticket.linked_bug_id,
        bug_id=ticket.linked_bug_id,
        linked_bug_number=ticket.linked_bug.bug_number if ticket.linked_bug else None,
        linked_bug_title=ticket.linked_bug.title if ticket.linked_bug else None,
        comments=comments_list,
        attachments=attachments_list,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.put("/service/tickets/{ticket_id}", response_model=TicketDetailResponse, tags=["Service & Support"])
def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_vals = {
        "subject": ticket.subject,
        "description": ticket.description,
        "category_id": ticket.category_id,
    }

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(ticket, field, val)

    ticket.updated_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=data.model_dump(exclude_unset=True),
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.patch("/service/tickets/{ticket_id}/status", response_model=TicketDetailResponse, tags=["Service & Support"])
def update_ticket_status(
    ticket_id: str,
    data: TicketStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_status = ticket.status
    new_status = data.status.upper()

    # Validate transition
    validate_status_transition(old_status, new_status)

    now = datetime.now(timezone.utc)

    # 1. Entering WAITING_FOR_CUSTOMER: Pause SLA
    if new_status == "WAITING_FOR_CUSTOMER" and old_status != "WAITING_FOR_CUSTOMER":
        ticket.sla_paused_at = now
        ticket.sla_status = "PAUSED"

    # 2. Resuming from WAITING_FOR_CUSTOMER: Resume SLA and extend due date
    if old_status == "WAITING_FOR_CUSTOMER" and new_status != "WAITING_FOR_CUSTOMER":
        if ticket.sla_paused_at:
            paused_at_utc = ensure_utc(ticket.sla_paused_at)
            paused_minutes = max(1, int((now - paused_at_utc).total_seconds() / 60))
            ticket.total_paused_minutes += paused_minutes
            due_utc = ensure_utc(ticket.due_at)
            if due_utc:
                ticket.due_at = due_utc + timedelta(minutes=paused_minutes)
            fr_due_utc = ensure_utc(ticket.first_response_due_at)
            if fr_due_utc and not ticket.first_response_at:
                ticket.first_response_due_at = fr_due_utc + timedelta(minutes=paused_minutes)
            ticket.sla_paused_at = None

    # Handle completion and reopen states
    if new_status == "CLOSED":
        ticket.closed_at = now
        ticket.closed_by_id = current_user.id
        update_ticket_sla_lifecycle(ticket, now)
    elif new_status == "RESOLVED":
        if not ticket.resolved_at:
            ticket.resolved_at = now
            ticket.resolved_by_id = current_user.id
        update_ticket_sla_lifecycle(ticket, now)
    elif new_status == "REOPENED":
        ticket.reopen_count += 1
        ticket.last_reopened_at = now
        ticket.closed_at = None
        ticket.closed_by_id = None

    ticket.status = new_status
    ticket.updated_at = now

    # Record status history
    hist = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=new_status,
        changed_by_id=current_user.id,
        reason=data.reason or f"Status transitioned to {new_status}",
    )
    db.add(hist)

    record_audit_log(
        db=db,
        action="STATUS_CHANGE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"status": old_status},
        new_values={"status": new_status, "reason": data.reason},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.post("/service/tickets/{ticket_id}/assign", response_model=TicketDetailResponse, tags=["Service & Support"])
@router.patch("/service/tickets/{ticket_id}/assignment", response_model=TicketDetailResponse, tags=["Service & Support"])
def update_ticket_assignment(
    ticket_id: str,
    data: TicketAssignmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.assign")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_assignee_id = ticket.assigned_to_id
    now = datetime.now(timezone.utc)

    if data.assigned_to_id:
        assignee = db.query(User).filter(User.id == data.assigned_to_id, User.is_active == True).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee user not found or inactive")
        ticket.assigned_to_id = assignee.id
        ticket.assigned_by_id = current_user.id
        ticket.assigned_at = now
        if ticket.status in ("NEW", "OPEN"):
            ticket.status = "ASSIGNED"
        if assignee.id != current_user.id:
            notify_ticket_assigned(db, ticket, assignee, current_user)
    else:
        ticket.assigned_to_id = None
        ticket.assigned_by_id = None
        ticket.assigned_at = None

    if data.service_team_id:
        team = db.query(Team).filter(Team.id == data.service_team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        ticket.service_team_id = team.id

    ticket.updated_at = now

    # Record in TicketAssignment history
    hist = TicketAssignment(
        ticket_id=ticket.id,
        assigned_to_id=ticket.assigned_to_id,
        assigned_by_id=current_user.id,
        team_id=ticket.service_team_id,
        notes=data.notes,
    )
    db.add(hist)

    record_audit_log(
        db=db,
        action="ASSIGN",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"assigned_to_id": old_assignee_id},
        new_values={"assigned_to_id": ticket.assigned_to_id, "team_id": ticket.service_team_id},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.patch("/service/tickets/{ticket_id}/priority", response_model=TicketDetailResponse, tags=["Service & Support"])
def update_ticket_priority(
    ticket_id: str,
    data: TicketPriorityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_priority = ticket.priority
    ticket.priority = data.priority.upper()

    # Recalculate SLA due dates
    policy = match_sla_policy(db, priority=ticket.priority, severity=ticket.severity)
    if policy:
        ticket.sla_policy_id = policy.id
        first_resp_due, res_due = calculate_ticket_due_dates(policy, created_at=ticket.created_at)
        ticket.first_response_due_at = first_resp_due
        ticket.due_at = res_due

    ticket.updated_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db,
        action="PRIORITY_CHANGE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"priority": old_priority},
        new_values={"priority": ticket.priority},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.patch("/service/tickets/{ticket_id}/severity", response_model=TicketDetailResponse, tags=["Service & Support"])
def update_ticket_severity(
    ticket_id: str,
    data: TicketSeverityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_severity = ticket.severity
    ticket.severity = data.severity.upper()

    # Recalculate SLA due dates
    policy = match_sla_policy(db, priority=ticket.priority, severity=ticket.severity)
    if policy:
        ticket.sla_policy_id = policy.id
        first_resp_due, res_due = calculate_ticket_due_dates(policy, created_at=ticket.created_at)
        ticket.first_response_due_at = first_resp_due
        ticket.due_at = res_due

    ticket.updated_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db,
        action="SEVERITY_CHANGE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"severity": old_severity},
        new_values={"severity": ticket.severity},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


# =====================================================================
# 6. RESOLUTION, CONFIRMATION, ESCALATION & REOPEN
# =====================================================================

@router.post("/service/tickets/{ticket_id}/resolve", response_model=TicketDetailResponse, tags=["Service & Support"])
def resolve_ticket(
    ticket_id: str,
    data: TicketResolveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.resolve")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not data.resolution_summary.strip():
        raise HTTPException(status_code=400, detail="Meaningful resolution summary is required to resolve ticket")

    old_status = ticket.status
    validate_status_transition(old_status, "RESOLVED")

    now = datetime.now(timezone.utc)
    ticket.status = "RESOLVED"
    ticket.resolution_summary = data.resolution_summary.strip()
    ticket.resolved_at = now
    ticket.resolved_by_id = current_user.id
    ticket.updated_at = now

    bug_to_link = data.linked_bug_id or data.bug_id
    if bug_to_link:
        bug = db.query(Bug).filter(Bug.id == bug_to_link).first()
        if bug:
            ticket.linked_bug_id = bug.id

    # Update SLA final state
    update_ticket_sla_lifecycle(ticket, now)

    # History
    hist = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status="RESOLVED",
        changed_by_id=current_user.id,
        reason=f"Resolved: {data.resolution_summary[:80]}",
    )
    db.add(hist)

    record_audit_log(
        db=db,
        action="RESOLVE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"resolution_summary": ticket.resolution_summary, "resolved_by": current_user.full_name},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.post("/service/tickets/{ticket_id}/confirm", response_model=TicketDetailResponse, tags=["Service & Support"])
def confirm_ticket_resolution(
    ticket_id: str,
    data: TicketConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_status = ticket.status
    now = datetime.now(timezone.utc)

    ticket.status = "CLOSED"
    ticket.customer_confirmed_at = now
    ticket.customer_confirmed_by = data.customer_confirmed_by or "Customer Representative"
    ticket.closed_at = now
    ticket.closed_by_id = current_user.id
    ticket.updated_at = now

    hist = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status="CLOSED",
        changed_by_id=current_user.id,
        reason=f"Customer confirmed by {ticket.customer_confirmed_by}",
    )
    db.add(hist)

    record_audit_log(
        db=db,
        action="CONFIRM_RESOLUTION",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"confirmed_by": ticket.customer_confirmed_by},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.post("/service/tickets/{ticket_id}/reopen", response_model=TicketDetailResponse, tags=["Service & Support"])
def reopen_ticket(
    ticket_id: str,
    data: TicketReopenRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.reopen")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not data.reason.strip():
        raise HTTPException(status_code=400, detail="Reopening reason is mandatory")

    old_status = ticket.status
    validate_status_transition(old_status, "REOPENED")

    now = datetime.now(timezone.utc)
    ticket.status = "REOPENED"
    ticket.reopen_count += 1
    ticket.last_reopened_at = now
    ticket.last_reopened_reason = data.reason.strip()
    ticket.closed_at = None
    ticket.closed_by_id = None
    ticket.updated_at = now

    hist = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status="REOPENED",
        changed_by_id=current_user.id,
        reason=f"Reopened (Count: {ticket.reopen_count}): {data.reason.strip()}",
    )
    db.add(hist)

    record_audit_log(
        db=db,
        action="REOPEN",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"reopen_count": ticket.reopen_count, "reason": data.reason},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.post("/service/tickets/{ticket_id}/close", response_model=TicketDetailResponse, tags=["Service & Support"])
def close_ticket(
    ticket_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.close")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_status = ticket.status
    validate_status_transition(old_status, "CLOSED")

    now = datetime.now(timezone.utc)
    ticket.status = "CLOSED"
    ticket.closed_at = now
    ticket.closed_by_id = current_user.id
    ticket.updated_at = now

    hist = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status="CLOSED",
        changed_by_id=current_user.id,
        reason="Ticket closed by authorized service representative",
    )
    db.add(hist)

    record_audit_log(
        db=db,
        action="CLOSE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"closed_by": current_user.full_name},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.post("/service/tickets/{ticket_id}/escalate", response_model=TicketDetailResponse, tags=["Service & Support"])
def escalate_ticket(
    ticket_id: str,
    data: TicketEscalateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["service.escalate", "service.edit"])),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    target_user = None
    if data.escalated_to_id:
        target_user = db.query(User).filter(User.id == data.escalated_to_id, User.is_active == True).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Escalation target user not found or inactive")
    else:
        target_user = current_user

    now = datetime.now(timezone.utc)
    ticket.is_escalated = True
    level_prefix = f"[{data.escalation_level}] " if data.escalation_level else ""
    ticket.escalation_reason = f"{level_prefix}{data.reason}"
    ticket.escalated_to_id = target_user.id
    ticket.escalated_at = now
    ticket.updated_at = now

    esc = TicketEscalation(
        ticket_id=ticket.id,
        escalated_by_id=current_user.id,
        escalated_to_id=target_user.id,
        reason=data.reason,
    )
    db.add(esc)

    record_audit_log(
        db=db,
        action="ESCALATE",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"escalated_to": target_user.full_name, "reason": data.reason, "level": data.escalation_level},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


@router.post("/service/tickets/{ticket_id}/link-bug", response_model=TicketDetailResponse, tags=["Service & Support"])
@router.patch("/service/tickets/{ticket_id}/link-bug", response_model=TicketDetailResponse, tags=["Service & Support"])
def link_existing_bug(
    ticket_id: str,
    data: TicketLinkBugRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    bug = db.query(Bug).filter(Bug.id == data.bug_id, Bug.is_deleted == False).first()
    if not bug:
        raise HTTPException(status_code=404, detail="QA Bug not found")

    ticket.linked_bug_id = bug.id
    ticket.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        action="LINK_BUG",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"bug_id": bug.id, "bug_number": bug.bug_number},
        request=request,
    )
    db.commit()
    db.refresh(ticket)
    return get_ticket_detail(ticket_id=ticket.id, db=db, current_user=current_user)


# =====================================================================
# 7. COMMENTS & INTERNAL NOTES
# =====================================================================

@router.post("/service/tickets/{ticket_id}/comments", response_model=TicketCommentResponse, status_code=status.HTTP_201_CREATED, tags=["Service & Support"])
def add_ticket_comment(
    ticket_id: str,
    data: TicketCommentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    perms = current_user.get_permission_codes()
    is_internal_note = data.comment_type.upper() == "INTERNAL_NOTE"

    if is_internal_note and ("*" not in perms and "service.view_internal_notes" not in perms and "service.notes.view_internal" not in perms):
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to create internal notes")

    now = datetime.now(timezone.utc)
    comment_text = (data.message or data.body or "").strip()
    comm = TicketComment(
        ticket_id=ticket.id,
        user_id=current_user.id,
        comment_type="INTERNAL_NOTE" if is_internal_note else "CUSTOMER_REPLY",
        message=comment_text,
        created_at=now,
    )
    db.add(comm)

    # If first response and was customer reply, record first_response_at
    if not is_internal_note and not ticket.first_response_at:
        ticket.first_response_at = now
        ticket.acknowledged_at = now

    ticket.updated_at = now
    record_audit_log(
        db=db,
        action="COMMENT",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"comment_type": comm.comment_type},
        request=request,
    )
    db.commit()
    db.refresh(comm)

    return TicketCommentResponse(
        id=comm.id,
        ticket_id=comm.ticket_id,
        user_id=comm.user_id,
        user_name=current_user.full_name,
        comment_type=comm.comment_type,
        message=comm.message,
        body=comm.message,
        is_customer_visible=(comm.comment_type != "INTERNAL_NOTE"),
        created_at=comm.created_at,
    )


@router.get("/service/tickets/{ticket_id}/comments", response_model=List[TicketCommentResponse], tags=["Service & Support"])
def list_ticket_comments(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    perms = current_user.get_permission_codes()
    can_view_internal_notes = "*" in perms or "service.view_internal_notes" in perms or "service.notes.view_internal" in perms

    results = []
    for c in ticket.comments:
        if c.comment_type == "INTERNAL_NOTE" and not can_view_internal_notes:
            continue
        results.append(
            TicketCommentResponse(
                id=c.id,
                ticket_id=c.ticket_id,
                user_id=c.user_id,
                user_name=c.user.full_name if c.user else "System",
                comment_type=c.comment_type,
                message=c.message,
                body=c.message,
                is_customer_visible=(c.comment_type != "INTERNAL_NOTE"),
                created_at=c.created_at,
            )
        )
    return results


# =====================================================================
# 8. ATTACHMENTS (UPLOAD & AUTHENTICATED DOWNLOAD)
# =====================================================================

@router.post("/service/tickets/{ticket_id}/attachments", response_model=TicketAttachmentResponse, tags=["Service & Support"])
async def upload_ticket_attachment(
    ticket_id: str,
    file: UploadFile = File(...),
    is_internal_only: Optional[str] = Form(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.edit")),
    storage: StorageBackend = Depends(get_storage_backend),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    file_bytes = await file.read()
    max_size = 10 * 1024 * 1024  # 10MB limit

    service_allowed_exts = {
        ".png", ".jpg", ".jpeg", ".pdf", ".txt", ".log", ".json", ".zip", ".csv", ".docx", ".xlsx"
    }

    storage_res = storage.upload(
        file_bytes=file_bytes,
        filename=file.filename or "attachment",
        content_type=file.content_type or "application/octet-stream",
        prefix=f"tickets/{ticket.id}",
        max_size_bytes=max_size,
        allowed_extensions=service_allowed_exts,
    )

    att = TicketAttachment(
        ticket_id=ticket.id,
        filename=storage_res.filename,
        file_size=storage_res.size,
        content_type=storage_res.content_type,
        file_path=storage_res.key,
        uploaded_by_id=current_user.id,
    )
    db.add(att)
    ticket.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        action="ATTACHMENT_UPLOAD",
        entity_type="TICKET",
        entity_id=ticket.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"filename": storage_res.filename, "size": storage_res.size, "key": storage_res.key},
        request=request,
    )
    db.commit()
    db.refresh(att)

    return TicketAttachmentResponse(
        id=att.id,
        ticket_id=att.ticket_id,
        filename=att.filename,
        file_name=att.filename,
        file_size=att.file_size,
        content_type=att.content_type,
        uploaded_by_id=att.uploaded_by_id,
        uploaded_by_name=current_user.full_name,
        created_at=att.created_at,
    )


@router.get("/service/tickets/{ticket_id}/attachments/{attachment_id}/download", tags=["Service & Support"])
def download_ticket_attachment(
    ticket_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
    storage: StorageBackend = Depends(get_storage_backend),
):
    att = db.query(TicketAttachment).filter(
        TicketAttachment.id == attachment_id,
        TicketAttachment.ticket_id == ticket_id,
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not storage.exists(att.file_path):
        raise HTTPException(status_code=404, detail="Attachment file not found on server storage")

    try:
        stream, content_type, size = storage.get_stream(att.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Attachment file not found on server storage")

    return StreamingResponse(
        stream,
        media_type=att.content_type or content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{att.filename}"',
            "Content-Length": str(att.file_size or size),
        },
    )


# =====================================================================
# 9. TIMELINE
# =====================================================================

@router.get("/service/tickets/{ticket_id}/timeline", response_model=List[TicketTimelineItem], tags=["Service & Support"])
def get_ticket_timeline(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.view")),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.is_deleted == False).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    perms = current_user.get_permission_codes()
    can_view_internal_notes = "*" in perms or "service.view_internal_notes" in perms

    timeline: List[TicketTimelineItem] = []

    # 1. Creation event
    timeline.append(
        TicketTimelineItem(
            id=f"create-{ticket.id}",
            type="create",
            title=f"Ticket Created: {ticket.ticket_number}",
            description=f"Subject: {ticket.subject} (Priority: {ticket.priority}, Severity: {ticket.severity})",
            author_name=ticket.created_by.full_name if ticket.created_by else "Customer",
            timestamp=ticket.created_at,
        )
    )

    # 2. Status History
    for sh in ticket.status_history:
        timeline.append(
            TicketTimelineItem(
                id=f"status-{sh.id}",
                type="status_change",
                title=f"Status changed to {sh.new_status}",
                description=sh.reason,
                author_name=sh.changed_by.full_name if sh.changed_by else "System",
                timestamp=sh.created_at,
                metadata={"old_status": sh.old_status, "new_status": sh.new_status},
            )
        )

    # 3. Assignment History
    for ah in ticket.assignments:
        timeline.append(
            TicketTimelineItem(
                id=f"assign-{ah.id}",
                type="assignment",
                title=f"Assigned to {ah.assigned_to.full_name if ah.assigned_to else 'Unassigned'}",
                description=ah.notes,
                author_name=ah.assigned_by.full_name if ah.assigned_by else "System",
                timestamp=ah.created_at,
            )
        )

    # 4. Escalations
    for esc in ticket.escalations:
        timeline.append(
            TicketTimelineItem(
                id=f"esc-{esc.id}",
                type="escalation",
                title=f"Escalated to {esc.escalated_to.full_name if esc.escalated_to else 'Internal Team'}",
                description=esc.reason,
                author_name=esc.escalated_by.full_name if esc.escalated_by else "System",
                timestamp=esc.created_at,
            )
        )

    # 5. Comments
    for comm in ticket.comments:
        if comm.comment_type == "INTERNAL_NOTE" and not can_view_internal_notes:
            continue
        timeline.append(
            TicketTimelineItem(
                id=f"comm-{comm.id}",
                type="comment",
                title=f"{'Internal Note' if comm.comment_type == 'INTERNAL_NOTE' else 'Customer Reply'}",
                description=comm.message,
                author_name=comm.user.full_name if comm.user else "User",
                timestamp=comm.created_at,
                metadata={"comment_type": comm.comment_type},
            )
        )

    # 6. Attachments
    for att in ticket.attachments:
        timeline.append(
            TicketTimelineItem(
                id=f"att-{att.id}",
                type="attachment",
                title=f"Attachment Uploaded: {att.filename}",
                description=f"File size: {round(att.file_size / 1024, 1)} KB",
                author_name=att.uploaded_by.full_name if att.uploaded_by else "User",
                timestamp=att.created_at,
            )
        )

    timeline.sort(key=lambda x: x.timestamp, reverse=True)
    return timeline


# =====================================================================
# 10. EXPORT
# =====================================================================

@router.get("/service/export", tags=["Service & Support"])
def export_tickets_csv(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service.export")),
):
    query = db.query(Ticket).filter(Ticket.is_deleted == False)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if severity:
        query = query.filter(Ticket.severity == severity)

    tickets = query.order_by(Ticket.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Ticket Number", "Subject", "Status", "Company", "Contact", "Category",
        "Priority", "Severity", "Source", "Assignee",
        "SLA Status", "SLA Breached", "Due At", "Created At", "Resolved At", "Closed At"
    ])

    for t in tickets:
        writer.writerow([
            t.ticket_number,
            t.subject,
            t.status,
            t.company.organization_name if t.company else "",
            t.contact.name if t.contact else "",
            t.category.name if t.category else "",
            t.priority,
            t.severity,
            t.source,
            t.assigned_to.full_name if t.assigned_to else "Unassigned",
            t.sla_status,
            "Yes" if t.sla_breached else "No",
            t.due_at.isoformat() if t.due_at else "",
            t.created_at.isoformat() if t.created_at else "",
            t.resolved_at.isoformat() if t.resolved_at else "",
            t.closed_at.isoformat() if t.closed_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=service_tickets_{datetime.now().strftime('%Y%m%d')}.csv"},
    )
