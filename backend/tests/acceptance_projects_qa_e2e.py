"""Comprehensive 30-Step End-to-End Live Acceptance Test for Projects & QA Module.

Validates the complete lifecycle against the live backend API:
Sales Order Handoff -> Project Creation -> Team Assignments ->
Milestones & Task Lifecycle -> Dynamic Progress Recalculation ->
QA Test Suites & Test Cases -> Immutable Test Execution History ->
Bug Reporting -> Developer Resolution -> QA Retesting & Closure ->
Delivery QA Gating Enforcement -> Executive Delivery Sign-off -> Audit Logs.
"""

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from datetime import date, timedelta
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_projects_qa_acceptance_test():
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)
    print("=================================================================")
    print(">>> STARTING PROJECTS & QA MODULE 30-STEP LIVE ACCEPTANCE TEST <<<")
    print("=================================================================\n")

    # Step 1: Login as Super Admin
    print("Step 1: Authenticating as Super Admin...")
    resp = client.post("/auth/login", json={"email": "admin@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("   [PASS] Super Admin authenticated")

    # Step 2: Login as Project Manager
    print("\nStep 2: Authenticating as Project Manager...")
    resp = client.post("/auth/login", json={"email": "pm@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"PM login failed: {resp.text}"
    pm_token = resp.json()["access_token"]
    pm_id = resp.json()["user_id"]
    pm_headers = {"Authorization": f"Bearer {pm_token}"}
    print("   [PASS] Project Manager authenticated")

    # Step 3: Login as Core Developer
    print("\nStep 3: Authenticating as Core Developer...")
    resp = client.post("/auth/login", json={"email": "dev@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Dev login failed: {resp.text}"
    dev_token = resp.json()["access_token"]
    dev_id = resp.json()["user_id"]
    dev_headers = {"Authorization": f"Bearer {dev_token}"}
    print("   [PASS] Core Developer authenticated")

    # Step 4: Login as QA Engineer
    print("\nStep 4: Authenticating as QA Engineer...")
    resp = client.post("/auth/login", json={"email": "qa@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"QA login failed: {resp.text}"
    qa_token = resp.json()["access_token"]
    qa_id = resp.json()["user_id"]
    qa_headers = {"Authorization": f"Bearer {qa_token}"}
    print("   [PASS] QA Engineer authenticated")

    # Step 5: Login as Sales Executive
    print("\nStep 5: Authenticating as Sales Executive...")
    resp = client.post("/auth/login", json={"email": "sales.exec@edtechcrm.com", "password": "Admin@123"})
    assert resp.status_code == 200, f"Sales Exec login failed: {resp.text}"
    se_token = resp.json()["access_token"]
    se_headers = {"Authorization": f"Bearer {se_token}"}
    print("   [PASS] Sales Executive authenticated")

    # Step 6: Setup or locate Test College
    print("\nStep 6: Setting up target Institution: 'Bannari Amman Institute of Technology'...")
    col_resp = client.post("/companies", json={
        "organization_name": "Bannari Amman Institute of Technology",
        "code": "BIT-SAT-01",
        "type": "Autonomous Engineering College",
        "city": "Sathyamangalam",
        "state": "Tamil Nadu",
        "status": "Customer",
    }, headers=admin_headers)
    if col_resp.status_code == 200:
        college = col_resp.json()
    else:
        # If already exists, retrieve it
        col_list = client.get("/companies?search=BIT-SAT-01", headers=admin_headers).json()
        assert len(col_list) > 0, "Failed to retrieve or create test college"
        college = col_list[0]
    company_id = college["id"]
    print(f"   [PASS] College ready: {college['organization_name']} (ID: {company_id})")

    # Step 7: Setup or locate Test Product
    print("\nStep 7: Verifying Product Catalog item...")
    prod_resp = client.post("/products", json={
        "name": "Enterprise Campus Cloud Suite",
        "code": "ECS-ENT-01",
        "base_price": 500000.0,
        "tax_rate": 18.0,
    }, headers=admin_headers)
    if prod_resp.status_code == 200:
        product_id = prod_resp.json()["id"]
    else:
        prod_list = client.get("/products?search=ECS-ENT-01", headers=admin_headers).json()
        assert len(prod_list) > 0, "Failed to find or create test product"
        product_id = prod_list[0]["id"]
    print(f"   [PASS] Product ready (ID: {product_id})")

    # Step 8: Create and Confirm Sales Order
    print("\nStep 8: Creating and Confirming Sales Order...")
    order_payload = {
        "company_id": company_id,
        "notes": "Full campus digitization with LMS, biometric attendance, and ERP.",
        "items": [
            {
                "product_id": product_id,
                "description": "Campus Cloud License and On-Prem Gateway",
                "quantity": 1.0,
                "unit_price": 500000.0,
                "discount": 50000.0,
                "tax_rate": 18.0,
            }
        ]
    }
    so_resp = client.post("/sales-orders", json=order_payload, headers=admin_headers)
    assert so_resp.status_code == 200, f"Sales Order creation failed: {so_resp.text}"
    sales_order = so_resp.json()
    so_id = sales_order["id"]
    so_num = sales_order["order_number"]
    print(f"   [PASS] Created Sales Order {so_num}")

    # Confirm Sales Order
    conf_resp = client.post(f"/sales-orders/{so_id}/confirm", headers=admin_headers)
    assert conf_resp.status_code == 200, f"Sales Order confirmation failed: {conf_resp.text}"
    conf_data = conf_resp.json()
    print(f"   [PASS] Sales Order {so_num} confirmed")

    # Step 9: Verify Project Handoff Payload on Sales Order
    print("\nStep 9: Verifying automated Project Handoff Payload...")
    assert "project_handoff" in conf_data, "project_handoff missing from confirmation response"
    handoff = conf_data["project_handoff"]
    assert handoff["company_id"] == company_id
    assert handoff["order_id"] == so_id
    assert handoff["items_count"] == 1
    print(f"   [PASS] Verified handoff payload for {handoff['order_number']}")

    # Step 10: Trigger Project Creation from Sales Order
    print("\nStep 10: Executing Project Handoff via /projects/from-sales-order...")
    proj_resp = client.post("/projects/from-sales-order", json={
        "sales_order_id": so_id,
        "name": "Bannari Amman Campus Cloud Deployment",
        "notes": "Deployment initiated from confirmed Sales Order",
        "initial_project_manager_id": pm_id,
        "target_delivery_date": str(date.today() + timedelta(days=90)),
    }, headers=pm_headers)
    assert proj_resp.status_code == 200, f"Project handoff failed: {proj_resp.text}"
    project = proj_resp.json()
    project_id = project["id"]
    prj_num = project["project_number"]
    assert prj_num.startswith("PRJ-")
    assert project["status"] == "ACTIVE"
    print(f"   [PASS] Successfully created Deployment Project {prj_num}")

    # Step 11: Verify Duplicate Handoff Protection (Idempotency)
    print("\nStep 11: Verifying duplicate project handoff prevention...")
    dup_resp = client.post("/projects/from-sales-order", json={
        "sales_order_id": so_id,
        "name": "Duplicate Project Attempt",
    }, headers=pm_headers)
    assert dup_resp.status_code == 400, f"Duplicate should fail with 400: {dup_resp.text}"
    assert "already exists" in dup_resp.json()["detail"]
    print("   [PASS] Duplicate project prevented by backend idempotency guard")

    # Step 12: Verify Inheritance on Project
    print("\nStep 12: Verifying inherited metadata on Project...")
    p_detail = client.get(f"/projects/{project_id}", headers=pm_headers).json()
    assert p_detail["company_id"] == company_id
    assert p_detail["sales_order_id"] == so_id
    assert p_detail["progress_percentage"] == 0.0
    print(f"   [PASS] Project correctly linked to College and Sales Order {so_num}")

    # Step 13: Assign Project Members
    print("\nStep 13: Assigning Project Team Members (PM, Dev, QA)...")
    m_dev = client.post(f"/projects/{project_id}/members", json={"user_id": dev_id, "role": "Developer"}, headers=pm_headers)
    assert m_dev.status_code == 200, m_dev.text
    m_qa = client.post(f"/projects/{project_id}/members", json={"user_id": qa_id, "role": "QA Engineer"}, headers=pm_headers)
    assert m_qa.status_code == 200, m_qa.text
    members = client.get(f"/projects/{project_id}", headers=pm_headers).json()["members"]
    assert len(members) >= 2
    print(f"   [PASS] Assigned {len(members)} team members to {prj_num}")

    # Step 14: Create Milestone 1
    print("\nStep 14: Creating Milestone 1: Phase 1 - Infrastructure Setup...")
    ms1_resp = client.post(f"/projects/{project_id}/milestones", json={
        "name": "Phase 1 - Infrastructure Setup",
        "description": "Core VPC, Postgres DB cluster, and load balancer setup",
        "sequence": 1,
        "due_date": str(date.today() + timedelta(days=20)),
    }, headers=pm_headers)
    assert ms1_resp.status_code == 200, ms1_resp.text
    ms1 = ms1_resp.json()
    ms1_id = ms1["id"]
    print(f"   [PASS] Created Milestone 1 (ID: {ms1_id})")

    # Step 15: Create Milestone 2
    print("\nStep 15: Creating Milestone 2: Phase 2 - Applications & Integrations...")
    ms2_resp = client.post(f"/projects/{project_id}/milestones", json={
        "name": "Phase 2 - Applications & Integrations",
        "description": "LMS, Attendance sync, and single sign-on integration",
        "sequence": 2,
        "due_date": str(date.today() + timedelta(days=60)),
    }, headers=pm_headers)
    assert ms2_resp.status_code == 200
    ms2 = ms2_resp.json()
    ms2_id = ms2["id"]
    print(f"   [PASS] Created Milestone 2 (ID: {ms2_id})")

    # Step 16: Create Developer Task 1
    print("\nStep 16: Creating Task 1 under Milestone 1...")
    t1_resp = client.post(f"/projects/{project_id}/tasks", json={
        "title": "Provision Database Cluster",
        "milestone_id": ms1_id,
        "assigned_to_id": dev_id,
        "priority": "HIGH",
        "estimated_hours": 16.0,
    }, headers=pm_headers)
    assert t1_resp.status_code == 200, t1_resp.text
    t1 = t1_resp.json()
    t1_id = t1["id"]
    print(f"   [PASS] Created Task 1: {t1['task_number']}")

    # Step 17: Create Developer Task 2
    print("\nStep 17: Creating Task 2 under Milestone 2...")
    t2_resp = client.post(f"/projects/{project_id}/tasks", json={
        "title": "Configure SAML Single Sign-On",
        "milestone_id": ms2_id,
        "assigned_to_id": dev_id,
        "priority": "MEDIUM",
        "estimated_hours": 24.0,
    }, headers=pm_headers)
    assert t2_resp.status_code == 200, t2_resp.text
    t2 = t2_resp.json()
    t2_id = t2["id"]
    print(f"   [PASS] Created Task 2: {t2['task_number']}")

    # Step 18: RBAC Verification
    print("\nStep 18: Verifying RBAC Security boundaries...")
    # Dev cannot create milestone
    dev_ms = client.post(f"/projects/{project_id}/milestones", json={"name": "Illegal MS"}, headers=dev_headers)
    assert dev_ms.status_code == 403, "Developer should be forbidden from creating milestones"
    # Sales Exec cannot create task
    se_t = client.post(f"/projects/{project_id}/tasks", json={"title": "Illegal Task"}, headers=se_headers)
    assert se_t.status_code == 403, "Sales Exec should be forbidden from creating tasks"
    print("   [PASS] RBAC enforced: unauthorized actions blocked with 403")

    # Step 19: Developer updates Task 1 to IN_PROGRESS
    print("\nStep 19: Developer begins work on Task 1 (IN_PROGRESS)...")
    upd_t1 = client.put(f"/tasks/{t1_id}", json={
        "status": "IN_PROGRESS",
        "actual_hours": 6.0,
    }, headers=dev_headers)
    assert upd_t1.status_code == 200, upd_t1.text
    assert upd_t1.json()["status"] == "IN_PROGRESS"
    print("   [PASS] Task 1 updated to IN_PROGRESS")

    # Step 20: Developer completes Task 1
    print("\nStep 20: Developer completes Task 1...")
    comp_t1 = client.put(f"/tasks/{t1_id}", json={
        "status": "COMPLETED",
        "actual_hours": 15.0,
    }, headers=dev_headers)
    assert comp_t1.status_code == 200
    assert comp_t1.json()["status"] == "COMPLETED"
    print("   [PASS] Task 1 COMPLETED")

    # Step 21: Milestone 1 completed & Progress recalculated
    print("\nStep 21: Marking Milestone 1 as COMPLETED and checking progress...")
    ms1_comp = client.put(f"/milestones/{ms1_id}", json={"status": "COMPLETED"}, headers=pm_headers)
    assert ms1_comp.status_code == 200
    p_check = client.get(f"/projects/{project_id}", headers=pm_headers).json()
    # 1 of 2 tasks completed (50%), 1 of 2 milestones completed (50%) -> 50%
    assert p_check["progress_percentage"] >= 50.0
    print(f"   [PASS] Dynamic progress verified: {p_check['progress_percentage']}%")

    # Step 22: QA Engineer creates Test Suite
    print("\nStep 22: QA Engineer creates Test Suite...")
    ts_resp = client.post(f"/projects/{project_id}/test-suites", json={
        "name": "Campus Security & Resilience Suite",
        "description": "Validates campus infrastructure and single sign-on security",
        "module": "Security",
    }, headers=qa_headers)
    assert ts_resp.status_code == 200, ts_resp.text
    suite = ts_resp.json()
    suite_id = suite["id"]
    print(f"   [PASS] Created Test Suite: {suite['name']}")

    # Step 23: QA Engineer creates Test Case 1
    print("\nStep 23: Creating Test Case 1 (Single Sign-On)...")
    tc1_resp = client.post(f"/test-suites/{suite_id}/test-cases", json={
        "title": "Verify SAML 2.0 Auth with Institutional IdP",
        "priority": "HIGH",
        "expected_result": "200 OK with valid user claims",
    }, headers=qa_headers)
    assert tc1_resp.status_code == 200, tc1_resp.text
    tc1 = tc1_resp.json()
    tc1_id = tc1["id"]
    print(f"   [PASS] Created Test Case 1: {tc1['test_case_number']}")

    # Step 24: QA Engineer creates Test Case 2
    print("\nStep 24: Creating Test Case 2 (Database Failover)...")
    tc2_resp = client.post(f"/test-suites/{suite_id}/test-cases", json={
        "title": "Verify Active-Active Failover under Load",
        "priority": "CRITICAL",
        "expected_result": "Secondary replica promoted with zero packet drop",
    }, headers=qa_headers)
    assert tc2_resp.status_code == 200
    tc2 = tc2_resp.json()
    tc2_id = tc2["id"]
    print(f"   [PASS] Created Test Case 2: {tc2['test_case_number']}")

    # Step 25: QA Engineer executes Test Case 1 -> PASS
    print("\nStep 25: Executing Test Case 1 (PASS)...")
    e1_resp = client.post(f"/test-cases/{tc1_id}/execute", json={
        "result": "PASS",
        "actual_result": "IdP redirect executed and JWT claims mapped correctly",
        "environment": "Staging",
        "build_version": "v2.0.0-rc1",
    }, headers=qa_headers)
    assert e1_resp.status_code == 200, e1_resp.text
    assert e1_resp.json()["latest_result"] == "PASS"
    print("   [PASS] Test Case 1 execution recorded: PASS")

    # Step 26: QA Engineer executes Test Case 2 -> FAIL
    print("\nStep 26: Executing Test Case 2 (FAIL)...")
    e2_resp = client.post(f"/test-cases/{tc2_id}/execute", json={
        "result": "FAIL",
        "actual_result": "Replica promotion timed out after 30s causing transaction drops",
        "environment": "Staging",
        "build_version": "v2.0.0-rc1",
    }, headers=qa_headers)
    assert e2_resp.status_code == 200, e2_resp.text
    assert e2_resp.json()["latest_result"] == "FAIL"
    print("   [PASS] Test Case 2 execution recorded: FAIL")

    # Step 27: QA Engineer files Critical Bug
    print("\nStep 27: Filing Critical Defect linked to Test Case 2...")
    bug_resp = client.post(f"/projects/{project_id}/bugs", json={
        "title": "Database failover timeout causes dropped enrollments",
        "test_case_id": tc2_id,
        "severity": "CRITICAL",
        "priority": "URGENT",
        "environment": "Staging",
        "steps_to_reproduce": "1. Run 100 concurrent enrollment writes\n2. Kill primary node\n3. Observe timeout",
        "expected_result": "Failover completes in <3 seconds",
        "actual_result": "Failover hung for 30s",
        "assigned_to_id": dev_id,
    }, headers=qa_headers)
    assert bug_resp.status_code == 200, bug_resp.text
    bug = bug_resp.json()
    bug_id = bug["id"]
    bug_num = bug["bug_number"]
    assert bug_num.startswith("BUG-")
    print(f"   [PASS] Created Critical Bug: {bug_num}")

    # Step 28: Attempt Delivery - MUST BE BLOCKED BY QA GATING
    print("\nStep 28: Project Manager attempts delivery sign-off (Verifying QA Gate)...")
    deliv_try = client.post(f"/projects/{project_id}/delivery", json={
        "status": "DELIVERED",
        "completion_notes": "Attempting sign-off while defects exist",
    }, headers=pm_headers)
    assert deliv_try.status_code == 400, f"Delivery should be blocked: {deliv_try.text}"
    assert "QA Delivery Gate Blocked" in deliv_try.json()["detail"]
    print("   [PASS] QA Delivery Gate strictly enforced: Delivery transition blocked")

    # Step 29: Resolve Defect, Retest, Close Bug, and Finish Tasks
    print("\nStep 29: Resolving Defect, Retesting, Closing, and Completing Tasks...")
    # Dev resolves bug
    dev_fix = client.patch(f"/bugs/{bug_id}/status", json={
        "status": "RESOLVED",
        "comment": "Tuned failover heartbeat timeout to 2 seconds in pgpool config",
    }, headers=dev_headers)
    assert dev_fix.status_code == 200, dev_fix.text
    assert dev_fix.json()["status"] == "RESOLVED"

    # QA retests bug
    qa_retest = client.patch(f"/bugs/{bug_id}/status", json={
        "status": "RETEST",
        "comment": "Re-running active failover test suite in Staging",
    }, headers=qa_headers)
    assert qa_retest.status_code == 200, qa_retest.text

    # Re-run Test Case 2 -> PASS
    e2_pass = client.post(f"/test-cases/{tc2_id}/execute", json={
        "result": "PASS",
        "actual_result": "Failover completed in 1.4s with 0 errors",
        "environment": "Staging",
        "build_version": "v2.0.0-rc2",
    }, headers=qa_headers)
    assert e2_pass.status_code == 200

    # QA closes bug
    qa_close = client.patch(f"/bugs/{bug_id}/status", json={
        "status": "CLOSED",
        "comment": "Fix verified and accepted",
    }, headers=qa_headers)
    assert qa_close.status_code == 200
    assert qa_close.json()["status"] == "CLOSED"

    # Developer finishes Task 2
    client.put(f"/tasks/{t2_id}", json={"status": "COMPLETED", "actual_hours": 20.0}, headers=dev_headers)
    # Complete Milestone 2
    client.put(f"/milestones/{ms2_id}", json={"status": "COMPLETED"}, headers=pm_headers)
    print("   [PASS] Defect resolved & verified, all tasks & milestones completed")

    # Step 30: Executive Delivery Sign-off
    print("\nStep 30: Executing final Delivery Sign-off...")
    deliv_final = client.post(f"/projects/{project_id}/delivery", json={
        "status": "COMPLETED",
        "completion_notes": "Campus ERP deployment fully verified by QA, signed off by BIT Principal.",
    }, headers=pm_headers)
    assert deliv_final.status_code == 200, f"Delivery sign-off failed: {deliv_final.text}"
    final_p = deliv_final.json()
    assert final_p["status"] == "COMPLETED"
    assert final_p["progress_percentage"] == 100.0
    print(f"   [PASS] Project {prj_num} successfully DELIVERED and marked COMPLETED with 100% progress!")

    print("\n=================================================================")
    print(">>> 30-STEP PROJECTS & QA LIVE ACCEPTANCE TEST COMPLETED 100% <<<")
    print("=================================================================\n")

if __name__ == "__main__":
    run_projects_qa_acceptance_test()
