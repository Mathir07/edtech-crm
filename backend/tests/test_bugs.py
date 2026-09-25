"""Unit and integration tests for Bug Tracking Module."""

import io
import pytest
from fastapi.testclient import TestClient

def test_bug_lifecycle_comments_and_attachments(
    client: TestClient, admin_headers: dict, pm_headers: dict, dev_headers: dict, qa_headers: dict
):
    # Setup College & Project
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Bug Tracker Institute",
        "code": "BUG-COL-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "Bug Tracker Project",
        "code": "PRJ-BUG-01",
        "budget": 100000.0,
    }, headers=pm_headers)
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["id"]

    # 1. Report Bug by QA Engineer
    bug_payload = {
        "title": "Null pointer exception on invoice generation",
        "description": "Clicking download invoice without tax ID causes 500 error",
        "severity": "CRITICAL",
        "priority": "HIGH",
        "environment": "Production Staging",
        "steps_to_reproduce": "1. Go to sales orders\n2. Click Generate Invoice\n3. Observe 500",
        "expected_result": "Invoice generated with default zero tax",
        "actual_result": "500 Internal Server Error"
    }
    bug_resp = client.post(f"/api/v1/projects/{project_id}/bugs", json=bug_payload, headers=qa_headers)
    assert bug_resp.status_code == 200, bug_resp.text
    bug = bug_resp.json()
    assert bug["bug_number"].startswith("BUG-")
    assert bug["status"] == "OPEN"
    bug_id = bug["id"]

    # 2. Add Comment by QA
    comment_payload = {"comment": "Reproduced on Chrome 120 and Firefox 122"}
    comm_resp = client.post(f"/api/v1/bugs/{bug_id}/comments", json=comment_payload, headers=qa_headers)
    assert comm_resp.status_code == 200, comm_resp.text
    assert comm_resp.json()["comment"] == "Reproduced on Chrome 120 and Firefox 122"

    # 3. Upload File Attachment
    fake_log_content = b"2026-09-18 ERROR [app.finance.invoice] NullPointerException: tax_id is None"
    files = {"file": ("error_stacktrace.log", io.BytesIO(fake_log_content), "text/plain")}
    att_resp = client.post(f"/api/v1/bugs/{bug_id}/attachments", files=files, headers=qa_headers)
    assert att_resp.status_code == 200, att_resp.text
    att_data = att_resp.json()
    assert att_data["filename"] == "error_stacktrace.log"
    att_id = att_data["id"]

    # Download Attachment
    down_resp = client.get(f"/api/v1/bugs/{bug_id}/attachments/{att_id}/download", headers=dev_headers)
    assert down_resp.status_code == 200
    assert down_resp.content == fake_log_content

    # Attempt upload of disallowed file extension (.exe)
    bad_file = {"file": ("exploit.exe", io.BytesIO(b"binary content"), "application/octet-stream")}
    bad_resp = client.post(f"/api/v1/bugs/{bug_id}/attachments", files=bad_file, headers=qa_headers)
    assert bad_resp.status_code == 400
    detail = bad_resp.json()["detail"].lower()
    assert "forbidden" in detail or "unsupported" in detail

    # 4. Developer picks up bug -> IN_PROGRESS
    trans1 = client.patch(f"/api/v1/bugs/{bug_id}/status", json={
        "status": "IN_PROGRESS",
        "comment": "Investigating null check in invoice generator"
    }, headers=dev_headers)
    assert trans1.status_code == 200, trans1.text
    assert trans1.json()["status"] == "IN_PROGRESS"

    # 5. Developer fixes bug -> RESOLVED
    trans2 = client.patch(f"/api/v1/bugs/{bug_id}/status", json={
        "status": "RESOLVED",
        "comment": "Added fallback default 0.0 tax rate when tax ID is omitted"
    }, headers=dev_headers)
    assert trans2.status_code == 200, trans2.text
    assert trans2.json()["status"] == "RESOLVED"
    assert trans2.json()["resolved_at"] is not None

    # 6. QA verifies fix -> RETEST
    trans3 = client.patch(f"/api/v1/bugs/{bug_id}/status", json={
        "status": "RETEST",
        "comment": "Verified invoice generation with and without tax ID in Staging"
    }, headers=qa_headers)
    assert trans3.status_code == 200, trans3.text
    assert trans3.json()["status"] == "RETEST"

    # 7. QA Closes Bug -> CLOSED
    trans4 = client.patch(f"/api/v1/bugs/{bug_id}/status", json={
        "status": "CLOSED",
        "comment": "Fix confirmed and accepted for release"
    }, headers=qa_headers)
    assert trans4.status_code == 200, trans4.text
    assert trans4.json()["status"] == "CLOSED"
    assert trans4.json()["closed_at"] is not None

    # 8. Test Invalid Transition (CLOSED -> RESOLVED directly)
    bad_trans = client.patch(f"/api/v1/bugs/{bug_id}/status", json={
        "status": "RESOLVED"
    }, headers=dev_headers)
    assert bad_trans.status_code == 400
    assert "Invalid bug status transition" in bad_trans.json()["detail"]
