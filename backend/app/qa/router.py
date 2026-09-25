from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
import os
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission, require_any_permission
from app.core.audit import record_audit_log
from app.core.storage import get_storage_backend, StorageBackend
from app.users.models import User
from app.sales.calculations import generate_sequential_number
from app.projects.models import Project
from app.qa.models import TestSuite, TestCase, TestExecution, Bug, BugComment, BugAttachment
from app.qa.schemas import (
    TestSuiteCreate, TestSuiteUpdate, TestSuiteResponse,
    TestCaseCreate, TestCaseUpdate, TestCaseResponse,
    TestExecutionCreate, TestExecutionResponse,
    BugCreate, BugUpdate, BugStatusTransitionRequest, BugResponse, BugDetailResponse,
    BugCommentCreate, BugCommentResponse,
    BugAttachmentResponse,
    QADashboardStatsResponse,
)

router = APIRouter()

@router.get("/qa/status")
def qa_extension_status():
    """Module extension point for QA Bug Tracking & Test Execution."""
    return {"module": "qa", "status": "active", "version": "2.0"}


# Helper formatters
def _format_test_suite_response(ts: TestSuite) -> TestSuiteResponse:
    res = TestSuiteResponse.model_validate(ts)
    res.created_by_name = ts.created_by.full_name if ts.created_by else None
    res.test_cases_count = len(ts.test_cases)
    return res

def _format_test_case_response(tc: TestCase) -> TestCaseResponse:
    res = TestCaseResponse.model_validate(tc)
    res.test_suite_name = tc.test_suite.name if tc.test_suite else None
    res.created_by_name = tc.created_by.full_name if tc.created_by else None
    res.assigned_to_name = tc.assigned_to.full_name if tc.assigned_to else None
    if tc.executions:
        res.latest_result = tc.executions[0].result
    res.executions = [
        TestExecutionResponse(
            id=ex.id,
            test_case_id=ex.test_case_id,
            executed_by_id=ex.executed_by_id,
            executed_by_name=ex.executed_by.full_name if ex.executed_by else None,
            execution_date=ex.execution_date,
            result=ex.result,
            actual_result=ex.actual_result,
            comments=ex.comments,
            environment=ex.environment,
            build_version=ex.build_version,
        )
        for ex in tc.executions
    ]
    return res

def _format_bug_response(b: Bug) -> BugResponse:
    res = BugResponse.model_validate(b)
    res.project_name = b.project.name if b.project else None
    res.test_case_number = b.test_case.test_case_number if b.test_case else None
    res.assigned_to_name = b.assigned_to.full_name if b.assigned_to else None
    res.reported_by_name = b.reported_by.full_name if b.reported_by else None
    res.comments_count = len(b.comments)
    res.attachments_count = len(b.attachments)
    return res


# =====================================================================
# 1. QA DASHBOARD STATS
# =====================================================================

@router.get("/projects/{project_id}/qa/dashboard", response_model=QADashboardStatsResponse)
def get_qa_dashboard(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.view")),
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    test_cases = db.query(TestCase).filter(TestCase.project_id == project_id).all()
    total_cases = len(test_cases)
    passed = sum(1 for tc in test_cases if tc.status == "PASSED")
    failed = sum(1 for tc in test_cases if tc.status == "FAILED")
    blocked = sum(1 for tc in test_cases if tc.status == "BLOCKED")
    not_executed = sum(1 for tc in test_cases if tc.status in ["NOT_EXECUTED", "DRAFT", "READY"])
    pass_rate = round((passed / total_cases * 100.0), 2) if total_cases > 0 else 0.0

    bugs = db.query(Bug).filter(Bug.project_id == project_id, Bug.is_deleted == False).all()
    total_bugs = len(bugs)
    open_bugs = sum(1 for b in bugs if b.status in ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"])
    critical_bugs = sum(1 for b in bugs if b.severity in ["CRITICAL", "HIGH"] and b.status not in ["CLOSED", "WONT_FIX"])
    resolved_bugs = sum(1 for b in bugs if b.status == "RESOLVED")
    retest_bugs = sum(1 for b in bugs if b.status == "RETEST")
    closed_bugs = sum(1 for b in bugs if b.status in ["CLOSED", "WONT_FIX"])

    # QA progress: test coverage + resolution rate
    executed_cases = passed + failed + blocked
    exec_rate = (executed_cases / total_cases * 100.0) if total_cases > 0 else 0.0
    bug_res_rate = ((total_bugs - open_bugs) / total_bugs * 100.0) if total_bugs > 0 else 100.0
    qa_progress = round((exec_rate * 0.7) + (bug_res_rate * 0.3), 2) if total_cases > 0 else 0.0

    return QADashboardStatsResponse(
        total_test_cases=total_cases,
        passed_cases=passed,
        failed_cases=failed,
        blocked_cases=blocked,
        not_executed_cases=not_executed,
        pass_rate=pass_rate,
        total_bugs=total_bugs,
        open_bugs=open_bugs,
        critical_bugs=critical_bugs,
        resolved_bugs=resolved_bugs,
        retest_required_bugs=retest_bugs,
        closed_bugs=closed_bugs,
        qa_progress=min(100.0, max(0.0, qa_progress)),
    )


# =====================================================================
# 2. TEST SUITES
# =====================================================================

@router.get("/projects/{project_id}/test-suites", response_model=List[TestSuiteResponse])
def list_test_suites(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.view")),
):
    suites = db.query(TestSuite).filter(TestSuite.project_id == project_id).all()
    return [_format_test_suite_response(ts) for ts in suites]


@router.post("/projects/{project_id}/test-suites", response_model=TestSuiteResponse)
def create_test_suite(
    project_id: str,
    data: TestSuiteCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.create")),
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ts = TestSuite(
        project_id=project_id,
        name=data.name,
        description=data.description,
        module=data.module,
        status=data.status,
        created_by_id=current_user.id,
    )
    db.add(ts)
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="TEST_SUITE",
        entity_id=ts.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"project_id": project_id, "name": ts.name, "module": ts.module},
        request=request,
    )
    db.commit()
    db.refresh(ts)
    return _format_test_suite_response(ts)


@router.put("/test-suites/{suite_id}", response_model=TestSuiteResponse)
def update_test_suite(
    suite_id: str,
    data: TestSuiteUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.edit")),
):
    ts = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Test suite not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ts, k, v)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="TEST_SUITE",
        entity_id=ts.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(ts)
    return _format_test_suite_response(ts)


@router.delete("/test-suites/{suite_id}")
def delete_test_suite(
    suite_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.manage")),
):
    ts = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Test suite not found")

    db.delete(ts)
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="TEST_SUITE",
        entity_id=ts.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Test suite deleted"}


# =====================================================================
# 3. TEST CASES & EXECUTION HISTORY
# =====================================================================

@router.get("/projects/{project_id}/test-cases", response_model=List[TestCaseResponse])
def list_test_cases(
    project_id: str,
    test_suite_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.view")),
):
    query = db.query(TestCase).filter(TestCase.project_id == project_id)
    if test_suite_id:
        query = query.filter(TestCase.test_suite_id == test_suite_id)
    if status:
        query = query.filter(TestCase.status == status)
    if priority:
        query = query.filter(TestCase.priority == priority)

    cases = query.order_by(TestCase.created_at.desc()).all()
    return [_format_test_case_response(tc) for tc in cases]


@router.post("/test-suites/{suite_id}/test-cases", response_model=TestCaseResponse)
def create_test_case(
    suite_id: str,
    data: TestCaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.create")),
):
    suite = db.query(TestSuite).filter(TestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    test_case_number = generate_sequential_number(db, entity_type="test_case", prefix="TC")
    tc = TestCase(
        test_case_number=test_case_number,
        test_suite_id=suite.id,
        project_id=suite.project_id,
        title=data.title,
        description=data.description,
        preconditions=data.preconditions,
        test_steps=data.test_steps,
        expected_result=data.expected_result,
        priority=data.priority,
        status=data.status,
        created_by_id=current_user.id,
        assigned_to_id=data.assigned_to_id,
    )
    db.add(tc)
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="TEST_CASE",
        entity_id=tc.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"test_case_number": test_case_number, "title": tc.title, "suite_id": suite_id},
        request=request,
    )
    db.commit()
    db.refresh(tc)
    return _format_test_case_response(tc)


@router.get("/test-cases/{case_id}", response_model=TestCaseResponse)
def get_test_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.view")),
):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    return _format_test_case_response(tc)


@router.put("/test-cases/{case_id}", response_model=TestCaseResponse)
def update_test_case(
    case_id: str,
    data: TestCaseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.edit")),
):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tc, k, v)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="TEST_CASE",
        entity_id=tc.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(tc)
    return _format_test_case_response(tc)


@router.post("/test-cases/{case_id}/execute", response_model=TestCaseResponse)
def execute_test_case(
    case_id: str,
    data: TestExecutionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("qa.execute")),
):
    """
    Records a new historical test execution entry without overwriting previous runs.
    Updates the test case's status to PASSED, FAILED, BLOCKED, or SKIPPED.
    """
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")

    valid_results = ["PASS", "FAIL", "BLOCKED", "SKIPPED"]
    if data.result not in valid_results:
        raise HTTPException(status_code=400, detail=f"Invalid execution result '{data.result}'")

    execution = TestExecution(
        test_case_id=tc.id,
        executed_by_id=current_user.id,
        execution_date=datetime.now(timezone.utc),
        result=data.result,
        actual_result=data.actual_result,
        comments=data.comments,
        environment=data.environment,
        build_version=data.build_version,
    )
    db.add(execution)

    # Update latest status on test case
    status_map = {
        "PASS": "PASSED",
        "FAIL": "FAILED",
        "BLOCKED": "BLOCKED",
        "SKIPPED": "NOT_EXECUTED",
    }
    old_status = tc.status
    tc.status = status_map[data.result]

    record_audit_log(
        db=db,
        action="TEST_EXECUTION",
        entity_type="TEST_CASE",
        entity_id=tc.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"status": old_status},
        new_values={"result": data.result, "status": tc.status, "environment": data.environment},
        request=request,
    )
    db.commit()
    db.refresh(tc)
    return _format_test_case_response(tc)


# =====================================================================
# 4. BUG MANAGEMENT & WORKFLOW
# =====================================================================

@router.get("/bugs", response_model=List[BugResponse])
def list_bugs(
    project_id: Optional[str] = None,
    severity: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bugs.view")),
):
    query = db.query(Bug).filter(Bug.is_deleted == False)
    if project_id:
        query = query.filter(Bug.project_id == project_id)
    if severity:
        query = query.filter(Bug.severity == severity)
    if priority:
        query = query.filter(Bug.priority == priority)
    if status:
        query = query.filter(Bug.status == status)
    if assigned_to_id:
        query = query.filter(Bug.assigned_to_id == assigned_to_id)
    if search:
        s = f"%{search}%"
        query = query.filter((Bug.title.ilike(s)) | (Bug.bug_number.ilike(s)))

    bugs = query.order_by(Bug.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_bug_response(b) for b in bugs]


@router.post("/projects/{project_id}/bugs", response_model=BugResponse)
def report_bug(
    project_id: str,
    data: BugCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bugs.create")),
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.test_case_id:
        tc = db.query(TestCase).filter(TestCase.id == data.test_case_id).first()
        if not tc:
            raise HTTPException(status_code=404, detail="Linked test case not found")

    bug_number = generate_sequential_number(db, entity_type="bug", prefix="BUG")
    bug = Bug(
        bug_number=bug_number,
        project_id=project_id,
        test_case_id=data.test_case_id,
        title=data.title,
        description=data.description,
        severity=data.severity,
        priority=data.priority,
        status="ASSIGNED" if data.assigned_to_id else "OPEN",
        assigned_to_id=data.assigned_to_id,
        reported_by_id=current_user.id,
        environment=data.environment,
        steps_to_reproduce=data.steps_to_reproduce,
        expected_result=data.expected_result,
        actual_result=data.actual_result,
    )
    db.add(bug)
    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="BUG",
        entity_id=bug.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"bug_number": bug_number, "title": bug.title, "severity": bug.severity, "project_id": project_id},
        request=request,
    )
    db.commit()
    db.refresh(bug)
    return _format_bug_response(bug)


@router.get("/bugs/{bug_id}", response_model=BugDetailResponse)
def get_bug_detail(
    bug_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bugs.view")),
):
    b = db.query(Bug).filter(Bug.id == bug_id, Bug.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bug not found")

    base = _format_bug_response(b)
    detail = BugDetailResponse(**base.model_dump())

    # Format comments
    detail.comments = [
        BugCommentResponse(
            id=c.id,
            bug_id=c.bug_id,
            user_id=c.user_id,
            user_name=c.user.full_name if c.user else None,
            comment=c.comment,
            created_at=c.created_at,
        )
        for c in b.comments
    ]

    # Format attachments
    detail.attachments = [
        BugAttachmentResponse(
            id=att.id,
            bug_id=att.bug_id,
            filename=att.filename,
            file_size=att.file_size,
            content_type=att.content_type,
            uploaded_by_id=att.uploaded_by_id,
            uploaded_by_name=att.uploaded_by.full_name if att.uploaded_by else None,
            created_at=att.created_at,
        )
        for att in b.attachments
    ]

    return detail


@router.patch("/bugs/{bug_id}/status", response_model=BugDetailResponse)
def transition_bug_status(
    bug_id: str,
    payload: BugStatusTransitionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["bugs.edit", "bugs.resolve", "bugs.retest", "bugs.close"])),
):
    """
    Validates controlled bug workflow transitions:
    OPEN -> ASSIGNED, IN_PROGRESS, WONT_FIX
    ASSIGNED -> IN_PROGRESS, WONT_FIX
    IN_PROGRESS -> RESOLVED, OPEN, WONT_FIX
    RESOLVED -> RETEST
    RETEST -> CLOSED (pass), REOPENED (fail)
    REOPENED -> ASSIGNED, IN_PROGRESS
    CLOSED -> REOPENED
    WONT_FIX -> REOPENED, CLOSED
    """
    b = db.query(Bug).filter(Bug.id == bug_id, Bug.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bug not found")

    valid_transitions: Dict[str, List[str]] = {
        "OPEN": ["ASSIGNED", "IN_PROGRESS", "WONT_FIX", "RESOLVED"],
        "ASSIGNED": ["IN_PROGRESS", "WONT_FIX", "RESOLVED", "OPEN"],
        "IN_PROGRESS": ["RESOLVED", "OPEN", "WONT_FIX"],
        "RESOLVED": ["RETEST", "IN_PROGRESS", "CLOSED"],
        "RETEST": ["CLOSED", "REOPENED", "IN_PROGRESS"],
        "REOPENED": ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "WONT_FIX"],
        "CLOSED": ["REOPENED"],
        "WONT_FIX": ["REOPENED", "CLOSED"],
    }

    target = payload.status
    allowed = valid_transitions.get(b.status, [])
    if target not in allowed and target != b.status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid bug status transition from '{b.status}' to '{target}'. Allowed: {', '.join(allowed)}"
        )

    # Permission check for resolving/retesting/closing
    user_perms = current_user.get_permission_codes()
    is_admin = current_user.is_superuser or "*" in user_perms
    if target == "RESOLVED" and not is_admin and "bugs.resolve" not in user_perms:
        raise HTTPException(status_code=403, detail="Permission 'bugs.resolve' required to resolve bugs.")
    if target in ["RETEST", "CLOSED", "REOPENED"] and not is_admin and "bugs.retest" not in user_perms and "bugs.close" not in user_perms:
        raise HTTPException(status_code=403, detail="Permission 'bugs.retest' or 'bugs.close' required.")

    old_status = b.status
    b.status = target
    if target == "RESOLVED":
        b.resolved_at = datetime.now(timezone.utc)
    elif target == "CLOSED":
        b.closed_at = datetime.now(timezone.utc)
    elif target == "REOPENED":
        b.resolved_at = None
        b.closed_at = None

    if payload.assigned_to_id:
        b.assigned_to_id = payload.assigned_to_id

    # If comment provided, append to comments
    if payload.comment:
        comm = BugComment(
            bug_id=b.id,
            user_id=current_user.id,
            comment=f"[Status -> {target}] {payload.comment}",
        )
        db.add(comm)

    record_audit_log(
        db=db,
        action="STATUS_CHANGE",
        entity_type="BUG",
        entity_id=b.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"status": old_status},
        new_values={"status": target, "comment": payload.comment},
        request=request,
    )
    db.commit()
    db.refresh(b)
    return get_bug_detail(bug_id=b.id, db=db, current_user=current_user)


@router.post("/bugs/{bug_id}/comments", response_model=BugCommentResponse)
def add_bug_comment(
    bug_id: str,
    data: BugCommentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bugs.view")),
):
    b = db.query(Bug).filter(Bug.id == bug_id, Bug.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bug not found")

    comm = BugComment(
        bug_id=b.id,
        user_id=current_user.id,
        comment=data.comment,
    )
    db.add(comm)
    db.commit()
    db.refresh(comm)

    return BugCommentResponse(
        id=comm.id,
        bug_id=comm.bug_id,
        user_id=comm.user_id,
        user_name=current_user.full_name,
        comment=comm.comment,
        created_at=comm.created_at,
    )


@router.post("/bugs/{bug_id}/attachments", response_model=BugAttachmentResponse)
async def upload_bug_attachment(
    bug_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bugs.edit")),
    storage: StorageBackend = Depends(get_storage_backend),
):
    b = db.query(Bug).filter(Bug.id == bug_id, Bug.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bug not found")

    file_bytes = await file.read()
    max_size = 10 * 1024 * 1024  # 10MB limit
    qa_allowed_exts = {".png", ".jpg", ".jpeg", ".pdf", ".txt", ".log", ".json", ".zip", ".csv"}

    storage_res = storage.upload(
        file_bytes=file_bytes,
        filename=file.filename or "attachment",
        content_type=file.content_type or "application/octet-stream",
        prefix=f"bugs/{b.id}",
        max_size_bytes=max_size,
        allowed_extensions=qa_allowed_exts,
    )

    att = BugAttachment(
        bug_id=b.id,
        filename=storage_res.filename,
        file_size=storage_res.size,
        content_type=storage_res.content_type,
        file_path=storage_res.key,
        uploaded_by_id=current_user.id,
    )
    db.add(att)
    record_audit_log(
        db=db,
        action="ATTACHMENT_UPLOAD",
        entity_type="BUG",
        entity_id=b.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"filename": storage_res.filename, "size": storage_res.size, "key": storage_res.key},
        request=request,
    )
    db.commit()
    db.refresh(att)

    return BugAttachmentResponse(
        id=att.id,
        bug_id=att.bug_id,
        filename=att.filename,
        file_size=att.file_size,
        content_type=att.content_type,
        uploaded_by_id=att.uploaded_by_id,
        uploaded_by_name=current_user.full_name,
        created_at=att.created_at,
    )


@router.get("/bugs/{bug_id}/attachments/{att_id}/download")
def download_bug_attachment(
    bug_id: str,
    att_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bugs.view")),
    storage: StorageBackend = Depends(get_storage_backend),
):
    att = db.query(BugAttachment).filter(BugAttachment.id == att_id, BugAttachment.bug_id == bug_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not storage.exists(att.file_path):
        raise HTTPException(status_code=404, detail="Attachment physical file not found on server storage.")

    try:
        stream, content_type, size = storage.get_stream(att.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Attachment physical file not found on server storage.")

    return StreamingResponse(
        stream,
        media_type=att.content_type or content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{att.filename}"',
            "Content-Length": str(att.file_size or size),
        },
    )
