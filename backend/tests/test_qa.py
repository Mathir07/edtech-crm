"""Unit and integration tests for QA Module (Suites, Cases, Executions, Dashboard)."""

import pytest
from fastapi.testclient import TestClient

def test_qa_suite_cases_execution_and_dashboard(client: TestClient, admin_headers: dict, pm_headers: dict, qa_headers: dict):
    # Setup College & Project
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "QA Testing Institute",
        "code": "QA-COL-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "QA Validation Project",
        "code": "PRJ-QA-01",
        "budget": 250000.0,
    }, headers=pm_headers)
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["id"]

    # 1. Create Test Suite
    suite_payload = {
        "name": "Identity & Access Management Suite",
        "description": "Authentication and RBAC test suite",
        "module": "Authentication",
        "status": "ACTIVE"
    }
    ts_resp = client.post(f"/api/v1/projects/{project_id}/test-suites", json=suite_payload, headers=qa_headers)
    assert ts_resp.status_code == 200, ts_resp.text
    suite = ts_resp.json()
    assert suite["name"] == "Identity & Access Management Suite"
    suite_id = suite["id"]

    # 2. Create Test Cases
    tc1_payload = {
        "title": "Verify Login with Valid Credentials",
        "description": "User should receive JWT token upon valid credentials",
        "preconditions": "User account exists in system",
        "test_steps": "1. Send POST /auth/login with valid email & password\n2. Verify 200 OK",
        "expected_result": "200 OK with access token",
        "priority": "HIGH"
    }
    tc1_resp = client.post(f"/api/v1/test-suites/{suite_id}/test-cases", json=tc1_payload, headers=qa_headers)
    assert tc1_resp.status_code == 200, tc1_resp.text
    tc1 = tc1_resp.json()
    assert tc1["test_case_number"].startswith("TC-")
    assert tc1["status"] == "NOT_EXECUTED"
    tc1_id = tc1["id"]

    tc2_payload = {
        "title": "Verify Token Expiration Security",
        "description": "Expired tokens must return 401 Unauthorized",
        "priority": "CRITICAL"
    }
    tc2_resp = client.post(f"/api/v1/test-suites/{suite_id}/test-cases", json=tc2_payload, headers=qa_headers)
    assert tc2_resp.status_code == 200
    tc2 = tc2_resp.json()
    assert tc2["test_case_number"].startswith("TC-")
    tc2_id = tc2["id"]

    # 3. Execute Test Cases
    # Execute TC 1 -> PASS
    exec1_payload = {
        "result": "PASS",
        "actual_result": "Logged in successfully, token received",
        "comments": "Verified on staging environment",
        "environment": "Staging",
        "build_version": "v1.2.0"
    }
    e1_resp = client.post(f"/api/v1/test-cases/{tc1_id}/execute", json=exec1_payload, headers=qa_headers)
    assert e1_resp.status_code == 200, e1_resp.text
    tc1_after = e1_resp.json()
    assert tc1_after["status"] == "PASSED"
    assert tc1_after["latest_result"] == "PASS"

    # Execute TC 2 -> FAIL
    exec2_payload = {
        "result": "FAIL",
        "actual_result": "Token refresh did not revoke old expired token",
        "comments": "Potential session vulnerability",
        "environment": "Staging",
        "build_version": "v1.2.0"
    }
    e2_resp = client.post(f"/api/v1/test-cases/{tc2_id}/execute", json=exec2_payload, headers=qa_headers)
    assert e2_resp.status_code == 200, e2_resp.text
    tc2_after = e2_resp.json()
    assert tc2_after["status"] == "FAILED"
    assert tc2_after["latest_result"] == "FAIL"

    # Re-execute TC 2 -> PASS (Immutable execution history test)
    exec2_retest = {
        "result": "PASS",
        "actual_result": "Expired token correctly rejected with 401",
        "comments": "Fixed in patch build v1.2.1",
        "environment": "Staging",
        "build_version": "v1.2.1"
    }
    e2_retest_resp = client.post(f"/api/v1/test-cases/{tc2_id}/execute", json=exec2_retest, headers=qa_headers)
    assert e2_retest_resp.status_code == 200
    tc2_retest = e2_retest_resp.json()
    assert tc2_retest["status"] == "PASSED"
    assert len(tc2_retest["executions"]) == 2  # History preserved!

    # 4. Check QA Dashboard
    dash_resp = client.get(f"/api/v1/projects/{project_id}/qa/dashboard", headers=qa_headers)
    assert dash_resp.status_code == 200, dash_resp.text
    dash = dash_resp.json()
    assert dash["total_test_cases"] == 2
    assert dash["passed_cases"] == 2
    assert dash["failed_cases"] == 0
    assert dash["pass_rate"] == 100.0
    assert dash["qa_progress"] == 100.0
