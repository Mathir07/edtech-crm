import pytest
from decimal import Decimal
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.organizations.models import Company
from app.accounting.models import Account, Invoice, CustomerPayment, Vendor, Bill, Expense, JournalEntry


@pytest.fixture
def test_college(db_session: Session) -> Company:
    col = Company(
        organization_name="PSG College of Technology",
        code="PSG-TECH",
        type="Engineering College",
        city="Coimbatore",
        state="Tamil Nadu",
        country="India",
        status="Customer",
    )
    db_session.add(col)
    db_session.commit()
    db_session.refresh(col)
    return col


def test_invoice_lifecycle_and_gl_posting(client: TestClient, db_session: Session, finance_manager_headers: dict, test_college: Company):
    # 1. Create Draft Invoice
    payload = {
        "company_id": test_college.id,
        "invoice_date": "2026-06-01",
        "due_date": "2026-07-01",
        "currency": "INR",
        "discount_amount": 0.00,
        "items": [
            {
                "description": "EdTech ERP Campus Annual Subscription",
                "quantity": 1,
                "unit_price": 100000.00,
                "tax_rate": 18.00,
                "discount": 0.00
            }
        ]
    }

    res = client.post("/api/v1/accounting/invoices", json=payload, headers=finance_manager_headers)
    assert res.status_code == 201, res.text
    inv = res.json()
    assert inv["status"] == "DRAFT"
    assert Decimal(str(inv["subtotal"])) == Decimal("100000.00")
    assert Decimal(str(inv["tax_amount"])) == Decimal("18000.00")
    assert Decimal(str(inv["total_amount"])) == Decimal("118000.00")
    assert Decimal(str(inv["amount_due"])) == Decimal("118000.00")
    inv_id = inv["id"]

    # 2. Issue the Invoice -> triggers automatic GL journal generation
    issue_res = client.post(f"/api/v1/accounting/invoices/{inv_id}/issue", headers=finance_manager_headers)
    assert issue_res.status_code == 200, issue_res.text
    issued_inv = issue_res.json()
    assert issued_inv["status"] == "ISSUED"
    assert issued_inv["journal_entry_id"] is not None

    # 3. Verify Journal Entry
    je_res = client.get(f"/api/v1/accounting/journal-entries/{issued_inv['journal_entry_id']}", headers=finance_manager_headers)
    assert je_res.status_code == 200
    je = je_res.json()
    assert je["status"] == "POSTED"
    assert Decimal(str(je["total_debit"])) == Decimal("118000.00")
    assert Decimal(str(je["total_credit"])) == Decimal("118000.00")

    # Lines: AR (1200) Debit 118,000, Revenue (4000) Credit 100,000, Tax (2100) Credit 18,000
    lines = je["lines"]
    ar_line = next(l for l in lines if l["account_code"] == "1200")
    rev_line = next(l for l in lines if l["account_code"] == "4000")
    tax_line = next(l for l in lines if l["account_code"] == "2100")

    assert Decimal(str(ar_line["debit"])) == Decimal("118000.00")
    assert Decimal(str(rev_line["credit"])) == Decimal("100000.00")
    assert Decimal(str(tax_line["credit"])) == Decimal("18000.00")


def test_customer_payment_and_allocation(client: TestClient, db_session: Session, finance_manager_headers: dict, test_college: Company):
    # Setup issued invoice
    bank = db_session.query(Account).filter(Account.account_code == "1010").first()

    inv_payload = {
        "company_id": test_college.id,
        "invoice_date": "2026-06-01",
        "due_date": "2026-07-01",
        "items": [
            {
                "description": "Semester Licensing",
                "quantity": 1,
                "unit_price": 50000.00,
                "tax_rate": 0.00
            }
        ]
    }
    c_res = client.post("/api/v1/accounting/invoices", json=inv_payload, headers=finance_manager_headers)
    inv_id = c_res.json()["id"]
    client.post(f"/api/v1/accounting/invoices/{inv_id}/issue", headers=finance_manager_headers)

    # 1. Partial Payment of 30,000 allocated to invoice
    pay_payload = {
        "company_id": test_college.id,
        "payment_date": "2026-06-10",
        "amount": 30000.00,
        "payment_method": "NEFT",
        "bank_account_id": bank.id,
        "reference": "UTR-99182312",
        "allocations": [
            {
                "invoice_id": inv_id,
                "amount": 30000.00
            }
        ]
    }
    p_res = client.post("/api/v1/accounting/payments", json=pay_payload, headers=finance_manager_headers)
    assert p_res.status_code == 201, p_res.text
    pay = p_res.json()
    assert pay["status"] == "POSTED"
    assert Decimal(str(pay["allocated_amount"])) == Decimal("30000.00")
    assert Decimal(str(pay["unallocated_amount"])) == Decimal("0.00")

    # Verify invoice status is now PARTIALLY_PAID
    inv_check = client.get(f"/api/v1/accounting/invoices/{inv_id}", headers=finance_manager_headers).json()
    assert inv_check["status"] == "PARTIALLY_PAID"
    assert Decimal(str(inv_check["amount_paid"])) == Decimal("30000.00")
    assert Decimal(str(inv_check["amount_due"])) == Decimal("20000.00")

    # 2. Over-allocation rejection test: trying to allocate 25,000 when only 20,000 is due
    over_pay_payload = {
        "company_id": test_college.id,
        "payment_date": "2026-06-12",
        "amount": 25000.00,
        "payment_method": "RTGS",
        "bank_account_id": bank.id,
        "allocations": [
            {
                "invoice_id": inv_id,
                "amount": 25000.00
            }
        ]
    }
    over_res = client.post("/api/v1/accounting/payments", json=over_pay_payload, headers=finance_manager_headers)
    assert over_res.status_code == 400
    assert "exceeds" in over_res.json()["detail"].lower()

    # 3. Final Payment of 20,000 to fully pay invoice
    final_pay = {
        "company_id": test_college.id,
        "payment_date": "2026-06-15",
        "amount": 20000.00,
        "payment_method": "NEFT",
        "bank_account_id": bank.id,
        "allocations": [
            {"invoice_id": inv_id, "amount": 20000.00}
        ]
    }
    fin_res = client.post("/api/v1/accounting/payments", json=final_pay, headers=finance_manager_headers)
    assert fin_res.status_code == 201

    inv_final = client.get(f"/api/v1/accounting/invoices/{inv_id}", headers=finance_manager_headers).json()
    assert inv_final["status"] == "PAID"
    assert Decimal(str(inv_final["amount_due"])) == Decimal("0.00")


def test_vendor_bill_and_payment_lifecycle(client: TestClient, db_session: Session, finance_manager_headers: dict):
    # 1. Create Vendor
    v_payload = {
        "name": "Amazon Web Services India",
        "vendor_code": "VND-AWS-01",
        "contact_name": "Account Rep",
        "email": "billing@aws.amazon.com",
        "city": "Bengaluru",
        "tax_number": "29AAACA1234B1ZT",
    }
    v_res = client.post("/api/v1/accounting/vendors", json=v_payload, headers=finance_manager_headers)
    assert v_res.status_code == 201
    vendor_id = v_res.json()["id"]

    # Expense account: Cloud Infrastructure (5100)
    cloud_acc = db_session.query(Account).filter(Account.account_code == "5100").first()
    bank_acc = db_session.query(Account).filter(Account.account_code == "1010").first()

    # 2. Create Vendor Bill
    bill_payload = {
        "vendor_id": vendor_id,
        "bill_date": "2026-06-01",
        "due_date": "2026-06-30",
        "reference": "AWS-INV-202606",
        "items": [
            {
                "expense_account_id": cloud_acc.id,
                "description": "Production Kubernetes & DB cluster",
                "quantity": 1,
                "unit_price": 40000.00,
                "tax_rate": 18.00
            }
        ]
    }
    b_res = client.post("/api/v1/accounting/bills", json=bill_payload, headers=finance_manager_headers)
    assert b_res.status_code == 201
    bill = b_res.json()
    assert bill["status"] == "DRAFT"
    assert Decimal(str(bill["total_amount"])) == Decimal("47200.00")
    bill_id = bill["id"]

    # 3. Post Vendor Bill -> generates Expense Dr, Input Tax Dr, AP Cr
    post_res = client.post(f"/api/v1/accounting/bills/{bill_id}/post", headers=finance_manager_headers)
    assert post_res.status_code == 200
    posted_bill = post_res.json()
    assert posted_bill["status"] == "RECEIVED"
    assert posted_bill["journal_entry_id"] is not None

    je = client.get(f"/api/v1/accounting/journal-entries/{posted_bill['journal_entry_id']}", headers=finance_manager_headers).json()
    assert je["status"] == "POSTED"
    assert Decimal(str(je["total_debit"])) == Decimal("47200.00")
    assert Decimal(str(je["total_credit"])) == Decimal("47200.00")

    # Check AP credit line
    ap_line = next(l for l in je["lines"] if l["account_code"] == "2000")
    assert Decimal(str(ap_line["credit"])) == Decimal("47200.00")

    # 4. Pay the Vendor Bill
    pay_payload = {
        "bill_id": bill_id,
        "payment_date": "2026-06-25",
        "amount": 47200.00,
        "bank_account_id": bank_acc.id,
        "payment_method": "BANK_TRANSFER",
        "reference": "AWS-SETTLE-001"
    }
    vpay_res = client.post("/api/v1/accounting/vendor-payments", json=pay_payload, headers=finance_manager_headers)
    assert vpay_res.status_code == 200

    # Bill should now be PAID
    bills = client.get(f"/api/v1/accounting/bills?vendor_id={vendor_id}", headers=finance_manager_headers).json()
    assert bills[0]["status"] == "PAID"
    assert Decimal(str(bills[0]["amount_due"])) == Decimal("0.00")


def test_direct_expense_creation_and_gl_posting(client: TestClient, db_session: Session, finance_manager_headers: dict):
    office_acc = db_session.query(Account).filter(Account.account_code == "5300").first()
    bank_acc = db_session.query(Account).filter(Account.account_code == "1010").first()

    exp_payload = {
        "expense_date": "2026-06-18",
        "category": "OFFICE_SUPPLIES",
        "expense_account_id": office_acc.id,
        "payment_account_id": bank_acc.id,
        "amount": 12000.00,
        "tax_amount": 0.00,
        "description": "High-speed fiber connectivity quarterly payment",
        "reference": "ISP-Q1-2026"
    }

    res = client.post("/api/v1/accounting/expenses", json=exp_payload, headers=finance_manager_headers)
    assert res.status_code == 201, res.text
    exp = res.json()
    assert exp["status"] == "POSTED"
    assert exp["journal_entry_id"] is not None

    je = client.get(f"/api/v1/accounting/journal-entries/{exp['journal_entry_id']}", headers=finance_manager_headers).json()
    assert Decimal(str(je["total_debit"])) == Decimal("12000.00")
    assert Decimal(str(je["total_credit"])) == Decimal("12000.00")
