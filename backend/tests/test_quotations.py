"""Unit and integration tests for Quotations and Calculation Engine."""

import pytest
from fastapi.testclient import TestClient

def test_quotation_calculations_and_workflow(client: TestClient, admin_headers: dict, sales_manager_headers: dict):
    # Setup College & Contact & Opportunity
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Test Engineering College",
        "code": "TEST-ENG-01",
        "type": "Engineering",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "status": "Prospect"
    }, headers=admin_headers)
    assert col_resp.status_code == 200, col_resp.text
    company_id = col_resp.json()["id"]

    con_resp = client.post("/api/v1/contacts", json={
        "company_id": company_id,
        "name": "Dr. Ramesh Babu",
        "designation": "Principal",
        "email": "principal@testeng.edu",
        "is_primary": True
    }, headers=admin_headers)
    assert con_resp.status_code == 200
    contact_id = con_resp.json()["id"]

    # Get pipeline & stage
    pipes = client.get("/api/v1/pipelines", headers=admin_headers).json()
    stage_id = pipes[0]["stages"][0]["id"]
    pipe_id = pipes[0]["id"]

    opp_resp = client.post("/api/v1/opportunities", json={
        "company_id": company_id,
        "contact_id": contact_id,
        "title": "ERP Implementation Deal",
        "pipeline_id": pipe_id,
        "stage_id": stage_id,
        "value": 500000.0,
    }, headers=admin_headers)
    assert opp_resp.status_code == 200
    opp_id = opp_resp.json()["id"]

    # Product
    prod_resp = client.post("/api/v1/products", json={
        "name": "Exam Engine",
        "code": "TST-EXAM-01",
        "base_price": 200000.00,
        "tax_rate": 18.00,
    }, headers=admin_headers)
    assert prod_resp.status_code == 200
    prod_id = prod_resp.json()["id"]

    # 1. Test calculation preview endpoint
    calc_payload = {
        "items": [
            {
                "product_id": prod_id,
                "description": "Exam Engine License",
                "quantity": 2.0,
                "unit_price": 200000.0,
                "discount": 20000.0,
                "tax_rate": 18.0,
            }
        ]
    }
    calc_resp = client.post("/api/v1/quotations/calculate", json=calc_payload, headers=admin_headers)
    assert calc_resp.status_code == 200, calc_resp.text
    calc_data = calc_resp.json()
    # subtotal = 2 * 200000 = 400000
    # discount = 20000
    # taxable = 380000
    # tax = 380000 * 0.18 = 68400
    # total = 380000 + 68400 = 448400
    assert calc_data["subtotal"] == 400000.0
    assert calc_data["discount_amount"] == 20000.0
    assert calc_data["tax_amount"] == 68400.0
    assert calc_data["total_amount"] == 448400.0

    # 2. Test cross-entity validation: Contact belonging to another college should fail
    other_col = client.post("/api/v1/companies", json={
        "organization_name": "Another University",
        "code": "ANOTHER-01",
    }, headers=admin_headers).json()
    bad_quote = client.post("/api/v1/quotations", json={
        "company_id": other_col["id"],
        "contact_id": contact_id,  # belongs to company_id, not other_col
        "items": calc_payload["items"],
    }, headers=admin_headers)
    assert bad_quote.status_code == 400
    assert "Contact does not belong" in bad_quote.text

    # 3. Create Quotation
    quote_payload = {
        "company_id": company_id,
        "contact_id": contact_id,
        "opportunity_id": opp_id,
        "notes": "Standard institutional proposal.",
        "terms": "Net 30 days payment terms.",
        "items": calc_payload["items"],
    }
    create_resp = client.post("/api/v1/quotations", json=quote_payload, headers=admin_headers)
    assert create_resp.status_code == 200, create_resp.text
    quote = create_resp.json()
    quote_id = quote["id"]
    assert quote["quotation_number"].startswith("QT-")
    assert quote["status"] == "Draft"
    assert quote["total_amount"] == 448400.0
    assert len(quote["items"]) == 1
    assert quote["company_name"] == "Test Engineering College"

    # 4. Update Quotation (allowed in Draft)
    upd_resp = client.put(f"/api/v1/quotations/{quote_id}", json={
        "notes": "Updated commercial notes.",
    }, headers=admin_headers)
    assert upd_resp.status_code == 200
    assert upd_resp.json()["notes"] == "Updated commercial notes."

    # 5. Submit for Approval: Draft -> Pending Approval
    sub_resp = client.post(f"/api/v1/quotations/{quote_id}/submit", headers=admin_headers)
    assert sub_resp.status_code == 200
    assert sub_resp.json()["status"] == "Pending Approval"

    # Editing should now be blocked
    block_edit = client.put(f"/api/v1/quotations/{quote_id}", json={"notes": "Should fail"}, headers=admin_headers)
    assert block_edit.status_code == 400

    # 6. Approve Quotation as Sales Manager
    app_resp = client.post(f"/api/v1/quotations/{quote_id}/approve", headers=sales_manager_headers)
    assert app_resp.status_code == 200
    assert app_resp.json()["status"] == "Approved"
    assert app_resp.json()["approved_by_id"] is not None

    # 7. Send Quotation to Client (checks email guard)
    send_resp = client.post(f"/api/v1/quotations/{quote_id}/send", headers=sales_manager_headers)
    assert send_resp.status_code == 200
    assert send_resp.json()["status"] == "Sent"
    assert "Unconfigured" in send_resp.json()["email_integration_status"]

    # 8. Accept Quotation
    accept_resp = client.post(f"/api/v1/quotations/{quote_id}/accept", headers=sales_manager_headers)
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "Accepted"

    # 9. Duplicate Quotation
    dup_resp = client.post(f"/api/v1/quotations/{quote_id}/duplicate", headers=admin_headers)
    assert dup_resp.status_code == 200
    dup_quote = dup_resp.json()
    assert dup_quote["status"] == "Draft"
    assert dup_quote["quotation_number"] != quote["quotation_number"]
    assert dup_quote["total_amount"] == 448400.0
    assert len(dup_quote["items"]) == 1
