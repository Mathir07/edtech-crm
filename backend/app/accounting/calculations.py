from decimal import Decimal
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.accounting.models import (
    Account, FiscalPeriod, JournalEntry, JournalLine,
    Invoice, CustomerPayment, Bill, VendorPayment, Expense
)
from app.sales.calculations import generate_sequential_number


def validate_journal_balance(lines: List[Any]) -> Tuple[bool, Decimal, Decimal]:
    """
    Validates double-entry accounting rule: Total Debits == Total Credits.
    Ensures every line is non-negative and does not contain both debit and credit.
    """
    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")

    if len(lines) < 2:
        return False, total_debit, total_credit

    for line in lines:
        debit = Decimal(str(getattr(line, "debit", 0.0) or 0.0))
        credit = Decimal(str(getattr(line, "credit", 0.0) or 0.0))

        if debit < Decimal("0.00") or credit < Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Journal lines cannot have negative debit or credit values."
            )

        if debit > Decimal("0.00") and credit > Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A journal line cannot contain both a debit and a credit."
            )

        total_debit += debit
        total_credit += credit

    diff = abs(total_debit - total_credit)
    is_balanced = diff < Decimal("0.001") and total_debit > Decimal("0.00")
    return is_balanced, total_debit, total_credit


def check_fiscal_period_open(db: Session, target_date: date) -> Optional[FiscalPeriod]:
    """
    Validates that posting into the given date is allowed.
    Transactions must fall within an OPEN fiscal period.
    Posting into CLOSED, LOCKED, or undefined fiscal periods is rejected.
    """
    period = db.query(FiscalPeriod).filter(
        FiscalPeriod.start_date <= target_date,
        FiscalPeriod.end_date >= target_date,
    ).first()

    if not period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No open fiscal period covers transaction date '{target_date}'. Financial posting rejected."
        )

    if period.status in ("CLOSED", "LOCKED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot post transaction in {period.status.lower()} fiscal period '{period.name}' ({period.start_date} to {period.end_date})."
        )
    return period


def get_or_create_default_account(
    db: Session,
    code: str,
    name: str,
    acc_type: str,
    is_control: bool = False,
    is_bank_cash: bool = False,
) -> Account:
    """Helper to ensure critical standard control accounts exist."""
    acc = db.query(Account).filter(Account.account_code == code).first()
    if not acc:
        acc = Account(
            account_code=code,
            account_name=name,
            account_type=acc_type,
            is_control_account=is_control,
            is_bank_or_cash=is_bank_cash,
            is_active=True,
            currency="INR",
        )
        db.add(acc)
        db.flush()
    return acc


def create_invoice_journal(db: Session, invoice: Invoice, user_id: Optional[str]) -> JournalEntry:
    """
    Generates balanced Journal Entry when an Invoice is issued:
    Debit: Accounts Receivable (1200) = Total Amount
    Credit: Revenue (4000/4100) = Subtotal - Discount
    Credit: Tax Payable (2100) = Tax Amount
    """
    check_fiscal_period_open(db, invoice.invoice_date)

    ar_acc = db.query(Account).filter(Account.account_code == "1200").first()
    if not ar_acc:
        ar_acc = get_or_create_default_account(db, "1200", "Accounts Receivable", "ASSET", is_control=True)

    rev_acc = db.query(Account).filter(Account.account_code == "4000").first()
    if not rev_acc:
        rev_acc = get_or_create_default_account(db, "4000", "Software & Product Revenue", "REVENUE")

    tax_acc = db.query(Account).filter(Account.account_code == "2100").first()
    if not tax_acc:
        tax_acc = get_or_create_default_account(db, "2100", "GST / Tax Output Payable", "LIABILITY")

    je_num = generate_sequential_number(db, "journal_entry", "JE")
    je = JournalEntry(
        entry_number=je_num,
        transaction_date=invoice.invoice_date,
        posting_date=invoice.invoice_date,
        description=f"Sales Invoice {invoice.invoice_number} for {invoice.company.organization_name if invoice.company else 'Company'}",
        reference=invoice.invoice_number,
        source_module="INVOICE",
        source_id=invoice.id,
        status="POSTED",
        total_debit=invoice.total_amount,
        total_credit=invoice.total_amount,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(je)
    db.flush()

    # 1. Debit AR (Control account)
    line_ar = JournalLine(
        journal_entry_id=je.id,
        account_id=ar_acc.id,
        description=f"AR - Invoice {invoice.invoice_number}",
        debit=invoice.total_amount,
        credit=Decimal("0.00"),
        reference=invoice.invoice_number,
        company_id=invoice.company_id,
    )
    db.add(line_ar)

    # 2. Credit Revenue
    net_revenue = invoice.subtotal - invoice.discount_amount
    line_rev = JournalLine(
        journal_entry_id=je.id,
        account_id=rev_acc.id,
        description=f"Revenue - Invoice {invoice.invoice_number}",
        debit=Decimal("0.00"),
        credit=net_revenue,
        reference=invoice.invoice_number,
        company_id=invoice.company_id,
    )
    db.add(line_rev)

    # 3. Credit Tax (if applicable)
    if invoice.tax_amount > Decimal("0.00"):
        line_tax = JournalLine(
            journal_entry_id=je.id,
            account_id=tax_acc.id,
            description=f"Tax Payable - Invoice {invoice.invoice_number}",
            debit=Decimal("0.00"),
            credit=invoice.tax_amount,
            reference=invoice.invoice_number,
            company_id=invoice.company_id,
        )
        db.add(line_tax)

    db.flush()
    return je


def create_payment_journal(db: Session, payment: CustomerPayment, user_id: Optional[str]) -> JournalEntry:
    """
    Generates balanced Journal Entry when Customer Payment is posted:
    Debit: Bank / Cash Account (1010/1000) = Payment Amount
    Credit: Accounts Receivable (1200) = Payment Amount
    """
    check_fiscal_period_open(db, payment.payment_date)

    ar_acc = db.query(Account).filter(Account.account_code == "1200").first()
    if not ar_acc:
        ar_acc = get_or_create_default_account(db, "1200", "Accounts Receivable", "ASSET", is_control=True)

    je_num = generate_sequential_number(db, "journal_entry", "JE")
    je = JournalEntry(
        entry_number=je_num,
        transaction_date=payment.payment_date,
        posting_date=payment.payment_date,
        description=f"Customer Receipt {payment.payment_number} from {payment.company.organization_name if payment.company else 'Company'}",
        reference=payment.reference or payment.payment_number,
        source_module="PAYMENT",
        source_id=payment.id,
        status="POSTED",
        total_debit=payment.amount,
        total_credit=payment.amount,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(je)
    db.flush()

    # 1. Debit Bank/Cash
    line_bank = JournalLine(
        journal_entry_id=je.id,
        account_id=payment.bank_account_id,
        description=f"Receipt {payment.payment_number} via {payment.payment_method}",
        debit=payment.amount,
        credit=Decimal("0.00"),
        reference=payment.reference,
        company_id=payment.company_id,
    )
    db.add(line_bank)

    # 2. Credit AR
    line_ar = JournalLine(
        journal_entry_id=je.id,
        account_id=ar_acc.id,
        description=f"AR Reduction - Receipt {payment.payment_number}",
        debit=Decimal("0.00"),
        credit=payment.amount,
        reference=payment.payment_number,
        company_id=payment.company_id,
    )
    db.add(line_ar)

    db.flush()
    return je


def create_bill_journal(db: Session, bill: Bill, user_id: Optional[str]) -> JournalEntry:
    """
    Generates balanced Journal Entry when a Vendor Bill is posted:
    Debit: Expense Accounts (5000+) = Item Line Totals / Subtotal
    Debit: Tax Input / Receivable (2110 or 2100) = Tax Amount
    Credit: Accounts Payable (2000) = Total Amount
    """
    check_fiscal_period_open(db, bill.bill_date)

    ap_acc = db.query(Account).filter(Account.account_code == "2000").first()
    if not ap_acc:
        ap_acc = get_or_create_default_account(db, "2000", "Accounts Payable", "LIABILITY", is_control=True)

    default_exp_acc = db.query(Account).filter(Account.account_code == "5300").first()
    if not default_exp_acc:
        default_exp_acc = get_or_create_default_account(db, "5300", "Office & Operating Expenses", "EXPENSE")

    tax_acc = db.query(Account).filter(Account.account_code == "2110").first()
    if not tax_acc:
        tax_acc = get_or_create_default_account(db, "2110", "GST / Input Tax Credit", "ASSET")

    je_num = generate_sequential_number(db, "journal_entry", "JE")
    je = JournalEntry(
        entry_number=je_num,
        transaction_date=bill.bill_date,
        posting_date=bill.bill_date,
        description=f"Vendor Bill {bill.bill_number} from {bill.vendor.name if bill.vendor else 'Vendor'}",
        reference=bill.reference or bill.bill_number,
        source_module="BILL",
        source_id=bill.id,
        status="POSTED",
        total_debit=bill.total_amount,
        total_credit=bill.total_amount,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(je)
    db.flush()

    # 1. Debit Expense Items
    if bill.items:
        for item in bill.items:
            acc_id = item.expense_account_id or default_exp_acc.id
            net_amt = item.line_total - item.tax_amount
            line_item = JournalLine(
                journal_entry_id=je.id,
                account_id=acc_id,
                description=f"{item.description} (Bill {bill.bill_number})",
                debit=net_amt if net_amt > 0 else item.line_total,
                credit=Decimal("0.00"),
                reference=bill.bill_number,
                vendor_id=bill.vendor_id,
            )
            db.add(line_item)
    else:
        line_exp = JournalLine(
            journal_entry_id=je.id,
            account_id=default_exp_acc.id,
            description=f"Operating expense (Bill {bill.bill_number})",
            debit=bill.subtotal,
            credit=Decimal("0.00"),
            reference=bill.bill_number,
            vendor_id=bill.vendor_id,
        )
        db.add(line_exp)

    # 2. Debit Tax Input (if applicable)
    if bill.tax_amount > Decimal("0.00"):
        line_tax = JournalLine(
            journal_entry_id=je.id,
            account_id=tax_acc.id,
            description=f"Input Tax Credit - Bill {bill.bill_number}",
            debit=bill.tax_amount,
            credit=Decimal("0.00"),
            reference=bill.bill_number,
            vendor_id=bill.vendor_id,
        )
        db.add(line_tax)

    # 3. Credit AP
    line_ap = JournalLine(
        journal_entry_id=je.id,
        account_id=ap_acc.id,
        description=f"AP - Vendor Bill {bill.bill_number}",
        debit=Decimal("0.00"),
        credit=bill.total_amount,
        reference=bill.bill_number,
        vendor_id=bill.vendor_id,
    )
    db.add(line_ap)

    db.flush()
    return je


def create_vendor_payment_journal(db: Session, vpay: VendorPayment, user_id: Optional[str]) -> JournalEntry:
    """
    Generates balanced Journal Entry when Vendor Payment is disbursed:
    Debit: Accounts Payable (2000) = Amount
    Credit: Bank / Cash Account (1010/1000) = Amount
    """
    check_fiscal_period_open(db, vpay.payment_date)

    ap_acc = db.query(Account).filter(Account.account_code == "2000").first()
    if not ap_acc:
        ap_acc = get_or_create_default_account(db, "2000", "Accounts Payable", "LIABILITY", is_control=True)

    je_num = generate_sequential_number(db, "journal_entry", "JE")
    je = JournalEntry(
        entry_number=je_num,
        transaction_date=vpay.payment_date,
        posting_date=vpay.payment_date,
        description=f"Vendor Payment {vpay.payment_number} to {vpay.vendor.name if vpay.vendor else 'Vendor'}",
        reference=vpay.reference or vpay.payment_number,
        source_module="BILL",
        source_id=vpay.id,
        status="POSTED",
        total_debit=vpay.amount,
        total_credit=vpay.amount,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(je)
    db.flush()

    # 1. Debit AP
    line_ap = JournalLine(
        journal_entry_id=je.id,
        account_id=ap_acc.id,
        description=f"AP Settlement - Payment {vpay.payment_number}",
        debit=vpay.amount,
        credit=Decimal("0.00"),
        reference=vpay.payment_number,
        vendor_id=vpay.vendor_id,
    )
    db.add(line_ap)

    # 2. Credit Bank
    line_bank = JournalLine(
        journal_entry_id=je.id,
        account_id=vpay.bank_account_id,
        description=f"Disbursement {vpay.payment_number} via {vpay.payment_method}",
        debit=Decimal("0.00"),
        credit=vpay.amount,
        reference=vpay.reference,
        vendor_id=vpay.vendor_id,
    )
    db.add(line_bank)

    db.flush()
    return je


def create_expense_journal(db: Session, expense: Expense, user_id: Optional[str]) -> JournalEntry:
    """
    Generates balanced Journal Entry when Company Expense is posted:
    Debit: Expense Account (5000+) = Net Amount
    Debit: Tax Input (if applicable) = Tax Amount
    Credit: Bank / Cash Account (1010/1000) = Total Amount
    """
    check_fiscal_period_open(db, expense.expense_date)

    je_num = generate_sequential_number(db, "journal_entry", "JE")
    je = JournalEntry(
        entry_number=je_num,
        transaction_date=expense.expense_date,
        posting_date=expense.expense_date,
        description=f"Corporate Expense: {expense.description} ({expense.category})",
        reference=expense.reference or expense.expense_number,
        source_module="EXPENSE",
        source_id=expense.id,
        status="POSTED",
        total_debit=expense.total_amount,
        total_credit=expense.total_amount,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(je)
    db.flush()

    # 1. Debit Expense Account
    line_exp = JournalLine(
        journal_entry_id=je.id,
        account_id=expense.expense_account_id,
        description=expense.description,
        debit=expense.amount,
        credit=Decimal("0.00"),
        reference=expense.expense_number,
        vendor_id=expense.vendor_id,
    )
    db.add(line_exp)

    # 2. Debit Tax Input (if tax > 0)
    if expense.tax_amount > Decimal("0.00"):
        tax_acc = db.query(Account).filter(Account.account_code == "2110").first()
        if not tax_acc:
            tax_acc = get_or_create_default_account(db, "2110", "GST / Input Tax Credit", "ASSET")
        line_tax = JournalLine(
            journal_entry_id=je.id,
            account_id=tax_acc.id,
            description=f"Input tax on expense {expense.expense_number}",
            debit=expense.tax_amount,
            credit=Decimal("0.00"),
            reference=expense.expense_number,
            vendor_id=expense.vendor_id,
        )
        db.add(line_tax)

    # 3. Credit Payment Account (Bank/Cash)
    line_pay = JournalLine(
        journal_entry_id=je.id,
        account_id=expense.payment_account_id,
        description=f"Payment for expense {expense.expense_number} via {expense.payment_method}",
        debit=Decimal("0.00"),
        credit=expense.total_amount,
        reference=expense.reference,
        vendor_id=expense.vendor_id,
    )
    db.add(line_pay)

    db.flush()
    return je


def reverse_journal_entry(
    db: Session,
    original_entry: JournalEntry,
    reason: str,
    user_id: Optional[str]
) -> JournalEntry:
    """
    Creates a compensating reversal Journal Entry flipping all debits and credits.
    Marks original entry as REVERSED and links them bi-directionally.
    """
    if original_entry.status != "POSTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reverse journal entry with status '{original_entry.status}'. Only POSTED entries can be reversed."
        )

    check_fiscal_period_open(db, date.today())

    reversal_num = generate_sequential_number(db, "journal_entry", "JE")
    reversal_entry = JournalEntry(
        entry_number=reversal_num,
        transaction_date=date.today(),
        posting_date=date.today(),
        description=f"Reversal of {original_entry.entry_number}: {reason}",
        reference=original_entry.entry_number,
        source_module="REVERSAL",
        source_id=original_entry.id,
        status="POSTED",
        total_debit=original_entry.total_credit,
        total_credit=original_entry.total_debit,
        reversed_entry_id=original_entry.id,
        reversal_reason=reason,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(reversal_entry)
    db.flush()

    for line in original_entry.lines:
        flipped_line = JournalLine(
            journal_entry_id=reversal_entry.id,
            account_id=line.account_id,
            description=f"Reversal: {line.description or ''}",
            debit=line.credit,   # FLIP
            credit=line.debit,   # FLIP
            reference=original_entry.entry_number,
            company_id=line.company_id,
            vendor_id=line.vendor_id,
        )
        db.add(flipped_line)

    original_entry.status = "REVERSED"
    original_entry.reversal_reason = reason
    db.flush()
    return reversal_entry
