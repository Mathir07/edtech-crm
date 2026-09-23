from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.audit import record_audit_log
from app.users.models import User
from app.crm.models import Lead
from app.organizations.models import Company, Contact
from app.sales.models import Opportunity
from app.activities.models import Activity, Task, Meeting, Note
from app.activities.schemas import (
    ActivityResponse, ActivityCreate, ActivityUpdate,
    TaskResponse, TaskCreate, TaskUpdate,
    MeetingResponse, MeetingCreate,
    NoteResponse, NoteCreate,
)

router = APIRouter()

def resolve_entity_name(db: Session, entity_type: str, entity_id: str) -> Optional[str]:
    if not entity_type or not entity_id:
        return None
    t = entity_type.lower()
    if t == "lead":
        l = db.query(Lead).filter(Lead.id == entity_id).first()
        return l.title if l else None
    elif t in ["company", "organization"]:
        c = db.query(Company).filter(Company.id == entity_id).first()
        return c.organization_name if c else None
    elif t == "contact":
        con = db.query(Contact).filter(Contact.id == entity_id).first()
        return con.name if con else None
    elif t in ["opportunity", "deal"]:
        o = db.query(Opportunity).filter(Opportunity.id == entity_id).first()
        return o.title if o else None
    return None

# --- ACTIVITIES ---

@router.get("/activities", response_model=List[ActivityResponse])
def list_activities(
    scope: Optional[str] = Query(None, description="today, upcoming, overdue, completed, mine"),
    type: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    query = db.query(Activity)
    now = datetime.now(timezone.utc)

    if scope == "today":
        start_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_day = start_day + timedelta(days=1)
        query = query.filter(Activity.due_at >= start_day, Activity.due_at < end_day)
    elif scope == "upcoming":
        query = query.filter(Activity.due_at > now, Activity.is_completed == False)
    elif scope == "overdue":
        query = query.filter(Activity.due_at < now, Activity.is_completed == False)
    elif scope == "completed":
        query = query.filter(Activity.is_completed == True)
    elif scope == "mine":
        query = query.filter(Activity.assigned_to_id == current_user.id)

    if type:
        query = query.filter(Activity.type == type)
    if related_entity_type:
        query = query.filter(Activity.related_entity_type == related_entity_type)
    if related_entity_id:
        query = query.filter(Activity.related_entity_id == related_entity_id)
    if search:
        s = f"%{search}%"
        query = query.filter((Activity.subject.ilike(s)) | (Activity.description.ilike(s)))

    activities = query.order_by(Activity.due_at.asc()).limit(150).all()

    result = []
    for a in activities:
        r = ActivityResponse.model_validate(a)
        r.assigned_to_name = a.assigned_to.full_name if a.assigned_to else None
        r.created_by_name = a.created_by.full_name if a.created_by else None
        r.related_entity_name = resolve_entity_name(db, a.related_entity_type, a.related_entity_id)
        result.append(r)
    return result

@router.post("/activities", response_model=ActivityResponse)
def create_activity(
    data: ActivityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    act = Activity(
        **data.model_dump(),
        created_by_id=current_user.id,
    )
    if not act.assigned_to_id:
        act.assigned_to_id = current_user.id

    # If activity is associated with a Lead, update lead.last_activity_at and next_action/next_follow_up_date
    if act.related_entity_type and act.related_entity_type.lower() == "lead" and act.related_entity_id:
        lead = db.query(Lead).filter(Lead.id == act.related_entity_id, Lead.is_deleted == False).first()
        if lead:
            lead.last_activity_at = datetime.now(timezone.utc)
            if act.type.lower() == "follow-up" or "follow" in act.type.lower():
                if act.subject:
                    lead.next_action = act.subject
                if act.due_at:
                    lead.next_follow_up_date = act.due_at

    db.add(act)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="ACTIVITY",
        entity_id=act.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(act)

    r = ActivityResponse.model_validate(act)
    r.assigned_to_name = act.assigned_to.full_name if act.assigned_to else None
    r.created_by_name = act.created_by.full_name if act.created_by else None
    r.related_entity_name = resolve_entity_name(db, act.related_entity_type, act.related_entity_id)
    return r

@router.patch("/activities/{activity_id}/complete", response_model=ActivityResponse)
def mark_activity_complete(
    activity_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")

    act.is_completed = True
    act.completed_at = datetime.now(timezone.utc)

    # If activity is associated with a Lead, update lead.last_activity_at
    if act.related_entity_type and act.related_entity_type.lower() == "lead" and act.related_entity_id:
        lead = db.query(Lead).filter(Lead.id == act.related_entity_id, Lead.is_deleted == False).first()
        if lead:
            lead.last_activity_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        action="COMPLETE",
        entity_type="ACTIVITY",
        entity_id=act.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"is_completed": True, "completed_at": str(act.completed_at)},
        request=request,
    )
    db.commit()
    db.refresh(act)

    r = ActivityResponse.model_validate(act)
    r.assigned_to_name = act.assigned_to.full_name if act.assigned_to else None
    r.created_by_name = act.created_by.full_name if act.created_by else None
    r.related_entity_name = resolve_entity_name(db, act.related_entity_type, act.related_entity_id)
    return r

# --- TASKS ---

@router.get("/tasks", response_model=List[TaskResponse])
def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    scope: Optional[str] = Query(None, description="today, overdue, mine, open"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    query = db.query(Task)
    now = datetime.now(timezone.utc)

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)
    if related_entity_type:
        query = query.filter(Task.related_entity_type == related_entity_type)
    if related_entity_id:
        query = query.filter(Task.related_entity_id == related_entity_id)

    if scope == "today":
        start_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_day = start_day + timedelta(days=1)
        query = query.filter(Task.due_date >= start_day, Task.due_date < end_day)
    elif scope == "overdue":
        query = query.filter(Task.due_date < now, Task.status.notin_(["Completed", "Cancelled"]))
    elif scope == "mine":
        query = query.filter(Task.assigned_to_id == current_user.id)
    elif scope == "open":
        query = query.filter(Task.status.notin_(["Completed", "Cancelled"]))

    if search:
        s = f"%{search}%"
        query = query.filter((Task.title.ilike(s)) | (Task.description.ilike(s)))

    tasks = query.order_by(Task.due_date.asc()).all()
    result = []
    for t in tasks:
        r = TaskResponse.model_validate(t)
        r.assigned_to_name = t.assigned_to.full_name if t.assigned_to else None
        r.created_by_name = t.created_by.full_name if t.created_by else None
        result.append(r)
    return result

@router.post("/tasks", response_model=TaskResponse)
def create_task(
    data: TaskCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    task = Task(
        **data.model_dump(),
        created_by_id=current_user.id,
    )
    if not task.assigned_to_id:
        task.assigned_to_id = current_user.id

    db.add(task)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="TASK",
        entity_id=task.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(task)

    r = TaskResponse.model_validate(task)
    r.assigned_to_name = task.assigned_to.full_name if task.assigned_to else None
    r.created_by_name = task.created_by.full_name if task.created_by else None
    return r

# --- MEETINGS ---

@router.get("/meetings", response_model=List[MeetingResponse])
def list_meetings(
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    query = db.query(Meeting)
    if related_entity_type:
        query = query.filter(Meeting.related_entity_type == related_entity_type)
    if related_entity_id:
        query = query.filter(Meeting.related_entity_id == related_entity_id)

    meetings = query.order_by(Meeting.start_time.desc()).all()
    result = []
    for m in meetings:
        r = MeetingResponse.model_validate(m)
        r.organizer_name = m.organizer.full_name if m.organizer else None
        result.append(r)
    return result

@router.post("/meetings", response_model=MeetingResponse)
def create_meeting(
    data: MeetingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    meeting = Meeting(
        **data.model_dump(),
        organizer_id=current_user.id,
    )
    db.add(meeting)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="MEETING",
        entity_id=meeting.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(meeting)

    r = MeetingResponse.model_validate(meeting)
    r.organizer_name = meeting.organizer.full_name if meeting.organizer else None
    return r

# --- NOTES ---

@router.get("/notes", response_model=List[NoteResponse])
def list_notes(
    related_entity_type: str,
    related_entity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    notes = db.query(Note).filter(
        Note.related_entity_type == related_entity_type,
        Note.related_entity_id == related_entity_id,
    ).order_by(Note.created_at.desc()).all()

    result = []
    for n in notes:
        r = NoteResponse.model_validate(n)
        r.author_name = n.author.full_name if n.author else None
        result.append(r)
    return result

@router.post("/notes", response_model=NoteResponse)
def create_note(
    data: NoteCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.edit")),
):
    note = Note(
        content=data.content,
        related_entity_type=data.related_entity_type,
        related_entity_id=data.related_entity_id,
        author_id=current_user.id,
    )
    db.add(note)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="NOTE",
        entity_id=note.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"related_entity_type": data.related_entity_type, "related_entity_id": data.related_entity_id},
        request=request,
    )
    db.commit()
    db.refresh(note)

    r = NoteResponse.model_validate(note)
    r.author_name = current_user.full_name
    return r
