from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime, Date, Numeric, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin


class ServiceCategory(Base, TimestampMixin):
    __tablename__ = "service_categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    sort_order = Column(Integer, default=0, nullable=False)

    subcategories = relationship(
        "ServiceSubcategory",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="ServiceSubcategory.sort_order",
    )
    tickets = relationship("Ticket", back_populates="category")


class ServiceSubcategory(Base, TimestampMixin):
    __tablename__ = "service_subcategories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    category_id = Column(String(36), ForeignKey("service_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    sort_order = Column(Integer, default=0, nullable=False)

    category = relationship("ServiceCategory", back_populates="subcategories")
    tickets = relationship("Ticket", back_populates="subcategory")


class SLAPolicy(Base, TimestampMixin):
    __tablename__ = "sla_policies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Priority & Severity matching
    # Priority: LOW, MEDIUM, HIGH, URGENT (or 'ALL')
    priority = Column(String(50), nullable=False, default="ALL", index=True)
    # Severity: LOW, MEDIUM, HIGH, CRITICAL (or 'ALL')
    severity = Column(String(50), nullable=False, default="ALL", index=True)
    
    # SLA thresholds in minutes
    first_response_minutes = Column(Integer, nullable=False, default=60)
    resolution_minutes = Column(Integer, nullable=False, default=480)
    
    business_hours_only = Column(Boolean, default=True, nullable=False)
    active = Column(Boolean, default=True, nullable=False, index=True)

    tickets = relationship("Ticket", back_populates="sla_policy")


class Ticket(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ticket_number = Column(String(50), unique=True, nullable=False, index=True)
    subject = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)

    # Commercial & Institutional Entities
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Classification & Taxonomy
    category_id = Column(String(36), ForeignKey("service_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    subcategory_id = Column(String(36), ForeignKey("service_subcategories.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Priority: LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(50), default="MEDIUM", nullable=False, index=True)
    # Severity: LOW, MEDIUM, HIGH, CRITICAL
    severity = Column(String(50), default="MEDIUM", nullable=False, index=True)
    # Source: PORTAL, EMAIL, PHONE, WHATSAPP, INTERNAL, MANUAL, PROJECT, SYSTEM
    source = Column(String(50), default="PORTAL", nullable=False, index=True)

    # Controlled Workflow Status:
    # NEW, OPEN, ASSIGNED, IN_PROGRESS, WAITING_FOR_CUSTOMER, WAITING_FOR_INTERNAL,
    # RESOLVED, CUSTOMER_CONFIRMATION, CLOSED, REOPENED, CANCELLED
    status = Column(String(50), default="NEW", nullable=False, index=True)

    # Ownership & Assignment
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    service_team_id = Column(String(36), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # SLA Tracking
    sla_policy_id = Column(String(36), ForeignKey("sla_policies.id", ondelete="SET NULL"), nullable=True, index=True)
    first_response_at = Column(DateTime(timezone=True), nullable=True)
    first_response_due_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True, index=True)  # Resolution deadline
    sla_status = Column(String(50), default="ON_TRACK", nullable=False, index=True)  # ON_TRACK, AT_RISK, BREACHED, PAUSED, COMPLETED
    sla_breached = Column(Boolean, default=False, nullable=False, index=True)
    sla_breached_at = Column(DateTime(timezone=True), nullable=True)
    sla_paused_at = Column(DateTime(timezone=True), nullable=True)
    total_paused_minutes = Column(Integer, default=0, nullable=False)

    # Escalation
    is_escalated = Column(Boolean, default=False, nullable=False, index=True)
    escalation_reason = Column(Text, nullable=True)
    escalated_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)

    @property
    def escalation_level(self):
        if not self.is_escalated:
            return None
        if self.escalation_reason and self.escalation_reason.startswith("[LEVEL_"):
            parts = self.escalation_reason.split("]", 1)
            return parts[0].strip("[]")
        return "LEVEL_2"

    # Resolution & Confirmation
    resolution_summary = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    customer_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    customer_confirmed_by = Column(String(150), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Reopen History
    reopen_count = Column(Integer, default=0, nullable=False)
    last_reopened_at = Column(DateTime(timezone=True), nullable=True)
    last_reopened_reason = Column(Text, nullable=True)

    # Engineering Integration (Existing Bug linking)
    linked_bug_id = Column(String(36), ForeignKey("bugs.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    company = relationship("Company")
    contact = relationship("Contact")
    project = relationship("Project")
    sales_order = relationship("SalesOrder")
    contract = relationship("Contract")
    category = relationship("ServiceCategory", back_populates="tickets")
    subcategory = relationship("ServiceSubcategory", back_populates="tickets")
    sla_policy = relationship("SLAPolicy", back_populates="tickets")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    service_team = relationship("Team", foreign_keys=[service_team_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    escalated_to = relationship("User", foreign_keys=[escalated_to_id])
    linked_bug = relationship("Bug")

    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketComment.created_at.asc()")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    status_history = relationship("TicketStatusHistory", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketStatusHistory.created_at.desc()")
    assignments = relationship("TicketAssignment", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketAssignment.created_at.desc()")
    escalations = relationship("TicketEscalation", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketEscalation.created_at.desc()")


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # CUSTOMER_REPLY or INTERNAL_NOTE (Internal notes strictly protected)
    comment_type = Column(String(50), default="CUSTOMER_REPLY", nullable=False, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    ticket = relationship("Ticket", back_populates="comments")
    user = relationship("User")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    content_type = Column(String(100), nullable=False, default="application/octet-stream")
    file_path = Column(String(500), nullable=False)
    uploaded_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    ticket = relationship("Ticket", back_populates="attachments")
    uploaded_by = relationship("User")


class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    ticket = relationship("Ticket", back_populates="status_history")
    changed_by = relationship("User")


class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    team_id = Column(String(36), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    ticket = relationship("Ticket", back_populates="assignments")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    team = relationship("Team", foreign_keys=[team_id])


class TicketEscalation(Base):
    __tablename__ = "ticket_escalations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    escalated_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    escalated_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    ticket = relationship("Ticket", back_populates="escalations")
    escalated_by = relationship("User", foreign_keys=[escalated_by_id])
    escalated_to = relationship("User", foreign_keys=[escalated_to_id])
