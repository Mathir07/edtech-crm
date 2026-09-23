"""Unit and integration tests for Projects Module."""

import pytest
from fastapi.testclient import TestClient

def test_project_direct_creation_and_lifecycle(client: TestClient, admin_headers: dict, pm_headers: dict):
    # Setup College
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Project Test University",
        "code": "PRJ-UNI-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    # Direct Project Creation by PM
    proj_payload = {
        "company_id": company_id,
        "name": "Campus ERP Implementation",
        "code": "PRJ-ERP-01",
        "description": "Full-stack implementation of university ERP",
        "budget": 500000.0,
        "planned_start_date": "2026-10-01",
        "target_delivery_date": "2026-12-31"
    }
    proj_resp = client.post("/api/v1/projects", json=proj_payload, headers=pm_headers)
    assert proj_resp.status_code == 200, proj_resp.text
    project = proj_resp.json()
    assert project["project_number"].startswith("PRJ-")
    assert project["status"] == "PLANNED"
    assert project["progress_percentage"] == 0.0
    project_id = project["id"]

    # Add Project Members
    pm_user_id = client.get("/api/v1/auth/me", headers=pm_headers).json()["id"]
    member_payload = {
        "user_id": pm_user_id,
        "role": "Project Manager"
    }
    mem_resp = client.post(f"/api/v1/projects/{project_id}/members", json=member_payload, headers=pm_headers)
    assert mem_resp.status_code == 200, mem_resp.text
    assert len(mem_resp.json()) >= 1

    # Add Milestones
    m1_resp = client.post(f"/api/v1/projects/{project_id}/milestones", json={
        "name": "Phase 1: Architecture & DB Setup",
        "description": "Core schema and setup",
        "sequence": 1,
        "due_date": "2026-10-15"
    }, headers=pm_headers)
    assert m1_resp.status_code == 200, m1_resp.text
    m1 = m1_resp.json()

    m2_resp = client.post(f"/api/v1/projects/{project_id}/milestones", json={
        "name": "Phase 2: Modules & Integrations",
        "description": "Core modules",
        "sequence": 2,
        "due_date": "2026-11-15"
    }, headers=pm_headers)
    assert m2_resp.status_code == 200
    m2 = m2_resp.json()

    # Add Tasks
    t1_resp = client.post(f"/api/v1/projects/{project_id}/tasks", json={
        "title": "Configure Postgres Tables",
        "milestone_id": m1["id"],
        "status": "TODO",
        "priority": "HIGH",
        "estimated_hours": 10.0
    }, headers=pm_headers)
    assert t1_resp.status_code == 200, t1_resp.text
    t1 = t1_resp.json()
    assert t1["task_number"].startswith("TSK-")

    # Complete Task 1 via PUT /tasks/{task_id}
    t1_upd = client.put(f"/api/v1/tasks/{t1['id']}", json={
        "status": "COMPLETED",
        "actual_hours": 8.5
    }, headers=pm_headers)
    assert t1_upd.status_code == 200
    assert t1_upd.json()["status"] == "COMPLETED"

    # Complete Milestone 1 via PUT /milestones/{milestone_id}
    m1_upd = client.put(f"/api/v1/milestones/{m1['id']}", json={
        "status": "COMPLETED"
    }, headers=pm_headers)
    assert m1_upd.status_code == 200

    # Project Progress should be recalculated automatically
    p_get = client.get(f"/api/v1/projects/{project_id}", headers=pm_headers)
    assert p_get.status_code == 200
    p_data = p_get.json()
    assert p_data["progress_percentage"] > 0.0
    assert p_data["progress_percentage"] <= 100.0


def test_sales_order_to_project_handoff_and_delivery_gating(client: TestClient, admin_headers: dict, pm_headers: dict):
    # Setup College & Product
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Handoff Tech Institute",
        "code": "HND-COL-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    prod_resp = client.post("/api/v1/products", json={
        "name": "Cloud Portal System",
        "code": "HND-PRD-01",
        "base_price": 200000.00,
        "tax_rate": 18.00,
    }, headers=admin_headers)
    assert prod_resp.status_code == 200
    prod_id = prod_resp.json()["id"]

    # Sales Order
    order_resp = client.post("/api/v1/sales-orders", json={
        "company_id": company_id,
        "items": [
            {
                "product_id": prod_id,
                "description": "Cloud Portal License",
                "quantity": 1.0,
                "unit_price": 200000.0,
                "discount": 0.0,
                "tax_rate": 18.0,
            }
        ]
    }, headers=admin_headers)
    assert order_resp.status_code == 200
    order = order_resp.json()
    order_id = order["id"]

    # Confirm Order
    conf_resp = client.post(f"/api/v1/sales-orders/{order_id}/confirm", headers=admin_headers)
    assert conf_resp.status_code == 200

    # Handoff to Project
    handoff_payload = {
        "sales_order_id": order_id,
        "name": "Cloud Portal Deployment for Handoff Tech",
        "notes": "Initial handoff from Sales Order",
        "target_delivery_date": "2026-11-30"
    }
    h_resp = client.post("/api/v1/projects/from-sales-order", json=handoff_payload, headers=pm_headers)
    assert h_resp.status_code == 200, h_resp.text
    project = h_resp.json()
    assert project["sales_order_id"] == order_id
    assert project["company_id"] == company_id
    assert project["status"] == "ACTIVE"
    project_id = project["id"]

    # Idempotency check: creating again from same sales order must fail with 400
    dup_resp = client.post("/api/v1/projects/from-sales-order", json=handoff_payload, headers=pm_headers)
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"]

    # Attempt delivery when project has incomplete tasks
    client.post(f"/api/v1/projects/{project_id}/tasks", json={
        "title": "Deploy servers",
        "status": "TODO"
    }, headers=pm_headers)

    deliv_resp = client.post(f"/api/v1/projects/{project_id}/delivery", json={
        "status": "DELIVERED",
        "completion_notes": "Attempting early delivery"
    }, headers=pm_headers)
    assert deliv_resp.status_code == 400
    assert "QA Delivery Gate Blocked" in deliv_resp.json()["detail"]
