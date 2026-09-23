import pytest
from datetime import date, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounting.models import Account, FiscalPeriod, JournalEntry


def test_journal_entry_draft_creation(client: TestClient, db_session: Session, finance_manager_headers: dict):
    # Find bank and revenue accounts
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    revenue = db_session.query(Account).filter(Account.account_code == "4000").first()

    payload = {
        "entry_date": "2026-06-15",
        "reference": "TEST-JE-001",
        "description": "Initial capital or revenue test",
        "lines": [
            {
                "account_id": bank.id,
                "debit": 50000.00,
                "credit": 0.00,
                "description": "Debit Bank"
            },
            {
                "account_id": revenue.id,
                "debit": 0.00,
                "credit": 50000.00,
                "description": "Credit Revenue"
            }
        ]
    }

    res = client.post("/api/v1/accounting/journal-entries", json=payload, headers=finance_manager_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "DRAFT"
    assert Decimal(str(data["total_debit"])) == Decimal("50000.00")
    assert Decimal(str(data["total_credit"])) == Decimal("50000.00")
    assert len(data["lines"]) == 2


def test_journal_entry_unbalanced_rejection(client: TestClient, db_session: Session, finance_manager_headers: dict):
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    revenue = db_session.query(Account).filter(Account.account_code == "4000").first()

    unbalanced_payload = {
        "entry_date": "2026-06-15",
        "reference": "UNBALANCED-01",
        "description": "Should fail",
        "lines": [
            {"account_id": bank.id, "debit": 50000.00, "credit": 0.00, "description": "Bank"},
            {"account_id": revenue.id, "debit": 0.00, "credit": 40000.00, "description": "Revenue"}
        ]
    }

    res = client.post("/api/v1/accounting/journal-entries", json=unbalanced_payload, headers=finance_manager_headers)
    assert res.status_code == 400
    assert "balance" in res.json()["detail"].lower()


def test_journal_entry_negative_amount_rejection(client: TestClient, db_session: Session, finance_manager_headers: dict):
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    revenue = db_session.query(Account).filter(Account.account_code == "4000").first()

    neg_payload = {
        "entry_date": "2026-06-15",
        "reference": "NEG-01",
        "description": "Negative debit",
        "lines": [
            {"account_id": bank.id, "debit": -100.00, "credit": 0.00, "description": "Negative"},
            {"account_id": revenue.id, "debit": 0.00, "credit": -100.00, "description": "Negative"}
        ]
    }

    res = client.post("/api/v1/accounting/journal-entries", json=neg_payload, headers=finance_manager_headers)
    assert res.status_code == 422 or res.status_code == 400


def test_journal_entry_posting_and_immutability(client: TestClient, db_session: Session, finance_manager_headers: dict):
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    equity = db_session.query(Account).filter(Account.account_code == "3000").first()

    payload = {
        "entry_date": "2026-07-01",
        "reference": "EQUITY-INV-01",
        "description": "Equity injection",
        "lines": [
            {"account_id": bank.id, "debit": 100000.00, "credit": 0.00, "description": "Capital in Bank"},
            {"account_id": equity.id, "debit": 0.00, "credit": 100000.00, "description": "Shareholder Equity"}
        ]
    }

    # 1. Create draft
    res = client.post("/api/v1/accounting/journal-entries", json=payload, headers=finance_manager_headers)
    assert res.status_code == 201
    je_id = res.json()["id"]

    # 2. Post entry
    post_res = client.post(f"/api/v1/accounting/journal-entries/{je_id}/post", headers=finance_manager_headers)
    assert post_res.status_code == 200
    posted_data = post_res.json()
    assert posted_data["status"] == "POSTED"
    assert posted_data["posted_at"] is not None

    # 3. Immutability check: cannot edit posted entry
    edit_res = client.put(f"/api/v1/accounting/journal-entries/{je_id}", json=payload, headers=finance_manager_headers)
    assert edit_res.status_code == 400
    assert "cannot edit" in edit_res.json()["detail"].lower()

    # 4. Immutability check: cannot delete posted entry
    del_res = client.delete(f"/api/v1/accounting/journal-entries/{je_id}", headers=finance_manager_headers)
    assert del_res.status_code == 400
    assert "cannot delete" in del_res.json()["detail"].lower()


def test_journal_entry_reversal(client: TestClient, db_session: Session, finance_manager_headers: dict):
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    office = db_session.query(Account).filter(Account.account_code == "5300").first()

    payload = {
        "entry_date": "2026-07-10",
        "reference": "ACC-ERR-01",
        "description": "Erroneous charge to reverse",
        "lines": [
            {"account_id": office.id, "debit": 15000.00, "credit": 0.00, "description": "Office Supplies"},
            {"account_id": bank.id, "debit": 0.00, "credit": 15000.00, "description": "Bank Outflow"}
        ]
    }

    create_res = client.post("/api/v1/accounting/journal-entries", json=payload, headers=finance_manager_headers)
    je_id = create_res.json()["id"]

    # Post
    client.post(f"/api/v1/accounting/journal-entries/{je_id}/post", headers=finance_manager_headers)

    # Reverse
    rev_payload = {
        "reversal_date": "2026-07-11",
        "reason": "Mistaken double entry"
    }
    rev_res = client.post(f"/api/v1/accounting/journal-entries/{je_id}/reverse", json=rev_payload, headers=finance_manager_headers)
    assert rev_res.status_code == 200, rev_res.text
    comp_entry = rev_res.json()
    assert comp_entry["status"] == "POSTED"
    assert "Reversal of" in comp_entry["description"]

    # Original must now be REVERSED
    orig_res = client.get(f"/api/v1/accounting/journal-entries/{je_id}", headers=finance_manager_headers)
    assert orig_res.json()["status"] == "REVERSED"


def test_closed_fiscal_period_rejection(client: TestClient, db_session: Session, finance_manager_headers: dict):
    # Close existing period or create a closed period
    closed_fp = FiscalPeriod(
        name="FY 2025-26 Closed",
        start_date=date(2025, 4, 1),
        end_date=date(2026, 3, 31),
        status="CLOSED"
    )
    db_session.add(closed_fp)
    db_session.commit()

    bank = db_session.query(Account).filter(Account.account_code == "1010").first()
    rev = db_session.query(Account).filter(Account.account_code == "4000").first()

    payload = {
        "transaction_date": "2025-08-15",  # In closed fiscal period
        "reference": "PAST-PERIOD-01",
        "description": "Attempt to post into closed period",
        "lines": [
            {"account_id": bank.id, "debit": 5000.00, "credit": 0.00, "description": "Bank"},
            {"account_id": rev.id, "debit": 0.00, "credit": 5000.00, "description": "Rev"}
        ]
    }

    # Draft creation or post should reject entry in closed period
    create_res = client.post("/api/v1/accounting/journal-entries", json=payload, headers=finance_manager_headers)
    assert create_res.status_code == 400
    assert "closed" in create_res.json()["detail"].lower() or "period" in create_res.json()["detail"].lower()
