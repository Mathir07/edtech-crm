"""Unit tests for Projects & QA Role-Based Access Control (RBAC)."""

import pytest
from fastapi.testclient import TestClient

def test_projects_rbac_matrix(
    client: TestClient,
    admin_headers: dict,
    pm_headers: dict,
    dev_headers: dict,
    qa_headers: dict,
    sales_headers: dict
):
    # Setup College & Project with PM
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "RBAC Verification College",
        "code": "RBC-COL-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    # 1. Developer attempts to create a project -> Forbidden 403
    dev_proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "Unauthorized Dev Project",
        "code": "PRJ-DEV-UNAUTH"
    }, headers=dev_headers)
    assert dev_proj_resp.status_code == 403

    # 2. QA Engineer attempts to create a project -> Forbidden 403
    qa_proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "Unauthorized QA Project",
        "code": "PRJ-QA-UNAUTH"
    }, headers=qa_headers)
    assert qa_proj_resp.status_code == 403

    # 3. Sales Exec attempts to create a project -> Forbidden 403
    sales_proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "Unauthorized Sales Project",
        "code": "PRJ-SLS-UNAUTH"
    }, headers=sales_headers)
    assert sales_proj_resp.status_code == 403

    # 4. Project Manager creates the project -> Allowed 200
    pm_proj_resp = client.post("/api/v1/projects", json={
        "company_id": company_id,
        "name": "Authorized PM Project",
        "code": "PRJ-PM-AUTH",
        "budget": 300000.0
    }, headers=pm_headers)
    assert pm_proj_resp.status_code == 200
    project_id = pm_proj_resp.json()["id"]

    # 5. Milestone creation: Dev forbidden, PM allowed
    dev_ms_resp = client.post(f"/api/v1/projects/{project_id}/milestones", json={
        "name": "Dev Milestone",
        "sequence": 1
    }, headers=dev_headers)
    assert dev_ms_resp.status_code == 403

    pm_ms_resp = client.post(f"/api/v1/projects/{project_id}/milestones", json={
        "name": "PM Milestone",
        "sequence": 1
    }, headers=pm_headers)
    assert pm_ms_resp.status_code == 200
    milestone_id = pm_ms_resp.json()["id"]

    # 6. Task creation: QA forbidden, PM allowed
    qa_task_resp = client.post(f"/api/v1/projects/{project_id}/tasks", json={
        "title": "QA Task",
        "milestone_id": milestone_id
    }, headers=qa_headers)
    assert qa_task_resp.status_code == 403

    pm_task_resp = client.post(f"/api/v1/projects/{project_id}/tasks", json={
        "title": "Backend Migration",
        "milestone_id": milestone_id,
        "status": "TODO"
    }, headers=pm_headers)
    assert pm_task_resp.status_code == 200
    task_id = pm_task_resp.json()["id"]

    # 7. Developer CAN update task status -> Allowed 200
    dev_task_upd = client.put(f"/api/v1/tasks/{task_id}", json={
        "status": "IN_PROGRESS",
        "actual_hours": 4.0
    }, headers=dev_headers)
    assert dev_task_upd.status_code == 200
    assert dev_task_upd.json()["status"] == "IN_PROGRESS"

    # 8. Delivery transition: Dev & QA forbidden, PM allowed
    dev_deliv_resp = client.post(f"/api/v1/projects/{project_id}/delivery", json={
        "status": "DELIVERED"
    }, headers=dev_headers)
    assert dev_deliv_resp.status_code == 403

    qa_deliv_resp = client.post(f"/api/v1/projects/{project_id}/delivery", json={
        "status": "DELIVERED"
    }, headers=qa_headers)
    assert qa_deliv_resp.status_code == 403
