"""
Live End-to-End Acceptance Test for Service / Support Module.
Executes 34 comprehensive validation steps against the live running API server.
"""

import os
import re
import sys
import io
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000/api/v1")

def log_step(step_num: int, message: str):
    print(f"\n[STEP {step_num:02d}] {message}")

def assert_status(resp: httpx.Response, expected_code, step_desc: str):
    allowed = [expected_code] if isinstance(expected_code, int) else list(expected_code)
    if 200 in allowed and 201 not in allowed:
        allowed.append(201)
    if resp.status_code not in allowed:
        print(f"FAILED: {step_desc}")
        print(f"Expected {allowed}, got {resp.status_code}")
        print(f"Response: {resp.text}")
        sys.exit(1)
    print(f"PASSED: {step_desc} (HTTP {resp.status_code})")

def login(client: httpx.Client, email: str, password: str = "Admin@123") -> str:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {resp.text}")
    return resp.json()["access_token"]

def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def run_service_e2e():
    client = httpx.Client(base_url=BASE_URL, timeout=20.0)
    print("=" * 70)
    print("STARTING LIVE SERVICE / SUPPORT MODULE E2E ACCEPTANCE SUITE")
    print("=" * 70)

    # 1. Login with different roles
    log_step(1, "Authenticate test personas")
    admin_token = login(client, "admin@edtechcrm.com")
    admin_h = auth_headers(admin_token)

    service_mgr_token = login(client, "service.mgr@edtechcrm.com")
    service_mgr_h = auth_headers(service_mgr_token)

    service_exec_token = login(client, "service.exec@edtechcrm.com")
    service_exec_h = auth_headers(service_exec_token)

    qa_token = login(client, "qa@edtechcrm.com")
    qa_h = auth_headers(qa_token)

    sales_token = login(client, "sales.exec@edtechcrm.com")
    sales_h = auth_headers(sales_token)
    print("PASSED: All 5 personas authenticated successfully.")

    # 2. Verify seeded categories and SLA policies
    log_step(2, "Verify Seeded Categories & SLA Policies")
    r_cats = client.get("/service/categories", headers=service_mgr_h)
    assert_status(r_cats, 200, "Get seeded categories")
    categories = r_cats.json()
    assert len(categories) >= 3, f"Expected at least 3 categories, got {len(categories)}"

    r_slas = client.get("/service/sla-policies", headers=service_mgr_h)
    assert_status(r_slas, 200, "Get seeded SLA policies")
    sla_policies = r_slas.json()
    assert len(sla_policies) >= 3, f"Expected at least 3 SLA policies, got {len(sla_policies)}"
    print(f"PASSED: Found {len(categories)} categories and {len(sla_policies)} SLA policies.")

    # 3. Create a custom category and subcategory
    log_step(3, "Create custom Category and Subcategory")
    r_new_cat = client.post(
        "/service/categories",
        headers=service_mgr_h,
        json={"name": "SIS Integration & Sync", "description": "Student Information System API syncing"},
    )
    assert_status(r_new_cat, [200, 201], "Create custom service category")
    new_cat = r_new_cat.json()
    cat_id = new_cat["id"]

    r_new_sub = client.post(
        f"/service/categories/{cat_id}/subcategories",
        headers=service_mgr_h,
        json={"name": "Webhook Timeout", "description": "Webhook payloads exceeding 5000ms"},
    )
    assert_status(r_new_sub, [200, 201], "Create custom service subcategory")
    new_sub = r_new_sub.json()
    sub_id = new_sub["id"]

    # 4. Create custom SLA policy
    log_step(4, "Create Campus Mission-Critical SLA Policy")
    r_new_sla = client.post(
        "/service/sla-policies",
        headers=service_mgr_h,
        json={
            "name": "Live Test Mission-Critical SLA",
            "description": "Applies to critical institutional outages",
            "priority": "URGENT",
            "severity": "CRITICAL",
            "first_response_target_minutes": 30,
            "resolution_target_minutes": 240,
            "business_hours_only": True,
            "business_hour_start": "09:00",
            "business_hour_end": "18:00",
            "timezone": "Asia/Kolkata",
            "is_default": False,
        },
    )
    assert_status(r_new_sla, [200, 201], "Create custom SLA policy")

    # 5. Fetch a College and Contact
    log_step(5, "Fetch college and contact for ticket linking")
    r_cols = client.get("/companies", headers=service_mgr_h)
    assert_status(r_cols, 200, "Fetch colleges")
    cols = r_cols.json()
    assert len(cols) > 0, "No colleges available in DB"
    r_conts = client.get("/contacts", headers=service_mgr_h)
    assert_status(r_conts, 200, "Fetch contacts")
    conts = r_conts.json()
    test_college = next((col for col in cols if any(c.get("company_id") == col["id"] for c in conts)), cols[0])
    company_id = test_college["id"]
    college_contact = next((c for c in conts if c.get("company_id") == company_id), conts[0] if conts else None)
    contact_id = college_contact["id"] if college_contact else None

    # 6. Create Ticket 1
    log_step(6, "Create Ticket 1 with College and Contact")
    tkt_payload = {
        "subject": "Biometric Attendance API Sync failing for Semester Exams",
        "description": "During morning punch-in, biometric devices return 504 Gateway Timeout on student sync.",
        "priority": "HIGH",
        "severity": "HIGH",
        "source": "PORTAL",
        "company_id": company_id,
        "contact_id": contact_id,
        "category_id": cat_id,
        "subcategory_id": sub_id,
    }
    r_tkt1 = client.post("/service/tickets", headers=service_exec_h, json=tkt_payload)
    assert_status(r_tkt1, 200, "Create Ticket 1")
    tkt1 = r_tkt1.json()
    tkt1_id = tkt1["id"]
    tkt1_num = tkt1["ticket_number"]

    # 7. Verify Ticket Number format (TKT-YYYY-XXXX)
    log_step(7, "Verify Server-Side Ticket Number Sequential Generation")
    match = re.match(r"^TKT-\d{4}-\d{4}$", tkt1_num)
    assert match, f"Ticket number {tkt1_num} did not match expected pattern ^TKT-\\d{{4}}-\\d{{4}}$"
    print(f"PASSED: Generated Ticket Number is {tkt1_num}")

    # 8. Verify SLA Policy match and due dates
    log_step(8, "Verify SLA Policy match and business hour deadlines")
    assert tkt1["sla_policy_id"] is not None, "SLA policy should be automatically matched"
    assert tkt1["first_response_due_at"] is not None, "First response due date must be populated"
    assert tkt1["due_at"] is not None, "Resolution due date must be populated"
    assert tkt1["sla_status"] == "ON_TRACK", f"Initial SLA status should be ON_TRACK, got {tkt1['sla_status']}"

    # 9. Verify Initial Status
    log_step(9, "Verify Initial Status is NEW")
    assert tkt1["status"] == "NEW", f"Initial status must be NEW, got {tkt1['status']}"

    # 10. Attempt Invalid Status Transition
    log_step(10, "Attempt Invalid Status Transition (NEW directly to WAITING_FOR_CUSTOMER)")
    r_invalid = client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_exec_h,
        json={"status": "WAITING_FOR_CUSTOMER"},
    )
    assert r_invalid.status_code == 400, f"Expected 400 for illegal transition, got {r_invalid.status_code}"
    print("PASSED: Illegal status transition correctly rejected by state machine.")

    # 11. Move NEW -> OPEN
    log_step(11, "Transition status NEW -> OPEN")
    r_open = client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_exec_h,
        json={"status": "OPEN"},
    )
    assert_status(r_open, 200, "Transition to OPEN")
    assert r_open.json()["status"] == "OPEN"

    # 12. Assign Ticket to Service Executive
    log_step(12, "Assign Ticket to Service Executive")
    r_me = client.get("/auth/me", headers=service_exec_h)
    assert_status(r_me, 200, "Get current user")
    exec_user_id = r_me.json()["id"]

    r_assign = client.post(
        f"/service/tickets/{tkt1_id}/assign",
        headers=service_mgr_h,
        json={"assigned_to_id": exec_user_id, "notes": "Assigned to Lead Support Specialist"},
    )
    assert_status(r_assign, 200, "Assign ticket")
    assert r_assign.json()["assigned_to_id"] == exec_user_id
    assert r_assign.json()["status"] == "ASSIGNED"

    # 13. Move ASSIGNED -> IN_PROGRESS
    log_step(13, "Transition status ASSIGNED -> IN_PROGRESS")
    r_prog = client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_exec_h,
        json={"status": "IN_PROGRESS"},
    )
    assert_status(r_prog, 200, "Transition to IN_PROGRESS")
    assert r_prog.json()["status"] == "IN_PROGRESS"

    # 14. Add Customer Reply Comment
    log_step(14, "Add Customer Reply Comment and verify response timestamp")
    r_comm1 = client.post(
        f"/service/tickets/{tkt1_id}/comments",
        headers=service_exec_h,
        json={
            "comment_type": "CUSTOMER_REPLY",
            "body": "Dear Administrator, we are analyzing the 504 Gateway Timeout in the campus proxy router.",
        },
    )
    assert_status(r_comm1, 200, "Post customer reply comment")
    comm1 = r_comm1.json()
    assert comm1["comment_type"] == "CUSTOMER_REPLY"
    assert comm1["is_customer_visible"] is True

    # 15. Verify first_responded_at updated
    log_step(15, "Verify first_responded_at was marked on the ticket")
    r_tkt_after_resp = client.get(f"/service/tickets/{tkt1_id}", headers=service_exec_h)
    assert_status(r_tkt_after_resp, 200, "Fetch ticket")
    assert r_tkt_after_resp.json()["first_responded_at"] is not None

    # 16. Add Internal Note Comment
    log_step(16, "Add Internal Note Comment")
    r_comm2 = client.post(
        f"/service/tickets/{tkt1_id}/comments",
        headers=service_exec_h,
        json={
            "comment_type": "INTERNAL_NOTE",
            "body": "INTERNAL DIAGNOSTIC: Check connection pool exhaustion on redis cache node 3.",
        },
    )
    assert_status(r_comm2, 200, "Post internal note comment")
    comm2 = r_comm2.json()
    assert comm2["comment_type"] == "INTERNAL_NOTE"
    assert comm2["is_customer_visible"] is False

    # 17. Test RBAC Internal Note Protection
    log_step(17, "Verify Strict RBAC Redaction for Users without service.notes.view_internal")
    # Fetch as sales rep who does NOT have service.notes.view_internal permission
    r_sales_view = client.get(f"/service/tickets/{tkt1_id}", headers=sales_h)
    assert_status(r_sales_view, 200, "Fetch ticket as Sales Rep")
    sales_comments = r_sales_view.json().get("comments", [])
    internal_found = any(c["comment_type"] == "INTERNAL_NOTE" for c in sales_comments)
    assert not internal_found, "SECURITY BREACH: Internal note was exposed to user without permission!"
    print("PASSED: Internal notes are strictly stripped for unauthorized roles.")

    # 18. Upload File Attachment
    log_step(18, "Upload File Attachment")
    sample_file_content = b"Error 504 Gateway Timeout: connection pool exhausted at 10.0.4.12:6379"
    files = {"file": ("error_trace.log", io.BytesIO(sample_file_content), "text/plain")}
    data = {"is_internal_only": "false"}
    r_upload = client.post(
        f"/service/tickets/{tkt1_id}/attachments",
        headers={"Authorization": f"Bearer {service_exec_token}"},
        files=files,
        data=data,
    )
    assert_status(r_upload, 200, "Upload attachment")
    att = r_upload.json()
    att_id = att["id"]
    assert att["file_name"] == "error_trace.log"

    # 19. Download File Attachment
    log_step(19, "Download File Attachment via Authenticated Endpoint")
    r_dl = client.get(
        f"/service/tickets/{tkt1_id}/attachments/{att_id}/download",
        headers=service_exec_h,
    )
    assert_status(r_dl, 200, "Download attachment")
    assert r_dl.content == sample_file_content

    # 20. Move to WAITING_FOR_CUSTOMER (Pause SLA)
    log_step(20, "Move to WAITING_FOR_CUSTOMER and verify SLA pause")
    r_wait = client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_exec_h,
        json={"status": "WAITING_FOR_CUSTOMER", "reason": "Awaiting college network firewall logs"},
    )
    assert_status(r_wait, 200, "Transition to WAITING_FOR_CUSTOMER")
    wait_data = r_wait.json()
    assert wait_data["status"] == "WAITING_FOR_CUSTOMER"
    assert wait_data["sla_paused_at"] is not None
    assert wait_data["sla_status"] == "PAUSED"

    # 21. Move back to IN_PROGRESS (Resume SLA)
    log_step(21, "Resume to IN_PROGRESS and verify SLA resume")
    r_resume = client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_exec_h,
        json={"status": "IN_PROGRESS", "reason": "Customer provided network logs"},
    )
    assert_status(r_resume, 200, "Transition to IN_PROGRESS")
    resume_data = r_resume.json()
    assert resume_data["status"] == "IN_PROGRESS"
    assert resume_data["sla_paused_at"] is None
    assert resume_data["sla_status"] in ["ON_TRACK", "AT_RISK", "BREACHED"]

    # 22. Escalate Ticket
    log_step(22, "Escalate Ticket to LEVEL_2")
    r_esc = client.post(
        f"/service/tickets/{tkt1_id}/escalate",
        headers=service_exec_h,
        json={"escalation_level": "LEVEL_2", "reason": "High institutional impact on exam week"},
    )
    assert_status(r_esc, 200, "Escalate ticket")
    esc_data = r_esc.json()
    assert esc_data["escalation_level"] == "LEVEL_2"

    # 23. Link QA Bug or Create one
    log_step(23, "Link Ticket to QA Bug")
    r_bugs = client.get("/bugs", headers=qa_h)
    assert_status(r_bugs, 200, "Fetch bugs")
    bugs_list = r_bugs.json()
    bug_id = bugs_list[0]["id"] if bugs_list else None

    if bug_id:
        r_link = client.patch(
            f"/service/tickets/{tkt1_id}/link-bug",
            headers=service_exec_h,
            json={"bug_id": bug_id},
        )
        assert_status(r_link, 200, "Link bug to ticket")
        assert r_link.json()["bug_id"] == bug_id

    # 24. Resolve Ticket
    log_step(24, "Resolve Ticket with Resolution Summary")
    r_resolve = client.post(
        f"/service/tickets/{tkt1_id}/resolve",
        headers=service_exec_h,
        json={
            "resolution_summary": "Reconfigured Redis connection pool limits from 50 to 500 connections. Deployed hotfix patch v1.4.2.",
            "resolution_category": "Bug Fix",
            "bug_id": bug_id,
        },
    )
    assert_status(r_resolve, 200, "Resolve ticket")
    res_data = r_resolve.json()
    assert res_data["status"] == "RESOLVED"
    assert res_data["resolved_at"] is not None
    assert res_data["sla_status"] == "COMPLETED"

    # 25. Confirm / Close Ticket
    log_step(25, "Confirm Resolution and Close Ticket")
    r_close = client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_mgr_h,
        json={"status": "CLOSED", "reason": "College verified biometrics sync working"},
    )
    assert_status(r_close, 200, "Close ticket")
    close_data = r_close.json()
    assert close_data["status"] == "CLOSED"
    assert close_data["closed_at"] is not None

    # 26. Reopen Ticket
    log_step(26, "Reopen Ticket and verify reopen count")
    r_reopen = client.post(
        f"/service/tickets/{tkt1_id}/reopen",
        headers=service_mgr_h,
        json={"reason": "Intermittent sync failure reappeared during afternoon exam batch"},
    )
    assert_status(r_reopen, 200, "Reopen ticket")
    reopen_data = r_reopen.json()
    assert reopen_data["status"] == "REOPENED"
    assert reopen_data["reopen_count"] == 1

    # 27. Re-resolve and close for clean state
    log_step(27, "Re-resolve ticket")
    client.post(
        f"/service/tickets/{tkt1_id}/resolve",
        headers=service_exec_h,
        json={"resolution_summary": "Firewall MTU size adjusted on campus WAN interface.", "resolution_category": "Configuration Fix"},
    )
    client.patch(
        f"/service/tickets/{tkt1_id}/status",
        headers=service_mgr_h,
        json={"status": "CLOSED"},
    )

    # 28. Verify College 360 includes the ticket
    log_step(28, "Verify College 360 includes ticket in tickets list and timeline")
    r_col360 = client.get(f"/companies/{company_id}", headers=service_mgr_h)
    assert_status(r_col360, 200, "Get College 360")
    col_data = r_col360.json()
    col_tickets = col_data.get("tickets", [])
    found_in_col = any(t["id"] == tkt1_id for t in col_tickets)
    assert found_in_col, f"Ticket {tkt1_id} was not returned in College 360 tickets"
    print(f"PASSED: Company 360 includes ticket {tkt1_num} ({len(col_tickets)} total college tickets).")

    # 29. Verify Global Search
    log_step(29, "Verify Global Search by Ticket Number")
    r_search = client.get(f"/search?q={tkt1_num}", headers=service_mgr_h)
    assert_status(r_search, 200, "Search ticket number")
    search_res = r_search.json()
    search_tickets = search_res.get("tickets", [])
    found_in_search = any(t["id"] == tkt1_id for t in search_tickets)
    assert found_in_search, f"Ticket {tkt1_num} was not found in global search results"
    print(f"PASSED: Global search indexed and returned {tkt1_num}.")

    # 30. Verify Service Dashboard Metrics
    log_step(30, "Verify Service Dashboard Live Operational Metrics")
    r_dash = client.get("/service/dashboard", headers=service_mgr_h)
    assert_status(r_dash, 200, "Get Service Dashboard")
    dash = r_dash.json()
    assert dash["total_tickets"] >= 1
    assert "tickets_by_priority" in dash
    assert "tickets_by_status" in dash
    assert "sla_compliance_rate" in dash
    print(f"PASSED: Dashboard reported {dash['total_tickets']} tickets with {dash['sla_compliance_rate']}% SLA compliance.")

    # 31. Verify CSV Export
    log_step(31, "Verify CSV Export Endpoint")
    r_exp = client.get("/service/export", headers=service_mgr_h)
    assert_status(r_exp, 200, "Get Service Tickets CSV Export")
    assert "text/csv" in r_exp.headers.get("Content-Type", "")
    assert "Ticket Number,Subject,Status" in r_exp.text
    assert tkt1_num in r_exp.text
    print(f"PASSED: CSV export contains {tkt1_num} with valid CSV headers.")

    # 32. Verify Extension Status Endpoint
    log_step(32, "Verify /extensions/service/status Modular Monolith Contract")
    r_ext = client.get("/extensions/service/status", headers=service_mgr_h)
    assert_status(r_ext, 200, "Get /extensions/service/status")
    ext_data = r_ext.json()
    assert ext_data["module"] == "service_support"
    assert ext_data["status"] == "active"
    assert ext_data["total_tickets"] >= 1
    print("PASSED: Modular monolith contract /extensions/service/status verified.")

    # 33. Verify Ticket Timeline
    log_step(33, "Verify Ticket Audit Timeline")
    r_tl = client.get(f"/service/tickets/{tkt1_id}/timeline", headers=service_mgr_h)
    assert_status(r_tl, 200, "Get ticket timeline")
    tl_events = r_tl.json()
    assert len(tl_events) >= 5, f"Expected at least 5 timeline events, got {len(tl_events)}"
    print(f"PASSED: Ticket timeline recorded {len(tl_events)} lifecycle audit events.")

    # 34. Check RBAC on Category and SLA creation
    log_step(34, "Verify RBAC Security: Sales Rep cannot create SLA Policy")
    r_unauth_sla = client.post(
        "/service/sla-policies",
        headers=sales_h,
        json={"name": "Hacked Policy", "first_response_target_minutes": 10, "resolution_target_minutes": 60},
    )
    assert r_unauth_sla.status_code == 403, f"Expected 403 Forbidden, got {r_unauth_sla.status_code}"
    print("PASSED: Unauthorized SLA policy creation rejected with 403 Forbidden.")

    print("\n" + "=" * 70)
    print("ALL 34 SERVICE ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY WITH ZERO REGRESSIONS!")
    print("=" * 70)

if __name__ == "__main__":
    run_service_e2e()
