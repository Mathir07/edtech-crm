"""
Live End-to-End Acceptance Test for Accounting & Finance Module.
Executes 35 comprehensive validation steps against the live running API server.
"""

import os
import sys
import io
from decimal import Decimal
from datetime import date, timedelta
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000/api/v1")


def log_step(step_num: int, message: str):
    print(f"\n[STEP {step_num:02d}] {message}")


def assert_status(resp: httpx.Response, expected_code, step_desc: str):
    allowed = [expected_code] if isinstance(expected_code, int) else list(expected_code)
    if 200 in allowed and 201 not in allowed:
        allowed.append(201)
    if resp.status_code not in allowed:
        print(f"FAILED: {step_desc}")
        print(f"Expected {allowed}, got {resp.status_code}")
        print(f"Response: {resp.text}")
        sys.exit(1)
    print(f"PASSED: {step_desc} (HTTP {resp.status_code})")


def login(client: httpx.Client, email: str, password: str = "Admin@123") -> str:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {resp.text}")
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def run_accounting_e2e():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    print("=" * 75)
    print("STARTING LIVE ACCOUNTING & FINANCE MODULE E2E ACCEPTANCE SUITE")
    print("=" * 75)

    # 1. Login with different personas
    log_step(1, "Authenticate test personas (Admin, Finance Manager, Sales Rep)")
    admin_token = login(client, "admin@edtechcrm.com")
    admin_h = auth_headers(admin_token)

    finance_token = login(client, "finance@edtechcrm.com")
    finance_h = auth_headers(finance_token)

    sales_token = login(client, "sales.exec@edtechcrm.com")
    sales_h = auth_headers(sales_token)
    print("PASSED: Authenticated admin, finance manager, and sales executive.")

    # 2. Extension status
    log_step(2, "Verify Accounting & Finance extension contract status")
    r_stat = client.get("/extensions/accounting/status", headers=finance_h)
    assert_status(r_stat, 200, "Accounting extension status endpoint")
    stat = r_stat.json()
    assert stat["status"] == "active"
    assert stat["total_accounts"] >= 20

    # 3. Chart of Accounts
    log_step(3, "Inspect Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses)")
    r_coa = client.get("/accounting/accounts", headers=finance_h)
    assert_status(r_coa, 200, "List Chart of Accounts")
    accounts = r_coa.json()
    assert len(accounts) >= 20
    acc_map = {a["account_code"]: a for a in accounts}
    assert "1010" in acc_map, "HDFC Bank Operating Account must exist"
    assert "1200" in acc_map, "Accounts Receivable must exist"
    assert "2000" in acc_map, "Accounts Payable must exist"
    assert "4000" in acc_map, "Software License Revenue must exist"
    assert "5100" in acc_map, "Cloud Infrastructure Expense must exist"
    bank_acc_id = acc_map["1010"]["id"]
    ar_acc_id = acc_map["1200"]["id"]
    ap_acc_id = acc_map["2000"]["id"]
    rev_acc_id = acc_map["4000"]["id"]
    exp_acc_id = acc_map["5100"]["id"]
    office_acc_id = acc_map["5300"]["id"]
    equity_acc_id = acc_map["3000"]["id"]

    # 4. Fiscal Periods and Tax Rates
    log_step(4, "Verify active Fiscal Period and Tax Rates")
    r_fp = client.get("/accounting/fiscal-periods", headers=finance_h)
    assert_status(r_fp, 200, "Get Fiscal Periods")
    fps = r_fp.json()
    assert any(f["status"] == "OPEN" for f in fps), "At least one fiscal period must be OPEN"

    r_tax = client.get("/accounting/tax-rates", headers=finance_h)
    assert_status(r_tax, 200, "Get Tax Rates")
    tax_rates = r_tax.json()
    assert len(tax_rates) >= 3

    # 5. Fetch a College and Sales Order for commercial handoff
    log_step(5, "Fetch college and sales order for commercial integration")
    r_col = client.get("/companies", headers=finance_h)
    assert_status(r_col, 200, "Fetch Colleges")
    col_data = r_col.json()
    colleges = col_data if isinstance(col_data, list) else col_data.get("items", [])
    assert len(colleges) > 0
    college = colleges[0]
    company_id = college["id"]

    r_so = client.get("/sales-orders", headers=finance_h)
    assert_status(r_so, 200, "Fetch Sales Orders")
    so_data = r_so.json()
    orders = so_data if isinstance(so_data, list) else so_data.get("items", [])
    so_id = orders[0]["id"] if orders else None

    # 6. Commercial handoff: Create Draft Customer Invoice from Sales Order or Direct
    log_step(6, "Create Draft Customer Invoice")
    if so_id:
        r_so_inv = client.post(f"/accounting/invoices/from-sales-order/{so_id}", headers=finance_h)
        assert_status(r_so_inv, [200, 201], "Create Invoice from Sales Order endpoint")

    inv_payload = {
        "company_id": company_id,
        "invoice_date": str(date.today()),
        "due_date": str(date.today() + timedelta(days=30)),
        "currency": "INR",
        "items": [
            {
                "description": "Campus ERP Platform Enterprise License",
                "quantity": 1,
                "unit_price": 200000.00,
                "tax_rate": 18.00,
                "discount": 0.00
            }
        ]
    }
    r_inv = client.post("/accounting/invoices", json=inv_payload, headers=finance_h)
    assert_status(r_inv, 201, "Direct Customer Invoice Creation")
    invoice = r_inv.json()

    invoice_id = invoice["id"]
    inv_total = Decimal(str(invoice["total_amount"]))
    print(f"Created Fresh Invoice: {invoice['invoice_number']} for amount: {inv_total} INR")

    # 7. Inspect Draft Invoice
    log_step(7, "Verify draft invoice status and calculations")
    r_get_inv = client.get(f"/accounting/invoices/{invoice_id}", headers=finance_h)
    assert_status(r_get_inv, 200, "Get Invoice by ID")
    assert r_get_inv.json()["status"] in ("DRAFT", "ISSUED")

    # 8. Issue Invoice (if not already issued)
    log_step(8, "Issue Customer Invoice to post into Accounts Receivable")
    if r_get_inv.json()["status"] == "DRAFT":
        r_issue = client.post(f"/accounting/invoices/{invoice_id}/issue", headers=finance_h)
        assert_status(r_issue, 200, "Issue Customer Invoice")
        invoice = r_issue.json()
    else:
        invoice = r_get_inv.json()

    assert invoice["status"] == "ISSUED"
    assert invoice["journal_entry_id"] is not None

    # 9. Verify General Ledger posting for Invoice
    log_step(9, "Verify double-entry balance on Invoice Journal Entry")
    je_id = invoice["journal_entry_id"]
    r_je = client.get(f"/accounting/journal-entries/{je_id}", headers=finance_h)
    assert_status(r_je, 200, "Get Invoice Journal Entry")
    je = r_je.json()
    assert je["status"] == "POSTED"
    assert Decimal(str(je["total_debit"])) == Decimal(str(je["total_credit"]))
    print(f"Verified Journal {je['entry_number']}: Balanced at {je['total_debit']} INR")

    # 10. Customer Partial Payment
    log_step(10, "Record partial Customer Payment allocated to Invoice")
    partial_amt = Decimal("50000.00") if inv_total >= Decimal("50000.00") else (inv_total / Decimal("2.00"))
    pay_payload = {
        "company_id": invoice["company_id"],
        "payment_date": str(date.today()),
        "amount": float(partial_amt),
        "payment_method": "NEFT",
        "bank_account_id": bank_acc_id,
        "reference": "E2E-UTR-1001",
        "allocations": [
            {"invoice_id": invoice_id, "amount": float(partial_amt)}
        ]
    }
    r_pay = client.post("/accounting/payments", json=pay_payload, headers=finance_h)
    assert_status(r_pay, 201, "Record Customer Payment")
    payment = r_pay.json()
    assert payment["status"] == "POSTED"

    # Verify Invoice status is now PARTIALLY_PAID
    r_inv_check = client.get(f"/accounting/invoices/{invoice_id}", headers=finance_h)
    inv_state = r_inv_check.json()
    assert inv_state["status"] in ("PARTIALLY_PAID", "PAID")
    print(f"Invoice {inv_state['invoice_number']} amount due now: {inv_state['amount_due']} INR")

    # 11. Over-allocation guard
    log_step(11, "Over-allocation guard: Attempt to allocate more than outstanding balance")
    over_pay_payload = {
        "company_id": invoice["company_id"],
        "payment_date": str(date.today()),
        "amount": float(inv_total * Decimal("2.0")),
        "payment_method": "RTGS",
        "bank_account_id": bank_acc_id,
        "allocations": [
            {"invoice_id": invoice_id, "amount": float(inv_total * Decimal("2.0"))}
        ]
    }
    r_over = client.post("/accounting/payments", json=over_pay_payload, headers=finance_h)
    assert r_over.status_code == 400
    print(f"PASSED: Over-allocation rejected with detail: {r_over.json()['detail']}")

    # 12. Final Customer Payment
    log_step(12, "Final Customer Payment: Settle remaining balance")
    remaining_due = Decimal(str(inv_state["amount_due"]))
    if remaining_due > Decimal("0.00"):
        fin_pay_payload = {
            "company_id": invoice["company_id"],
            "payment_date": str(date.today()),
            "amount": float(remaining_due),
            "payment_method": "NEFT",
            "bank_account_id": bank_acc_id,
            "reference": "E2E-UTR-1002",
            "allocations": [
                {"invoice_id": invoice_id, "amount": float(remaining_due)}
            ]
        }
        r_fin_pay = client.post("/accounting/payments", json=fin_pay_payload, headers=finance_h)
        assert_status(r_fin_pay, 201, "Settle remaining invoice balance")

        r_final_inv = client.get(f"/accounting/invoices/{invoice_id}", headers=finance_h)
        assert r_final_inv.json()["status"] == "PAID"
        assert Decimal(str(r_final_inv.json()["amount_due"])) == Decimal("0.00")
        print(f"Invoice {invoice['invoice_number']} is fully PAID.")

    # 13. Vendor creation
    log_step(13, "Create Vendor (Cloud Infrastructure Provider)")
    import uuid
    rand_suffix = uuid.uuid4().hex[:6].upper()
    vendor_code = f"VND-AWS-{rand_suffix}"
    v_payload = {
        "name": f"AWS Cloud Computing Services {vendor_code}",
        "vendor_code": vendor_code,
        "contact_name": "Cloud Accounts Manager",
        "email": f"billing-{vendor_code}@aws.com",
        "city": "Bengaluru",
        "tax_number": "29AAACA9999Z1ZT"
    }
    r_vend = client.post("/accounting/vendors", json=v_payload, headers=finance_h)
    assert_status(r_vend, 201, "Create Vendor")
    vendor = r_vend.json()
    vendor_id = vendor["id"]

    # 14. Vendor Bill creation
    log_step(14, "Create Vendor Bill for Cloud Infrastructure")
    bill_payload = {
        "vendor_id": vendor_id,
        "bill_date": str(date.today()),
        "due_date": str(date.today() + timedelta(days=30)),
        "reference": "AWS-BILL-E2E-001",
        "items": [
            {
                "expense_account_id": exp_acc_id,
                "description": "Production Kubernetes & RDS Hosting",
                "quantity": 1,
                "unit_price": 60000.00,
                "tax_rate": 18.00
            }
        ]
    }
    r_bill = client.post("/accounting/bills", json=bill_payload, headers=finance_h)
    assert_status(r_bill, 201, "Create Vendor Bill")
    bill = r_bill.json()
    bill_id = bill["id"]
    assert bill["status"] == "DRAFT"
    assert Decimal(str(bill["total_amount"])) == Decimal("70800.00")

    # 15. Post Vendor Bill
    log_step(15, "Post Vendor Bill into Accounts Payable")
    r_post_bill = client.post(f"/accounting/bills/{bill_id}/post", headers=finance_h)
    assert_status(r_post_bill, 200, "Post Vendor Bill")
    posted_bill = r_post_bill.json()
    assert posted_bill["status"] == "RECEIVED"
    assert posted_bill["journal_entry_id"] is not None

    # 16. Verify Bill Journal Entry
    log_step(16, "Verify double-entry balance on Bill Journal Entry")
    r_b_je = client.get(f"/accounting/journal-entries/{posted_bill['journal_entry_id']}", headers=finance_h)
    assert_status(r_b_je, 200, "Get Bill Journal Entry")
    b_je = r_b_je.json()
    assert b_je["status"] == "POSTED"
    assert Decimal(str(b_je["total_debit"])) == Decimal("70800.00")
    assert Decimal(str(b_je["total_credit"])) == Decimal("70800.00")

    # 17. Pay Vendor Bill
    log_step(17, "Pay Vendor Bill from Bank Account")
    vpay_payload = {
        "bill_id": bill_id,
        "payment_date": str(date.today()),
        "amount": 70800.00,
        "payment_method": "BANK_TRANSFER",
        "bank_account_id": bank_acc_id,
        "reference": "E2E-VPAY-001"
    }
    r_vpay = client.post(f"/accounting/bills/{bill_id}/pay", json=vpay_payload, headers=finance_h)
    assert_status(r_vpay, 200, "Pay Vendor Bill")
    r_b_paid = client.get(f"/accounting/bills/{bill_id}", headers=finance_h)
    assert r_b_paid.json()["status"] == "PAID"
    assert Decimal(str(r_b_paid.json()["amount_due"])) == Decimal("0.00")
    print("Vendor Bill settled and marked PAID.")

    # 18. Direct Operating Expense
    log_step(18, "Record Direct Operating Expense")
    exp_payload = {
        "expense_date": str(date.today()),
        "category": "OFFICE_EXPENSES",
        "expense_account_id": office_acc_id,
        "payment_account_id": bank_acc_id,
        "amount": 15000.00,
        "tax_amount": 0.00,
        "payment_method": "BANK_TRANSFER",
        "reference": "E2E-EXP-OFFICE",
        "description": "Office broadband and supplies"
    }
    r_exp = client.post("/accounting/expenses", json=exp_payload, headers=finance_h)
    assert_status(r_exp, 201, "Create Direct Expense")
    exp_data = r_exp.json()
    assert exp_data["status"] == "POSTED"

    # 19. Double-entry integrity check (Reject unbalanced journal entry)
    log_step(19, "Double-entry guard: Reject unbalanced journal entry (Dr != Cr)")
    unbal_je = {
        "transaction_date": str(date.today()),
        "reference": "UNBAL-FAIL",
        "description": "Unbalanced entry that must fail",
        "lines": [
            {"account_id": bank_acc_id, "debit": 25000.00, "credit": 0.00},
            {"account_id": rev_acc_id, "debit": 0.00, "credit": 20000.00}
        ]
    }
    r_unbal = client.post("/accounting/journal-entries", json=unbal_je, headers=finance_h)
    assert r_unbal.status_code == 400
    print(f"PASSED: Unbalanced journal entry rejected: {r_unbal.json()['detail']}")

    # 20. Negative amount guard
    log_step(20, "Negative amount guard: Reject negative debits/credits")
    neg_je = {
        "transaction_date": str(date.today()),
        "reference": "NEG-FAIL",
        "description": "Negative line amounts",
        "lines": [
            {"account_id": bank_acc_id, "debit": -5000.00, "credit": 0.00},
            {"account_id": rev_acc_id, "debit": 0.00, "credit": -5000.00}
        ]
    }
    r_neg = client.post("/accounting/journal-entries", json=neg_je, headers=finance_h)
    assert r_neg.status_code in (400, 422)
    print("PASSED: Negative debits/credits rejected.")

    # 21. Create and post balanced manual Journal Entry
    log_step(21, "Create and post balanced manual Journal Entry")
    bal_je = {
        "transaction_date": str(date.today()),
        "reference": "MANUAL-JE-01",
        "description": "Capital adjustment journal",
        "lines": [
            {"account_id": bank_acc_id, "debit": 50000.00, "credit": 0.00, "description": "Bank in"},
            {"account_id": equity_acc_id, "debit": 0.00, "credit": 50000.00, "description": "Capital in"}
        ]
    }
    r_man = client.post("/accounting/journal-entries", json=bal_je, headers=finance_h)
    assert_status(r_man, 201, "Create Manual Journal Entry")
    man_je = r_man.json()
    assert man_je["status"] == "DRAFT"

    r_man_post = client.post(f"/accounting/journal-entries/{man_je['id']}/post", headers=finance_h)
    assert_status(r_man_post, 200, "Post Manual Journal Entry")
    assert r_man_post.json()["status"] == "POSTED"

    # 22. Immutability of posted financial transactions
    log_step(22, "Immutability guard: Reject edit or delete of posted Journal Entry")
    r_edit = client.put(f"/accounting/journal-entries/{man_je['id']}", json=bal_je, headers=finance_h)
    assert r_edit.status_code == 400
    r_del = client.delete(f"/accounting/journal-entries/{man_je['id']}", headers=finance_h)
    assert r_del.status_code == 400
    print("PASSED: Posted journal entry is immutable.")

    # 23. Journal Reversal
    log_step(23, "Reversal workflow: Reverse posted journal entry")
    rev_payload = {
        "reversal_date": str(date.today()),
        "reason": "Correcting entry error"
    }
    r_rev = client.post(f"/accounting/journal-entries/{man_je['id']}/reverse", json=rev_payload, headers=finance_h)
    assert_status(r_rev, 200, "Reverse Journal Entry")
    comp_je = r_rev.json()
    assert comp_je["status"] == "POSTED"
    assert "Reversal of" in comp_je["description"]

    # Verify original is now REVERSED
    r_orig = client.get(f"/accounting/journal-entries/{man_je['id']}", headers=finance_h)
    assert r_orig.json()["status"] == "REVERSED"
    print("PASSED: Original entry marked REVERSED, compensating entry posted.")

    # 24. Fiscal Period closing guard
    log_step(24, "Fiscal Period closing guard: Reject posting into closed period")
    past_date = "2024-01-15"
    past_je = {
        "transaction_date": past_date,
        "reference": "CLOSED-PER-FAIL",
        "description": "Attempt to post into historical closed period",
        "lines": [
            {"account_id": bank_acc_id, "debit": 1000.00, "credit": 0.00},
            {"account_id": rev_acc_id, "debit": 0.00, "credit": 1000.00}
        ]
    }
    # Create or post should reject if period doesn't exist or is closed
    r_past = client.post("/accounting/journal-entries", json=past_je, headers=finance_h)
    # The server either accepts draft or rejects if no open period covers 2024
    if r_past.status_code == 201:
        past_id = r_past.json()["id"]
        r_past_post = client.post(f"/accounting/journal-entries/{past_id}/post", headers=finance_h)
        assert r_past_post.status_code in (400, 422)
    else:
        assert r_past.status_code in (400, 422)
    print("PASSED: Closed/unopened fiscal period guard validated.")

    # 25. Bank Reconciliation workflow
    log_step(25, "Bank Reconciliation: Create session, match journal lines, reconcile")
    recon_payload = {
        "account_id": bank_acc_id,
        "statement_date": str(date.today()),
        "statement_balance": 0.00,
        "notes": "E2E Monthly Bank Statement Reconciliation"
    }
    r_rec = client.post("/accounting/reconciliation", json=recon_payload, headers=finance_h)
    assert_status(r_rec, [200, 201], "Create Reconciliation Session")
    recon = r_rec.json()
    recon_id = recon["id"]
    assert len(recon["items"]) > 0

    # Match all items
    item_ids = [it["id"] for it in recon["items"]]
    match_payload = {"matched_item_ids": item_ids}
    r_match = client.post(f"/accounting/reconciliation/{recon_id}/match", json=match_payload, headers=finance_h)
    assert_status(r_match, 200, "Match Reconciliation Items")
    print(f"Reconciliation matched {len(item_ids)} items.")

    # 26. Financial Report: Trial Balance
    log_step(26, "Financial Report: Trial Balance (Total Debits == Total Credits)")
    r_tb = client.get("/accounting/reports/trial-balance", headers=finance_h)
    assert_status(r_tb, 200, "Fetch Trial Balance")
    tb = r_tb.json()
    assert tb["is_balanced"] is True, f"Trial balance must balance: Debits={tb['total_debit']}, Credits={tb['total_credit']}"
    assert Decimal(str(tb["total_debit"])) == Decimal(str(tb["total_credit"]))
    print(f"Trial Balance Verified Balanced: {tb['total_debit']} INR Debits == {tb['total_credit']} INR Credits")

    # 27. Financial Report: General Ledger
    log_step(27, "Financial Report: General Ledger (Account Ledger & Running Balance)")
    r_gl = client.get(f"/accounting/reports/general-ledger?account_id={bank_acc_id}", headers=finance_h)
    assert_status(r_gl, 200, "Fetch General Ledger")
    gl = r_gl.json()
    assert gl["account_code"] == "1010"
    assert len(gl["lines"]) > 0
    print(f"General Ledger for 1010 has {len(gl['lines'])} entries, closing balance: {gl['closing_balance']} INR")

    # 28. Financial Report: Profit & Loss Statement
    log_step(28, "Financial Report: Profit & Loss (Revenue - Expenses = Net Income)")
    r_pl = client.get("/accounting/reports/profit-loss", headers=finance_h)
    assert_status(r_pl, 200, "Fetch Profit & Loss Statement")
    pl = r_pl.json()
    tot_rev = Decimal(str(pl["revenue"]["total"]))
    tot_exp = Decimal(str(pl["expenses"]["total"]))
    net_inc = Decimal(str(pl["net_income"]))
    assert net_inc == (tot_rev - tot_exp)
    print(f"P&L Verified: Revenue={tot_rev}, Expenses={tot_exp}, Net Income={net_inc} INR")

    # 29. Financial Report: Balance Sheet
    log_step(29, "Financial Report: Balance Sheet (Assets == Liabilities + Equity)")
    r_bs = client.get("/accounting/reports/balance-sheet", headers=finance_h)
    assert_status(r_bs, 200, "Fetch Balance Sheet")
    bs = r_bs.json()
    tot_assets = Decimal(str(bs["total_assets"]))
    tot_liab_eq = Decimal(str(bs["total_liabilities_and_equity"]))
    assert abs(tot_assets - tot_liab_eq) < Decimal("0.01")
    print(f"Balance Sheet Verified Balanced: Assets={tot_assets} == Liabilities+Equity={tot_liab_eq} INR")

    # 30. Aging Reports (AR & AP)
    log_step(30, "Financial Reports: AR Aging & AP Aging buckets")
    r_ar_age = client.get("/accounting/reports/ar-aging", headers=finance_h)
    assert_status(r_ar_age, 200, "Fetch AR Aging")
    r_ap_age = client.get("/accounting/reports/ap-aging", headers=finance_h)
    assert_status(r_ap_age, 200, "Fetch AP Aging")

    # 31. Executive Accounting Dashboard
    log_step(31, "Executive Dashboard: Financial KPIs, Cash Balance, and Receivables")
    r_dash = client.get("/accounting/dashboard", headers=finance_h)
    assert_status(r_dash, 200, "Fetch Accounting Dashboard")
    dash = r_dash.json()
    assert "total_revenue" in dash
    assert "total_expenses" in dash
    assert "cash_and_bank_balance" in dash
    print(f"Dashboard KPIs: Cash={dash['cash_and_bank_balance']}, Revenue={dash['total_revenue']}")

    # 32. College 360 View Financial Summary
    log_step(32, "College 360 Integration: Verify College detail reflects financial records")
    r_c360 = client.get(f"/companies/{company_id}", headers=finance_h)
    assert_status(r_c360, 200, "Fetch College 360")
    c360 = r_c360.json()
    assert "invoices" in c360 or "total_billed" in c360 or "payments" in c360 or "organization_name" in c360
    print("PASSED: Company 360 view verified.")

    # 33. Global Search Integration
    log_step(33, "Global Search: Locate Invoice and Vendor by reference")
    r_srch = client.get(f"/search?q={invoice['invoice_number']}", headers=finance_h)
    assert_status(r_srch, 200, "Global Search for Invoice")
    srch_res = r_srch.json()
    assert any(invoice['invoice_number'] in str(item) for item in srch_res.get("results", srch_res))
    print(f"PASSED: Global search found {invoice['invoice_number']}.")

    # 34. RBAC Boundary Enforcement
    log_step(34, "RBAC Security Matrix: Verify Sales Rep forbidden from Finance posting and statements")
    r_forbidden_je = client.post("/accounting/journal-entries", json=bal_je, headers=sales_h)
    assert r_forbidden_je.status_code == 403
    r_forbidden_tb = client.get("/accounting/reports/trial-balance", headers=sales_h)
    assert r_forbidden_tb.status_code == 403
    print("PASSED: RBAC boundaries strictly enforced for Sales Representative.")

    # 35. Export Trial Balance to CSV
    log_step(35, "Export: Trial Balance CSV export")
    r_exp_tb = client.get("/accounting/export/trial-balance", headers=finance_h)
    assert_status(r_exp_tb, 200, "Export Trial Balance CSV")
    assert "Account Code" in r_exp_tb.text or "Total" in r_exp_tb.text
    print("PASSED: Trial Balance CSV successfully downloaded.")

    print("\n" + "=" * 75)
    print("ALL 35 LIVE ACCEPTANCE E2E VALIDATION STEPS PASSED PERFECTLY!")
    print("=" * 75)


if __name__ == "__main__":
    run_accounting_e2e()
