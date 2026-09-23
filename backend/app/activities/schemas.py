from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# Activities
class ActivityBase(BaseModel):
    type: str  # Call, Email, WhatsApp, Meeting, Demo, Follow-up, Task, Note
    subject: str
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    assigned_to_id: Optional[str] = None
    related_entity_type: str  # company, contact, lead, opportunity
    related_entity_id: str

class ActivityCreate(ActivityBase):
    pass

class ActivityUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    assigned_to_id: Optional[str] = None
    is_completed: Optional[bool] = None

class ActivityResponse(ActivityBase):
    id: str
    is_completed: bool
    completed_at: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None
    related_entity_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Tasks
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_id: Optional[str] = None
    priority: str = "Medium"  # Low, Medium, High, Urgent
    status: str = "Pending"  # Pending, In Progress, Completed, Cancelled
    due_date: Optional[datetime] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None

class TaskResponse(TaskBase):
    id: str
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Meetings
class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    status: str = "Scheduled"
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None

class MeetingCreate(MeetingBase):
    pass

class MeetingResponse(MeetingBase):
    id: str
    organizer_id: Optional[str] = None
    organizer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Notes
class NoteBase(BaseModel):
    content: str
    related_entity_type: str
    related_entity_id: str

class NoteCreate(NoteBase):
    pass

class NoteResponse(NoteBase):
    id: str
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
