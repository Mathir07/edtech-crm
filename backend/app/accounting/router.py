import io
import csv
from decimal import Decimal
from datetime import date, datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission, require_any_permission
from app.core.audit import record_audit_log
from app.users.models import User
from app.organizations.models import Company, Contact
from app.sales.models import SalesOrder, Contract
from app.projects.models import Project
from app.sales.calculations import generate_sequential_number

from app.accounting.models import (
    Account, FiscalPeriod, JournalEntry, JournalLine,
    TaxRate, Invoice, InvoiceItem, CustomerPayment,
    PaymentAllocation, Vendor, Bill, BillItem,
    VendorPayment, BillAllocation, Expense,
    BankReconciliation, BankReconciliationItem
)
from app.accounting.schemas import (
    AccountCreate, AccountUpdate, AccountResponse, AccountTreeItem,
    FiscalPeriodCreate, FiscalPeriodUpdate, FiscalPeriodResponse,
    TaxRateCreate, TaxRateResponse,
    JournalLineCreate, JournalLineResponse,
    JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse, JournalEntryReverseRequest,
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceFromSalesOrderRequest,
    CustomerPaymentCreate, CustomerPaymentResponse, PaymentAllocationItem, PaymentAllocationResponse,
    VendorCreate, VendorUpdate, VendorResponse,
    BillCreate, BillResponse, VendorPaymentCreate,
    ExpenseCreate, ExpenseResponse,
    BankReconciliationCreate, BankReconciliationResponse, BankReconciliationMatchRequest,
    TrialBalanceResponse, GeneralLedgerResponse, ProfitLossResponse, BalanceSheetResponse,
    AgingReportResponse, AccountingDashboardResponse
)
from app.accounting.calculations import (
    validate_journal_balance, check_fiscal_period_open,
    create_invoice_journal, create_payment_journal,
    create_bill_journal, create_vendor_payment_journal,
    create_expense_journal, reverse_journal_entry,
    get_or_create_default_account
)
from app.accounting.reports import (
    get_trial_balance, get_general_ledger,
    get_profit_and_loss, get_balance_sheet,
    get_ar_aging, get_ap_aging,
    get_accounting_dashboard
)

router = APIRouter(tags=["Accounting & Finance"])


# ==========================================
# EXTENSION CONTRACT STATUS
# ==========================================

@router.get("/extensions/accounting/status")
@router.get("/accounting/status")
def accounting_extension_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Modular monolith contract for Accounting & Finance extension.
    """
    acc_count = db.query(Account).count()
    inv_count = db.query(Invoice).filter(Invoice.is_deleted == False).count()
    je_count = db.query(JournalEntry).count()
    return {
        "module": "accounting_finance",
        "status": "active",
        "version": "1.0",
        "total_accounts": acc_count,
        "total_invoices": inv_count,
        "total_journal_entries": je_count,
    }


# ==========================================
# CHART OF ACCOUNTS
# ==========================================

@router.get("/accounting/accounts", response_model=List[AccountResponse])
def list_accounts(
    account_type: Optional[str] = Query(None, description="ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE"),
    active_only: bool = Query(True),
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_accounts"])),
):
    query = db.query(Account)
    if active_only:
        query = query.filter(Account.is_active == True)
    if account_type:
        query = query.filter(Account.account_type == account_type.upper())
    if q:
        query = query.filter(
            or_(
                Account.account_code.ilike(f"%{q}%"),
                Account.account_name.ilike(f"%{q}%")
            )
        )
    accounts = query.order_by(Account.account_code.asc()).all()

    results = []
    for acc in accounts:
        # Calculate live balance from posted journal lines
        row = (
            db.query(
                func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
                func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status == "POSTED",
            )
            .first()
        )
        deb = Decimal(str(row.deb or 0.00))
        crd = Decimal(str(row.crd or 0.00))
        bal = (deb - crd) if acc.account_type in ("ASSET", "EXPENSE") else (crd - deb)

        resp = AccountResponse.model_validate(acc)
        resp.current_balance = bal
        results.append(resp)
    return results


@router.get("/accounting/accounts/tree")
def get_account_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_accounts"])),
):
    accounts = db.query(Account).filter(Account.is_active == True).order_by(Account.account_code.asc()).all()
    account_map = {}
    for acc in accounts:
        account_map[acc.id] = {
            "id": acc.id,
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "account_type": acc.account_type,
            "parent_account_id": acc.parent_account_id,
            "is_control_account": acc.is_control_account,
            "is_bank_or_cash": acc.is_bank_or_cash,
            "currency": acc.currency,
            "children": [],
        }

    tree = []
    for acc in accounts:
        if acc.parent_account_id and acc.parent_account_id in account_map:
            account_map[acc.parent_account_id]["children"].append(account_map[acc.id])
        else:
            tree.append(account_map[acc.id])
    return tree


@router.get("/accounting/accounts/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_accounts"])),
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    row = (
        db.query(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .filter(JournalLine.account_id == acc.id, JournalEntry.status == "POSTED")
        .first()
    )
    deb = Decimal(str(row.deb or 0.00))
    crd = Decimal(str(row.crd or 0.00))
    bal = (deb - crd) if acc.account_type in ("ASSET", "EXPENSE") else (crd - deb)

    resp = AccountResponse.model_validate(acc)
    resp.current_balance = bal
    return resp


@router.post("/accounting/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    data: AccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.manage_accounts", "accounting.create"])),
):
    existing = db.query(Account).filter(Account.account_code == data.account_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Account code '{data.account_code}' already exists.")

    acc = Account(
        account_code=data.account_code.strip(),
        account_name=data.account_name.strip(),
        account_type=data.account_type.upper(),
        parent_account_id=data.parent_account_id,
        description=data.description,
        is_control_account=data.is_control_account,
        is_bank_or_cash=data.is_bank_or_cash,
        currency=data.currency or "INR",
        created_by_id=current_user.id,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="ACCOUNT",
        entity_id=acc.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"code": acc.account_code, "name": acc.account_name, "type": acc.account_type},
        request=request,
    )
    return acc


@router.patch("/accounting/accounts/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: str,
    data: AccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.manage_accounts", "accounting.edit"])),
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    old_vals = {"name": acc.account_name, "is_active": acc.is_active}
    if data.account_name is not None:
        acc.account_name = data.account_name.strip()
    if data.description is not None:
        acc.description = data.description
    if data.parent_account_id is not None:
        acc.parent_account_id = data.parent_account_id
    if data.is_active is not None:
        acc.is_active = data.is_active
    if data.is_control_account is not None:
        acc.is_control_account = data.is_control_account
    if data.is_bank_or_cash is not None:
        acc.is_bank_or_cash = data.is_bank_or_cash

    db.commit()
    db.refresh(acc)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="ACCOUNT",
        entity_id=acc.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values={"name": acc.account_name, "is_active": acc.is_active},
        request=request,
    )
    return acc


@router.delete("/accounting/accounts/{account_id}")
def delete_account(
    account_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.manage_accounts")),
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    # Safety: Cannot delete account used in posted transactions
    used = (
        db.query(JournalLine)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .filter(JournalLine.account_id == acc.id, JournalEntry.status == "POSTED")
        .first()
    )
    if used:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete account with existing posted journal entries. You may deactivate it instead."
        )

    acc.is_active = False
    db.commit()
    return {"message": f"Account {acc.account_code} deactivated successfully"}


# ==========================================
# FISCAL PERIODS
# ==========================================

@router.get("/accounting/fiscal-periods", response_model=List[FiscalPeriodResponse])
def list_fiscal_periods(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_periods"])),
):
    return db.query(FiscalPeriod).order_by(FiscalPeriod.start_date.desc()).all()


@router.post("/accounting/fiscal-periods", response_model=FiscalPeriodResponse, status_code=status.HTTP_201_CREATED)
def create_fiscal_period(
    data: FiscalPeriodCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.manage_periods")),
):
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    existing = db.query(FiscalPeriod).filter(FiscalPeriod.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Fiscal period '{data.name}' already exists.")

    period = FiscalPeriod(
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        status="OPEN",
        notes=data.notes,
    )
    db.add(period)
    db.commit()
    db.refresh(period)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="FISCAL_PERIOD",
        entity_id=period.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"name": period.name, "start": str(period.start_date), "end": str(period.end_date)},
        request=request,
    )
    return period


@router.patch("/accounting/fiscal-periods/{period_id}", response_model=FiscalPeriodResponse)
def update_fiscal_period(
    period_id: str,
    data: FiscalPeriodUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.manage_periods")),
):
    period = db.query(FiscalPeriod).filter(FiscalPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Fiscal period not found")

    if data.status:
        valid_statuses = {"OPEN", "CLOSED", "LOCKED"}
        st = data.status.upper()
        if st not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        period.status = st
        if st in ("CLOSED", "LOCKED"):
            period.closed_by_id = current_user.id
            period.closed_at = datetime.now(timezone.utc)
        else:
            period.closed_by_id = None
            period.closed_at = None

    if data.notes is not None:
        period.notes = data.notes

    db.commit()
    db.refresh(period)
    return period


# ==========================================
# TAX RATES
# ==========================================

@router.get("/accounting/tax-rates", response_model=List[TaxRateResponse])
def list_tax_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_tax"])),
):
    return db.query(TaxRate).filter(TaxRate.is_active == True).order_by(TaxRate.rate.asc()).all()


@router.post("/accounting/tax-rates", response_model=TaxRateResponse, status_code=status.HTTP_201_CREATED)
def create_tax_rate(
    data: TaxRateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.manage_tax")),
):
    existing = db.query(TaxRate).filter(TaxRate.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tax rate code '{data.code}' already exists.")

    tax = TaxRate(
        name=data.name,
        code=data.code.upper(),
        rate=data.rate,
        tax_account_id=data.tax_account_id,
        description=data.description,
        is_active=True,
    )
    db.add(tax)
    db.commit()
    db.refresh(tax)
    return tax


# ==========================================
# JOURNAL ENTRIES (DOUBLE-ENTRY)
# ==========================================

@router.get("/accounting/journal-entries", response_model=List[JournalEntryResponse])
def list_journal_entries(
    status_filter: Optional[str] = Query(None, alias="status"),
    source_module: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.view")),
):
    query = db.query(JournalEntry)
    if status_filter:
        query = query.filter(JournalEntry.status == status_filter.upper())
    if source_module:
        query = query.filter(JournalEntry.source_module == source_module.upper())
    if start_date:
        query = query.filter(JournalEntry.transaction_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.transaction_date <= end_date)

    entries = query.order_by(JournalEntry.transaction_date.desc(), JournalEntry.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for je in entries:
        r = JournalEntryResponse.model_validate(je)
        r.lines = [
            JournalLineResponse(
                id=l.id,
                journal_entry_id=l.journal_entry_id,
                account_id=l.account_id,
                account_code=l.account.account_code if l.account else None,
                account_name=l.account.account_name if l.account else None,
                description=l.description,
                debit=l.debit,
                credit=l.credit,
                reference=l.reference,
                company_id=l.company_id,
                vendor_id=l.vendor_id,
                created_at=l.created_at,
            )
            for l in je.lines
        ]
        results.append(r)
    return results


@router.get("/accounting/journal-entries/{entry_id}", response_model=JournalEntryResponse)
def get_journal_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.view")),
):
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    r = JournalEntryResponse.model_validate(je)
    r.lines = [
        JournalLineResponse(
            id=l.id,
            journal_entry_id=l.journal_entry_id,
            account_id=l.account_id,
            account_code=l.account.account_code if l.account else None,
            account_name=l.account.account_name if l.account else None,
            description=l.description,
            debit=l.debit,
            credit=l.credit,
            reference=l.reference,
            company_id=l.company_id,
            vendor_id=l.vendor_id,
            created_at=l.created_at,
        )
        for l in je.lines
    ]
    return r


@router.post("/accounting/journal-entries", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    data: JournalEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_accounts"])),
):
    # Verify double entry balance
    is_balanced, total_debit, total_credit = validate_journal_balance(data.lines)
    if not is_balanced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Journal entry is unbalanced: Total Debits ({total_debit}) != Total Credits ({total_credit})."
        )

    # Verify fiscal period is open
    check_fiscal_period_open(db, data.transaction_date)

    entry_num = generate_sequential_number(db, "journal_entry", "JE")
    je = JournalEntry(
        entry_number=entry_num,
        transaction_date=data.transaction_date,
        posting_date=data.posting_date,
        description=data.description,
        reference=data.reference,
        source_module=data.source_module.upper(),
        source_id=data.source_id,
        status="DRAFT",
        total_debit=total_debit,
        total_credit=total_credit,
        created_by_id=current_user.id,
    )
    db.add(je)
    db.flush()

    for l in data.lines:
        acc = db.query(Account).filter(Account.id == l.account_id).first()
        if not acc:
            raise HTTPException(status_code=400, detail=f"Account with ID '{l.account_id}' not found.")
        jl = JournalLine(
            journal_entry_id=je.id,
            account_id=acc.id,
            description=l.description or data.description,
            debit=l.debit,
            credit=l.credit,
            reference=l.reference or data.reference,
            company_id=l.company_id,
            vendor_id=l.vendor_id,
        )
        db.add(jl)

    db.commit()
    db.refresh(je)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="JOURNAL_ENTRY",
        entity_id=je.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"entry_number": je.entry_number, "total_debit": float(total_debit), "status": je.status},
        request=request,
    )
    return get_journal_entry(je.id, db, current_user)


@router.put("/accounting/journal-entries/{entry_id}", response_model=JournalEntryResponse)
def update_journal_entry(
    entry_id: str,
    data: JournalEntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.edit")),
):
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit journal entry with status '{je.status}'. Posted entries are immutable."
        )

    if data.description is not None:
        je.description = data.description
    if data.reference is not None:
        je.reference = data.reference
    if data.transaction_date is not None:
        check_fiscal_period_open(db, data.transaction_date)
        je.transaction_date = data.transaction_date

    if data.lines is not None:
        is_balanced, total_debit, total_credit = validate_journal_balance(data.lines)
        if not is_balanced:
            raise HTTPException(
                status_code=400,
                detail=f"Journal entry is unbalanced: Total Debits ({total_debit}) != Total Credits ({total_credit})."
            )
        # Delete old lines and insert new
        db.query(JournalLine).filter(JournalLine.journal_entry_id == je.id).delete()
        for l in data.lines:
            acc = db.query(Account).filter(Account.id == l.account_id).first()
            if not acc:
                raise HTTPException(status_code=400, detail=f"Account with ID '{l.account_id}' not found.")
            jl = JournalLine(
                journal_entry_id=je.id,
                account_id=acc.id,
                description=l.description or je.description,
                debit=l.debit,
                credit=l.credit,
                reference=l.reference or je.reference,
                company_id=l.company_id,
                vendor_id=l.vendor_id,
            )
            db.add(jl)
        je.total_debit = total_debit
        je.total_credit = total_credit

    db.commit()
    db.refresh(je)
    return get_journal_entry(je.id, db, current_user)


@router.post("/accounting/journal-entries/{entry_id}/post", response_model=JournalEntryResponse)
def post_journal_entry(
    entry_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.post")),
):
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Journal entry already has status '{je.status}'.")

    # Verify balance
    is_balanced, total_debit, total_credit = validate_journal_balance(je.lines)
    if not is_balanced:
        raise HTTPException(status_code=400, detail="Cannot post unbalanced journal entry.")

    # Verify fiscal period is open
    check_fiscal_period_open(db, je.transaction_date)

    je.status = "POSTED"
    je.posting_date = date.today()
    je.posted_by_id = current_user.id
    je.posted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(je)

    record_audit_log(
        db=db,
        action="POST",
        entity_type="JOURNAL_ENTRY",
        entity_id=je.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "POSTED", "posted_at": str(je.posted_at)},
        request=request,
    )
    return get_journal_entry(je.id, db, current_user)


@router.post("/accounting/journal-entries/{entry_id}/reverse", response_model=JournalEntryResponse)
def reverse_entry(
    entry_id: str,
    data: JournalEntryReverseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.reverse")),
):
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    rev_entry = reverse_journal_entry(db, je, data.reason, current_user.id)
    db.commit()
    db.refresh(rev_entry)

    record_audit_log(
        db=db,
        action="REVERSE",
        entity_type="JOURNAL_ENTRY",
        entity_id=je.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"reversal_entry_id": rev_entry.id, "reason": data.reason},
        request=request,
    )
    return get_journal_entry(rev_entry.id, db, current_user)


@router.delete("/accounting/journal-entries/{entry_id}")
def delete_draft_journal_entry(
    entry_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.delete_draft")),
):
    je = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Cannot delete posted or reversed journal entries.")

    db.delete(je)
    db.commit()
    return {"message": f"Journal entry {je.entry_number} deleted successfully"}


# ==========================================
# ACCOUNTS RECEIVABLE: INVOICES
# ==========================================

@router.get("/accounting/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    company_id: Optional[str] = None,
    sales_order_id: Optional[str] = None,
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "sales.orders.view", "crm.companies.view"])),
):
    query = db.query(Invoice).filter(Invoice.is_deleted == False)
    if status_filter:
        query = query.filter(Invoice.status == status_filter.upper())
    if company_id:
        query = query.filter(Invoice.company_id == company_id)
    if sales_order_id:
        query = query.filter(Invoice.sales_order_id == sales_order_id)
    if project_id:
        query = query.filter(Invoice.project_id == project_id)

    invoices = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for inv in invoices:
        resp = InvoiceResponse.model_validate(inv)
        resp.company_name = inv.company.organization_name if inv.company else None
        resp.contact_name = inv.contact.name if inv.contact else None
        resp.sales_order_number = inv.sales_order.order_number if inv.sales_order else None
        resp.contract_number = inv.contract.contract_number if inv.contract else None
        resp.project_number = inv.project.project_number if inv.project else None
        results.append(resp)
    return results


@router.get("/accounting/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "sales.orders.view", "crm.companies.view"])),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.is_deleted == False).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    resp = InvoiceResponse.model_validate(inv)
    resp.company_name = inv.company.organization_name if inv.company else None
    resp.contact_name = inv.contact.name if inv.contact else None
    resp.sales_order_number = inv.sales_order.order_number if inv.sales_order else None
    resp.contract_number = inv.contract.contract_number if inv.contract else None
    resp.project_number = inv.project.project_number if inv.project else None
    return resp


@router.post("/accounting/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_invoices"])),
):
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if not data.items:
        raise HTTPException(status_code=400, detail="Invoice must contain at least one line item.")

    inv_num = generate_sequential_number(db, "invoice", "INV")

    subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")

    items_to_add = []
    for idx, it in enumerate(data.items):
        qty = Decimal(str(it.quantity))
        price = Decimal(str(it.unit_price))
        disc = Decimal(str(it.discount))
        trate = Decimal(str(it.tax_rate))

        line_sub = (qty * price) - disc
        line_tax = line_sub * (trate / Decimal("100.00"))
        line_total = line_sub + line_tax

        subtotal += line_sub
        tax_total += line_tax

        items_to_add.append(InvoiceItem(
            product_id=it.product_id,
            account_id=it.account_id,
            description=it.description,
            quantity=qty,
            unit_price=price,
            discount=disc,
            tax_rate=trate,
            tax_amount=line_tax,
            line_total=line_total,
            sort_order=it.sort_order or idx,
        ))

    total_amount = subtotal - data.discount_amount + tax_total

    inv = Invoice(
        invoice_number=inv_num,
        company_id=data.company_id,
        contact_id=data.contact_id,
        sales_order_id=data.sales_order_id,
        contract_id=data.contract_id,
        project_id=data.project_id,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        currency=data.currency or "INR",
        subtotal=subtotal,
        discount_amount=data.discount_amount,
        tax_amount=tax_total,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        amount_due=total_amount,
        status="DRAFT",
        notes=data.notes,
        terms=data.terms,
        created_by_id=current_user.id,
    )
    inv.items = items_to_add
    db.add(inv)
    db.commit()
    db.refresh(inv)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="INVOICE",
        entity_id=inv.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"invoice_number": inv.invoice_number, "total": float(total_amount), "status": inv.status},
        request=request,
    )
    return get_invoice(inv.id, db, current_user)


@router.post("/accounting/invoices/from-sales-order/{sales_order_id}", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice_from_sales_order(
    sales_order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_invoices", "sales.orders.create"])),
):
    """
    Seamless commercial integration: Automatically creates draft Invoice from confirmed Sales Order.
    """
    so = db.query(SalesOrder).filter(SalesOrder.id == sales_order_id, SalesOrder.is_deleted == False).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order not found")

    # Check if invoice already created from this sales order
    existing_inv = db.query(Invoice).filter(
        Invoice.sales_order_id == so.id,
        Invoice.is_deleted == False,
        Invoice.status != "VOID"
    ).first()
    if existing_inv:
        return get_invoice(existing_inv.id, db, current_user)

    inv_num = generate_sequential_number(db, "invoice", "INV")
    
    # 30-day default payment terms
    today = date.today()
    from datetime import timedelta
    due = today + timedelta(days=30)

    items_to_add = []
    for idx, s_item in enumerate(so.items):
        items_to_add.append(InvoiceItem(
            product_id=s_item.product_id,
            description=s_item.description,
            quantity=s_item.quantity,
            unit_price=s_item.unit_price,
            discount=s_item.discount,
            tax_rate=s_item.tax_rate,
            tax_amount=s_item.tax_amount,
            line_total=s_item.line_total,
            sort_order=idx,
        ))

    inv = Invoice(
        invoice_number=inv_num,
        company_id=so.company_id,
        contact_id=so.contact_id,
        sales_order_id=so.id,
        contract_id=so.contract_id,
        invoice_date=today,
        due_date=due,
        currency=so.currency or "INR",
        subtotal=so.subtotal,
        discount_amount=so.discount_amount,
        tax_amount=so.tax_amount,
        total_amount=so.total_amount,
        amount_paid=Decimal("0.00"),
        amount_due=so.total_amount,
        status="DRAFT",
        notes=f"Generated automatically from Sales Order {so.order_number}",
        created_by_id=current_user.id,
    )
    inv.items = items_to_add
    db.add(inv)
    db.commit()
    db.refresh(inv)

    record_audit_log(
        db=db,
        action="CREATE_FROM_SALES_ORDER",
        entity_type="INVOICE",
        entity_id=inv.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"invoice_number": inv.invoice_number, "sales_order": so.order_number},
        request=request,
    )
    return get_invoice(inv.id, db, current_user)


@router.post("/accounting/invoices/{invoice_id}/issue", response_model=InvoiceResponse)
def issue_invoice(
    invoice_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.post", "accounting.manage_invoices"])),
):
    """
    Issues Invoice: Changes status from DRAFT to ISSUED and generates balanced Journal Entry.
    """
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.is_deleted == False).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot issue invoice with status '{inv.status}'.")

    # Generate balanced journal entry
    je = create_invoice_journal(db, inv, current_user.id)
    inv.journal_entry_id = je.id
    inv.status = "ISSUED"
    inv.issued_by_id = current_user.id
    inv.issued_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(inv)

    record_audit_log(
        db=db,
        action="ISSUE",
        entity_type="INVOICE",
        entity_id=inv.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "ISSUED", "journal_entry": je.entry_number},
        request=request,
    )
    return get_invoice(inv.id, db, current_user)


@router.post("/accounting/invoices/{invoice_id}/void", response_model=InvoiceResponse)
def void_invoice(
    invoice_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.void")),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.is_deleted == False).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.amount_paid > Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Cannot void an invoice with allocated payments.")

    if inv.journal_entry:
        reverse_journal_entry(db, inv.journal_entry, f"Voiding Invoice {inv.invoice_number}", current_user.id)

    inv.status = "VOID"
    inv.amount_due = Decimal("0.00")
    db.commit()
    db.refresh(inv)

    record_audit_log(
        db=db,
        action="VOID",
        entity_type="INVOICE",
        entity_id=inv.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "VOID"},
        request=request,
    )
    return get_invoice(inv.id, db, current_user)


# ==========================================
# PAYMENTS & ALLOCATIONS
# ==========================================

@router.get("/accounting/payments", response_model=List[CustomerPaymentResponse])
def list_payments(
    company_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_payments", "crm.companies.view"])),
):
    query = db.query(CustomerPayment)
    if company_id:
        query = query.filter(CustomerPayment.company_id == company_id)
    payments = query.order_by(CustomerPayment.payment_date.desc(), CustomerPayment.created_at.desc()).offset(skip).limit(limit).all()

    results = []
    for p in payments:
        resp = CustomerPaymentResponse.model_validate(p)
        resp.company_name = p.company.organization_name if p.company else None
        resp.bank_account_name = p.bank_account.account_name if p.bank_account else None
        resp.allocations = [
            PaymentAllocationResponse(
                id=a.id,
                payment_id=a.payment_id,
                invoice_id=a.invoice_id,
                invoice_number=a.invoice.invoice_number if a.invoice else None,
                amount=a.amount,
                allocated_at=a.allocated_at,
            )
            for a in p.allocations
        ]
        results.append(resp)
    return results


@router.post("/accounting/payments", response_model=CustomerPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_customer_payment(
    data: CustomerPaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_payments"])),
):
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    bank_acc = db.query(Account).filter(Account.id == data.bank_account_id).first()
    if not bank_acc:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if data.amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be positive.")

    # Validate allocations if provided
    total_alloc = sum((Decimal(str(a.amount)) for a in data.allocations), Decimal("0.00"))
    if total_alloc > data.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Total allocated amount ({total_alloc}) exceeds payment amount ({data.amount})."
        )

    pay_num = generate_sequential_number(db, "payment", "PAY")
    payment = CustomerPayment(
        payment_number=pay_num,
        company_id=data.company_id,
        payment_date=data.payment_date,
        amount=data.amount,
        payment_method=data.payment_method.upper(),
        bank_account_id=data.bank_account_id,
        reference=data.reference,
        notes=data.notes,
        status="POSTED",
        allocated_amount=total_alloc,
        unallocated_amount=data.amount - total_alloc,
        created_by_id=current_user.id,
        posted_by_id=current_user.id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.flush()

    # Generate balanced payment Journal Entry
    je = create_payment_journal(db, payment, current_user.id)
    payment.journal_entry_id = je.id

    # Allocate to invoices
    for a in data.allocations:
        inv = db.query(Invoice).filter(Invoice.id == a.invoice_id, Invoice.is_deleted == False).first()
        if not inv:
            raise HTTPException(status_code=404, detail=f"Invoice {a.invoice_id} not found.")
        if inv.company_id != company.id:
            raise HTTPException(status_code=400, detail="Cannot allocate payment to an invoice of a different company.")

        alloc_amt = Decimal(str(a.amount))
        if alloc_amt > inv.amount_due:
            raise HTTPException(
                status_code=400,
                detail=f"Allocation amount ({alloc_amt}) exceeds invoice {inv.invoice_number} balance due ({inv.amount_due})."
            )

        alloc = PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            amount=alloc_amt,
            created_by_id=current_user.id,
        )
        db.add(alloc)

        # Update invoice balances
        inv.amount_paid += alloc_amt
        inv.amount_due -= alloc_amt
        if inv.amount_due <= Decimal("0.00"):
            inv.status = "PAID"
        else:
            inv.status = "PARTIALLY_PAID"

    db.commit()
    db.refresh(payment)

    record_audit_log(
        db=db,
        action="CREATE_PAYMENT",
        entity_type="CUSTOMER_PAYMENT",
        entity_id=payment.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"payment_number": payment.payment_number, "amount": float(payment.amount)},
        request=request,
    )
    return list_payments(company_id=company.id, limit=1, db=db, current_user=current_user)[0]


@router.post("/accounting/payments/{payment_id}/allocate", response_model=CustomerPaymentResponse)
def allocate_payment(
    payment_id: str,
    data: PaymentAllocationItem,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_payments"])),
):
    payment = db.query(CustomerPayment).filter(CustomerPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    alloc_amt = Decimal(str(data.amount))
    if alloc_amt <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Allocation amount must be positive.")
    if alloc_amt > payment.unallocated_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Allocation amount ({alloc_amt}) exceeds unallocated payment balance ({payment.unallocated_amount})."
        )

    inv = db.query(Invoice).filter(Invoice.id == data.invoice_id, Invoice.is_deleted == False).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.company_id != payment.company_id:
        raise HTTPException(status_code=400, detail="Cannot allocate payment to an invoice of another company.")
    if alloc_amt > inv.amount_due:
        raise HTTPException(
            status_code=400,
            detail=f"Allocation amount ({alloc_amt}) exceeds invoice balance due ({inv.amount_due})."
        )

    alloc = PaymentAllocation(
        payment_id=payment.id,
        invoice_id=inv.id,
        amount=alloc_amt,
        created_by_id=current_user.id,
    )
    db.add(alloc)

    payment.allocated_amount += alloc_amt
    payment.unallocated_amount -= alloc_amt

    inv.amount_paid += alloc_amt
    inv.amount_due -= alloc_amt
    if inv.amount_due <= Decimal("0.00"):
        inv.status = "PAID"
    else:
        inv.status = "PARTIALLY_PAID"

    db.commit()
    db.refresh(payment)
    return list_payments(company_id=payment.company_id, limit=1, db=db, current_user=current_user)[0]


# ==========================================
# ACCOUNTS PAYABLE: VENDORS & BILLS
# ==========================================

@router.get("/accounting/vendors", response_model=List[VendorResponse])
def list_vendors(
    active_only: bool = True,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_vendors"])),
):
    query = db.query(Vendor).filter(Vendor.is_deleted == False)
    if active_only:
        query = query.filter(Vendor.is_active == True)
    if q:
        query = query.filter(or_(Vendor.name.ilike(f"%{q}%"), Vendor.vendor_code.ilike(f"%{q}%")))
    return query.order_by(Vendor.name.asc()).all()


@router.post("/accounting/vendors", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    data: VendorCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_vendors"])),
):
    vcode = data.vendor_code or generate_sequential_number(db, "vendor", "VND")
    v = Vendor(
        vendor_code=vcode,
        name=data.name.strip(),
        contact_name=data.contact_name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        city=data.city,
        tax_number=data.tax_number,
        bank_account_details=data.bank_account_details,
        notes=data.notes,
        created_by_id=current_user.id,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.get("/accounting/bills", response_model=List[BillResponse])
def list_bills(
    vendor_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_bills"])),
):
    query = db.query(Bill).filter(Bill.is_deleted == False)
    if vendor_id:
        query = query.filter(Bill.vendor_id == vendor_id)
    if status_filter:
        query = query.filter(Bill.status == status_filter.upper())
    bills = query.order_by(Bill.bill_date.desc()).all()

    results = []
    for b in bills:
        resp = BillResponse.model_validate(b)
        resp.vendor_name = b.vendor.name if b.vendor else None
        results.append(resp)
    return results


@router.post("/accounting/bills", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def create_bill(
    data: BillCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_bills"])),
):
    vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id, Vendor.is_deleted == False).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    bill_num = generate_sequential_number(db, "bill", "BILL")
    subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")

    items_to_add = []
    for it in data.items:
        qty = Decimal(str(it.quantity))
        price = Decimal(str(it.unit_price))
        trate = Decimal(str(it.tax_rate))

        line_sub = qty * price
        line_tax = line_sub * (trate / Decimal("100.00"))
        line_total = line_sub + line_tax

        subtotal += line_sub
        tax_total += line_tax

        items_to_add.append(BillItem(
            expense_account_id=it.expense_account_id,
            description=it.description,
            quantity=qty,
            unit_price=price,
            tax_rate=trate,
            tax_amount=line_tax,
            line_total=line_total,
        ))

    total = subtotal + tax_total

    bill = Bill(
        bill_number=bill_num,
        vendor_id=data.vendor_id,
        bill_date=data.bill_date,
        due_date=data.due_date,
        reference=data.reference,
        subtotal=subtotal,
        tax_amount=tax_total,
        total_amount=total,
        amount_paid=Decimal("0.00"),
        amount_due=total,
        status="DRAFT",
        notes=data.notes,
        created_by_id=current_user.id,
    )
    bill.items = items_to_add
    db.add(bill)
    db.commit()
    db.refresh(bill)
    resp = BillResponse.model_validate(bill)
    resp.vendor_name = vendor.name
    return resp


@router.get("/accounting/bills/{bill_id}", response_model=BillResponse)
def get_bill(
    bill_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.view", "accounting.manage_bills"])),
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.is_deleted == False).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    resp = BillResponse.model_validate(bill)
    resp.vendor_name = bill.vendor.name if bill.vendor else None
    return resp


@router.post("/accounting/bills/{bill_id}/post", response_model=BillResponse)
def post_bill(
    bill_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.post", "accounting.manage_bills"])),
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.is_deleted == False).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Bill is already in status '{bill.status}'.")

    je = create_bill_journal(db, bill, current_user.id)
    bill.journal_entry_id = je.id
    bill.status = "RECEIVED"
    bill.posted_by_id = current_user.id
    bill.posted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(bill)

    record_audit_log(
        db=db,
        action="POST_BILL",
        entity_type="BILL",
        entity_id=bill.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "RECEIVED", "journal_entry": je.entry_number},
        request=request,
    )
    return get_bill(bill.id, db, current_user)


@router.post("/accounting/vendor-payments")
def create_vendor_payment(
    data: VendorPaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_payments"])),
):
    return pay_vendor_bill(bill_id=data.bill_id, data=data, request=request, db=db, current_user=current_user)


@router.post("/accounting/bills/{bill_id}/pay")
def pay_vendor_bill(
    bill_id: str,
    data: VendorPaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_payments"])),
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.is_deleted == False).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    pay_amt = Decimal(str(data.amount))
    if pay_amt <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be positive.")
    if pay_amt > bill.amount_due:
        raise HTTPException(status_code=400, detail=f"Payment ({pay_amt}) exceeds balance due ({bill.amount_due}).")

    vpay_num = generate_sequential_number(db, "vendor_payment", "VPAY")
    vpay = VendorPayment(
        payment_number=vpay_num,
        vendor_id=bill.vendor_id,
        payment_date=data.payment_date,
        amount=pay_amt,
        payment_method=data.payment_method.upper(),
        bank_account_id=data.bank_account_id,
        reference=data.reference,
        notes=data.notes,
        status="POSTED",
        created_by_id=current_user.id,
    )
    db.add(vpay)
    db.flush()

    # Generate AP settlement journal
    je = create_vendor_payment_journal(db, vpay, current_user.id)
    vpay.journal_entry_id = je.id

    alloc = BillAllocation(
        vendor_payment_id=vpay.id,
        bill_id=bill.id,
        amount=pay_amt,
    )
    db.add(alloc)

    bill.amount_paid += pay_amt
    bill.amount_due -= pay_amt
    if bill.amount_due <= Decimal("0.00"):
        bill.status = "PAID"
    else:
        bill.status = "PARTIALLY_PAID"

    db.commit()
    return {"message": f"Payment {vpay_num} recorded and allocated to Bill {bill.bill_number}"}


# ==========================================
# EXPENSES
# ==========================================

@router.get("/accounting/expenses", response_model=List[ExpenseResponse])
def list_expenses(
    category: Optional[str] = None,
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.view")),
):
    query = db.query(Expense).filter(Expense.is_deleted == False)
    if category:
        query = query.filter(Expense.category == category)
    if project_id:
        query = query.filter(Expense.project_id == project_id)

    expenses = query.order_by(Expense.expense_date.desc()).offset(skip).limit(limit).all()
    results = []
    for e in expenses:
        resp = ExpenseResponse.model_validate(e)
        resp.expense_account_name = e.expense_account.account_name if e.expense_account else None
        resp.payment_account_name = e.payment_account.account_name if e.payment_account else None
        resp.vendor_name = e.vendor.name if e.vendor else None
        resp.project_number = e.project.project_number if e.project else None
        results.append(resp)
    return results


@router.post("/accounting/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.create", "accounting.manage_bills"])),
):
    exp_num = generate_sequential_number(db, "expense", "EXP")
    amt = Decimal(str(data.amount))
    tax = Decimal(str(data.tax_amount))
    tot = amt + tax

    expense = Expense(
        expense_number=exp_num,
        expense_date=data.expense_date,
        category=data.category,
        expense_account_id=data.expense_account_id,
        payment_account_id=data.payment_account_id,
        vendor_id=data.vendor_id,
        project_id=data.project_id,
        amount=amt,
        tax_amount=tax,
        total_amount=tot,
        payment_method=data.payment_method.upper(),
        reference=data.reference,
        description=data.description,
        status="POSTED",
        created_by_id=current_user.id,
        posted_by_id=current_user.id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(expense)
    db.flush()

    je = create_expense_journal(db, expense, current_user.id)
    expense.journal_entry_id = je.id

    db.commit()
    db.refresh(expense)

    record_audit_log(
        db=db,
        action="CREATE_EXPENSE",
        entity_type="EXPENSE",
        entity_id=expense.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"expense_number": expense.expense_number, "total": float(tot)},
        request=request,
    )
    resp = ExpenseResponse.model_validate(expense)
    resp.expense_account_name = expense.expense_account.account_name if expense.expense_account else None
    resp.payment_account_name = expense.payment_account.account_name if expense.payment_account else None
    resp.vendor_name = expense.vendor.name if expense.vendor else None
    resp.project_number = expense.project.project_number if expense.project else None
    return resp


@router.get("/accounting/expenses/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.view")),
):
    e = db.query(Expense).filter(Expense.id == expense_id, Expense.is_deleted == False).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    resp = ExpenseResponse.model_validate(e)
    resp.expense_account_name = e.expense_account.account_name if e.expense_account else None
    resp.payment_account_name = e.payment_account.account_name if e.payment_account else None
    resp.vendor_name = e.vendor.name if e.vendor else None
    resp.project_number = e.project.project_number if e.project else None
    return resp


# ==========================================
# BANK RECONCILIATION
# ==========================================

@router.get("/accounting/reconciliation", response_model=List[BankReconciliationResponse])
def list_reconciliations(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.reconcile")),
):
    query = db.query(BankReconciliation)
    if account_id:
        query = query.filter(BankReconciliation.account_id == account_id)
    return query.order_by(BankReconciliation.statement_date.desc()).all()


@router.post("/accounting/reconciliation", response_model=BankReconciliationResponse, status_code=status.HTTP_201_CREATED)
def start_reconciliation(
    data: BankReconciliationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.reconcile")),
):
    acc = db.query(Account).filter(Account.id == data.account_id, Account.is_bank_or_cash == True).first()
    if not acc:
        raise HTTPException(status_code=400, detail="Selected account is not designated as Bank or Cash.")

    # Calculate GL balance as of statement date
    row = (
        db.query(
            func.coalesce(func.sum(JournalLine.debit), Decimal("0.00")).label("deb"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0.00")).label("crd"),
        )
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .filter(
            JournalLine.account_id == acc.id,
            JournalEntry.status == "POSTED",
            JournalEntry.transaction_date <= data.statement_date,
        )
        .first()
    )
    gl_bal = Decimal(str(row.deb or 0.00)) - Decimal(str(row.crd or 0.00))
    diff = data.statement_balance - gl_bal

    recon = BankReconciliation(
        account_id=acc.id,
        statement_date=data.statement_date,
        statement_balance=data.statement_balance,
        gl_balance=gl_bal,
        difference=diff,
        status="DRAFT",
        notes=data.notes,
    )
    db.add(recon)
    db.flush()

    # Load un-reconciled journal lines for this bank account
    lines = (
        db.query(JournalLine, JournalEntry)
        .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
        .filter(
            JournalLine.account_id == acc.id,
            JournalEntry.status == "POSTED",
            JournalEntry.transaction_date <= data.statement_date,
        )
        .all()
    )
    for jl, je in lines:
        net_amt = jl.debit - jl.credit
        item = BankReconciliationItem(
            reconciliation_id=recon.id,
            journal_line_id=jl.id,
            transaction_date=je.transaction_date,
            reference=jl.reference or je.entry_number,
            description=jl.description or je.description,
            amount=net_amt,
            matched=False,
        )
        db.add(item)

    db.commit()
    db.refresh(recon)
    return recon


@router.post("/accounting/reconciliation/{recon_id}/match", response_model=BankReconciliationResponse)
def match_reconciliation_items(
    recon_id: str,
    data: BankReconciliationMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.reconcile")),
):
    recon = db.query(BankReconciliation).filter(BankReconciliation.id == recon_id).first()
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation session not found")

    items = db.query(BankReconciliationItem).filter(
        BankReconciliationItem.reconciliation_id == recon.id,
        BankReconciliationItem.id.in_(data.matched_item_ids)
    ).all()

    now = datetime.now(timezone.utc)
    for it in items:
        it.matched = True
        it.matched_at = now

    matched_sum = db.query(func.coalesce(func.sum(BankReconciliationItem.amount), Decimal("0.00"))).filter(
        BankReconciliationItem.reconciliation_id == recon.id,
        BankReconciliationItem.matched == True,
    ).scalar()

    recon.difference = recon.statement_balance - Decimal(str(matched_sum))
    if recon.difference == Decimal("0.00"):
        recon.status = "RECONCILED"
        recon.reconciled_by_id = current_user.id
        recon.reconciled_at = now

    db.commit()
    db.refresh(recon)
    return recon


# ==========================================
# FINANCIAL REPORTS & DASHBOARD
# ==========================================

@router.get("/accounting/dashboard", response_model=AccountingDashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("accounting.view")),
):
    return get_accounting_dashboard(db)


@router.get("/accounting/reports/trial-balance", response_model=TrialBalanceResponse)
def report_trial_balance(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.reports", "accounting.view"])),
):
    return get_trial_balance(db, as_of_date)


@router.get("/accounting/reports/general-ledger", response_model=GeneralLedgerResponse)
def report_general_ledger(
    account_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.reports", "accounting.view"])),
):
    return get_general_ledger(db, account_id, start_date, end_date)


@router.get("/accounting/reports/profit-loss", response_model=ProfitLossResponse)
def report_profit_and_loss(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.reports", "accounting.view"])),
):
    return get_profit_and_loss(db, start_date, end_date)


@router.get("/accounting/reports/balance-sheet", response_model=BalanceSheetResponse)
def report_balance_sheet(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.reports", "accounting.view"])),
):
    return get_balance_sheet(db, as_of_date)


@router.get("/accounting/reports/ar-aging", response_model=AgingReportResponse)
def report_ar_aging(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.reports", "accounting.view"])),
):
    return get_ar_aging(db, as_of_date)


@router.get("/accounting/reports/ap-aging", response_model=AgingReportResponse)
def report_ap_aging(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.reports", "accounting.view"])),
):
    return get_ap_aging(db, as_of_date)


@router.get("/accounting/export/trial-balance")
def export_trial_balance_csv(
    as_of_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["accounting.export", "accounting.reports"])),
):
    tb = get_trial_balance(db, as_of_date)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Account Code", "Account Name", "Type", "Debit (INR)", "Credit (INR)"])
    for it in tb.items:
        writer.writerow([it.account_code, it.account_name, it.account_type, float(it.debit_balance), float(it.credit_balance)])
    writer.writerow(["TOTAL", "", "", float(tb.total_debit), float(tb.total_credit)])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trial_balance_{tb.as_of_date}.csv"}
    )
