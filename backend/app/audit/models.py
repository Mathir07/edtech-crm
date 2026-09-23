from sqlalchemy import Column, String, DateTime, Text, JSON, func
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(50), nullable=False, index=True)  # LOGIN, CREATE, UPDATE, DELETE, STAGE_CHANGE, etc.
    entity_type = Column(String(50), nullable=False, index=True)  # COMPANY, CONTACT, LEAD, OPPORTUNITY, etc.
    entity_id = Column(String(36), nullable=True, index=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
