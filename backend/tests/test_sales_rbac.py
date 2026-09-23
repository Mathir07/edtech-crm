"""RBAC enforcement tests for Sales Module operations."""

import pytest
from fastapi.testclient import TestClient

def test_sales_rbac_permission_enforcement(client: TestClient, admin_headers: dict, sales_headers: dict, sales_manager_headers: dict):
    # Setup College
    col = client.post("/api/v1/companies", json={
        "organization_name": "RBAC Sales College",
        "code": "RBAC-SALES-01",
    }, headers=admin_headers).json()
    company_id = col["id"]

    # 1. Product creation: Sales Executive cannot create products, Sales Manager can
    prod_payload = {
        "name": "RBAC Product Test",
        "code": "RBAC-PRD-01",
        "base_price": 50000.0,
    }
    se_prod = client.post("/api/v1/products", json=prod_payload, headers=sales_headers)
    assert se_prod.status_code == 403, "Sales Executive should not be allowed to create products"

    sm_prod = client.post("/api/v1/products", json=prod_payload, headers=sales_manager_headers)
    assert sm_prod.status_code == 200, "Sales Manager should be allowed to create products"
    prod_id = sm_prod.json()["id"]

    # 2. Quotation creation: Sales Executive CAN create quotations
    quote_payload = {
        "company_id": company_id,
        "notes": "Draft quote by executive",
        "items": [
            {
                "product_id": prod_id,
                "description": "Item 1",
                "quantity": 1.0,
                "unit_price": 50000.0,
            }
        ]
    }
    create_q = client.post("/api/v1/quotations", json=quote_payload, headers=sales_headers)
    assert create_q.status_code == 200, "Sales Executive should be allowed to create quotations"
    quote_id = create_q.json()["id"]

    # Submit for approval
    sub_q = client.post(f"/api/v1/quotations/{quote_id}/submit", headers=sales_headers)
    assert sub_q.status_code == 200

    # 3. Quotation approval: Sales Executive CANNOT approve quotation
    se_app = client.post(f"/api/v1/quotations/{quote_id}/approve", headers=sales_headers)
    assert se_app.status_code == 403, "Sales Executive should be forbidden from approving quotations"

    # Sales Manager CAN approve quotation
    sm_app = client.post(f"/api/v1/quotations/{quote_id}/approve", headers=sales_manager_headers)
    assert sm_app.status_code == 200, "Sales Manager should be permitted to approve quotations"

    # 4. Sales Order confirmation: Sales Executive cannot confirm sales orders
    order_payload = {
        "company_id": company_id,
        "quotation_id": quote_id,
        "notes": "Order for RBAC test",
    }
    create_o = client.post("/api/v1/sales-orders", json=order_payload, headers=sales_headers)
    assert create_o.status_code == 200, "Sales Executive can create draft orders"
    order_id = create_o.json()["id"]

    se_conf = client.post(f"/api/v1/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert se_conf.status_code == 403, "Sales Executive should be forbidden from confirming orders"

    sm_conf = client.post(f"/api/v1/sales-orders/{order_id}/confirm", headers=sales_manager_headers)
    assert sm_conf.status_code == 200, "Sales Manager should be permitted to confirm orders"
