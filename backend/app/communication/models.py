from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime, Integer, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin

class EmailAccount(Base, TimestampMixin):
    __tablename__ = "email_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email_address = Column(String(255), unique=True, nullable=False, index=True)
    account_name = Column(String(255), nullable=False)
    provider = Column(String(50), default="GMAIL", nullable=False)  # GMAIL, WORKSPACE
    status = Column(String(50), default="CONNECTED", nullable=False, index=True)  # CONNECTED, DISCONNECTED, ERROR, EXPIRED
    encrypted_access_token = Column(Text, nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    scopes = Column(Text, nullable=True)
    history_id = Column(String(100), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    threads = relationship("EmailThread", back_populates="email_account", cascade="all, delete-orphan")
    messages = relationship("CommunicationMessage", back_populates="email_account")


class EmailThread(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "email_threads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider_thread_id = Column(String(150), unique=True, nullable=False, index=True)
    email_account_id = Column(String(36), ForeignKey("email_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    subject = Column(String(500), nullable=True)
    snippet = Column(Text, nullable=True)
    last_message_at = Column(DateTime(timezone=True), nullable=True, index=True)
    message_count = Column(Integer, default=1, nullable=False)
    is_read = Column(Boolean, default=True, nullable=False, index=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)

    # CRM Relationships
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)

    email_account = relationship("EmailAccount", back_populates="threads")
    company = relationship("Company")
    contact = relationship("Contact")
    lead = relationship("Lead")
    opportunity = relationship("Opportunity")
    project = relationship("Project")
    ticket = relationship("Ticket")
    invoice = relationship("Invoice")
    messages = relationship("CommunicationMessage", back_populates="thread", cascade="all, delete-orphan", order_by="CommunicationMessage.created_at.asc()")


class CommunicationMessage(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "communication_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    channel = Column(String(50), nullable=False, index=True)  # EMAIL, WHATSAPP, PHONE
    direction = Column(String(50), nullable=False, index=True)  # INBOUND, OUTBOUND
    status = Column(String(50), nullable=False, index=True)  # PENDING, SENT, DELIVERED, READ, FAILED, RECEIVED, MISSED, ANSWERED, COMPLETED

    email_account_id = Column(String(36), ForeignKey("email_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    thread_id = Column(String(36), ForeignKey("email_threads.id", ondelete="SET NULL"), nullable=True, index=True)
    provider_message_id = Column(String(150), unique=True, nullable=True, index=True)  # Gmail message ID, WhatsApp wamid, Call SID
    provider_thread_id = Column(String(150), nullable=True, index=True)

    sender = Column(String(255), nullable=False, index=True)  # email address or phone number
    recipient = Column(String(255), nullable=False, index=True)  # email address or phone number
    cc = Column(Text, nullable=True)
    bcc = Column(Text, nullable=True)

    subject = Column(String(500), nullable=True)
    body_text = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)

    # Telephony / Call Specifics
    call_duration_seconds = Column(Integer, nullable=True, default=0)
    call_disposition = Column(String(100), nullable=True)  # FOLLOW_UP_REQUIRED, INTERESTED, NOT_INTERESTED, BUSY, WRONG_NUMBER, PROPOSAL_REQUESTED, RESOLVED
    recording_url = Column(String(500), nullable=True)
    is_manual = Column(Boolean, default=False, nullable=False)

    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Polymorphic CRM Entity Links (all nullable)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    project_task_id = Column(String(36), ForeignKey("project_tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_id = Column(String(36), ForeignKey("customer_payments.id", ondelete="SET NULL"), nullable=True, index=True)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)

    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    email_account = relationship("EmailAccount", back_populates="messages")
    thread = relationship("EmailThread", back_populates="messages")
    company = relationship("Company")
    contact = relationship("Contact")
    lead = relationship("Lead")
    opportunity = relationship("Opportunity")
    sales_order = relationship("SalesOrder")
    contract = relationship("Contract")
    project = relationship("Project")
    project_task = relationship("ProjectTask")
    ticket = relationship("Ticket")
    invoice = relationship("Invoice")
    payment = relationship("CustomerPayment")
    vendor = relationship("Vendor")
    created_by = relationship("User", foreign_keys=[created_by_id])
    attachments = relationship("CommunicationAttachment", back_populates="message", cascade="all, delete-orphan")


class CommunicationTemplate(Base, TimestampMixin):
    __tablename__ = "communication_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), unique=True, nullable=False, index=True)
    channel = Column(String(50), nullable=False, index=True)  # EMAIL, WHATSAPP
    subject = Column(String(255), nullable=True)
    body_text = Column(Text, nullable=False)
    variables = Column(JSON, nullable=True)  # e.g. ["contact_name", "company_name", "invoice_number", "amount_due"]
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_id])


class WhatsAppConfig(Base, TimestampMixin):
    __tablename__ = "whatsapp_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(50), default="META_CLOUD", nullable=False)
    phone_number_id = Column(String(100), nullable=True)
    business_account_id = Column(String(100), nullable=True)
    phone_number = Column(String(50), nullable=True)
    encrypted_access_token = Column(Text, nullable=True)
    webhook_verify_token = Column(String(255), nullable=True)
    status = Column(String(50), default="DISCONNECTED", nullable=False)  # CONNECTED, DISCONNECTED, ERROR


class PhoneConfig(Base, TimestampMixin):
    __tablename__ = "phone_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(50), default="TWILIO", nullable=False)  # TWILIO, EXOTEL, GENERIC_SIP
    account_sid = Column(String(100), nullable=True)
    phone_number = Column(String(50), nullable=True)
    encrypted_auth_token = Column(Text, nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    status = Column(String(50), default="DISCONNECTED", nullable=False)  # CONNECTED, DISCONNECTED, ERROR


class CommunicationAttachment(Base):
    __tablename__ = "communication_attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("communication_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(100), nullable=False)
    uploaded_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    message = relationship("CommunicationMessage", back_populates="attachments")
    uploaded_by = relationship("User")
