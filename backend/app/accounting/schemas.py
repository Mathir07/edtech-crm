from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict
from decimal import Decimal
from datetime import date, datetime


# ==========================================
# CHART OF ACCOUNTS SCHEMAS
# ==========================================

class AccountBase(BaseModel):
    account_code: str = Field(..., max_length=50)
    account_name: str = Field(..., max_length=255)
    account_type: str = Field(..., description="ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE")
    parent_account_id: Optional[str] = None
    description: Optional[str] = None
    is_control_account: bool = False
    is_bank_or_cash: bool = False
    currency: str = "INR"

    @field_validator("account_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = {"ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"}
        upper = v.strip().upper()
        if upper not in valid_types:
            raise ValueError(f"account_type must be one of {valid_types}")
        return upper


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    description: Optional[str] = None
    parent_account_id: Optional[str] = None
    is_active: Optional[bool] = None
    is_control_account: Optional[bool] = None
    is_bank_or_cash: Optional[bool] = None


class AccountResponse(AccountBase):
    id: str
    is_active: bool
    current_balance: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountTreeItem(AccountResponse):
    children: List["AccountTreeItem"] = []


# ==========================================
# FISCAL PERIOD SCHEMAS
# ==========================================

class FiscalPeriodBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    notes: Optional[str] = None


class FiscalPeriodCreate(FiscalPeriodBase):
    pass


class FiscalPeriodUpdate(BaseModel):
    status: Optional[str] = None  # OPEN, CLOSED, LOCKED
    notes: Optional[str] = None


class FiscalPeriodResponse(FiscalPeriodBase):
    id: str
    status: str
    closed_by_id: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# TAX RATE SCHEMAS
# ==========================================

class TaxRateCreate(BaseModel):
    name: str
    code: str
    rate: Decimal
    tax_account_id: Optional[str] = None
    description: Optional[str] = None


class TaxRateResponse(BaseModel):
    id: str
    name: str
    code: str
    rate: Decimal
    tax_account_id: Optional[str] = None
    is_active: bool
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# JOURNAL ENTRY & LINE SCHEMAS
# ==========================================

class JournalLineCreate(BaseModel):
    account_id: str
    description: Optional[str] = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    reference: Optional[str] = None
    company_id: Optional[str] = None
    vendor_id: Optional[str] = None

    @field_validator("debit", "credit")
    @classmethod
    def non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Debit and credit must be non-negative")
        return v


class JournalLineResponse(BaseModel):
    id: str
    journal_entry_id: str
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    description: Optional[str] = None
    debit: Decimal
    credit: Decimal
    reference: Optional[str] = None
    company_id: Optional[str] = None
    vendor_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JournalEntryCreate(BaseModel):
    transaction_date: date = Field(default_factory=date.today)
    posting_date: Optional[date] = None
    description: str
    reference: Optional[str] = None
    source_module: str = "MANUAL"
    source_id: Optional[str] = None
    lines: List[JournalLineCreate]

    @field_validator("lines")
    @classmethod
    def validate_lines(cls, lines: List[JournalLineCreate]) -> List[JournalLineCreate]:
        if len(lines) < 2:
            raise ValueError("Journal entry must contain at least 2 lines (double-entry)")
        total_debit = sum(l.debit for l in lines)
        total_credit = sum(l.credit for l in lines)
        if total_debit <= 0 or total_credit <= 0:
            raise ValueError("Total debits and credits must be greater than zero")
        for line in lines:
            if line.debit > 0 and line.credit > 0:
                raise ValueError("A journal line cannot contain both debit and credit")
        return lines


class JournalEntryUpdate(BaseModel):
    description: Optional[str] = None
    reference: Optional[str] = None
    transaction_date: Optional[date] = None
    lines: Optional[List[JournalLineCreate]] = None


class JournalEntryReverseRequest(BaseModel):
    reason: str


class JournalEntryResponse(BaseModel):
    id: str
    entry_number: str
    transaction_date: date
    posting_date: Optional[date] = None
    description: str
    reference: Optional[str] = None
    source_module: str
    source_id: Optional[str] = None
    status: str
    total_debit: Decimal
    total_credit: Decimal
    reversed_entry_id: Optional[str] = None
    reversal_reason: Optional[str] = None
    created_by_id: Optional[str] = None
    posted_by_id: Optional[str] = None
    posted_at: Optional[datetime] = None
    created_at: datetime
    lines: List[JournalLineResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# INVOICE & ITEM SCHEMAS
# ==========================================

class InvoiceItemCreate(BaseModel):
    product_id: Optional[str] = None
    account_id: Optional[str] = None
    description: str
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("18.00")
    sort_order: int = 0


class InvoiceItemResponse(BaseModel):
    id: str
    invoice_id: str
    product_id: Optional[str] = None
    account_id: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(BaseModel):
    company_id: str
    contact_id: Optional[str] = None
    sales_order_id: Optional[str] = None
    contract_id: Optional[str] = None
    project_id: Optional[str] = None
    invoice_date: date = Field(default_factory=date.today)
    due_date: date
    currency: str = "INR"
    discount_amount: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[InvoiceItemCreate]


class InvoiceFromSalesOrderRequest(BaseModel):
    sales_order_id: str
    due_date: Optional[date] = None
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    contact_id: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_amount: Optional[Decimal] = None
    items: Optional[List[InvoiceItemCreate]] = None


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    company_id: str
    company_name: Optional[str] = None
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    sales_order_id: Optional[str] = None
    sales_order_number: Optional[str] = None
    contract_id: Optional[str] = None
    contract_number: Optional[str] = None
    project_id: Optional[str] = None
    project_number: Optional[str] = None
    invoice_date: date
    due_date: date
    currency: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    status: str
    journal_entry_id: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    created_by_id: Optional[str] = None
    issued_by_id: Optional[str] = None
    issued_at: Optional[datetime] = None
    created_at: datetime
    items: List[InvoiceItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# CUSTOMER PAYMENT & ALLOCATION SCHEMAS
# ==========================================

class PaymentAllocationItem(BaseModel):
    invoice_id: str
    amount: Decimal


class CustomerPaymentCreate(BaseModel):
    company_id: str
    payment_date: date = Field(default_factory=date.today)
    amount: Decimal
    payment_method: str = "BANK_TRANSFER"
    bank_account_id: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    allocations: List[PaymentAllocationItem] = []


class PaymentAllocationResponse(BaseModel):
    id: str
    payment_id: str
    invoice_id: str
    invoice_number: Optional[str] = None
    amount: Decimal
    allocated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerPaymentResponse(BaseModel):
    id: str
    payment_number: str
    company_id: str
    company_name: Optional[str] = None
    payment_date: date
    amount: Decimal
    payment_method: str
    bank_account_id: str
    bank_account_name: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    allocated_amount: Decimal
    unallocated_amount: Decimal
    journal_entry_id: Optional[str] = None
    created_by_id: Optional[str] = None
    posted_by_id: Optional[str] = None
    posted_at: Optional[datetime] = None
    created_at: datetime
    allocations: List[PaymentAllocationResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# VENDOR, BILL, & EXPENSE SCHEMAS
# ==========================================

class VendorCreate(BaseModel):
    name: str
    vendor_code: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    tax_number: Optional[str] = None
    bank_account_details: Optional[str] = None
    notes: Optional[str] = None


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    tax_number: Optional[str] = None
    bank_account_details: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class VendorResponse(BaseModel):
    id: str
    vendor_code: str
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    tax_number: Optional[str] = None
    bank_account_details: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BillItemCreate(BaseModel):
    expense_account_id: str
    description: str
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("0.00")


class BillItemResponse(BaseModel):
    id: str
    bill_id: str
    expense_account_id: str
    expense_account_name: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class BillCreate(BaseModel):
    vendor_id: str
    bill_date: date = Field(default_factory=date.today)
    due_date: date
    reference: Optional[str] = None
    notes: Optional[str] = None
    items: List[BillItemCreate]


class BillResponse(BaseModel):
    id: str
    bill_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    bill_date: date
    due_date: date
    reference: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    status: str
    journal_entry_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    items: List[BillItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VendorPaymentCreate(BaseModel):
    bill_id: str
    amount: Decimal
    payment_date: date = Field(default_factory=date.today)
    payment_method: str = "BANK_TRANSFER"
    bank_account_id: str
    reference: Optional[str] = None
    notes: Optional[str] = None


class ExpenseCreate(BaseModel):
    expense_date: date = Field(default_factory=date.today)
    category: str
    expense_account_id: str
    payment_account_id: str
    vendor_id: Optional[str] = None
    project_id: Optional[str] = None
    amount: Decimal
    tax_amount: Decimal = Decimal("0.00")
    payment_method: str = "BANK_TRANSFER"
    reference: Optional[str] = None
    description: str


class ExpenseResponse(BaseModel):
    id: str
    expense_number: str
    expense_date: date
    category: str
    expense_account_id: str
    expense_account_name: Optional[str] = None
    payment_account_id: str
    payment_account_name: Optional[str] = None
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    project_id: Optional[str] = None
    project_number: Optional[str] = None
    amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_method: str
    reference: Optional[str] = None
    description: str
    status: str
    receipt_filename: Optional[str] = None
    journal_entry_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# BANK RECONCILIATION SCHEMAS
# ==========================================

class BankReconciliationCreate(BaseModel):
    account_id: str
    statement_date: date
    statement_balance: Decimal
    notes: Optional[str] = None


class BankReconciliationMatchRequest(BaseModel):
    matched_item_ids: List[str]


class BankReconciliationItemResponse(BaseModel):
    id: str
    reconciliation_id: str
    journal_line_id: Optional[str] = None
    transaction_date: date
    reference: Optional[str] = None
    description: Optional[str] = None
    amount: Decimal
    matched: bool
    matched_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BankReconciliationResponse(BaseModel):
    id: str
    account_id: str
    account_name: Optional[str] = None
    statement_date: date
    statement_balance: Decimal
    gl_balance: Decimal
    difference: Decimal
    status: str
    reconciled_by_id: Optional[str] = None
    reconciled_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    items: List[BankReconciliationItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# REPORTING SCHEMAS
# ==========================================

class TrialBalanceItem(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    debit_balance: Decimal
    credit_balance: Decimal


class TrialBalanceResponse(BaseModel):
    as_of_date: date
    items: List[TrialBalanceItem]
    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool


class GeneralLedgerLine(BaseModel):
    entry_number: str
    transaction_date: date
    description: str
    reference: Optional[str] = None
    source_module: str
    debit: Decimal
    credit: Decimal
    running_balance: Decimal


class GeneralLedgerResponse(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    start_date: date
    end_date: date
    opening_balance: Decimal
    closing_balance: Decimal
    lines: List[GeneralLedgerLine]


class ProfitLossItem(BaseModel):
    account_code: str
    account_name: str
    amount: Decimal


class ProfitLossSection(BaseModel):
    category: str
    items: List[ProfitLossItem]
    total: Decimal


class ProfitLossResponse(BaseModel):
    start_date: date
    end_date: date
    revenue: ProfitLossSection
    expenses: ProfitLossSection
    net_income: Decimal


class BalanceSheetSection(BaseModel):
    category: str
    items: List[ProfitLossItem]
    total: Decimal


class BalanceSheetResponse(BaseModel):
    as_of_date: date
    assets: BalanceSheetSection
    liabilities: BalanceSheetSection
    equity: BalanceSheetSection
    total_assets: Decimal
    total_liabilities_and_equity: Decimal
    is_balanced: bool


class AgingBucket(BaseModel):
    entity_id: str
    entity_name: str
    current_0_30: Decimal = Decimal("0.00")
    past_31_60: Decimal = Decimal("0.00")
    past_61_90: Decimal = Decimal("0.00")
    past_90_plus: Decimal = Decimal("0.00")
    total_outstanding: Decimal = Decimal("0.00")


class AgingReportResponse(BaseModel):
    as_of_date: date
    report_type: str  # AR or AP
    buckets: List[AgingBucket]
    total_0_30: Decimal
    total_31_60: Decimal
    total_61_90: Decimal
    total_90_plus: Decimal
    grand_total: Decimal


class AccountingDashboardResponse(BaseModel):
    total_revenue: Decimal
    total_expenses: Decimal
    net_income: Decimal
    accounts_receivable: Decimal
    accounts_payable: Decimal
    cash_and_bank_balance: Decimal
    overdue_invoices_count: int
    overdue_invoices_amount: Decimal
    overdue_bills_count: int
    overdue_bills_amount: Decimal
    recent_invoices: List[Dict[str, Any]]
    recent_payments: List[Dict[str, Any]]
    recent_bills: List[Dict[str, Any]]
    recent_expenses: List[Dict[str, Any]]
    recent_journal_entries: List[Dict[str, Any]]
