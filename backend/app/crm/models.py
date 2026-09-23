from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Float, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin

class LeadSource(Base, TimestampMixin):
    __tablename__ = "lead_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    leads = relationship("Lead", back_populates="source")

class Lead(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    source_id = Column(String(36), ForeignKey("lead_sources.id", ondelete="SET NULL"), nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="New", index=True)  # New, Contacted, Qualified, Unqualified, Converted, Lost
    priority = Column(String(50), nullable=False, default="Medium")  # Low, Medium, High, Urgent
    expected_value = Column(Float, nullable=True, default=0.0)
    expected_close_date = Column(Date, nullable=True)
    qualification_status = Column(String(50), nullable=False, default="Pending")  # Pending, Qualified, Disqualified
    converted_opportunity_id = Column(String(36), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Lead & Follow-Up Foundation fields
    contact_name = Column(String(150), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    company_name = Column(String(255), nullable=True)
    business_segment = Column(String(50), nullable=True, index=True)
    next_action = Column(String(255), nullable=True)
    next_follow_up_date = Column(DateTime(timezone=True), nullable=True, index=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    company = relationship("Company", back_populates="leads")
    contact = relationship("Contact")
    source = relationship("LeadSource", back_populates="leads")
    owner = relationship("User", foreign_keys=[owner_id])
