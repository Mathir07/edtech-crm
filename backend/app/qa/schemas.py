from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

# --- TEST SUITES ---

class TestSuiteBase(BaseModel):
    name: str
    description: Optional[str] = None
    module: Optional[str] = None
    status: str = "ACTIVE"

class TestSuiteCreate(TestSuiteBase):
    pass

class TestSuiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    status: Optional[str] = None

class TestSuiteResponse(TestSuiteBase):
    id: str
    project_id: str
    created_by_name: Optional[str] = None
    test_cases_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- TEST EXECUTIONS ---

class TestExecutionCreate(BaseModel):
    result: str  # PASS, FAIL, BLOCKED, SKIPPED
    actual_result: Optional[str] = None
    comments: Optional[str] = None
    environment: str = "Staging"
    build_version: Optional[str] = None

class TestExecutionResponse(TestExecutionCreate):
    id: str
    test_case_id: str
    executed_by_id: Optional[str] = None
    executed_by_name: Optional[str] = None
    execution_date: datetime

    model_config = ConfigDict(from_attributes=True)


# --- TEST CASES ---

class TestCaseBase(BaseModel):
    title: str
    description: Optional[str] = None
    preconditions: Optional[str] = None
    test_steps: Optional[str] = None
    expected_result: Optional[str] = None
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    status: str = "NOT_EXECUTED"  # DRAFT, READY, PASSED, FAILED, BLOCKED, NOT_EXECUTED
    assigned_to_id: Optional[str] = None

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    preconditions: Optional[str] = None
    test_steps: Optional[str] = None
    expected_result: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[str] = None

class TestCaseResponse(TestCaseBase):
    id: str
    test_case_number: str
    test_suite_id: str
    project_id: str
    test_suite_name: Optional[str] = None
    created_by_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    latest_result: Optional[str] = None
    executions: List[TestExecutionResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- BUG COMMENTS & ATTACHMENTS ---

class BugCommentCreate(BaseModel):
    comment: str

class BugCommentResponse(BaseModel):
    id: str
    bug_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    comment: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BugAttachmentResponse(BaseModel):
    id: str
    bug_id: str
    filename: str
    file_size: int
    content_type: str
    uploaded_by_id: Optional[str] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- BUGS ---

class BugBase(BaseModel):
    title: str
    description: Optional[str] = None
    test_case_id: Optional[str] = None
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    priority: str = "MEDIUM"  # LOW, MEDIUM, HIGH, URGENT
    assigned_to_id: Optional[str] = None
    environment: str = "Staging"
    steps_to_reproduce: Optional[str] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None

class BugCreate(BugBase):
    pass

class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[str] = None
    environment: Optional[str] = None
    steps_to_reproduce: Optional[str] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None

class BugStatusTransitionRequest(BaseModel):
    status: str  # OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, RETEST, REOPENED, CLOSED, WONT_FIX
    comment: Optional[str] = None
    assigned_to_id: Optional[str] = None

class BugResponse(BugBase):
    id: str
    bug_number: str
    project_id: str
    project_name: Optional[str] = None
    test_case_number: Optional[str] = None
    status: str
    assigned_to_name: Optional[str] = None
    reported_by_name: Optional[str] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    comments_count: int = 0
    attachments_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BugDetailResponse(BugResponse):
    comments: List[BugCommentResponse] = []
    attachments: List[BugAttachmentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- QA DASHBOARD STATS ---

class QADashboardStatsResponse(BaseModel):
    total_test_cases: int = 0
    passed_cases: int = 0
    failed_cases: int = 0
    blocked_cases: int = 0
    not_executed_cases: int = 0
    pass_rate: float = 0.0
    total_bugs: int = 0
    open_bugs: int = 0
    critical_bugs: int = 0
    resolved_bugs: int = 0
    retest_required_bugs: int = 0
    closed_bugs: int = 0
    qa_progress: float = 0.0
