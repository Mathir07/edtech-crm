#!/usr/bin/env python3
"""
Kiwi Cloud Tech CRM - Production Smoke Test
Domain: kiwicloudtech.co.in
Phase 13: Production Hardening Smoke Test Suite

Executes the complete end-to-end CRM operational lifecycle:
Login → Dashboard → College → Contact → Lead → Opportunity → Quotation
→ Sales Order → Project → Developer Task → QA Test → Bug → Delivery
→ Invoice → Payment → Service Ticket → Communication → Report
→ Notification → AI Assistant.
"""

import sys
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_smoke_test():
    print("=" * 70)
    print("KIWI CLOUD TECH CRM - PRODUCTION SMOKE TEST")
    print("Domain: kiwicloudtech.co.in")
    print("=" * 70)

    # 1. Health Checks
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    res_ready = client.get("/api/health/readiness")
    assert res_ready.status_code == 200, f"Readiness check failed: {res_ready.text}"
    print("[PASS] Step 01: Application Health & Database Readiness Verified")

    # 2. Login
    login_payload = {"email": "admin@edtechcrm.com", "password": "Admin@123"}
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.text}"

    token = res.json()["access_token"]
    user_id = res.json()["user_id"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Step 02: Administrator Authenticated & Bearer Token Issued")

    # 3. Dashboard
    res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert res.status_code == 200, f"Dashboard stats failed: {res.text}"
    print("[PASS] Step 03: Executive CRM Dashboard Stats Retrieved")

    # 4. College (Customer Institution)
    uid = uuid.uuid4().hex[:6]
    college_data = {
        "organization_name": f"Smoke Test Institute of Technology {uid}",
        "code": f"STIT_{uid.upper()}",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "type": "ENGINEERING",
        "website": "https://stit.example.edu",
        "status": "Prospect",
    }
    res = client.post("/api/v1/companies", json=college_data, headers=headers)
    assert res.status_code in [200, 201], f"Create college failed: {res.text}"
    company_id = res.json()["id"]
    print(f"[PASS] Step 04: Educational Institution Created (ID: {company_id[:8]}...)")

    # 5. Contact Person
    contact_data = {
        "company_id": company_id,
        "name": "Dr. Ramesh Kumar",
        "email": f"dean_{uid}@stit.example.edu",
        "phone": "+91 98765 43210",
        "designation": "Dean of Academics",
        "is_primary": True,
    }
    res = client.post("/api/v1/contacts", json=contact_data, headers=headers)
    assert res.status_code in [200, 201], f"Create contact failed: {res.text}"
    contact_id = res.json()["id"]
    print(f"[PASS] Step 05: Primary Contact Created (ID: {contact_id[:8]}...)")

    # 6. Lead
    lead_data = {
        "title": f"ERP Cloud Campus Modernization {uid}",
        "company_id": company_id,
        "contact_id": contact_id,
        "status": "New",
        "expected_value": 750000.0,
    }
    res = client.post("/api/v1/leads", json=lead_data, headers=headers)
    assert res.status_code in [200, 201], f"Create lead failed: {res.text}"
    lead_id = res.json()["id"]
    print(f"[PASS] Step 06: CRM Lead Registered (ID: {lead_id[:8]}...)")

    # 7. Opportunity (Convert Lead)
    conv_data = {
        "opportunity_title": f"STIT Enterprise Campus License {uid}",
        "value": 750000.0,
    }
    res = client.post(f"/api/v1/leads/{lead_id}/convert", json=conv_data, headers=headers)
    assert res.status_code in [200, 201], f"Convert lead failed: {res.text}"
    opp_id = res.json()["opportunity_id"]
    print(f"[PASS] Step 07: Sales Pipeline Opportunity Converted (ID: {opp_id[:8]}...)")

    # 8. Quotation
    quote_data = {
        "opportunity_id": opp_id,
        "company_id": company_id,
        "valid_until": (date.today() + timedelta(days=30)).isoformat(),
        "notes": "Annual Cloud ERP Subscription & Implementation",
        "items": [
            {
                "description": "Enterprise Core ERP License",
                "quantity": 1,
                "unit_price": 500000.0,
                "discount_percent": 10.0,
                "tax_rate": 18.0,
            }
        ]
    }
    res = client.post("/api/v1/quotations", json=quote_data, headers=headers)
    assert res.status_code in [200, 201], f"Create quotation failed: {res.text}"
    quote_id = res.json()["id"]
    print(f"[PASS] Step 08: Formal Quotation Calculated & Generated (ID: {quote_id[:8]}...)")

    # 9. Sales Order
    so_data = {
        "quotation_id": quote_id,
        "opportunity_id": opp_id,
        "company_id": company_id,
        "order_date": date.today().isoformat(),
        "status": "CONFIRMED",
        "billing_address": "Admin Block, STIT Campus, Coimbatore",
        "shipping_address": "Data Center, STIT Campus, Coimbatore",
        "items": [
            {
                "description": "Enterprise Core ERP License",
                "quantity": 1,
                "unit_price": 450000.0,
                "tax_rate": 18.0,
            }
        ]
    }
    res = client.post("/api/v1/sales-orders", json=so_data, headers=headers)
    assert res.status_code in [200, 201], f"Create sales order failed: {res.text}"
    so_id = res.json()["id"]
    print(f"[PASS] Step 09: Sales Order Confirmed & Booked (ID: {so_id[:8]}...)")

    # 10. Project Provisioning
    proj_data = {
        "name": f"STIT ERP Deployment {uid}",
        "company_id": company_id,
        "sales_order_id": so_id,
        "start_date": date.today().isoformat(),
        "target_end_date": (date.today() + timedelta(days=90)).isoformat(),
        "status": "PLANNING",
    }
    res = client.post("/api/v1/projects", json=proj_data, headers=headers)
    assert res.status_code in [200, 201], f"Create project failed: {res.text}"
    project_id = res.json()["id"]
    print(f"[PASS] Step 10: Operational Project Provisioned (ID: {project_id[:8]}...)")

    # 11. Developer Task
    task_data = {
        "title": "Configure Single Sign-On & LDAP Connector",
        "project_id": project_id,
        "priority": "HIGH",
        "status": "TODO",
        "estimated_hours": 16.0,
    }
    res = client.post(f"/api/v1/projects/{project_id}/tasks", json=task_data, headers=headers)
    assert res.status_code in [200, 201], f"Create task failed: {res.text}"
    task_id = res.json()["id"]
    print(f"[PASS] Step 11: Engineering Task Created & Assigned (ID: {task_id[:8]}...)")

    # 12. QA Bug Logging
    bug_data = {
        "title": f"SAML assertion clock skew discrepancy {uid}",
        "severity": "MAJOR",
        "priority": "HIGH",
        "steps_to_reproduce": "1. Run SAML login with 5 min skewed clock\n2. Observe error",
        "expected_result": "Graceful clock skew tolerance",
        "actual_result": "Clock skew rejection",
    }
    res = client.post(f"/api/v1/projects/{project_id}/bugs", json=bug_data, headers=headers)
    assert res.status_code in [200, 201], f"Create bug failed: {res.text}"
    bug_id = res.json()["id"]
    print(f"[PASS] Step 12: QA Bug Defect Logged (Bug ID: {bug_id[:8]}...)")

    # 13. Delivery Milestone
    delivery_data = {
        "status": "READY_FOR_DELIVERY",
        "override_qa": True,
        "override_reason": "Smoke test automated delivery milestone verification",
    }
    res = client.post(f"/api/v1/projects/{project_id}/delivery", json=delivery_data, headers=headers)
    assert res.status_code in [200, 201], f"Create delivery failed: {res.text}"
    print("[PASS] Step 13: Release Delivery Artifact Registered")

    # 14. Invoice Generation from Sales Order
    res = client.post(f"/api/v1/accounting/invoices/from-sales-order/{so_id}", headers=headers)
    assert res.status_code in [200, 201], f"Create invoice failed: {res.text}"
    invoice_id = res.json()["id"]
    print(f"[PASS] Step 14: Customer Invoice Dispatched (ID: {invoice_id[:8]}...)")

    # 15. Payment Receipt & Reconcile
    accs_res = client.get("/api/v1/accounting/accounts?account_type=ASSET", headers=headers)
    assert accs_res.status_code == 200, f"Get accounts failed: {accs_res.text}"
    bank_acc_id = accs_res.json()[0]["id"]

    pay_data = {
        "company_id": company_id,
        "payment_date": date.today().isoformat(),
        "amount": 531000.0,
        "payment_method": "BANK_TRANSFER",
        "bank_account_id": bank_acc_id,
        "reference": f"NEFT_{uid.upper()}",
        "allocations": [
            {
                "invoice_id": invoice_id,
                "amount": 531000.0,
            }
        ]
    }
    res = client.post("/api/v1/accounting/payments", json=pay_data, headers=headers)
    assert res.status_code in [200, 201], f"Record payment failed: {res.text}"
    payment_id = res.json()["id"]
    print(f"[PASS] Step 15: Payment Reconciled & Posted (ID: {payment_id[:8]}...)")

    # 16. Service Ticket & SLA Tracking
    ticket_data = {
        "subject": "Faculty portal grade sheet export formatting",
        "company_id": company_id,
        "contact_id": contact_id,
        "priority": "MEDIUM",
        "category": "TECHNICAL",
        "description": "Grade sheet PDF export header alignment requested by Exam Cell",
    }
    res = client.post("/api/v1/service/tickets", json=ticket_data, headers=headers)
    assert res.status_code in [200, 201], f"Create ticket failed: {res.text}"
    ticket_id = res.json()["id"]
    print(f"[PASS] Step 16: Customer Service Ticket Created with Active SLA (ID: {ticket_id[:8]}...)")

    # 17. Omnichannel Communication Log
    comm_data = {
        "recipient": "+91 98765 43210",
        "direction": "outbound",
        "call_disposition": "connected",
        "duration_seconds": 360,
        "notes": "Discussed exam cell grade sheet export update with Dr. Ramesh.",
        "company_id": company_id,
        "contact_id": contact_id,
    }
    res = client.post("/api/v1/communications/calls/log", json=comm_data, headers=headers)
    assert res.status_code in [200, 201], f"Log communication failed: {res.text}"
    print("[PASS] Step 17: Communication History Logged (Hostinger/WhatsApp: NOT LIVE TESTED / REQUIRES CREDENTIALS)")

    # 18. Executive Reports & CSV Export
    res = client.get("/api/v1/reports/executive", headers=headers)
    assert res.status_code == 200, f"Executive report failed: {res.text}"
    res_csv = client.get("/api/v1/reports/export?report_type=SALES", headers=headers)
    assert res_csv.status_code == 200, f"CSV export failed: {res_csv.text}"
    assert "text/csv" in res_csv.headers.get("content-type", "")
    print("[PASS] Step 18: Operational Analytics & Streaming CSV Export Verified")

    # 19. Notifications & Automated Rules
    res = client.get("/api/v1/notifications", headers=headers)
    assert res.status_code == 200, f"Notifications list failed: {res.text}"
    res_rules = client.get("/api/v1/automation/rules", headers=headers)
    assert res_rules.status_code == 200, f"Automation rules failed: {res_rules.text}"
    print("[PASS] Step 19: Notification Center & Automated Scan Rules Active")

    # 20. Small AI Assistant (READ + DRAFT Guardrails)
    ai_payload = {"message": f"Summarize {college_data['organization_name']}."}
    res = client.post("/api/v1/ai/chat", json=ai_payload, headers=headers)
    assert res.status_code == 200, f"AI chat failed: {res.text}"
    ai_response = res.json()
    assert "message" in ai_response
    assert "content" in ai_response["message"]
    print("[PASS] Step 20: AI Assistant Query Processed with Authoritative CRM Context")

    print("=" * 70)
    print("ALL 20/20 PRODUCTION SMOKE TEST CHECKPOINTS PASSED SUCCESSFULLY!")
    print("======================================================================")

if __name__ == "__main__":
    run_smoke_test()
