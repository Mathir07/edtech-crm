from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime, Date, Numeric, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin

class Project(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True, index=True)
    project_manager_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Controlled lifecycle status: PLANNED, ACTIVE, ON_HOLD, IN_QA, READY_FOR_DELIVERY, DELIVERED, COMPLETED, CANCELLED
    status = Column(String(50), nullable=False, default="PLANNED", index=True)
    # Priority: LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(50), nullable=False, default="MEDIUM", index=True)
    
    start_date = Column(Date, nullable=True)
    target_date = Column(Date, nullable=True)
    actual_completion_date = Column(Date, nullable=True)
    progress_percentage = Column(Numeric(5, 2), nullable=False, default=0.00)
    budget = Column(Numeric(12, 2), nullable=False, default=0.00)
    notes = Column(Text, nullable=True)

    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    company = relationship("Company")
    sales_order = relationship("SalesOrder")
    contract = relationship("Contract")
    project_manager = relationship("User", foreign_keys=[project_manager_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])

    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan", order_by="Milestone.sequence")
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")
    test_suites = relationship("TestSuite", back_populates="project", cascade="all, delete-orphan")
    bugs = relationship("Bug", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base, TimestampMixin):
    __tablename__ = "project_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, default="Developer")  # Project Manager, Developer, QA Engineer, Support
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    removed_at = Column(DateTime(timezone=True), nullable=True)
    active = Column(Boolean, default=True, nullable=False, index=True)

    project = relationship("Project", back_populates="members")
    user = relationship("User")


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sequence = Column(Integer, default=1, nullable=False)
    # Status: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED
    status = Column(String(50), default="NOT_STARTED", nullable=False, index=True)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completion_percentage = Column(Numeric(5, 2), default=0.00, nullable=False)

    project = relationship("Project", back_populates="milestones")
    tasks = relationship("ProjectTask", back_populates="milestone")


class ProjectTask(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "project_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_number = Column(String(50), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    milestone_id = Column(String(36), ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Status: TODO, IN_PROGRESS, BLOCKED, READY_FOR_QA, COMPLETED, CANCELLED
    status = Column(String(50), default="TODO", nullable=False, index=True)
    # Priority: LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(50), default="MEDIUM", nullable=False, index=True)
    
    estimated_hours = Column(Numeric(8, 2), default=0.00, nullable=False)
    actual_hours = Column(Numeric(8, 2), default=0.00, nullable=False)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="tasks")
    milestone = relationship("Milestone", back_populates="tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
