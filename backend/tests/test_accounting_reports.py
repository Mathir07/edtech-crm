import pytest
from decimal import Decimal
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounting.models import Account, FiscalPeriod, JournalEntry


def setup_test_financial_data(client: TestClient, db_session: Session, headers: dict):
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    rev = db_session.query(Account).filter(Account.account_code == "4000").first()
    exp = db_session.query(Account).filter(Account.account_code == "5100").first()
    equity = db_session.query(Account).filter(Account.account_code == "3000").first()

    # 1. Equity injection: 200,000 (Dr Bank, Cr Equity)
    je1 = {
        "transaction_date": "2026-04-15",
        "reference": "REP-EQ-01",
        "description": "Founder Seed Capital",
        "lines": [
            {"account_id": bank.id, "debit": 200000.00, "credit": 0.00},
            {"account_id": equity.id, "debit": 0.00, "credit": 200000.00}
        ]
    }
    r1 = client.post("/api/v1/accounting/journal-entries", json=je1, headers=headers).json()
    client.post(f"/api/v1/accounting/journal-entries/{r1['id']}/post", headers=headers)

    # 2. Software Revenue: 80,000 (Dr Bank, Cr Revenue)
    je2 = {
        "transaction_date": "2026-05-10",
        "reference": "REP-REV-01",
        "description": "Direct Client License",
        "lines": [
            {"account_id": bank.id, "debit": 80000.00, "credit": 0.00},
            {"account_id": rev.id, "debit": 0.00, "credit": 80000.00}
        ]
    }
    r2 = client.post("/api/v1/accounting/journal-entries", json=je2, headers=headers).json()
    client.post(f"/api/v1/accounting/journal-entries/{r2['id']}/post", headers=headers)

    # 3. Cloud Expense: 30,000 (Dr Cloud Exp, Cr Bank)
    je3 = {
        "transaction_date": "2026-05-20",
        "reference": "REP-EXP-01",
        "description": "Server hosting expense",
        "lines": [
            {"account_id": exp.id, "debit": 30000.00, "credit": 0.00},
            {"account_id": bank.id, "debit": 0.00, "credit": 30000.00}
        ]
    }
    r3 = client.post("/api/v1/accounting/journal-entries", json=je3, headers=headers).json()
    client.post(f"/api/v1/accounting/journal-entries/{r3['id']}/post", headers=headers)


def test_trial_balance_report(client: TestClient, db_session: Session, finance_manager_headers: dict):
    setup_test_financial_data(client, db_session, finance_manager_headers)

    res = client.get("/api/v1/accounting/reports/trial-balance", headers=finance_manager_headers)
    assert res.status_code == 200, res.text
    tb = res.json()
    assert tb["is_balanced"] is True
    assert Decimal(str(tb["total_debit"])) == Decimal(str(tb["total_credit"]))
    assert len(tb["items"]) > 0


def test_general_ledger_report(client: TestClient, db_session: Session, finance_manager_headers: dict):
    setup_test_financial_data(client, db_session, finance_manager_headers)
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()

    res = client.get(f"/api/v1/accounting/reports/general-ledger?account_id={bank.id}", headers=finance_manager_headers)
    assert res.status_code == 200, res.text
    gl = res.json()
    assert gl["account_code"] == "1010"
    assert len(gl["lines"]) >= 3
    # Net bank balance should be 200k + 80k - 30k = 250,000
    assert Decimal(str(gl["closing_balance"])) == Decimal("250000.00")


def test_profit_and_loss_report(client: TestClient, db_session: Session, finance_manager_headers: dict):
    setup_test_financial_data(client, db_session, finance_manager_headers)

    res = client.get("/api/v1/accounting/reports/profit-loss", headers=finance_manager_headers)
    assert res.status_code == 200, res.text
    pl = res.json()
    # Revenue: 80,000, Expense: 30,000 -> Net Income: 50,000
    assert Decimal(str(pl["revenue"]["total"])) == Decimal("80000.00")
    assert Decimal(str(pl["expenses"]["total"])) == Decimal("30000.00")
    assert Decimal(str(pl["net_income"])) == Decimal("50000.00")


def test_balance_sheet_report(client: TestClient, db_session: Session, finance_manager_headers: dict):
    setup_test_financial_data(client, db_session, finance_manager_headers)

    res = client.get("/api/v1/accounting/reports/balance-sheet", headers=finance_manager_headers)
    assert res.status_code == 200, res.text
    bs = res.json()
    assert bs["is_balanced"] is True
    # Assets (Bank 250k) == Liabilities (0) + Equity (200k) + Net Income (50k) = 250,000
    assert Decimal(str(bs["total_assets"])) == Decimal("250000.00")
    assert Decimal(str(bs["total_liabilities_and_equity"])) == Decimal("250000.00")


def test_dashboard_kpis(client: TestClient, db_session: Session, finance_manager_headers: dict):
    setup_test_financial_data(client, db_session, finance_manager_headers)

    res = client.get("/api/v1/accounting/dashboard", headers=finance_manager_headers)
    assert res.status_code == 200, res.text
    dash = res.json()
    assert Decimal(str(dash["total_revenue"])) >= Decimal("80000.00")
    assert Decimal(str(dash["cash_and_bank_balance"])) >= Decimal("250000.00")
