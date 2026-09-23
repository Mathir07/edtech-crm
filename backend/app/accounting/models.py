from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Integer, Date, DateTime, Numeric, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, date
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin


class Account(Base, TimestampMixin):
    """
    Chart of Accounts entity.
    Supports hierarchical accounts (parent_account_id) across standard 5 categories:
    ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE.
    """
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_code = Column(String(50), unique=True, nullable=False, index=True)
    account_name = Column(String(255), nullable=False, index=True)
    account_type = Column(String(50), nullable=False, index=True)  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    parent_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_control_account = Column(Boolean, default=False, nullable=False)  # Control account for AR/AP
    is_bank_or_cash = Column(Boolean, default=False, nullable=False)    # Flag for bank/cash reconciliation
    currency = Column(String(10), nullable=False, default="INR")
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    parent = relationship("Account", remote_side=[id], backref="children")
    created_by = relationship("User", foreign_keys=[created_by_id])
    journal_lines = relationship("JournalLine", back_populates="account")


class FiscalPeriod(Base, TimestampMixin):
    """
    Fiscal / Accounting Period entity.
    Controls financial posting windows (OPEN, CLOSED, LOCKED).
    """
    __tablename__ = "fiscal_periods"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False, index=True)  # e.g. FY 2026-27 Q1, Sep 2026
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="OPEN", index=True)  # OPEN, CLOSED, LOCKED
    closed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    closed_by = relationship("User", foreign_keys=[closed_by_id])


class JournalEntry(Base, TimestampMixin):
    """
    Double-entry General Journal header.
    Strict double-entry bookkeeping: SUM(debits) must equal SUM(credits) for POSTED entries.
    """
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entry_number = Column(String(50), unique=True, nullable=False, index=True)  # JE-YYYY-XXXX
    transaction_date = Column(Date, nullable=False, default=date.today, index=True)
    posting_date = Column(Date, nullable=True, index=True)
    description = Column(Text, nullable=False)
    reference = Column(String(100), nullable=True, index=True)
    source_module = Column(String(50), nullable=False, default="MANUAL", index=True)  # MANUAL, INVOICE, BILL, PAYMENT, EXPENSE, REVERSAL
    source_id = Column(String(36), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="DRAFT", index=True)  # DRAFT, POSTED, VOID, REVERSED
    fiscal_period_id = Column(String(36), ForeignKey("fiscal_periods.id", ondelete="SET NULL"), nullable=True)
    
    total_debit = Column(Numeric(14, 2), nullable=False, default=0.00)
    total_credit = Column(Numeric(14, 2), nullable=False, default=0.00)

    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    
    reversed_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    reversal_reason = Column(Text, nullable=True)

    # Relationships
    lines = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan", order_by="JournalLine.id")
    created_by = relationship("User", foreign_keys=[created_by_id])
    posted_by = relationship("User", foreign_keys=[posted_by_id])
    reversed_entry = relationship("JournalEntry", remote_side=[id], foreign_keys=[reversed_entry_id])
    fiscal_period = relationship("FiscalPeriod")


class JournalLine(Base):
    """
    Individual debit or credit line in a Journal Entry.
    """
    __tablename__ = "journal_lines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    description = Column(Text, nullable=True)
    debit = Column(Numeric(14, 2), nullable=False, default=0.00)
    credit = Column(Numeric(14, 2), nullable=False, default=0.00)
    reference = Column(String(100), nullable=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")
    company = relationship("Company")
    vendor = relationship("Vendor")


class TaxRate(Base, TimestampMixin):
    """
    Configurable tax rates (GST, VAT, Sales Tax) linked to liability/receivable accounts.
    """
    __tablename__ = "tax_rates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)  # GST_18, GST_12, GST_5, EXEMPT
    rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    tax_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    description = Column(Text, nullable=True)

    tax_account = relationship("Account")


class Invoice(Base, TimestampMixin, SoftDeleteMixin):
    """
    Accounts Receivable Customer Invoice linked to Company, Sales Order, Contract, and Project.
    """
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)  # INV-YYYY-XXXX
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    
    invoice_date = Column(Date, nullable=False, default=date.today, index=True)
    due_date = Column(Date, nullable=False, index=True)
    currency = Column(String(10), nullable=False, default="INR")
    
    subtotal = Column(Numeric(14, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    amount_paid = Column(Numeric(14, 2), nullable=False, default=0.00)
    amount_due = Column(Numeric(14, 2), nullable=False, default=0.00)
    
    status = Column(String(50), nullable=False, default="DRAFT", index=True)  # DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, VOID, CANCELLED
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issued_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    company = relationship("Company")
    contact = relationship("Contact")
    sales_order = relationship("SalesOrder")
    contract = relationship("Contract")
    project = relationship("Project")
    journal_entry = relationship("JournalEntry")
    created_by = relationship("User", foreign_keys=[created_by_id])
    issued_by = relationship("User", foreign_keys=[issued_by_id])
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.sort_order")
    allocations = relationship("PaymentAllocation", back_populates="invoice")


class InvoiceItem(Base):
    """
    Line item for an Invoice.
    """
    __tablename__ = "invoice_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)  # Revenue account
    description = Column(Text, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1.00)
    unit_price = Column(Numeric(14, 2), nullable=False, default=0.00)
    discount = Column(Numeric(14, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(14, 2), nullable=False, default=0.00)
    sort_order = Column(Integer, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")
    account = relationship("Account")


class CustomerPayment(Base, TimestampMixin):
    """
    Customer payment / receipt record with multi-invoice allocation support.
    """
    __tablename__ = "customer_payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    payment_number = Column(String(50), unique=True, nullable=False, index=True)  # PAY-YYYY-XXXX
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False, default=date.today, index=True)
    amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    payment_method = Column(String(50), nullable=False, default="BANK_TRANSFER")  # BANK_TRANSFER, CASH, CARD, CHEQUE, ONLINE, OTHER
    bank_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    reference = Column(String(100), nullable=True)  # Transaction ID / UTR / Cheque No
    notes = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="DRAFT", index=True)  # DRAFT, POSTED, VOID
    
    allocated_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    unallocated_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    company = relationship("Company")
    bank_account = relationship("Account", foreign_keys=[bank_account_id])
    journal_entry = relationship("JournalEntry")
    created_by = relationship("User", foreign_keys=[created_by_id])
    posted_by = relationship("User", foreign_keys=[posted_by_id])
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    """
    M:N allocation linking a CustomerPayment to an Invoice.
    """
    __tablename__ = "payment_allocations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    payment_id = Column(String(36), ForeignKey("customer_payments.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    allocated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    payment = relationship("CustomerPayment", back_populates="allocations")
    invoice = relationship("Invoice", back_populates="allocations")
    created_by = relationship("User")


class Vendor(Base, TimestampMixin, SoftDeleteMixin):
    """
    Accounts Payable Vendor entity for suppliers, software tools, and service providers.
    """
    __tablename__ = "vendors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    vendor_code = Column(String(50), unique=True, nullable=False, index=True)  # VND-0001
    name = Column(String(255), nullable=False, index=True)
    contact_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    tax_number = Column(String(50), nullable=True)  # GSTIN / PAN / Tax Registration
    bank_account_details = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_by = relationship("User")
    bills = relationship("Bill", back_populates="vendor")
    expenses = relationship("Expense", back_populates="vendor")


class Bill(Base, TimestampMixin, SoftDeleteMixin):
    """
    Accounts Payable Vendor Bill.
    """
    __tablename__ = "bills"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bill_number = Column(String(50), unique=True, nullable=False, index=True)  # BILL-YYYY-XXXX
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    bill_date = Column(Date, nullable=False, default=date.today, index=True)
    due_date = Column(Date, nullable=False, index=True)
    reference = Column(String(100), nullable=True)  # Vendor's own invoice reference
    
    subtotal = Column(Numeric(14, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    amount_paid = Column(Numeric(14, 2), nullable=False, default=0.00)
    amount_due = Column(Numeric(14, 2), nullable=False, default=0.00)
    
    status = Column(String(50), nullable=False, default="DRAFT", index=True)  # DRAFT, RECEIVED, PARTIALLY_PAID, PAID, OVERDUE, VOID, CANCELLED
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    vendor = relationship("Vendor", back_populates="bills")
    journal_entry = relationship("JournalEntry")
    created_by = relationship("User", foreign_keys=[created_by_id])
    posted_by = relationship("User", foreign_keys=[posted_by_id])
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")
    allocations = relationship("BillAllocation", back_populates="bill")


class BillItem(Base):
    """
    Line item for a Vendor Bill.
    """
    __tablename__ = "bill_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    bill_id = Column(String(36), ForeignKey("bills.id", ondelete="CASCADE"), nullable=False, index=True)
    expense_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    description = Column(Text, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1.00)
    unit_price = Column(Numeric(14, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(14, 2), nullable=False, default=0.00)

    bill = relationship("Bill", back_populates="items")
    expense_account = relationship("Account")


class VendorPayment(Base, TimestampMixin):
    """
    Vendor payment disbursement record.
    """
    __tablename__ = "vendor_payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    payment_number = Column(String(50), unique=True, nullable=False, index=True)  # VPAY-YYYY-XXXX
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False, default=date.today, index=True)
    amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    payment_method = Column(String(50), nullable=False, default="BANK_TRANSFER")
    bank_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="POSTED", index=True)  # DRAFT, POSTED, VOID
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    vendor = relationship("Vendor")
    bank_account = relationship("Account")
    journal_entry = relationship("JournalEntry")
    created_by = relationship("User")
    allocations = relationship("BillAllocation", back_populates="vendor_payment", cascade="all, delete-orphan")


class BillAllocation(Base):
    """
    Allocation linking VendorPayment to a Bill.
    """
    __tablename__ = "bill_allocations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    vendor_payment_id = Column(String(36), ForeignKey("vendor_payments.id", ondelete="CASCADE"), nullable=False, index=True)
    bill_id = Column(String(36), ForeignKey("bills.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    allocated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    vendor_payment = relationship("VendorPayment", back_populates="allocations")
    bill = relationship("Bill", back_populates="allocations")


class Expense(Base, TimestampMixin, SoftDeleteMixin):
    """
    Company operational expense.
    """
    __tablename__ = "expenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    expense_number = Column(String(50), unique=True, nullable=False, index=True)  # EXP-YYYY-XXXX
    expense_date = Column(Date, nullable=False, default=date.today, index=True)
    category = Column(String(50), nullable=False, index=True)  # Office, Software, Travel, Marketing, Salary, Utilities, Equipment, Professional Services, Other
    expense_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    payment_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    
    amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    
    payment_method = Column(String(50), nullable=False, default="BANK_TRANSFER")
    reference = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="DRAFT", index=True)  # DRAFT, POSTED, VOID
    
    receipt_filename = Column(String(255), nullable=True)
    receipt_path = Column(String(500), nullable=True)
    receipt_size = Column(Integer, nullable=True)
    
    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    expense_account = relationship("Account", foreign_keys=[expense_account_id])
    payment_account = relationship("Account", foreign_keys=[payment_account_id])
    vendor = relationship("Vendor", back_populates="expenses")
    project = relationship("Project")
    journal_entry = relationship("JournalEntry")
    created_by = relationship("User", foreign_keys=[created_by_id])
    posted_by = relationship("User", foreign_keys=[posted_by_id])


class BankReconciliation(Base, TimestampMixin):
    """
    Bank reconciliation statement header.
    """
    __tablename__ = "bank_reconciliations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    statement_date = Column(Date, nullable=False, index=True)
    statement_balance = Column(Numeric(14, 2), nullable=False, default=0.00)
    gl_balance = Column(Numeric(14, 2), nullable=False, default=0.00)
    difference = Column(Numeric(14, 2), nullable=False, default=0.00)
    status = Column(String(50), nullable=False, default="DRAFT", index=True)  # DRAFT, RECONCILED
    reconciled_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    account = relationship("Account")
    reconciled_by = relationship("User")
    items = relationship("BankReconciliationItem", back_populates="reconciliation", cascade="all, delete-orphan")


class BankReconciliationItem(Base):
    """
    Individual matched or pending item in a Bank Reconciliation.
    """
    __tablename__ = "bank_reconciliation_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    reconciliation_id = Column(String(36), ForeignKey("bank_reconciliations.id", ondelete="CASCADE"), nullable=False, index=True)
    journal_line_id = Column(String(36), ForeignKey("journal_lines.id", ondelete="SET NULL"), nullable=True)
    transaction_date = Column(Date, nullable=False)
    reference = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    amount = Column(Numeric(14, 2), nullable=False, default=0.00)
    matched = Column(Boolean, default=False, nullable=False, index=True)
    matched_at = Column(DateTime(timezone=True), nullable=True)

    reconciliation = relationship("BankReconciliation", back_populates="items")
    journal_line = relationship("JournalLine")
