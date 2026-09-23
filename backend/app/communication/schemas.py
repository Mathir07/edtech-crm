from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

# ==========================================
# EMAIL ACCOUNTS & OAUTH
# ==========================================

class EmailAccountResponse(BaseModel):
    id: str
    user_id: str
    email_address: str
    account_name: str
    provider: str
    status: str
    token_expires_at: Optional[datetime] = None
    scopes: Optional[str] = None
    history_id: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmailAccountCreate(BaseModel):
    email_address: str
    account_name: Optional[str] = "Corporate Workspace Account"
    provider: str = "GOOGLE"
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    scopes: Optional[str] = None


class EmailOAuthAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str


class EmailOAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    account_name: Optional[str] = "Corporate Workspace Account"


# ==========================================
# ATTACHMENTS
# ==========================================

class CommunicationAttachmentResponse(BaseModel):
    id: str
    message_id: str
    filename: str
    file_size: int
    content_type: str
    uploaded_by_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# COMMUNICATION MESSAGES
# ==========================================

class SendEmailRequest(BaseModel):
    to_email: Optional[str] = None
    recipient: Optional[str] = None
    subject: str
    body_text: str
    body_html: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None
    email_account_id: Optional[str] = None
    # CRM Links
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    project_id: Optional[str] = None
    ticket_id: Optional[str] = None
    invoice_id: Optional[str] = None

    @property
    def destination(self) -> str:
        return self.to_email or self.recipient or ""


class SendWhatsAppRequest(BaseModel):
    to_phone: Optional[str] = None
    recipient: Optional[str] = None
    message_text: Optional[str] = None
    template_name: Optional[str] = None
    template_id: Optional[str] = None
    template_variables: Optional[Dict[str, str]] = None
    # CRM Links
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    ticket_id: Optional[str] = None

    @property
    def destination_phone(self) -> str:
        return self.to_phone or self.recipient or ""


class ManualCallLogRequest(BaseModel):
    phone_number: Optional[str] = None
    recipient: Optional[str] = None
    direction: str = "OUTBOUND"  # INBOUND, OUTBOUND
    duration_seconds: Optional[int] = 0
    call_duration_seconds: Optional[int] = None
    disposition: Optional[str] = "FOLLOW_UP_REQUIRED"
    call_disposition: Optional[str] = None
    notes: Optional[str] = None
    recording_url: Optional[str] = None
    # CRM Links
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    ticket_id: Optional[str] = None

    @property
    def target_phone(self) -> str:
        return self.phone_number or self.recipient or ""

    @property
    def total_duration(self) -> int:
        return self.call_duration_seconds if self.call_duration_seconds is not None else (self.duration_seconds or 0)

    @property
    def final_disposition(self) -> str:
        return self.call_disposition or self.disposition or "FOLLOW_UP_REQUIRED"


class CommunicationMessageResponse(BaseModel):
    id: str
    channel: str
    direction: str
    status: str
    provider_message_id: Optional[str] = None
    provider_thread_id: Optional[str] = None
    thread_id: Optional[str] = None
    sender: str
    recipient: str
    cc: Optional[str] = None
    bcc: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    call_duration_seconds: Optional[int] = 0
    call_disposition: Optional[str] = None
    recording_url: Optional[str] = None
    is_manual: bool = False
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    # CRM Links
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    contract_id: Optional[str] = None
    project_id: Optional[str] = None
    project_task_id: Optional[str] = None
    ticket_id: Optional[str] = None
    invoice_id: Optional[str] = None
    payment_id: Optional[str] = None
    vendor_id: Optional[str] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    attachments: List[CommunicationAttachmentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# EMAIL THREADS
# ==========================================

class EmailThreadResponse(BaseModel):
    id: str
    provider_thread_id: str
    email_account_id: Optional[str] = None
    subject: Optional[str] = None
    snippet: Optional[str] = None
    last_message_at: Optional[datetime] = None
    message_count: int = 1
    is_read: bool = True
    is_archived: bool = False
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    project_id: Optional[str] = None
    ticket_id: Optional[str] = None
    invoice_id: Optional[str] = None
    created_at: datetime
    messages: List[CommunicationMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# TEMPLATES
# ==========================================

class CommunicationTemplateCreate(BaseModel):
    name: str
    channel: str = "EMAIL"  # EMAIL, WHATSAPP
    subject: Optional[str] = None
    body_text: str
    variables: Optional[Any] = None
    is_active: bool = True


class CommunicationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    variables: Optional[Any] = None
    is_active: Optional[bool] = None


class CommunicationTemplateResponse(BaseModel):
    id: str
    name: str
    channel: str
    subject: Optional[str] = None
    body_text: str
    variables: Optional[Any] = None
    is_active: bool
    created_by_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# INTEGRATION SETTINGS
# ==========================================

class WhatsAppConfigUpdate(BaseModel):
    provider: Optional[str] = "META"
    phone_number_id: Optional[str] = None
    business_account_id: Optional[str] = None
    phone_number: Optional[str] = None
    access_token: Optional[str] = None
    webhook_verify_token: Optional[str] = "edtech_crm_whatsapp_verify_token_2026"


class WhatsAppConfigResponse(BaseModel):
    id: str
    provider: str
    phone_number_id: Optional[str] = None
    business_account_id: Optional[str] = None
    phone_number: Optional[str] = None
    webhook_verify_token: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PhoneConfigUpdate(BaseModel):
    provider: str = "TWILIO"
    account_sid: str
    phone_number: Optional[str] = None
    auth_token: Optional[str] = None
    webhook_secret: Optional[str] = None


class PhoneConfigResponse(BaseModel):
    id: str
    provider: str
    account_sid: Optional[str] = None
    phone_number: Optional[str] = None
    webhook_secret: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmailDraftCreate(BaseModel):
    to_email: Optional[str] = None
    recipient: Optional[str] = None
    subject: Optional[str] = ""
    body_text: Optional[str] = ""
    body_html: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    project_id: Optional[str] = None
    ticket_id: Optional[str] = None
    invoice_id: Optional[str] = None

    @property
    def destination(self) -> str:
        return self.to_email or self.recipient or ""


class EmailDraftUpdate(BaseModel):
    to_email: Optional[str] = None
    recipient: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    company_id: Optional[str] = None
    contact_id: Optional[str] = None


class ReplyEmailRequest(BaseModel):
    body_text: str
    body_html: Optional[str] = None
    reply_all: bool = False
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None


class ForwardEmailRequest(BaseModel):
    to_email: str
    body_text: Optional[str] = ""
    cc: Optional[List[str]] = None


class IntegrationsOverviewResponse(BaseModel):
    hostinger: Optional[Dict[str, Any]] = None
    gmail: Optional[Dict[str, Any]] = None
    whatsapp: Dict[str, Any]
    phone: Dict[str, Any]


# ==========================================
# ASSOCIATIONS & TIMELINE
# ==========================================

class AssociateCRMRequest(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    contract_id: Optional[str] = None
    project_id: Optional[str] = None
    ticket_id: Optional[str] = None
    invoice_id: Optional[str] = None


class CommunicationTimelineItem(BaseModel):
    id: str
    channel: str
    direction: str
    status: str
    timestamp: datetime
    sender: str
    recipient: str
    subject: Optional[str] = None
    preview: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    created_by_name: Optional[str] = None


# ==========================================
# TELEPHONY FOUNDATION
# ==========================================

class InitiateCallRequest(BaseModel):
    to_phone: str
    from_phone: Optional[str] = None
    lead_id: Optional[str] = None
    contact_id: Optional[str] = None
    company_id: Optional[str] = None
    opportunity_id: Optional[str] = None


class TelephonyStatusResponse(BaseModel):
    enabled: bool
    provider: str
    business_number: Optional[str] = None
    supported_providers: List[str]
    message: str
