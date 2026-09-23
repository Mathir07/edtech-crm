import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, timezone

from app.core.security import get_password_hash, create_access_token
from app.users.models import User, Role, Permission
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.sales.models import Opportunity
from app.projects.models import Project
from app.qa.models import Bug
from app.service.models import Ticket
from app.accounting.models import Invoice
from app.audit.models import AuditLog
from app.ai.providers import MockDeterministicAIProvider, ExternalLLMProvider


def test_ai_status(client: TestClient, admin_headers: dict):
    res = client.get("/api/v1/ai/status", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["module"] == "ai"
    assert data["status"] == "active"


def test_ai_authentication_required(client: TestClient):
    res = client.post("/api/v1/ai/chat", json={"message": "Hello"})
    assert res.status_code == 401


def test_ai_permission_enforcement(client: TestClient, db_session: Session):
    # Create user with no permissions
    user = User(
        email="noperms@edtechcrm.com",
        first_name="No",
        last_name="Perms",
        hashed_password=get_password_hash("Pass123!"),
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(data={"sub": user.id, "email": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/v1/ai/chat", json={"message": "Hello"}, headers=headers)
    assert res.status_code == 403
    assert "Permission denied" in res.json()["detail"]


def test_prompt_length_limit(client: TestClient, admin_headers: dict):
    long_prompt = "A" * 2050
    res = client.post("/api/v1/ai/chat", json={"message": long_prompt}, headers=admin_headers)
    assert res.status_code in [400, 422]


def test_college_summary_query(client: TestClient, admin_headers: dict, db_session: Session):
    col = Company(
        organization_name="Zenith Engineering College",
        code="ZEC-001",
        type="College",
        city="Coimbatore",
        state="Tamil Nadu",
    )
    db_session.add(col)
    db_session.commit()

    res = client.post("/api/v1/ai/chat", json={"message": "Summarize Zenith Engineering College."}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "Zenith Engineering College" in data["message"]["content"]
    assert ("get_company_summary" in data["tools_used"] or "get_college_summary" in data["tools_used"])
    assert data["message"]["citations"] is not None
    assert any("Zenith Engineering College" in c["title"] for c in data["message"]["citations"])


def test_project_summary_query(client: TestClient, admin_headers: dict, db_session: Session):
    col = Company(
        organization_name="Apex Tech Institute",
        code="ATI-001",
        type="College",
    )
    db_session.add(col)
    db_session.commit()

    prj = Project(
        name="LMS Cloud Rollout",
        project_number="PRJ-AI-900",
        status="IN_PROGRESS",
        company_id=col.id,
    )
    db_session.add(prj)
    db_session.commit()

    res = client.post("/api/v1/ai/chat", json={"message": "Summarize project LMS Cloud Rollout."}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "LMS Cloud Rollout" in data["message"]["content"]
    assert "get_project_summary" in data["tools_used"]
    assert any("PRJ-AI-900" in c["title"] for c in data["message"]["citations"])


def test_service_sla_query(client: TestClient, admin_headers: dict, db_session: Session):
    col = Company(organization_name="Support Test College", code="STC-001", type="College")
    db_session.add(col)
    db_session.flush()

    con = Contact(name="Principal Support", email="sup@stc.edu", company_id=col.id)
    db_session.add(con)
    db_session.flush()

    tk = Ticket(
        ticket_number="TK-SLA-900",
        subject="Portal SSL Certificate Expiring",
        description="Urgent SSL renewal required",
        company_id=col.id,
        contact_id=con.id,
        priority="CRITICAL",
        severity="CRITICAL",
        status="OPEN",
        sla_status="AT_RISK",
    )
    db_session.add(tk)
    db_session.commit()

    res = client.post("/api/v1/ai/chat", json={"message": "Which tickets are close to SLA breach?"}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "get_service_summary" in data["tools_used"]
    assert "TK-SLA-900" in data["message"]["content"] or "At-Risk Tickets" in data["message"]["content"]


def test_qa_summary_query(client: TestClient, admin_headers: dict, db_session: Session):
    col = Company(organization_name="QA Test College", code="QTC-001", type="College")
    db_session.add(col)
    db_session.flush()

    prj = Project(name="QA Project", project_number="PRJ-QA-900", company_id=col.id)
    db_session.add(prj)
    db_session.flush()

    bug = Bug(
        bug_number="BUG-AI-900",
        title="Payment Gateway Timeout On Checkout",
        project_id=prj.id,
        severity="CRITICAL",
        priority="HIGH",
        status="OPEN",
    )
    db_session.add(bug)
    db_session.commit()

    res = client.post("/api/v1/ai/chat", json={"message": "Show critical bugs."}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "get_qa_summary" in data["tools_used"]
    assert "BUG-AI-900" in data["message"]["content"] or "Critical Bugs" in data["message"]["content"]


def test_followup_assistant_query(client: TestClient, admin_headers: dict, db_session: Session):
    lead = Lead(
        title="Dormant Lead Tech College",
        status="New",
    )
    db_session.add(lead)
    db_session.commit()

    res = client.post("/api/v1/ai/chat", json={"message": "What should I follow up on today?"}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "get_followups" in data["tools_used"]
    assert "Actionable CRM Follow-Ups" in data["message"]["content"]


def test_finance_query_authorized_user(client: TestClient, admin_headers: dict, db_session: Session):
    col = Company(organization_name="Finance Test College", code="FTC-001", type="College")
    db_session.add(col)
    db_session.flush()

    inv = Invoice(
        invoice_number="INV-AI-100",
        company_id=col.id,
        total_amount=150000.00,
        amount_due=150000.00,
        status="OVERDUE",
        due_date=date.today() - timedelta(days=5),
    )
    db_session.add(inv)
    db_session.commit()

    res = client.post("/api/v1/ai/chat", json={"message": "Show overdue invoices."}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "get_finance_summary" in data["tools_used"]
    assert "Finance & Accounting Overview" in data["message"]["content"]
    assert "INV-AI-100" in data["message"]["content"] or "Overdue Invoices" in data["message"]["content"]


def test_finance_query_unauthorized_user_strictly_blocked(client: TestClient, sales_headers: dict):
    # Sales user has ai.chat and crm permissions, but strictly NO accounting permissions
    res = client.post("/api/v1/ai/chat", json={"message": "Show overdue invoices."}, headers=sales_headers)
    assert res.status_code == 200
    data = res.json()
    # Verifies user-friendly permission denial with ZERO leaked figures or records
    assert "don't have access to financial information" in data["message"]["content"]
    assert "INV-" not in data["message"]["content"]
    assert "₹" not in data["message"]["content"]


def test_email_drafting_no_autonomous_sending(client: TestClient, admin_headers: dict):
    res = client.post(
        "/api/v1/ai/chat",
        json={"message": "Draft a follow-up email to Apex University regarding deployment schedule."},
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    content = data["message"]["content"]
    assert "draft_communication" in data["tools_used"]
    assert "Draft Only" in content
    assert "Please review and send manually" in content
    assert "Apex University" in content


def test_multi_turn_conversation_context(client: TestClient, admin_headers: dict, db_session: Session):
    col = Company(
        organization_name="Heritage Arts College",
        code="HAC-001",
        type="College",
        city="Madurai",
    )
    db_session.add(col)
    db_session.commit()

    # First turn: Summarize College
    res1 = client.post("/api/v1/ai/chat", json={"message": "Summarize Heritage Arts College."}, headers=admin_headers)
    assert res1.status_code == 200
    conv_id = res1.json()["conversation_id"]

    # Second turn: Follow-up question relying on previous entity
    res2 = client.post(
        "/api/v1/ai/chat",
        json={"message": "What about their open tickets?", "conversation_id": conv_id},
        headers=admin_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["conversation_id"] == conv_id
    assert "get_service_summary" in res2.json()["tools_used"] or "get_college_summary" in res2.json()["tools_used"]


def test_conversations_crud(client: TestClient, admin_headers: dict):
    # 1. Post a message to create conversation
    res1 = client.post("/api/v1/ai/chat", json={"message": "Show critical bugs."}, headers=admin_headers)
    conv_id = res1.json()["conversation_id"]

    # 2. List conversations
    res2 = client.get("/api/v1/ai/conversations", headers=admin_headers)
    assert res2.status_code == 200
    convs = res2.json()
    assert any(c["id"] == conv_id for c in convs)

    # 3. Get conversation detail
    res3 = client.get(f"/api/v1/ai/conversations/{conv_id}", headers=admin_headers)
    assert res3.status_code == 200
    detail = res3.json()
    assert len(detail["messages"]) >= 2  # user + assistant

    # 4. Delete conversation
    res4 = client.delete(f"/api/v1/ai/conversations/{conv_id}", headers=admin_headers)
    assert res4.status_code == 200
    assert res4.json()["status"] == "deleted"


def test_quick_actions_endpoint_rbac(client: TestClient, admin_headers: dict, sales_headers: dict):
    # Admin / finance user gets finance quick action
    res_admin = client.get("/api/v1/ai/quick-actions", headers=admin_headers)
    assert res_admin.status_code == 200
    admin_actions = res_admin.json()
    assert any(a["id"] == "overdue_invoices" for a in admin_actions)

    # Sales user does NOT get finance quick action
    res_sales = client.get("/api/v1/ai/quick-actions", headers=sales_headers)
    assert res_sales.status_code == 200
    sales_actions = res_sales.json()
    assert not any(a["id"] == "overdue_invoices" for a in sales_actions)


def test_audit_log_recorded_for_ai_query(client: TestClient, admin_headers: dict, db_session: Session):
    res = client.post("/api/v1/ai/chat", json={"message": "Which tickets are close to SLA breach?"}, headers=admin_headers)
    assert res.status_code == 200

    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "AI_QUERY",
        AuditLog.entity_type == "AI_ASSISTANT"
    ).order_by(AuditLog.created_at.desc()).first()
    assert audit is not None
    assert "tools_used" in audit.new_values


def test_report_explanation_query(client: TestClient, admin_headers: dict):
    res = client.post("/api/v1/ai/chat", json={"message": "Explain the sales report."}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "get_reports_explanation" in data["tools_used"]
    assert "Sales & Pipeline Report Explanation" in data["message"]["content"]


def test_unknown_crm_record_handling(client: TestClient, admin_headers: dict):
    res = client.post("/api/v1/ai/chat", json={"message": "Summarize NonExistentCollegeXYZ123."}, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "couldn't find" in data["message"]["content"].lower()


def test_external_provider_fallback_when_unconfigured():
    provider = ExternalLLMProvider(api_key="", model="gpt-4o-mini")
    res = provider.generate("Summarize ABC College.", "sys prompt", [])
    assert res is not None
    assert "Kiwi Cloud Tech" in res.content or "Customer Summary" in res.content
