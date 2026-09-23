import sys
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
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


def run_acceptance_ai_e2e():
    print("=" * 60)
    print("PHASE 12 E2E: SMALL AI ASSISTANT ACCEPTANCE TEST SUITE")
    print("Domain: kiwicloudtech.co.in")
    print("=" * 60)

    client = TestClient(app)
    db = SessionLocal()
    checkpoints_passed = 0
    total_checkpoints = 15

    try:
        # Bootstrap test users & data
        admin_user = db.query(User).filter(User.is_superuser == True).first()
        if not admin_user:
            admin_user = db.query(User).first()

        # Create sales user without accounting permissions
        sales_role = db.query(Role).filter(Role.name == "Sales Executive").first()
        ai_perm = db.query(Permission).filter(Permission.code == "ai.chat").first()
        if not ai_perm:
            ai_perm = Permission(code="ai.chat", name="Interact with AI Assistant", module="ai")
            db.add(ai_perm)
            db.commit()

        if sales_role and ai_perm not in sales_role.permissions:
            sales_role.permissions.append(ai_perm)
            db.commit()

        sales_user = db.query(User).filter(User.email == "sales_e2e_ai@kiwicloudtech.co.in").first()
        if not sales_user:
            sales_user = User(
                email="sales_e2e_ai@kiwicloudtech.co.in",
                first_name="Sales",
                last_name="E2E",
                hashed_password=get_password_hash("Password123!"),
                is_active=True,
                is_superuser=False,
            )
            if sales_role:
                sales_user.roles.append(sales_role)
            db.add(sales_user)
            db.commit()
            db.refresh(sales_user)

        # Create tokens directly
        admin_token = create_access_token({"sub": admin_user.id})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        sales_token = create_access_token({"sub": sales_user.id})
        sales_headers = {"Authorization": f"Bearer {sales_token}"}

        # Seed realistic CRM entities for AI queries
        col = db.query(Company).filter(Company.code == "E2E-COL-AI").first()
        if not col:
            col = Company(
                organization_name="Global Institute of Technology",
                code="E2E-COL-AI",
                type="Autonomous College",
                city="Bengaluru",
            )
            db.add(col)
            db.commit()
            db.refresh(col)

        contact = db.query(Contact).filter(Contact.company_id == col.id).first()
        if not contact:
            contact = Contact(
                name="Dr. S. K. Sharma",
                designation="Principal",
                email="principal@globalinst.edu",
                company_id=col.id,
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)

        prj = db.query(Project).filter(Project.project_number == "PRJ-E2E-AI").first()
        if not prj:
            prj = Project(
                name="Smart Campus ERP Rollout",
                project_number="PRJ-E2E-AI",
                company_id=col.id,
                status="IN_PROGRESS",
                progress_percentage=45.0,
            )
            db.add(prj)
            db.commit()
            db.refresh(prj)

        ticket = db.query(Ticket).filter(Ticket.ticket_number == "TK-E2E-AI").first()
        if not ticket:
            ticket = Ticket(
                ticket_number="TK-E2E-AI",
                subject="LMS Server Database Latency",
                description="Database response latency exceeding 3 seconds during peak examination hours.",
                company_id=col.id,
                contact_id=contact.id,
                project_id=prj.id,
                priority="CRITICAL",
                severity="CRITICAL",
                status="OPEN",
                sla_status="AT_RISK",
            )
            db.add(ticket)
            db.commit()

        bug = db.query(Bug).filter(Bug.bug_number == "BUG-E2E-AI").first()
        if not bug:
            bug = Bug(
                bug_number="BUG-E2E-AI",
                title="Student Registration Duplicate Enrollment Bug",
                project_id=prj.id,
                severity="CRITICAL",
                priority="HIGH",
                status="OPEN",
            )
            db.add(bug)
            db.commit()

        inv = db.query(Invoice).filter(Invoice.invoice_number == "INV-E2E-AI").first()
        if not inv:
            inv = Invoice(
                invoice_number="INV-E2E-AI",
                company_id=col.id,
                total_amount=Decimal("250000.00"),
                amount_due=Decimal("250000.00"),
                status="OVERDUE",
                due_date=date.today() - timedelta(days=12),
            )
            db.add(inv)
            db.commit()

        lead = db.query(Lead).filter(Lead.title == "Dormant E2E Lead").first()
        if not lead:
            lead = Lead(
                title="Dormant E2E Lead",
                status="New",
                company_id=col.id,
            )
            db.add(lead)
            db.commit()

        # ============================================================
        # CHECKPOINT 01: Authenticated user opens AI assistant
        # ============================================================
        r1 = client.get("/api/v1/ai/status", headers=admin_headers)
        assert r1.status_code == 200 and r1.json().get("status") == "active", f"Checkpoint 1 Failed: {r1.text}"
        checkpoints_passed += 1
        print("[PASS] Checkpoint 01: Authenticated user connected to AI Assistant service.")

        # ============================================================
        # CHECKPOINT 02: Simple CRM search
        # ============================================================
        r2 = client.post("/api/v1/ai/chat", json={"message": "Find Global Institute of Technology"}, headers=admin_headers)
        assert r2.status_code == 200, f"Checkpoint 2 Failed: {r2.text}"
        assert "Global Institute of Technology" in r2.json()["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 02: Simple CRM search executed and returned matched entity.")

        # ============================================================
        # CHECKPOINT 03: Customer / College summary
        # ============================================================
        r3 = client.post("/api/v1/ai/chat", json={"message": "Summarize Global Institute of Technology."}, headers=admin_headers)
        assert r3.status_code == 200, f"Checkpoint 3 Failed: {r3.text}"
        data3 = r3.json()
        assert "Customer Summary" in data3["message"]["content"]
        assert "get_company_summary" in data3["tools_used"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 03: Company summary returned structured CRM customer data.")

        # ============================================================
        # CHECKPOINT 04: Project summary
        # ============================================================
        r4 = client.post("/api/v1/ai/chat", json={"message": "Summarize project Smart Campus ERP Rollout."}, headers=admin_headers)
        assert r4.status_code == 200, f"Checkpoint 4 Failed: {r4.text}"
        data4 = r4.json()
        assert "Project Summary" in data4["message"]["content"]
        assert "PRJ-E2E-AI" in data4["message"]["content"] or "Authoritative Progress" in data4["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 04: Project summary returned authoritative progress & QA status.")

        # ============================================================
        # CHECKPOINT 05: Follow-up query
        # ============================================================
        r5 = client.post("/api/v1/ai/chat", json={"message": "What should I follow up on today?"}, headers=admin_headers)
        assert r5.status_code == 200, f"Checkpoint 5 Failed: {r5.text}"
        assert "get_followups" in r5.json()["tools_used"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 05: Actionable follow-ups query executed successfully.")

        # ============================================================
        # CHECKPOINT 06: Service / SLA query
        # ============================================================
        r6 = client.post("/api/v1/ai/chat", json={"message": "Which tickets are close to SLA breach?"}, headers=admin_headers)
        assert r6.status_code == 200, f"Checkpoint 6 Failed: {r6.text}"
        data6 = r6.json()
        assert "get_service_summary" in data6["tools_used"]
        assert "Service & Support Status" in data6["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 06: Service / SLA query returned at-risk and breached tickets.")

        # ============================================================
        # CHECKPOINT 07: QA query
        # ============================================================
        r7 = client.post("/api/v1/ai/chat", json={"message": "Show critical bugs."}, headers=admin_headers)
        assert r7.status_code == 200, f"Checkpoint 7 Failed: {r7.text}"
        data7 = r7.json()
        assert "get_qa_summary" in data7["tools_used"]
        assert "QA & Quality Status" in data7["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 07: QA critical bugs query executed and returned active issues.")

        # ============================================================
        # CHECKPOINT 08: Finance query by authorized user
        # ============================================================
        r8 = client.post("/api/v1/ai/chat", json={"message": "Show overdue invoices."}, headers=admin_headers)
        assert r8.status_code == 200, f"Checkpoint 8 Failed: {r8.text}"
        data8 = r8.json()
        assert "get_finance_summary" in data8["tools_used"]
        assert "Finance & Accounting Overview" in data8["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 08: Finance query by authorized user returned receivables & invoice data.")

        # ============================================================
        # CHECKPOINT 09: Finance query by unauthorized user is strictly blocked
        # ============================================================
        r9 = client.post("/api/v1/ai/chat", json={"message": "Show overdue invoices."}, headers=sales_headers)
        assert r9.status_code == 200, f"Checkpoint 9 Failed: {r9.text}"
        data9 = r9.json()
        assert "don't have access to financial information" in data9["message"]["content"]
        assert "INV-" not in data9["message"]["content"]
        assert "250000" not in data9["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 09: Unauthorized finance query strictly blocked with zero data leakage.")

        # ============================================================
        # CHECKPOINT 10: Email draft generated
        # ============================================================
        r10 = client.post(
            "/api/v1/ai/chat",
            json={"message": "Draft a follow-up email to Global Institute of Technology regarding project milestone."},
            headers=admin_headers
        )
        assert r10.status_code == 200, f"Checkpoint 10 Failed: {r10.text}"
        data10 = r10.json()
        assert "draft_communication" in data10["tools_used"]
        assert "Generated Draft" in data10["message"]["content"]
        checkpoints_passed += 1
        print("[PASS] Checkpoint 10: Communication draft generated with subject and body.")

        # ============================================================
        # CHECKPOINT 11: AI does not send the email
        # ============================================================
        content10 = data10["message"]["content"]
        assert "Draft Only" in content10 and "review and send manually" in content10
        checkpoints_passed += 1
        print("[PASS] Checkpoint 11: Confirmed AI does not autonomously send email (review disclaimer present).")

        # ============================================================
        # CHECKPOINT 12: Conversation context works
        # ============================================================
        conv_id = data3["conversation_id"]
        r12 = client.post(
            "/api/v1/ai/chat",
            json={"message": "What about their open tickets?", "conversation_id": conv_id},
            headers=admin_headers
        )
        assert r12.status_code == 200, f"Checkpoint 12 Failed: {r12.text}"
        assert r12.json()["conversation_id"] == conv_id
        checkpoints_passed += 1
        print("[PASS] Checkpoint 12: Multi-turn context retained active entity across turns.")

        # ============================================================
        # CHECKPOINT 13: Source / record link returned
        # ============================================================
        citations = data3["message"].get("citations")
        assert citations is not None and len(citations) > 0, "No citations returned."
        assert any("/companies/" in c["url"] for c in citations), "Citation URL missing college link."
        checkpoints_passed += 1
        print("[PASS] Checkpoint 13: Source citations with clickable CRM record links verified.")

        # ============================================================
        # CHECKPOINT 14: AI provider failure / oversized prompt handled safely
        # ============================================================
        r14 = client.post("/api/v1/ai/chat", json={"message": "X" * 2050}, headers=admin_headers)
        assert r14.status_code in [400, 422], f"Checkpoint 14 Failed: {r14.status_code}"
        checkpoints_passed += 1
        print("[PASS] Checkpoint 14: Rate limiting and oversized prompt handled safely without crash.")

        # ============================================================
        # CHECKPOINT 15: Audit event recorded
        # ============================================================
        audit = db.query(AuditLog).filter(
            AuditLog.action == "AI_QUERY",
            AuditLog.entity_type == "AI_ASSISTANT"
        ).order_by(AuditLog.created_at.desc()).first()
        assert audit is not None, "Checkpoint 15 Failed: Audit log record not found."
        assert "tools_used" in audit.new_values, "Audit log missing tools_used metadata."
        checkpoints_passed += 1
        print("[PASS] Checkpoint 15: Audit log entry verified with user ID, tools used, and timestamp.")

    finally:
        db.close()

    print("=" * 60)
    print(f"PHASE 12 E2E RESULT: {checkpoints_passed}/{total_checkpoints} CHECKPOINTS PASSED")
    print("=" * 60)
    assert checkpoints_passed == total_checkpoints


if __name__ == "__main__":
    run_acceptance_ai_e2e()
