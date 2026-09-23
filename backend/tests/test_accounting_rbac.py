import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounting.models import Account


def test_unauthenticated_requests_rejected(client: TestClient):
    # Endpoints should reject without auth token
    r1 = client.get("/api/v1/accounting/accounts")
    assert r1.status_code == 401

    r2 = client.get("/api/v1/accounting/invoices")
    assert r2.status_code == 401

    r3 = client.get("/api/v1/accounting/reports/trial-balance")
    assert r3.status_code == 401

    r4 = client.post("/api/v1/accounting/journal-entries", json={})
    assert r4.status_code == 401


def test_sales_rep_forbidden_accounting_operations(client: TestClient, sales_headers: dict):
    # Sales Rep should NOT be able to post journal entries
    res = client.post("/api/v1/accounting/journal-entries", json={"description": "Hack"}, headers=sales_headers)
    assert res.status_code == 403

    # Sales Rep should NOT be able to access Trial Balance
    tb_res = client.get("/api/v1/accounting/reports/trial-balance", headers=sales_headers)
    assert tb_res.status_code == 403

    # Sales Rep should NOT be able to create fiscal period
    fp_res = client.post("/api/v1/accounting/fiscal-periods", json={"name": "FY Hack"}, headers=sales_headers)
    assert fp_res.status_code == 403

    # Sales Rep should NOT be able to create vendor bills
    b_res = client.post("/api/v1/accounting/bills", json={}, headers=sales_headers)
    assert b_res.status_code == 403


def test_accountant_allowed_operations_and_boundaries(client: TestClient, db_session: Session, accountant_headers: dict):
    # Accountant CAN view accounts
    r_acc = client.get("/api/v1/accounting/accounts", headers=accountant_headers)
    assert r_acc.status_code == 200

    # Accountant CAN view invoices and bills
    r_inv = client.get("/api/v1/accounting/invoices", headers=accountant_headers)
    assert r_inv.status_code == 200

    # Accountant CAN view reports
    r_tb = client.get("/api/v1/accounting/reports/trial-balance", headers=accountant_headers)
    assert r_tb.status_code == 200

    # Accountant CANNOT create fiscal periods
    r_fp = client.post("/api/v1/accounting/fiscal-periods", json={
        "name": "Unauthorized Period",
        "start_date": "2028-01-01",
        "end_date": "2028-12-31"
    }, headers=accountant_headers)
    assert r_fp.status_code == 403


def test_finance_manager_full_access(client: TestClient, finance_manager_headers: dict):
    # Finance manager can view dashboard
    d_res = client.get("/api/v1/accounting/dashboard", headers=finance_manager_headers)
    assert d_res.status_code == 200

    # Finance manager can access periods
    p_res = client.get("/api/v1/accounting/fiscal-periods", headers=finance_manager_headers)
    assert p_res.status_code == 200

    # Finance manager can export CSV
    exp_res = client.get("/api/v1/accounting/export/trial-balance", headers=finance_manager_headers)
    assert exp_res.status_code == 200
