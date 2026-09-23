"""Unit and integration tests for Institutional Contracts."""

import pytest
from fastapi.testclient import TestClient
from datetime import date, timedelta

def test_contract_lifecycle(client: TestClient, admin_headers: dict, sales_manager_headers: dict):
    # Setup College
    col_resp = client.post("/api/v1/companies", json={
        "organization_name": "Contract Test University",
        "code": "CT-UNI-01",
        "status": "Prospect"
    }, headers=admin_headers)
    assert col_resp.status_code == 200
    company_id = col_resp.json()["id"]

    # Create Contract
    start = date.today()
    end = start + timedelta(days=365)
    contract_payload = {
        "company_id": company_id,
        "title": "Master Services & SLA Agreement 2026",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "contract_value": 750000.00,
        "currency": "INR",
        "status": "Draft",
        "description": "Annual institutional cloud software agreement",
        "terms": "Net 30 days. Quarterly SLA reviews."
    }
    create_resp = client.post("/api/v1/contracts", json=contract_payload, headers=sales_manager_headers)
    assert create_resp.status_code == 200, create_resp.text
    contract = create_resp.json()
    contract_id = contract["id"]
    assert contract["contract_number"].startswith("CT-")
    assert contract["status"] == "Draft"
    assert contract["contract_value"] == 750000.00
    assert contract["company_name"] == "Contract Test University"

    # Get Contract
    get_resp = client.get(f"/api/v1/contracts/{contract_id}", headers=sales_manager_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == contract_payload["title"]

    # Activate Contract (approval required)
    act_resp = client.post(f"/api/v1/contracts/{contract_id}/activate", headers=sales_manager_headers)
    assert act_resp.status_code == 200
    assert act_resp.json()["status"] == "Active"
    assert act_resp.json()["signed_date"] is not None

    # Cancel Contract
    cancel_resp = client.post(f"/api/v1/contracts/{contract_id}/cancel", headers=sales_manager_headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "Cancelled"
