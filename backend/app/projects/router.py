from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.audit import record_audit_log
from app.users.models import User
from app.organizations.models import Company
from app.sales.models import SalesOrder, Contract
from app.sales.calculations import generate_sequential_number
from app.projects.models import Project, ProjectMember, Milestone, ProjectTask
from app.projects.calculations import recalculate_project_progress, validate_project_delivery_readiness
from app.projects.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse, ProjectDeliveryRequest,
    ProjectFromSalesOrderCreate,
    ProjectMemberCreate, ProjectMemberResponse,
    MilestoneCreate, MilestoneUpdate, MilestoneResponse,
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskStatusUpdate, ProjectTaskResponse,
)
from app.qa.models import TestSuite, TestCase, Bug

router = APIRouter()

@router.get("/projects/status")
def projects_extension_status():
    """Module extension point for Phase 3: Project Management & Milestone Tracking."""
    return {"module": "projects", "status": "active", "version": "2.0"}


# Helper formatter for ProjectResponse
def _format_project_response(p: Project) -> ProjectResponse:
    res = ProjectResponse.model_validate(p)
    res.progress_percentage = float(p.progress_percentage)
    res.budget = float(p.budget)
    res.company_name = p.company.organization_name if p.company else None
    res.sales_order_number = p.sales_order.order_number if p.sales_order else None
    res.contract_number = p.contract.contract_number if p.contract else None
    res.project_manager_name = p.project_manager.full_name if p.project_manager else None
    res.creator_name = p.created_by.full_name if p.created_by else None
    return res


# =====================================================================
# 1. PROJECTS CRUD & SALES ORDER HANDOFF
# =====================================================================

@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    project_manager_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.view")),
):
    query = db.query(Project).filter(Project.is_deleted == False)
    if company_id:
        query = query.filter(Project.company_id == company_id)
    if status:
        query = query.filter(Project.status == status)
    if project_manager_id:
        query = query.filter(Project.project_manager_id == project_manager_id)
    if search:
        s = f"%{search}%"
        query = query.filter((Project.name.ilike(s)) | (Project.project_number.ilike(s)))

    projects = query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_project_response(p) for p in projects]


@router.post("/projects", response_model=ProjectResponse)
def create_project(
    data: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.create")),
):
    # Validate company
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Validate cross-company integrity if sales order provided
    if data.sales_order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id, SalesOrder.is_deleted == False).first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales Order not found")
        if so.company_id != data.company_id:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid cross-company reference: Sales Order belongs to company '{so.company_id}', but project is for '{data.company_id}'"
            )
        # Duplicate project prevention
        existing = db.query(Project).filter(
            Project.sales_order_id == data.sales_order_id,
            Project.is_deleted == False,
            Project.status != "CANCELLED"
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"An active project '{existing.project_number}' already exists for Sales Order '{so.order_number}'"
            )

    project_number = generate_sequential_number(db, entity_type="project", prefix="PRJ")
    project = Project(
        project_number=project_number,
        name=data.name,
        description=data.description,
        company_id=data.company_id,
        sales_order_id=data.sales_order_id,
        contract_id=data.contract_id,
        project_manager_id=data.project_manager_id,
        status=data.status,
        priority=data.priority,
        start_date=data.start_date or date.today(),
        target_date=data.target_date,
        budget=data.budget,
        notes=data.notes,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(project)
    db.flush()

    # If PM assigned, automatically add to project members
    if data.project_manager_id:
        pm_member = ProjectMember(
            project_id=project.id,
            user_id=data.project_manager_id,
            role="Project Manager",
            active=True,
        )
        db.add(pm_member)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="PROJECT",
        entity_id=project.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"project_number": project_number, "name": project.name, "company_id": project.company_id},
        request=request,
    )
    db.commit()
    db.refresh(project)
    return _format_project_response(project)


@router.post("/projects/from-sales-order", response_model=ProjectResponse)
def create_project_from_sales_order(
    data: ProjectFromSalesOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.create")),
):
    """
    Executes the Sales Order -> Project handoff.
    Inherits Company, Contract, Budget, and Scope from confirmed Sales Order.
    """
    so = db.query(SalesOrder).filter(SalesOrder.id == data.sales_order_id, SalesOrder.is_deleted == False).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    if so.status != "Confirmed":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot initiate project from Sales Order in '{so.status}' status. Order must be 'Confirmed'."
        )

    # Check for existing project for this sales order
    existing = db.query(Project).filter(
        Project.sales_order_id == so.id,
        Project.is_deleted == False,
        Project.status != "CANCELLED"
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An active project '{existing.project_number}' already exists for Sales Order '{so.order_number}'"
        )

    project_name = data.name or f"Implementation - {so.company.organization_name if so.company else 'Company'}"
    project_number = generate_sequential_number(db, entity_type="project", prefix="PRJ")

    project = Project(
        project_number=project_number,
        name=project_name,
        description=f"Generated from confirmed Sales Order {so.order_number}. Scope covers {len(so.items)} deliverable line items.",
        company_id=so.company_id,
        sales_order_id=so.id,
        contract_id=so.contract_id,
        project_manager_id=data.project_manager_id,
        status="ACTIVE",
        priority="HIGH",
        start_date=date.today(),
        target_date=data.target_date,
        budget=float(so.total_amount),
        notes=data.notes or so.notes,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(project)
    db.flush()

    # Automatically create initial implementation milestones based on sales order deliverables
    default_milestones = [
        ("Phase 1: Kickoff & Campus IT Discovery", "Stakeholder requirements signoff and environment discovery", 1),
        ("Phase 2: Platform Deployment & Integration", "SIS/LMS connectors, database setup, and user sync", 2),
        ("Phase 3: User Acceptance Testing (UAT)", "College administrative and faculty validation testing", 3),
        ("Phase 4: Campus Go-Live & Handover", "Production launch, training signoff, and operational handover", 4),
    ]
    for m_name, m_desc, m_seq in default_milestones:
        ms = Milestone(
            project_id=project.id,
            name=m_name,
            description=m_desc,
            sequence=m_seq,
            status="NOT_STARTED",
        )
        db.add(ms)

    if data.project_manager_id:
        pm_member = ProjectMember(
            project_id=project.id,
            user_id=data.project_manager_id,
            role="Project Manager",
            active=True,
        )
        db.add(pm_member)

    record_audit_log(
        db=db,
        action="CREATE_FROM_SALES_ORDER",
        entity_type="PROJECT",
        entity_id=project.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"project_number": project_number, "sales_order_id": so.id, "company_id": so.company_id},
        request=request,
    )
    db.commit()
    db.refresh(project)
    return _format_project_response(project)


@router.get("/projects/{project_id}", response_model=ProjectDetailResponse)
def get_project_360(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.view")),
):
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    base_res = _format_project_response(p)
    detail_res = ProjectDetailResponse(**base_res.model_dump())

    # Format Members
    members_resp = []
    for m in p.members:
        if m.active:
            m_resp = ProjectMemberResponse.model_validate(m)
            m_resp.user_name = m.user.full_name if m.user else None
            m_resp.user_email = m.user.email if m.user else None
            members_resp.append(m_resp)
    detail_res.members = members_resp

    # Format Milestones
    milestones_resp = []
    for ms in p.milestones:
        m_r = MilestoneResponse.model_validate(ms)
        m_r.completion_percentage = float(ms.completion_percentage)
        milestones_resp.append(m_r)
    detail_res.milestones = milestones_resp

    # Format Tasks
    tasks_resp = []
    for t in p.tasks:
        if not t.is_deleted:
            t_r = ProjectTaskResponse.model_validate(t)
            t_r.estimated_hours = float(t.estimated_hours)
            t_r.actual_hours = float(t.actual_hours)
            t_r.milestone_name = t.milestone.name if t.milestone else None
            t_r.assigned_to_name = t.assigned_to.full_name if t.assigned_to else None
            t_r.created_by_name = t.created_by.full_name if t.created_by else None
            tasks_resp.append(t_r)
    detail_res.tasks = tasks_resp

    # Delivery Readiness
    detail_res.delivery_readiness = validate_project_delivery_readiness(db, p.id)

    # QA Summary
    test_cases = db.query(TestCase).filter(TestCase.project_id == p.id).all()
    detail_res.qa_summary = {
        "total_test_cases": len(test_cases),
        "passed": sum(1 for tc in test_cases if tc.status == "PASSED"),
        "failed": sum(1 for tc in test_cases if tc.status == "FAILED"),
        "blocked": sum(1 for tc in test_cases if tc.status == "BLOCKED"),
        "not_executed": sum(1 for tc in test_cases if tc.status in ["NOT_EXECUTED", "DRAFT", "READY"]),
    }

    # Bugs Summary
    bugs = db.query(Bug).filter(Bug.project_id == p.id, Bug.is_deleted == False).all()
    detail_res.bugs_summary = {
        "total_bugs": len(bugs),
        "open": sum(1 for b in bugs if b.status in ["OPEN", "ASSIGNED", "IN_PROGRESS"]),
        "resolved": sum(1 for b in bugs if b.status == "RESOLVED"),
        "retest": sum(1 for b in bugs if b.status == "RETEST"),
        "closed": sum(1 for b in bugs if b.status in ["CLOSED", "WONT_FIX"]),
        "critical": sum(1 for b in bugs if b.severity == "CRITICAL" and b.status not in ["CLOSED", "WONT_FIX"]),
    }

    return detail_res


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    data: ProjectUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
):
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    old_vals = {k: getattr(p, k) for k in data.model_dump(exclude_unset=True).keys()}
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    p.updated_by_id = current_user.id

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="PROJECT",
        entity_id=p.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(p)
    return _format_project_response(p)


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.delete")),
):
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    p.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="PROJECT",
        entity_id=p.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": f"Project '{p.project_number}' deleted"}


# =====================================================================
# 2. PROJECT MEMBERS / TEAM ASSIGNMENT
# =====================================================================

@router.post("/projects/{project_id}/members", response_model=ProjectMemberResponse)
def add_project_member(
    project_id: str,
    data: ProjectMemberCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.assign")),
):
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    user = db.query(User).filter(User.id == data.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check existing member
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == data.user_id,
        ProjectMember.active == True
    ).first()
    if existing:
        existing.role = data.role
        db.commit()
        db.refresh(existing)
        res = ProjectMemberResponse.model_validate(existing)
        res.user_name = user.full_name
        res.user_email = user.email
        return res

    member = ProjectMember(
        project_id=project_id,
        user_id=data.user_id,
        role=data.role,
        active=True,
    )
    db.add(member)
    record_audit_log(
        db=db,
        action="ASSIGN_MEMBER",
        entity_type="PROJECT_MEMBER",
        entity_id=member.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"project_id": project_id, "user_id": data.user_id, "role": data.role},
        request=request,
    )
    db.commit()
    db.refresh(member)
    res = ProjectMemberResponse.model_validate(member)
    res.user_name = user.full_name
    res.user_email = user.email
    return res


@router.delete("/projects/{project_id}/members/{user_id}")
def remove_project_member(
    project_id: str,
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.assign")),
):
    m = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
        ProjectMember.active == True
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Active project member assignment not found")

    m.active = False
    m.removed_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db,
        action="REMOVE_MEMBER",
        entity_type="PROJECT_MEMBER",
        entity_id=m.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Project member removed"}


# =====================================================================
# 3. MILESTONES
# =====================================================================

@router.post("/projects/{project_id}/milestones", response_model=MilestoneResponse)
def create_milestone(
    project_id: str,
    data: MilestoneCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.manage")),
):
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    ms = Milestone(
        project_id=project_id,
        name=data.name,
        description=data.description,
        sequence=data.sequence,
        status=data.status,
        start_date=data.start_date,
        due_date=data.due_date,
    )
    db.add(ms)
    db.flush()
    recalculate_project_progress(db, project_id)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="MILESTONE",
        entity_id=ms.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"project_id": project_id, "name": ms.name},
        request=request,
    )
    db.commit()
    db.refresh(ms)
    r = MilestoneResponse.model_validate(ms)
    r.completion_percentage = float(ms.completion_percentage)
    return r


@router.put("/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_milestone(
    milestone_id: str,
    data: MilestoneUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.manage")),
):
    ms = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ms, k, v)

    if data.status == "COMPLETED" and not ms.completed_at:
        ms.completed_at = datetime.now(timezone.utc)
        ms.completion_percentage = 100.00
    elif data.status and data.status != "COMPLETED":
        ms.completed_at = None

    db.flush()
    recalculate_project_progress(db, ms.project_id)
    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="MILESTONE",
        entity_id=ms.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(ms)
    r = MilestoneResponse.model_validate(ms)
    r.completion_percentage = float(ms.completion_percentage)
    return r


@router.delete("/milestones/{milestone_id}")
def delete_milestone(
    milestone_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.manage")),
):
    ms = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")

    project_id = ms.project_id
    db.delete(ms)
    db.flush()
    recalculate_project_progress(db, project_id)
    db.commit()
    return {"message": "Milestone deleted"}


# =====================================================================
# 4. PROJECT TASKS
# =====================================================================

@router.post("/projects/{project_id}/tasks", response_model=ProjectTaskResponse)
def create_project_task(
    project_id: str,
    data: ProjectTaskCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.create")),
):
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    task_number = generate_sequential_number(db, entity_type="task", prefix="TSK")
    task = ProjectTask(
        task_number=task_number,
        project_id=project_id,
        milestone_id=data.milestone_id,
        title=data.title,
        description=data.description,
        assigned_to_id=data.assigned_to_id,
        created_by_id=current_user.id,
        status=data.status,
        priority=data.priority,
        estimated_hours=data.estimated_hours,
        actual_hours=data.actual_hours,
        start_date=data.start_date,
        due_date=data.due_date,
    )
    db.add(task)
    db.flush()
    recalculate_project_progress(db, project_id)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="PROJECT_TASK",
        entity_id=task.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"task_number": task_number, "title": task.title, "project_id": project_id},
        request=request,
    )
    db.commit()
    db.refresh(task)

    r = ProjectTaskResponse.model_validate(task)
    r.estimated_hours = float(task.estimated_hours)
    r.actual_hours = float(task.actual_hours)
    r.assigned_to_name = task.assigned_to.full_name if task.assigned_to else None
    r.created_by_name = current_user.full_name
    r.milestone_name = task.milestone.name if task.milestone else None
    return r


@router.put("/tasks/{task_id}", response_model=ProjectTaskResponse)
def update_project_task(
    task_id: str,
    data: ProjectTaskUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.edit")),
):
    t = db.query(ProjectTask).filter(ProjectTask.id == task_id, ProjectTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)

    if data.status == "COMPLETED" and not t.completed_at:
        t.completed_at = datetime.now(timezone.utc)
    elif data.status and data.status != "COMPLETED":
        t.completed_at = None

    db.flush()
    recalculate_project_progress(db, t.project_id)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="PROJECT_TASK",
        entity_id=t.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(t)

    r = ProjectTaskResponse.model_validate(t)
    r.estimated_hours = float(t.estimated_hours)
    r.actual_hours = float(t.actual_hours)
    r.assigned_to_name = t.assigned_to.full_name if t.assigned_to else None
    r.created_by_name = t.created_by.full_name if t.created_by else None
    r.milestone_name = t.milestone.name if t.milestone else None
    return r


@router.patch("/tasks/{task_id}/status", response_model=ProjectTaskResponse)
def update_task_status(
    task_id: str,
    payload: ProjectTaskStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.edit")),
):
    t = db.query(ProjectTask).filter(ProjectTask.id == task_id, ProjectTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = t.status
    t.status = payload.status
    if payload.status == "COMPLETED":
        t.completed_at = datetime.now(timezone.utc)
    else:
        t.completed_at = None

    db.flush()
    recalculate_project_progress(db, t.project_id)

    record_audit_log(
        db=db,
        action="STATUS_CHANGE",
        entity_type="PROJECT_TASK",
        entity_id=t.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"status": old_status},
        new_values={"status": payload.status},
        request=request,
    )
    db.commit()
    db.refresh(t)

    r = ProjectTaskResponse.model_validate(t)
    r.estimated_hours = float(t.estimated_hours)
    r.actual_hours = float(t.actual_hours)
    r.assigned_to_name = t.assigned_to.full_name if t.assigned_to else None
    r.created_by_name = t.created_by.full_name if t.created_by else None
    r.milestone_name = t.milestone.name if t.milestone else None
    return r


@router.delete("/tasks/{task_id}")
def delete_project_task(
    task_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.manage")),
):
    t = db.query(ProjectTask).filter(ProjectTask.id == task_id, ProjectTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    project_id = t.project_id
    t.soft_delete()
    db.flush()
    recalculate_project_progress(db, project_id)

    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="PROJECT_TASK",
        entity_id=t.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Task deleted"}


# =====================================================================
# 5. DELIVERY WORKFLOW & QA GATING
# =====================================================================

@router.post("/projects/{project_id}/delivery", response_model=ProjectResponse)
def execute_project_delivery(
    project_id: str,
    payload: ProjectDeliveryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delivery.manage")),
):
    """
    Executes controlled project delivery stage transitions:
    READY_FOR_DELIVERY, DELIVERED, COMPLETED.
    Enforces QA gating: blocks completion if critical bugs or failed tests remain,
    unless authorized override is explicitly declared with justification.
    """
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    valid_targets = ["READY_FOR_DELIVERY", "DELIVERED", "COMPLETED", "IN_QA", "ACTIVE"]
    if payload.status not in valid_targets:
        raise HTTPException(status_code=400, detail=f"Invalid target delivery status '{payload.status}'")

    # If attempting delivery or completion, check QA Gate
    if payload.status in ["READY_FOR_DELIVERY", "DELIVERED", "COMPLETED"]:
        readiness = validate_project_delivery_readiness(db, p.id)
        if not readiness["is_ready"]:
            if not payload.override_qa:
                reasons_str = "; ".join(readiness["reasons"])
                raise HTTPException(
                    status_code=400,
                    detail=f"QA Delivery Gate Blocked: {reasons_str}. Resolve issues or supply authorized override."
                )
            if not payload.override_reason:
                raise HTTPException(
                    status_code=400,
                    detail="Override justification reason must be documented when bypassing QA gating."
                )

    old_status = p.status
    p.status = payload.status
    if payload.status == "COMPLETED":
        p.actual_completion_date = date.today()
        p.progress_percentage = 100.00
    p.updated_by_id = current_user.id

    record_audit_log(
        db=db,
        action="DELIVERY_TRANSITION",
        entity_type="PROJECT",
        entity_id=p.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"status": old_status},
        new_values={
            "status": payload.status,
            "override_qa": payload.override_qa,
            "override_reason": payload.override_reason,
            "notes": payload.completion_notes,
        },
        request=request,
    )
    db.commit()
    db.refresh(p)
    return _format_project_response(p)
