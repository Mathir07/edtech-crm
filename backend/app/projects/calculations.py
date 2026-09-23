from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.projects.models import Project, Milestone, ProjectTask
from app.qa.models import Bug, TestCase

def recalculate_project_progress(db: Session, project_id: str) -> float:
    """
    Calculates dynamic, source-of-truth progress for a project based on task and milestone completion.
    Guarantees progress is strictly clamped between 0.00 and 100.00.
    """
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        return 0.0

    tasks = db.query(ProjectTask).filter(
        ProjectTask.project_id == project_id,
        ProjectTask.is_deleted == False
    ).all()

    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()

    # Update individual milestone completion if they have tasks
    if milestones:
        for m in milestones:
            m_tasks = [t for t in tasks if t.milestone_id == m.id]
            if m_tasks:
                completed = sum(1 for t in m_tasks if t.status == "COMPLETED")
                pct = round((completed / len(m_tasks)) * 100.0, 2)
                m.completion_percentage = pct
                if pct >= 100.0 and m.status != "COMPLETED":
                    m.status = "COMPLETED"
                    m.completed_at = datetime.now(timezone.utc)
                elif pct < 100.0 and m.status == "COMPLETED":
                    m.status = "IN_PROGRESS"
                    m.completed_at = None

    if tasks:
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.status == "COMPLETED")
        progress = (completed_tasks / total_tasks) * 100.0
    elif milestones:
        total_m = len(milestones)
        completed_m = sum(1 for m in milestones if m.status == "COMPLETED")
        progress = (completed_m / total_m) * 100.0
    else:
        progress = 0.0

    # Strict clamping between 0.00 and 100.00
    clamped_progress = max(0.00, min(100.00, round(progress, 2)))
    project.progress_percentage = clamped_progress
    db.flush()
    return clamped_progress


def validate_project_delivery_readiness(db: Session, project_id: str) -> Dict[str, Any]:
    """
    Validates whether a project satisfies QA gating conditions for delivery.
    Gating Rules:
    1. No open/reopened CRITICAL or HIGH severity bugs.
    2. No FAILED test cases.
    3. At least 1 test case must exist and be executed.
    """
    open_bugs = db.query(Bug).filter(
        Bug.project_id == project_id,
        Bug.is_deleted == False,
        Bug.status.notin_(["CLOSED", "WONT_FIX"])
    ).all()

    critical_high_bugs = [b for b in open_bugs if b.severity in ["CRITICAL", "HIGH"]]
    
    test_cases = db.query(TestCase).filter(TestCase.project_id == project_id).all()
    total_cases = len(test_cases)
    passed_cases = sum(1 for tc in test_cases if tc.status == "PASSED")
    failed_cases = sum(1 for tc in test_cases if tc.status == "FAILED")
    blocked_cases = sum(1 for tc in test_cases if tc.status == "BLOCKED")

    reasons: List[str] = []
    if critical_high_bugs:
        reasons.append(f"{len(critical_high_bugs)} unresolved CRITICAL/HIGH severity bug(s) remain open.")
    if failed_cases > 0:
        reasons.append(f"{failed_cases} test case(s) are currently in FAILED status.")
    if total_cases == 0:
        reasons.append("No QA test cases have been defined or executed for this project.")

    is_ready = len(critical_high_bugs) == 0 and failed_cases == 0 and total_cases > 0

    return {
        "is_ready": is_ready,
        "total_bugs": len(open_bugs),
        "critical_high_bugs": len(critical_high_bugs),
        "total_test_cases": total_cases,
        "passed_test_cases": passed_cases,
        "failed_test_cases": failed_cases,
        "blocked_test_cases": blocked_cases,
        "reasons": reasons,
    }
