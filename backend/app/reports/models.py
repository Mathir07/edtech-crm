from sqlalchemy import Column, String, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base, generate_uuid, TimestampMixin

class SavedReport(Base, TimestampMixin):
    __tablename__ = "saved_reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    report_type = Column(String(100), nullable=False, index=True)  # EXECUTIVE, SALES, PIPELINE, PROJECTS, QA, SERVICE, FINANCE, COMMUNICATIONS, TEAM
    filters_json = Column(JSON, nullable=False, default=dict)
    columns_json = Column(JSON, nullable=True)
    is_favorite = Column(Boolean, default=False, nullable=False)
    is_shared = Column(Boolean, default=False, nullable=False)

    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    updated_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
