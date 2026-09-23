import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.users.models import User


class Notification(Base):
    """
    In-app notification entity supporting multi-tenant isolation, priority levels,
    entity linkbacks, and deduplication keys for idempotent automation runs.
    """
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False, default="kct-default", index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(36), nullable=True)
    priority = Column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    dedup_key = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="notifications")


class NotificationPreference(Base):
    """
    User notification preferences per channel and business domain category.
    """
    __tablename__ = "notification_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Global channel toggles
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)

    # Category channels
    tasks_in_app = Column(Boolean, default=True, nullable=False)
    tasks_email = Column(Boolean, default=False, nullable=False)

    meetings_in_app = Column(Boolean, default=True, nullable=False)
    meetings_email = Column(Boolean, default=True, nullable=False)

    sales_in_app = Column(Boolean, default=True, nullable=False)
    sales_email = Column(Boolean, default=False, nullable=False)

    finance_in_app = Column(Boolean, default=True, nullable=False)
    finance_email = Column(Boolean, default=True, nullable=False)

    service_in_app = Column(Boolean, default=True, nullable=False)
    service_email = Column(Boolean, default=True, nullable=False)

    projects_in_app = Column(Boolean, default=True, nullable=False)
    projects_email = Column(Boolean, default=False, nullable=False)

    qa_in_app = Column(Boolean, default=True, nullable=False)
    qa_email = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    # Relationship
    user = relationship("User", backref="notification_preference", uselist=False)


class AutomationRule(Base):
    """
    Configurable startup automation rules per organization.
    """
    __tablename__ = "automation_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False, default="kct-default", index=True)
    rule_key = Column(String(50), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    config_json = Column(JSON, nullable=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)


class AutomationJobLog(Base):
    """
    Execution history and audit log for background automation jobs.
    """
    __tablename__ = "automation_job_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=False, default="kct-default", index=True)
    job_name = Column(String(100), nullable=False, index=True)
    status = Column(String(20), nullable=False)  # SUCCESS, FAILED, RUNNING
    items_processed = Column(Integer, default=0, nullable=False)
    notifications_created = Column(Integer, default=0, nullable=False)
    emails_sent = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
