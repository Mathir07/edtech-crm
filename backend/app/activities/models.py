from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid, TimestampMixin

class Activity(Base, TimestampMixin):
    __tablename__ = "activities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    type = Column(String(50), nullable=False, index=True)  # Call, Email, WhatsApp, Meeting, Demo, Follow-up, Task, Note
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False, nullable=False, index=True)
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    related_entity_type = Column(String(50), nullable=False, index=True)  # company, contact, lead, opportunity, etc.
    related_entity_id = Column(String(36), nullable=False, index=True)

    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    priority = Column(String(50), default="Medium", nullable=False)  # Low, Medium, High, Urgent
    status = Column(String(50), default="Pending", nullable=False, index=True)  # Pending, In Progress, Completed, Cancelled
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    related_entity_type = Column(String(50), nullable=True, index=True)
    related_entity_id = Column(String(36), nullable=True, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

class Meeting(Base, TimestampMixin):
    __tablename__ = "meetings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=True)
    meeting_link = Column(String(255), nullable=True)
    organizer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(50), default="Scheduled", nullable=False)  # Scheduled, Completed, Cancelled, Rescheduled
    related_entity_type = Column(String(50), nullable=True, index=True)
    related_entity_id = Column(String(36), nullable=True, index=True)

    organizer = relationship("User", foreign_keys=[organizer_id])

class Note(Base, TimestampMixin):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    content = Column(Text, nullable=False)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    related_entity_type = Column(String(50), nullable=False, index=True)
    related_entity_id = Column(String(36), nullable=False, index=True)

    author = relationship("User", foreign_keys=[author_id])
