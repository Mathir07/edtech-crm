"""Unit and integration tests for Sales Orders and Project Handoff."""

import pytest
from fastapi.testclient import TestClient

def test_sales_order_and_project_handoff(client: TestClient, admin_headers: dict, sales_manager_headers: dict):
    # Setup College
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Order Test College",
        "code": "ORD-COL-01",
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    # Product
    prod_resp = client.post("/api/v1/products", json={
        "name": "Smart Attendance Gateway",
        "code": "ORD-PRD-01",
        "base_price": 100000.00,
        "tax_rate": 18.00,
    }, headers=admin_headers)
    assert prod_resp.status_code == 200
    prod_id = prod_resp.json()["id"]

    # Create Sales Order
    order_payload = {
        "company_id": company_id,
        "notes": "Fast-track delivery requested by principal.",
        "items": [
            {
                "product_id": prod_id,
                "description": "Smart Attendance Gateway Device",
                "quantity": 3.0,
                "unit_price": 100000.0,
                "discount": 10000.0,
                "tax_rate": 18.0,
            }
        ]
    }
    create_resp = client.post("/api/v1/sales-orders", json=order_payload, headers=sales_manager_headers)
    assert create_resp.status_code == 200, create_resp.text
    order = create_resp.json()
    order_id = order["id"]
    assert order["order_number"].startswith("SO-")
    assert order["status"] == "Draft"
    # subtotal = 3 * 100000 = 300000
    # discount = 10000
    # taxable = 290000
    # tax = 290000 * 0.18 = 52200
    # total = 342200
    assert order["total_amount"] == 342200.0
    assert len(order["items"]) == 1

    # Confirm Sales Order & Verify Project Handoff
    conf_resp = client.post(f"/api/v1/sales-orders/{order_id}/confirm", headers=sales_manager_headers)
    assert conf_resp.status_code == 200, conf_resp.text
    conf_data = conf_resp.json()
    assert conf_data["order"]["status"] == "Confirmed"
    assert "project_handoff" in conf_data
    handoff = conf_data["project_handoff"]
    assert handoff["status"] == "Ready for Deployment & Milestone Setup"
    assert handoff["company_id"] == company_id
    assert handoff["order_id"] == order_id
    assert handoff["next_module"] == "projects"
    assert handoff["total_value"] == 342200.0

    # Verify Sales Dashboard Stats
    stats_resp = client.get("/api/v1/sales/dashboard/stats", headers=sales_manager_headers)
    assert stats_resp.status_code == 200, stats_resp.text
    stats = stats_resp.json()
    assert stats["total_orders"] >= 1
    assert stats["confirmed_orders"] >= 1
    assert stats["confirmed_order_value"] >= 342200.0
