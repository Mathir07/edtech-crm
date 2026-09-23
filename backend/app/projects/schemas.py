from typing import List, Optional, Any, Dict
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field

# --- PROJECT MEMBERS ---

class ProjectMemberBase(BaseModel):
    user_id: str
    role: str = "Developer"  # Project Manager, Developer, QA Engineer, Support

class ProjectMemberCreate(ProjectMemberBase):
    pass

class ProjectMemberResponse(ProjectMemberBase):
    id: str
    project_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    assigned_at: datetime
    removed_at: Optional[datetime] = None
    active: bool = True

    model_config = ConfigDict(from_attributes=True)


# --- MILESTONES ---

class MilestoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    sequence: int = 1
    status: str = "NOT_STARTED"  # NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED
    start_date: Optional[date] = None
    due_date: Optional[date] = None

class MilestoneCreate(MilestoneBase):
    pass

class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sequence: Optional[int] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    completion_percentage: Optional[float] = None

class MilestoneResponse(MilestoneBase):
    id: str
    project_id: str
    completed_at: Optional[datetime] = None
    completion_percentage: float = 0.00
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- PROJECT TASKS ---

class ProjectTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    milestone_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    status: str = "TODO"  # TODO, IN_PROGRESS, BLOCKED, READY_FOR_QA, COMPLETED, CANCELLED
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    estimated_hours: float = 0.0
    actual_hours: float = 0.0
    start_date: Optional[date] = None
    due_date: Optional[date] = None

class ProjectTaskCreate(ProjectTaskBase):
    pass

class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    milestone_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None

class ProjectTaskStatusUpdate(BaseModel):
    status: str

class ProjectTaskResponse(ProjectTaskBase):
    id: str
    task_number: str
    project_id: str
    milestone_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- PROJECTS ---

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    company_id: str
    sales_order_id: Optional[str] = None
    contract_id: Optional[str] = None
    project_manager_id: Optional[str] = None
    status: str = "PLANNED"  # PLANNED, ACTIVE, ON_HOLD, IN_QA, READY_FOR_DELIVERY, DELIVERED, COMPLETED, CANCELLED
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    budget: float = 0.00
    notes: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectFromSalesOrderCreate(BaseModel):
    sales_order_id: str
    name: Optional[str] = None
    project_manager_id: Optional[str] = None
    target_date: Optional[date] = None
    notes: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    project_manager_id: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    budget: Optional[float] = None
    notes: Optional[str] = None

class ProjectDeliveryRequest(BaseModel):
    status: str  # READY_FOR_DELIVERY, DELIVERED, COMPLETED
    override_qa: bool = False
    override_reason: Optional[str] = None
    completion_notes: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: str
    project_number: str
    progress_percentage: float = 0.00
    actual_completion_date: Optional[date] = None
    company_name: Optional[str] = None
    sales_order_number: Optional[str] = None
    contract_number: Optional[str] = None
    project_manager_name: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProjectDetailResponse(ProjectResponse):
    members: List[ProjectMemberResponse] = []
    milestones: List[MilestoneResponse] = []
    tasks: List[ProjectTaskResponse] = []
    delivery_readiness: Dict[str, Any] = {}
    qa_summary: Dict[str, Any] = {}
    bugs_summary: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)
