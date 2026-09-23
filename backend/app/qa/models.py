from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin

class TestSuite(Base, TimestampMixin):
    __tablename__ = "test_suites"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    module = Column(String(100), nullable=True, index=True)  # e.g. Authentication, Admissions, Examination, Fees, SIS
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)  # ACTIVE, ARCHIVED
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    project = relationship("Project", back_populates="test_suites")
    created_by = relationship("User")
    test_cases = relationship("TestCase", back_populates="test_suite", cascade="all, delete-orphan")


class TestCase(Base, TimestampMixin):
    __tablename__ = "test_cases"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    test_case_number = Column(String(50), unique=True, nullable=False, index=True)
    test_suite_id = Column(String(36), ForeignKey("test_suites.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    preconditions = Column(Text, nullable=True)
    test_steps = Column(Text, nullable=True)
    expected_result = Column(Text, nullable=True)
    
    # Priority: LOW, MEDIUM, HIGH, CRITICAL
    priority = Column(String(50), default="MEDIUM", nullable=False, index=True)
    # Status: DRAFT, READY, PASSED, FAILED, BLOCKED, NOT_EXECUTED
    status = Column(String(50), default="NOT_EXECUTED", nullable=False, index=True)
    
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    test_suite = relationship("TestSuite", back_populates="test_cases")
    project = relationship("Project")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    executions = relationship("TestExecution", back_populates="test_case", cascade="all, delete-orphan", order_by="TestExecution.execution_date.desc()")
    bugs = relationship("Bug", back_populates="test_case")


class TestExecution(Base):
    __tablename__ = "test_executions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    test_case_id = Column(String(36), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    executed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    execution_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Result: PASS, FAIL, BLOCKED, SKIPPED
    result = Column(String(50), nullable=False, index=True)
    actual_result = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    environment = Column(String(100), default="Staging", nullable=False)
    build_version = Column(String(50), nullable=True)

    test_case = relationship("TestCase", back_populates="executions")
    executed_by = relationship("User")


class Bug(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "bugs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bug_number = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    test_case_id = Column(String(36), ForeignKey("test_cases.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Severity: LOW, MEDIUM, HIGH, CRITICAL
    severity = Column(String(50), default="MEDIUM", nullable=False, index=True)
    # Priority: LOW, MEDIUM, HIGH, URGENT
    priority = Column(String(50), default="MEDIUM", nullable=False, index=True)
    # Status: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, RETEST, REOPENED, CLOSED, WONT_FIX
    status = Column(String(50), default="OPEN", nullable=False, index=True)
    
    assigned_to_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reported_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    environment = Column(String(100), default="Staging", nullable=False)
    steps_to_reproduce = Column(Text, nullable=True)
    expected_result = Column(Text, nullable=True)
    actual_result = Column(Text, nullable=True)
    
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="bugs")
    test_case = relationship("TestCase", back_populates="bugs")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    reported_by = relationship("User", foreign_keys=[reported_by_id])
    comments = relationship("BugComment", back_populates="bug", cascade="all, delete-orphan", order_by="BugComment.created_at.asc()")
    attachments = relationship("BugAttachment", back_populates="bug", cascade="all, delete-orphan")


class BugComment(Base):
    __tablename__ = "bug_comments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bug_id = Column(String(36), ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    bug = relationship("Bug", back_populates="comments")
    user = relationship("User")


class BugAttachment(Base):
    __tablename__ = "bug_attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bug_id = Column(String(36), ForeignKey("bugs.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    content_type = Column(String(100), nullable=False, default="application/octet-stream")
    file_path = Column(String(500), nullable=False)
    uploaded_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    bug = relationship("Bug", back_populates="attachments")
    uploaded_by = relationship("User")
