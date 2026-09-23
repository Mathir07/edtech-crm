from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date


# =====================================================================
# 1. CATEGORIES & SUBCATEGORIES
# =====================================================================

class ServiceSubcategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class ServiceSubcategoryCreate(ServiceSubcategoryBase):
    pass


class ServiceSubcategoryResponse(ServiceSubcategoryBase):
    id: str
    category_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ServiceCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class ServiceCategoryResponse(ServiceCategoryBase):
    id: str
    subcategories: List[ServiceSubcategoryResponse] = []
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# 2. SLA POLICIES
# =====================================================================

class SLAPolicyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    priority: str = Field(default="ALL")  # LOW, MEDIUM, HIGH, URGENT, ALL
    severity: str = Field(default="ALL")  # LOW, MEDIUM, HIGH, CRITICAL, ALL
    first_response_minutes: int = Field(default=60, ge=1)
    resolution_minutes: int = Field(default=480, ge=1)
    first_response_target_minutes: Optional[int] = None
    resolution_target_minutes: Optional[int] = None
    business_hours_only: bool = True
    business_hour_start: Optional[str] = "09:00"
    business_hour_end: Optional[str] = "18:00"
    timezone: Optional[str] = "Asia/Kolkata"
    is_default: Optional[bool] = False
    active: bool = True
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    @model_validator(mode="after")
    def sync_target_minutes(self):
        if self.first_response_target_minutes and not self.first_response_minutes:
            self.first_response_minutes = self.first_response_target_minutes
        elif self.first_response_minutes and not self.first_response_target_minutes:
            self.first_response_target_minutes = self.first_response_minutes
        if self.resolution_target_minutes and not self.resolution_minutes:
            self.resolution_minutes = self.resolution_target_minutes
        elif self.resolution_minutes and not self.resolution_target_minutes:
            self.resolution_target_minutes = self.resolution_minutes
        return self


class SLAPolicyCreate(SLAPolicyBase):
    pass


class SLAPolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    severity: Optional[str] = None
    first_response_minutes: Optional[int] = None
    resolution_minutes: Optional[int] = None
    first_response_target_minutes: Optional[int] = None
    resolution_target_minutes: Optional[int] = None
    business_hours_only: Optional[bool] = None
    business_hour_start: Optional[str] = None
    business_hour_end: Optional[str] = None
    timezone: Optional[str] = None
    is_default: Optional[bool] = None
    active: Optional[bool] = None


class SLAPolicyResponse(SLAPolicyBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# 3. COMMENTS & ATTACHMENTS
# =====================================================================

class TicketCommentCreate(BaseModel):
    message: Optional[str] = None
    body: Optional[str] = None
    comment_type: str = Field(default="CUSTOMER_REPLY")  # CUSTOMER_REPLY, INTERNAL_NOTE

    @model_validator(mode="after")
    def validate_message(self):
        msg = self.message or self.body
        if not msg or not msg.strip():
            raise ValueError("Comment message or body must not be empty.")
        self.message = msg.strip()
        self.body = self.message
        return self


class TicketCommentResponse(BaseModel):
    id: str
    ticket_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    comment_type: str
    message: str
    body: Optional[str] = None
    is_customer_visible: bool = True
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_body_and_visibility(self):
        if not self.body:
            self.body = self.message
        self.is_customer_visible = (self.comment_type != "INTERNAL_NOTE")
        return self


class TicketAttachmentResponse(BaseModel):
    id: str
    ticket_id: str
    filename: str
    file_name: Optional[str] = None
    file_size: int
    content_type: str
    uploaded_by_id: Optional[str] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_file_name(self):
        if not self.file_name:
            self.file_name = self.filename
        return self


# =====================================================================
# 4. STATUS HISTORY & AUDIT TRAIL
# =====================================================================

class TicketStatusHistoryResponse(BaseModel):
    id: str
    ticket_id: str
    old_status: Optional[str] = None
    new_status: str
    changed_by_id: Optional[str] = None
    changed_by_name: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TicketAssignmentResponse(BaseModel):
    id: str
    ticket_id: str
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_by_id: Optional[str] = None
    assigned_by_name: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TicketEscalationResponse(BaseModel):
    id: str
    ticket_id: str
    escalated_by_id: Optional[str] = None
    escalated_by_name: Optional[str] = None
    escalated_to_id: Optional[str] = None
    escalated_to_name: Optional[str] = None
    reason: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TicketTimelineItem(BaseModel):
    id: str
    type: str  # create, status_change, assignment, comment, attachment, escalation, resolution, reopen, close
    title: str
    description: Optional[str] = None
    author_name: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


# =====================================================================
# 5. TICKETS (CRUD, WORKFLOW, DETAIL)
# =====================================================================

class TicketCreate(BaseModel):
    company_id: str
    contact_id: str
    subject: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    priority: str = Field(default="MEDIUM")  # LOW, MEDIUM, HIGH, URGENT
    severity: str = Field(default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    source: str = Field(default="PORTAL")    # PORTAL, EMAIL, PHONE, WHATSAPP, INTERNAL, MANUAL, PROJECT, SYSTEM
    project_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    contract_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    service_team_id: Optional[str] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    project_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    contract_id: Optional[str] = None


class TicketStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class TicketAssignmentUpdate(BaseModel):
    assigned_to_id: Optional[str] = None
    service_team_id: Optional[str] = None
    notes: Optional[str] = None


class TicketPriorityUpdate(BaseModel):
    priority: str


class TicketSeverityUpdate(BaseModel):
    severity: str


class TicketEscalateRequest(BaseModel):
    escalated_to_id: Optional[str] = None
    escalation_level: Optional[str] = "LEVEL_2"
    reason: str = Field(..., min_length=3)


class TicketResolveRequest(BaseModel):
    resolution_summary: str = Field(..., min_length=5)
    resolution_category: Optional[str] = None
    linked_bug_id: Optional[str] = None
    bug_id: Optional[str] = None


class TicketConfirmRequest(BaseModel):
    customer_confirmed_by: Optional[str] = "Customer Representative"
    notes: Optional[str] = None


class TicketReopenRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class TicketLinkBugRequest(BaseModel):
    bug_id: str


class TicketListItemResponse(BaseModel):
    id: str
    ticket_number: str
    subject: str
    company_id: str
    company_name: str
    contact_id: str
    contact_name: str
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    priority: str
    severity: str
    source: str
    status: str
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    service_team_name: Optional[str] = None
    sla_status: str
    sla_breached: bool
    sla_policy_id: Optional[str] = None
    first_response_due_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    time_remaining_minutes: int = 0
    created_at: datetime
    updated_at: datetime
    reopen_count: int = 0
    is_escalated: bool = False
    project_id: Optional[str] = None
    project_number: Optional[str] = None
    linked_bug_id: Optional[str] = None
    linked_bug_number: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class TicketDetailResponse(BaseModel):
    id: str
    ticket_number: str
    subject: str
    description: str
    company_id: str
    company_name: str
    company_code: Optional[str] = None
    contact_id: str
    contact_name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    project_number: Optional[str] = None
    sales_order_id: Optional[str] = None
    sales_order_number: Optional[str] = None
    contract_id: Optional[str] = None
    contract_number: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    priority: str
    severity: str
    source: str
    status: str
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_by_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    service_team_id: Optional[str] = None
    service_team_name: Optional[str] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    sla_policy_id: Optional[str] = None
    sla_policy_name: Optional[str] = None
    first_response_at: Optional[datetime] = None
    first_responded_at: Optional[datetime] = None
    first_response_due_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    sla_status: str
    sla_breached: bool
    sla_breached_at: Optional[datetime] = None
    sla_paused_at: Optional[datetime] = None
    total_paused_minutes: int = 0
    time_remaining_minutes: int = 0
    is_escalated: bool
    escalation_level: Optional[str] = None
    escalation_reason: Optional[str] = None
    escalated_to_name: Optional[str] = None
    escalated_at: Optional[datetime] = None
    resolution_summary: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by_name: Optional[str] = None
    customer_confirmed_at: Optional[datetime] = None
    customer_confirmed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    closed_by_name: Optional[str] = None
    reopen_count: int
    last_reopened_at: Optional[datetime] = None
    last_reopened_reason: Optional[str] = None
    linked_bug_id: Optional[str] = None
    bug_id: Optional[str] = None
    linked_bug_number: Optional[str] = None
    linked_bug_title: Optional[str] = None
    comments: List[TicketCommentResponse] = []
    attachments: List[TicketAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.first_responded_at and self.first_response_at:
            self.first_responded_at = self.first_response_at
        if not self.bug_id and self.linked_bug_id:
            self.bug_id = self.linked_bug_id
        return self


class TicketListPaginationResponse(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    items: List[TicketListItemResponse]


# =====================================================================
# 6. DASHBOARD & REPORTS
# =====================================================================

class ServiceDashboardResponse(BaseModel):
    total_tickets: int = 0
    total_open_tickets: int = 0
    new_today: int = 0
    unassigned: int = 0
    assigned: int = 0
    in_progress: int = 0
    waiting_for_customer: int = 0
    waiting_for_internal: int = 0
    resolved: int = 0
    customer_confirmation: int = 0
    closed: int = 0
    reopened: int = 0
    sla_at_risk: int = 0
    sla_breached: int = 0
    critical_tickets: int = 0
    high_priority_tickets: int = 0
    sla_compliance_rate: float = 100.0
    tickets_by_priority: Dict[str, int] = {}
    tickets_by_status: Dict[str, int] = {}
    recent_tickets: List[TicketListItemResponse] = []
    at_risk_tickets: List[TicketListItemResponse] = []


class ServiceReportResponse(BaseModel):
    total_tickets: int
    resolution_rate: float
    sla_compliance_rate: float
    reopened_rate: float
    tickets_by_priority: Dict[str, int]
    tickets_by_severity: Dict[str, int]
    tickets_by_status: Dict[str, int]
    tickets_by_category: Dict[str, int]
    tickets_by_assignee: Dict[str, int]
    tickets_by_company: Dict[str, int]
