import pytest
from datetime import datetime, timezone, timedelta, date
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import User
from app.organizations.models import Company, Contact
from app.activities.models import Task, Meeting
from app.crm.models import Lead
from app.sales.models import Opportunity
from app.accounting.models import Invoice, CustomerPayment
from app.service.models import Ticket
from app.projects.models import Project, Milestone
from app.qa.models import Bug
from app.notifications.models import Notification, NotificationPreference, AutomationRule, AutomationJobLog
from app.notifications.automation import (
    scan_task_reminders,
    scan_meeting_reminders,
    scan_lead_followups,
    scan_opportunity_followups,
    scan_invoice_reminders,
    scan_payment_received,
    scan_service_sla,
    scan_project_delays,
    scan_critical_qa_bugs,
    execute_all_automations,
    create_notification_if_unique,
)


def _get_or_create_college(db: Session) -> Company:
    col = db.query(Company).first()
    if not col:
        col = Company(
            organization_name="PSG College of Technology",
            code="PSG-AUTO-01",
            type="Engineering College",
            city="Coimbatore",
            state="Tamil Nadu",
            country="India",
            status="Customer",
        )
        db.add(col)
        db.commit()
        db.refresh(col)
    return col


def _get_or_create_contact(db: Session, company_id: str) -> Contact:
    contact = db.query(Contact).filter(Contact.company_id == company_id).first()
    if not contact:
        contact = Contact(
            company_id=company_id,
            name="Dr. Karthik Rajan",
            email="karthik@psgtech.edu",
            phone="+919876543210",
            designation="Principal",
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
    return contact


def _get_or_create_project(db: Session, company_id: str, pm_id: str) -> Project:
    proj = db.query(Project).filter(Project.company_id == company_id).first()
    if not proj:
        proj = Project(
            project_number="PRJ-AUTO-01",
            name="Campus Automation Deployment",
            company_id=company_id,
            project_manager_id=pm_id,
            status="ACTIVE",
            start_date=date.today(),
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
    return proj


def test_notifications_status(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/notifications/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["module"] == "notifications"
    assert data["status"] == "active"


def test_notification_creation_and_listing(client: TestClient, admin_headers: dict, db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    assert admin is not None

    n1 = Notification(
        organization_id="kct-default",
        user_id=admin.id,
        notification_type="SYSTEM",
        title="Welcome to Phase 11",
        message="Automation system initialized.",
        priority="LOW",
        dedup_key="test:sys:1",
    )
    n2 = Notification(
        organization_id="kct-default",
        user_id=admin.id,
        notification_type="TASK_DUE",
        title="Urgent task review",
        message="Task deadline approaching.",
        priority="HIGH",
        dedup_key="test:task:1",
    )
    db_session.add_all([n1, n2])
    db_session.commit()

    # List all
    resp = client.get("/api/v1/notifications", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert data["unread_count"] >= 2

    # Filter by priority
    resp_filtered = client.get("/api/v1/notifications?priority=HIGH", headers=admin_headers)
    assert resp_filtered.status_code == 200
    high_items = resp_filtered.json()["items"]
    assert all(item["priority"] == "HIGH" for item in high_items)


def test_notification_unread_and_mark_read(client: TestClient, admin_headers: dict, db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()

    # Insert an unread notification specifically for this test
    n = Notification(
        organization_id="kct-default",
        user_id=admin.id,
        notification_type="TASK_DUE",
        title="Unread Check",
        message="Pending action",
        priority="MEDIUM",
        is_read=False,
    )
    db_session.add(n)
    db_session.commit()

    # Check unread count is >= 1
    resp = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["unread_count"] >= 1

    # Mark all as read
    resp_mark = client.post(
        "/api/v1/notifications/mark-read",
        json={"mark_all": True},
        headers=admin_headers,
    )
    assert resp_mark.status_code == 200
    assert resp_mark.json()["success"] is True

    # Check unread count is now 0
    resp_after = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert resp_after.status_code == 200
    assert resp_after.json()["unread_count"] == 0


def test_notification_deduplication(db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    assert admin is not None

    dedup = "dedup:unique:test:123"
    notif1 = create_notification_if_unique(
        db=db_session,
        user_id=admin.id,
        notification_type="SYSTEM",
        title="Dedup Test",
        message="First event",
        dedup_key=dedup,
    )
    db_session.commit()
    assert notif1 is not None

    notif2 = create_notification_if_unique(
        db=db_session,
        user_id=admin.id,
        notification_type="SYSTEM",
        title="Dedup Test Duplicate",
        message="Second event",
        dedup_key=dedup,
    )
    assert notif2 is None


def test_notification_preferences_crud(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/notifications/preferences", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["in_app_enabled"] is True

    update_payload = {
        "email_enabled": False,
        "tasks_email": False,
        "qa_email": True,
    }
    resp_update = client.put(
        "/api/v1/notifications/preferences",
        json=update_payload,
        headers=admin_headers,
    )
    assert resp_update.status_code == 200
    updated = resp_update.json()
    assert updated["email_enabled"] is False
    assert updated["tasks_email"] is False
    assert updated["qa_email"] is True


def test_automation_rules_api(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/automation/rules", headers=admin_headers)
    assert resp.status_code == 200
    rules = resp.json()
    assert len(rules) >= 9

    target_rule = rules[0]
    rule_id = target_rule["id"]

    resp_toggle = client.put(
        f"/api/v1/automation/rules/{rule_id}/toggle",
        json={"is_enabled": False},
        headers=admin_headers,
    )
    assert resp_toggle.status_code == 200
    assert resp_toggle.json()["is_enabled"] is False

    resp_restore = client.put(
        f"/api/v1/automation/rules/{rule_id}/toggle",
        json={"is_enabled": True},
        headers=admin_headers,
    )
    assert resp_restore.status_code == 200
    assert resp_restore.json()["is_enabled"] is True

    resp_run = client.post("/api/v1/automation/run", headers=admin_headers)
    assert resp_run.status_code == 200
    run_data = resp_run.json()
    assert run_data["status"] == "COMPLETED"
    assert run_data["jobs_executed"] >= 9

    resp_logs = client.get("/api/v1/automation/logs", headers=admin_headers)
    assert resp_logs.status_code == 200
    logs = resp_logs.json()
    assert len(logs) >= 1


def test_task_reminders_automation(db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    now = datetime.now(timezone.utc)

    overdue_task = Task(
        title="Overdue College Audit",
        status="In Progress",
        assigned_to_id=admin.id,
        due_date=now - timedelta(days=2),
    )
    due_soon_task = Task(
        title="Upcoming SLA Review",
        status="Pending",
        assigned_to_id=admin.id,
        due_date=now + timedelta(hours=5),
    )
    db_session.add_all([overdue_task, due_soon_task])
    db_session.commit()

    res = scan_task_reminders(db_session)
    assert res["items_processed"] >= 2
    assert res["notifications_created"] >= 2


def test_meeting_reminders_automation(db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    now = datetime.now(timezone.utc)

    meeting_1h = Meeting(
        title="College Principal Demo",
        status="Scheduled",
        organizer_id=admin.id,
        start_time=now + timedelta(minutes=50),
        end_time=now + timedelta(minutes=110),
    )
    db_session.add(meeting_1h)
    db_session.commit()

    res = scan_meeting_reminders(db_session)
    assert res["items_processed"] >= 1
    assert res["notifications_created"] >= 1


def test_lead_and_opp_followup_automation(db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    now = datetime.now(timezone.utc)
    eight_days_ago = now - timedelta(days=8)
    col = _get_or_create_college(db_session)

    lead = Lead(
        title="Dr. Sharma - Engineering College",
        status="New",
        owner_id=admin.id,
        created_at=eight_days_ago,
        updated_at=eight_days_ago,
    )
    from app.sales.models import Pipeline, PipelineStage
    pipe = db_session.query(Pipeline).first()
    stage = db_session.query(PipelineStage).first()
    opp = Opportunity(
        company_id=col.id,
        pipeline_id=pipe.id if pipe else None,
        stage_id=stage.id if stage else None,
        title="Campus Cloud ERP Package",
        status="Open",
        owner_id=admin.id,
        value=500000.0,
        created_at=eight_days_ago,
        updated_at=eight_days_ago,
    )
    db_session.add_all([lead, opp])
    db_session.commit()

    res_lead = scan_lead_followups(db_session)
    assert res_lead["notifications_created"] >= 1

    res_opp = scan_opportunity_followups(db_session)
    assert res_opp["notifications_created"] >= 1


def test_invoice_and_payment_automation(db_session: Session):
    col = _get_or_create_college(db_session)
    today = date.today()

    inv = Invoice(
        company_id=col.id,
        invoice_number="INV-AUTO-001",
        invoice_date=today - timedelta(days=30),
        due_date=today - timedelta(days=5),
        status="OVERDUE",
        total_amount=150000.0,
        amount_due=150000.0,
    )
    db_session.add(inv)
    db_session.commit()

    res_inv = scan_invoice_reminders(db_session)
    assert res_inv["notifications_created"] >= 1


def test_service_sla_automation(db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    col = _get_or_create_college(db_session)
    contact = _get_or_create_contact(db_session, col.id)
    now = datetime.now(timezone.utc)

    tk = Ticket(
        ticket_number="TCK-AUTO-01",
        subject="Portal Login Failure",
        description="Students unable to authenticate",
        company_id=col.id,
        contact_id=contact.id,
        status="IN_PROGRESS",
        assigned_to_id=admin.id,
        first_response_due_at=now - timedelta(minutes=15),
        sla_breached=True,
        sla_status="BREACHED",
    )
    db_session.add(tk)
    db_session.commit()

    res_sla = scan_service_sla(db_session)
    assert res_sla["notifications_created"] >= 1


def test_critical_qa_bug_automation(db_session: Session):
    admin = db_session.query(User).filter(User.is_superuser == True).first()
    col = _get_or_create_college(db_session)
    proj = _get_or_create_project(db_session, col.id, admin.id)

    bug = Bug(
        bug_number="BUG-AUTO-CRIT",
        project_id=proj.id,
        title="Data corruption on college semester roll",
        severity="CRITICAL",
        status="Open",
        assigned_to_id=admin.id,
    )
    db_session.add(bug)
    db_session.commit()

    res_qa = scan_critical_qa_bugs(db_session)
    assert res_qa["notifications_created"] >= 1


def test_automation_execution_idempotency(db_session: Session):
    logs_run1 = execute_all_automations(db_session)
    assert len(logs_run1) >= 9

    logs_run2 = execute_all_automations(db_session)
    assert len(logs_run2) >= 9
    second_run_created = sum(l.notifications_created for l in logs_run2)
    assert second_run_created == 0, f"Expected 0 new notifications on immediate rerun, got {second_run_created}"


def test_financial_notification_rbac(client: TestClient, sales_headers: dict, admin_headers: dict, db_session: Session):
    sales_exec = db_session.query(User).filter(User.email == "test.sales@edtechcrm.com").first()
    assert sales_exec is not None

    fin_notif = Notification(
        organization_id="kct-default",
        user_id=sales_exec.id,
        notification_type="INVOICE_DUE",
        title="College Invoice Due",
        message="Confidential financial due notice",
        priority="HIGH",
        dedup_key="rbac:test:inv:1",
    )
    db_session.add(fin_notif)
    db_session.commit()

    resp_se = client.get("/api/v1/notifications", headers=sales_headers)
    assert resp_se.status_code == 200
    se_items = resp_se.json()["items"]
    assert all(item["notification_type"] not in ["INVOICE_DUE", "PAYMENT_RECEIVED"] for item in se_items)

    resp_admin = client.get("/api/v1/notifications", headers=admin_headers)
    assert resp_admin.status_code == 200


@patch("app.communication.providers.hostinger.HostingerEmailProvider.send_email")
def test_hostinger_email_notification_mock(mock_send_email, db_session: Session):
    mock_send_email.return_value = {"status": "SUCCESS", "message_id": "<mock123@kiwicloudtech.co.in>"}

    admin = db_session.query(User).filter(User.is_superuser == True).first()
    assert admin is not None

    pref = db_session.query(NotificationPreference).filter(NotificationPreference.user_id == admin.id).first()
    if not pref:
        pref = NotificationPreference(user_id=admin.id, in_app_enabled=True, email_enabled=True, qa_email=True)
        db_session.add(pref)
    else:
        pref.email_enabled = True
        pref.qa_email = True
    db_session.commit()

    notif = create_notification_if_unique(
        db=db_session,
        user_id=admin.id,
        notification_type="QA_CRITICAL_BUG",
        title="Payment gateway crash",
        message="Critical exception in fee collection",
        priority="CRITICAL",
        dedup_key="mock:test:qa:crit:1",
    )
    db_session.commit()

    assert notif is not None
    assert mock_send_email.called
