from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# --- Notification Schemas ---

class NotificationBase(BaseModel):
    notification_type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    priority: str = "MEDIUM"


class NotificationCreate(NotificationBase):
    user_id: str
    organization_id: str = "kct-default"
    dedup_key: Optional[str] = None


class NotificationResponse(NotificationBase):
    id: str
    organization_id: str
    user_id: str
    is_read: bool
    read_at: Optional[datetime] = None
    dedup_key: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkReadRequest(BaseModel):
    notification_ids: Optional[List[str]] = None
    mark_all: bool = False


# --- Preference Schemas ---

class NotificationPreferenceBase(BaseModel):
    in_app_enabled: bool = True
    email_enabled: bool = True

    tasks_in_app: bool = True
    tasks_email: bool = False

    meetings_in_app: bool = True
    meetings_email: bool = True

    sales_in_app: bool = True
    sales_email: bool = False

    finance_in_app: bool = True
    finance_email: bool = True

    service_in_app: bool = True
    service_email: bool = True

    projects_in_app: bool = True
    projects_email: bool = False

    qa_in_app: bool = True
    qa_email: bool = True


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None

    tasks_in_app: Optional[bool] = None
    tasks_email: Optional[bool] = None

    meetings_in_app: Optional[bool] = None
    meetings_email: Optional[bool] = None

    sales_in_app: Optional[bool] = None
    sales_email: Optional[bool] = None

    finance_in_app: Optional[bool] = None
    finance_email: Optional[bool] = None

    service_in_app: Optional[bool] = None
    service_email: Optional[bool] = None

    projects_in_app: Optional[bool] = None
    projects_email: Optional[bool] = None

    qa_in_app: Optional[bool] = None
    qa_email: Optional[bool] = None


class NotificationPreferenceResponse(NotificationPreferenceBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Automation Schemas ---

class AutomationRuleResponse(BaseModel):
    id: str
    organization_id: str
    rule_key: str
    name: str
    description: Optional[str] = None
    is_enabled: bool
    config_json: Optional[Dict[str, Any]] = None
    last_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationRuleToggleRequest(BaseModel):
    is_enabled: bool


class AutomationRuleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    config_json: Optional[Dict[str, Any]] = None


class AutomationJobLogResponse(BaseModel):
    id: str
    organization_id: str
    job_name: str
    status: str
    items_processed: int
    notifications_created: int
    emails_sent: int
    error_message: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AutomationRunResponse(BaseModel):
    status: str
    jobs_executed: int
    total_notifications_created: int
    total_emails_sent: int
    logs: List[AutomationJobLogResponse]
