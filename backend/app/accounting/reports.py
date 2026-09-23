from decimal import Decimal
from datetime import date, datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from app.accounting.models import (
    Account, JournalEntry, JournalLine, Invoice, CustomerPayment,
    Bill, VendorPayment, Expense, Vendor
)
from app.organizations.models import Company
from app.accounting.schemas import (
    TrialBalanceResponse, TrialBalanceItem,
    GeneralLedgerResponse, GeneralLedgerLine,
    ProfitLossResponse, ProfitLossSection, ProfitLossItem,
    BalanceSheetResponse, BalanceSheetSection,
    AgingReportResponse, AgingBucket,
    AccountingDashboardResponse
)


def get_trial_balance(db: Session, as_of_date: Optional[date] = None) -> TrialBalanceResponse:
    """
    Computes live Trial Balance across all active accounts from posted journal lines.
    Mathematical invariant: Total Debits == Total Credits.
    """
    if not as_of_date:
        as_of_date = date.today()

    accounts = db.query(Account).filter(Account.is_active == True).order_by(Account.account_code).all()
    items: List[TrialBalanceItem] = []
    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")

    for acc in accounts:
        query = (
            db.query(
                func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("sum_debit"),
                func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("sum_credit"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status == "POSTED",
                JournalEntry.transaction_date <= as_of_date,
            )
        )
        row = query.first()
        acc_debit = Decimal(str(row.sum_debit or 0.00))
        acc_credit = Decimal(str(row.sum_credit or 0.00))

        # Determine net display balance based on normal account type
        if acc.account_type in ("ASSET", "EXPENSE"):
            net = acc_debit - acc_credit
            d_bal = net if net > Decimal("0.00") else Decimal("0.00")
            c_bal = -net if net < Decimal("0.00") else Decimal("0.00")
        else:
            net = acc_credit - acc_debit
            c_bal = net if net > Decimal("0.00") else Decimal("0.00")
            d_bal = -net if net < Decimal("0.00") else Decimal("0.00")

        if d_bal > Decimal("0.00") or c_bal > Decimal("0.00"):
            items.append(TrialBalanceItem(
                account_id=acc.id,
                account_code=acc.account_code,
                account_name=acc.account_name,
                account_type=acc.account_type,
                debit_balance=d_bal,
                credit_balance=c_bal,
            ))
            total_debit += d_bal
            total_credit += c_bal

    diff = abs(total_debit - total_credit)
    is_balanced = diff < Decimal("0.01")

    return TrialBalanceResponse(
        as_of_date=as_of_date,
        items=items,
        total_debit=total_debit,
        total_credit=total_credit,
        is_balanced=is_balanced,
    )


def get_general_ledger(
    db: Session,
    account_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> GeneralLedgerResponse:
    """
    Computes chronological General Ledger for a specific account with running balance.
    """
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = date(end_date.year, 1, 1)

    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise ValueError("Account not found")

    is_debit_normal = acc.account_type in ("ASSET", "EXPENSE")

    # 1. Opening balance before start_date
    prior_query = (
        db.query(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("sum_debit"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("sum_credit"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .filter(
            JournalLine.account_id == acc.id,
            JournalEntry.status == "POSTED",
            JournalEntry.transaction_date < start_date,
        )
    )
    p_row = prior_query.first()
    prior_debit = Decimal(str(p_row.sum_debit or 0.00))
    prior_credit = Decimal(str(p_row.sum_credit or 0.00))
    opening_balance = (prior_debit - prior_credit) if is_debit_normal else (prior_credit - prior_debit)

    # 2. Activity within date range
    lines_query = (
        db.query(JournalLine, JournalEntry)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .filter(
            JournalLine.account_id == acc.id,
            JournalEntry.status == "POSTED",
            JournalEntry.transaction_date >= start_date,
            JournalEntry.transaction_date <= end_date,
        )
        .order_by(JournalEntry.transaction_date.asc(), JournalEntry.entry_number.asc())
        .all()
    )

    gl_lines: List[GeneralLedgerLine] = []
    current_bal = opening_balance

    for jline, jentry in lines_query:
        deb = Decimal(str(jline.debit or 0.00))
        crd = Decimal(str(jline.credit or 0.00))

        if is_debit_normal:
            current_bal += (deb - crd)
        else:
            current_bal += (crd - deb)

        gl_lines.append(GeneralLedgerLine(
            entry_number=jentry.entry_number,
            transaction_date=jentry.transaction_date,
            description=jline.description or jentry.description,
            reference=jline.reference or jentry.reference,
            source_module=jentry.source_module,
            debit=deb,
            credit=crd,
            running_balance=current_bal,
        ))

    return GeneralLedgerResponse(
        account_id=acc.id,
        account_code=acc.account_code,
        account_name=acc.account_name,
        account_type=acc.account_type,
        start_date=start_date,
        end_date=end_date,
        opening_balance=opening_balance,
        closing_balance=current_bal,
        lines=gl_lines,
    )


def get_profit_and_loss(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> ProfitLossResponse:
    """
    Computes live Income Statement (Profit & Loss) for given date range.
    Net Income = Total Revenues - Total Expenses.
    """
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = date(end_date.year, 1, 1)

    # 1. Revenue accounts (Credit - Debit)
    rev_accounts = db.query(Account).filter(Account.account_type == "REVENUE", Account.is_active == True).all()
    rev_items: List[ProfitLossItem] = []
    total_revenue = Decimal("0.00")

    for acc in rev_accounts:
        row = (
            db.query(
                func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
                func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status == "POSTED",
                JournalEntry.transaction_date >= start_date,
                JournalEntry.transaction_date <= end_date,
            )
            .first()
        )
        amt = Decimal(str(row.crd or 0.00)) - Decimal(str(row.deb or 0.00))
        if amt != Decimal("0.00"):
            rev_items.append(ProfitLossItem(
                account_code=acc.account_code,
                account_name=acc.account_name,
                amount=amt,
            ))
            total_revenue += amt

    # 2. Expense accounts (Debit - Credit)
    exp_accounts = db.query(Account).filter(Account.account_type == "EXPENSE", Account.is_active == True).all()
    exp_items: List[ProfitLossItem] = []
    total_expense = Decimal("0.00")

    for acc in exp_accounts:
        row = (
            db.query(
                func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
                func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status == "POSTED",
                JournalEntry.transaction_date >= start_date,
                JournalEntry.transaction_date <= end_date,
            )
            .first()
        )
        amt = Decimal(str(row.deb or 0.00)) - Decimal(str(row.crd or 0.00))
        if amt != Decimal("0.00"):
            exp_items.append(ProfitLossItem(
                account_code=acc.account_code,
                account_name=acc.account_name,
                amount=amt,
            ))
            total_expense += amt

    net_income = total_revenue - total_expense

    return ProfitLossResponse(
        start_date=start_date,
        end_date=end_date,
        revenue=ProfitLossSection(category="Revenues", items=rev_items, total=total_revenue),
        expenses=ProfitLossSection(category="Operating Expenses", items=exp_items, total=total_expense),
        net_income=net_income,
    )


def get_balance_sheet(db: Session, as_of_date: Optional[date] = None) -> BalanceSheetResponse:
    """
    Computes live Balance Sheet as of given date.
    Assets == Liabilities + Equity (+ Net Income).
    """
    if not as_of_date:
        as_of_date = date.today()

    accounts = db.query(Account).filter(Account.is_active == True).order_by(Account.account_code).all()

    asset_items: List[ProfitLossItem] = []
    total_assets = Decimal("0.00")

    liab_items: List[ProfitLossItem] = []
    total_liab = Decimal("0.00")

    eq_items: List[ProfitLossItem] = []
    total_eq = Decimal("0.00")

    for acc in accounts:
        if acc.account_type not in ("ASSET", "LIABILITY", "EQUITY"):
            continue

        row = (
            db.query(
                func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
                func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status == "POSTED",
                JournalEntry.transaction_date <= as_of_date,
            )
            .first()
        )
        deb = Decimal(str(row.deb or 0.00))
        crd = Decimal(str(row.crd or 0.00))

        if acc.account_type == "ASSET":
            val = deb - crd
            if val != Decimal("0.00"):
                asset_items.append(ProfitLossItem(account_code=acc.account_code, account_name=acc.account_name, amount=val))
                total_assets += val
        elif acc.account_type == "LIABILITY":
            val = crd - deb
            if val != Decimal("0.00"):
                liab_items.append(ProfitLossItem(account_code=acc.account_code, account_name=acc.account_name, amount=val))
                total_liab += val
        elif acc.account_type == "EQUITY":
            val = crd - deb
            if val != Decimal("0.00"):
                eq_items.append(ProfitLossItem(account_code=acc.account_code, account_name=acc.account_name, amount=val))
                total_eq += val

    # Calculate cumulative Net Income (Retained Earnings to date)
    pnl = get_profit_and_loss(db, date(2000, 1, 1), as_of_date)
    if pnl.net_income != Decimal("0.00"):
        eq_items.append(ProfitLossItem(
            account_code="3999",
            account_name="Current Period Retained Earnings",
            amount=pnl.net_income,
        ))
        total_eq += pnl.net_income

    total_liab_eq = total_liab + total_eq
    is_balanced = abs(total_assets - total_liab_eq) < Decimal("0.01")

    return BalanceSheetResponse(
        as_of_date=as_of_date,
        assets=BalanceSheetSection(category="Assets", items=asset_items, total=total_assets),
        liabilities=BalanceSheetSection(category="Liabilities", items=liab_items, total=total_liab),
        equity=BalanceSheetSection(category="Equity", items=eq_items, total=total_eq),
        total_assets=total_assets,
        total_liabilities_and_equity=total_liab_eq,
        is_balanced=is_balanced,
    )


def get_ar_aging(db: Session, as_of_date: Optional[date] = None) -> AgingReportResponse:
    """
    Computes Accounts Receivable Aging report broken down into 0-30, 31-60, 61-90, and 90+ day buckets.
    """
    if not as_of_date:
        as_of_date = date.today()

    invoices = db.query(Invoice).filter(
        Invoice.status.in_(["ISSUED", "PARTIALLY_PAID", "OVERDUE"]),
        Invoice.amount_due > Decimal("0.00"),
        Invoice.is_deleted == False,
    ).all()

    buckets_by_col: Dict[str, AgingBucket] = {}
    tot_0_30 = Decimal("0.00")
    tot_31_60 = Decimal("0.00")
    tot_61_90 = Decimal("0.00")
    tot_90 = Decimal("0.00")
    grand_tot = Decimal("0.00")

    for inv in invoices:
        col_id = inv.company_id
        col_name = inv.company.organization_name if inv.company else "Company"

        if col_id not in buckets_by_col:
            buckets_by_col[col_id] = AgingBucket(entity_id=col_id, entity_name=col_name)

        due = inv.due_date
        days = (as_of_date - due).days
        due_amt = inv.amount_due

        if days <= 30:
            buckets_by_col[col_id].current_0_30 += due_amt
            tot_0_30 += due_amt
        elif days <= 60:
            buckets_by_col[col_id].past_31_60 += due_amt
            tot_31_60 += due_amt
        elif days <= 90:
            buckets_by_col[col_id].past_61_90 += due_amt
            tot_61_90 += due_amt
        else:
            buckets_by_col[col_id].past_90_plus += due_amt
            tot_90 += due_amt

        buckets_by_col[col_id].total_outstanding += due_amt
        grand_tot += due_amt

    return AgingReportResponse(
        as_of_date=as_of_date,
        report_type="AR",
        buckets=list(buckets_by_col.values()),
        total_0_30=tot_0_30,
        total_31_60=tot_31_60,
        total_61_90=tot_61_90,
        total_90_plus=tot_90,
        grand_total=grand_tot,
    )


def get_ap_aging(db: Session, as_of_date: Optional[date] = None) -> AgingReportResponse:
    """
    Computes Accounts Payable Aging report broken down into 0-30, 31-60, 61-90, and 90+ day buckets.
    """
    if not as_of_date:
        as_of_date = date.today()

    bills = db.query(Bill).filter(
        Bill.status.in_(["RECEIVED", "PARTIALLY_PAID", "OVERDUE"]),
        Bill.amount_due > Decimal("0.00"),
        Bill.is_deleted == False,
    ).all()

    buckets_by_vnd: Dict[str, AgingBucket] = {}
    tot_0_30 = Decimal("0.00")
    tot_31_60 = Decimal("0.00")
    tot_61_90 = Decimal("0.00")
    tot_90 = Decimal("0.00")
    grand_tot = Decimal("0.00")

    for b in bills:
        vnd_id = b.vendor_id
        vnd_name = b.vendor.name if b.vendor else "Vendor"

        if vnd_id not in buckets_by_vnd:
            buckets_by_vnd[vnd_id] = AgingBucket(entity_id=vnd_id, entity_name=vnd_name)

        due = b.due_date
        days = (as_of_date - due).days
        due_amt = b.amount_due

        if days <= 30:
            buckets_by_vnd[vnd_id].current_0_30 += due_amt
            tot_0_30 += due_amt
        elif days <= 60:
            buckets_by_vnd[vnd_id].past_31_60 += due_amt
            tot_31_60 += due_amt
        elif days <= 90:
            buckets_by_vnd[vnd_id].past_61_90 += due_amt
            tot_61_90 += due_amt
        else:
            buckets_by_vnd[vnd_id].past_90_plus += due_amt
            tot_90 += due_amt

        buckets_by_vnd[vnd_id].total_outstanding += due_amt
        grand_tot += due_amt

    return AgingReportResponse(
        as_of_date=as_of_date,
        report_type="AP",
        buckets=list(buckets_by_vnd.values()),
        total_0_30=tot_0_30,
        total_31_60=tot_31_60,
        total_61_90=tot_61_90,
        total_90_plus=tot_90,
        grand_total=grand_tot,
    )


def get_accounting_dashboard(db: Session) -> AccountingDashboardResponse:
    """
    Provides real-time operational financial KPIs and recent transactions.
    """
    today = date.today()
    start_of_year = date(today.year, 1, 1)

    pnl = get_profit_and_loss(db, start_of_year, today)
    ar_report = get_ar_aging(db, today)
    ap_report = get_ap_aging(db, today)

    # Cash and Bank balance
    cash_bank_accounts = db.query(Account).filter(
        Account.is_bank_or_cash == True,
        Account.is_active == True,
    ).all()
    cash_bank_total = Decimal("0.00")
    for cb in cash_bank_accounts:
        row = (
            db.query(
                func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
                func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == cb.id,
                JournalEntry.status == "POSTED",
            )
            .first()
        )
        deb = Decimal(str(row.deb or 0.00))
        crd = Decimal(str(row.crd or 0.00))
        cash_bank_total += (deb - crd)

    # Overdue counts
    overdue_invoices = db.query(Invoice).filter(
        Invoice.status.in_(["ISSUED", "PARTIALLY_PAID", "OVERDUE"]),
        Invoice.due_date < today,
        Invoice.amount_due > Decimal("0.00"),
        Invoice.is_deleted == False,
    ).all()
    overdue_inv_amt = sum((i.amount_due for i in overdue_invoices), Decimal("0.00"))

    overdue_bills = db.query(Bill).filter(
        Bill.status.in_(["RECEIVED", "PARTIALLY_PAID", "OVERDUE"]),
        Bill.due_date < today,
        Bill.amount_due > Decimal("0.00"),
        Bill.is_deleted == False,
    ).all()
    overdue_bill_amt = sum((b.amount_due for b in overdue_bills), Decimal("0.00"))

    # Recent lists
    recent_invoices = [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "company_name": inv.company.organization_name if inv.company else "Company",
            "total_amount": float(inv.total_amount),
            "amount_due": float(inv.amount_due),
            "status": inv.status,
            "invoice_date": inv.invoice_date.isoformat(),
        }
        for inv in db.query(Invoice).filter(Invoice.is_deleted == False).order_by(Invoice.created_at.desc()).limit(5).all()
    ]

    recent_payments = [
        {
            "id": p.id,
            "payment_number": p.payment_number,
            "company_name": p.company.organization_name if p.company else "Company",
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "payment_date": p.payment_date.isoformat(),
            "status": p.status,
        }
        for p in db.query(CustomerPayment).order_by(CustomerPayment.created_at.desc()).limit(5).all()
    ]

    recent_bills = [
        {
            "id": b.id,
            "bill_number": b.bill_number,
            "vendor_name": b.vendor.name if b.vendor else "Vendor",
            "total_amount": float(b.total_amount),
            "amount_due": float(b.amount_due),
            "status": b.status,
            "bill_date": b.bill_date.isoformat(),
        }
        for b in db.query(Bill).filter(Bill.is_deleted == False).order_by(Bill.created_at.desc()).limit(5).all()
    ]

    recent_expenses = [
        {
            "id": e.id,
            "expense_number": e.expense_number,
            "category": e.category,
            "amount": float(e.total_amount),
            "description": e.description,
            "status": e.status,
            "expense_date": e.expense_date.isoformat(),
        }
        for e in db.query(Expense).filter(Expense.is_deleted == False).order_by(Expense.created_at.desc()).limit(5).all()
    ]

    recent_jes = [
        {
            "id": je.id,
            "entry_number": je.entry_number,
            "description": je.description,
            "total_debit": float(je.total_debit),
            "status": je.status,
            "transaction_date": je.transaction_date.isoformat(),
        }
        for je in db.query(JournalEntry).order_by(JournalEntry.created_at.desc()).limit(5).all()
    ]

    return AccountingDashboardResponse(
        total_revenue=pnl.revenue.total,
        total_expenses=pnl.expenses.total,
        net_income=pnl.net_income,
        accounts_receivable=ar_report.grand_total,
        accounts_payable=ap_report.grand_total,
        cash_and_bank_balance=cash_bank_total,
        overdue_invoices_count=len(overdue_invoices),
        overdue_invoices_amount=overdue_inv_amt,
        overdue_bills_count=len(overdue_bills),
        overdue_bills_amount=overdue_bill_amt,
        recent_invoices=recent_invoices,
        recent_payments=recent_payments,
        recent_bills=recent_bills,
        recent_expenses=recent_expenses,
        recent_journal_entries=recent_jes,
    )
