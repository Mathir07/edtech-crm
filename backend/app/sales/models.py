from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Float, Integer, Date, DateTime, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, date
from app.core.database import Base, generate_uuid, TimestampMixin, SoftDeleteMixin

class Pipeline(Base, TimestampMixin):
    __tablename__ = "pipelines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    stages = relationship("PipelineStage", back_populates="pipeline", order_by="PipelineStage.order", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="pipeline")

class PipelineStage(Base, TimestampMixin):
    __tablename__ = "pipeline_stages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    order = Column(Integer, nullable=False, default=0)
    probability = Column(Integer, nullable=False, default=10)  # 0 - 100
    is_won = Column(Boolean, default=False, nullable=False)
    is_lost = Column(Boolean, default=False, nullable=False)
    color = Column(String(30), nullable=False, default="#3b82f6")  # hex color for Kanban

    pipeline = relationship("Pipeline", back_populates="stages")
    opportunities = relationship("Opportunity", back_populates="stage")

class Opportunity(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "opportunities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="RESTRICT"), nullable=False)
    stage_id = Column(String(36), ForeignKey("pipeline_stages.id", ondelete="RESTRICT"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    value = Column(Float, nullable=False, default=0.0)
    probability = Column(Integer, nullable=False, default=10)
    expected_close_date = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default="Open", index=True)  # Open, Won, Lost
    lost_reason = Column(Text, nullable=True)
    won_at = Column(DateTime(timezone=True), nullable=True)
    lost_at = Column(DateTime(timezone=True), nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    company = relationship("Company", back_populates="opportunities")
    contact = relationship("Contact")
    pipeline = relationship("Pipeline", back_populates="opportunities")
    stage = relationship("PipelineStage", back_populates="opportunities")
    owner = relationship("User", foreign_keys=[owner_id])
    quotations = relationship("Quotation", back_populates="opportunity")

class ProductCategory(Base, TimestampMixin):
    __tablename__ = "product_categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="Active", index=True)

    products = relationship("Product", back_populates="category")

class Product(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    category_id = Column(String(36), ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    type = Column(String(50), nullable=False, default="Product", index=True)  # Product, Service, Subscription, Custom
    unit = Column(String(50), nullable=False, default="Unit")
    base_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    status = Column(String(50), nullable=False, default="Active", index=True)  # Active, Inactive

    category = relationship("ProductCategory", back_populates="products")

class NumberSequence(Base):
    __tablename__ = "number_sequences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), nullable=False, index=True)  # quotation, contract, sales_order
    year = Column(Integer, nullable=False, index=True)
    current_val = Column(Integer, nullable=False, default=0)
    prefix = Column(String(10), nullable=False, default="QT")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Quotation(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quotations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    quotation_number = Column(String(50), unique=True, nullable=False, index=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    quotation_date = Column(Date, nullable=False, default=date.today)
    valid_until = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default="Draft", index=True)
    # Draft, Pending Approval, Approved, Sent, Viewed, Negotiation, Accepted, Rejected, Expired, Cancelled
    currency = Column(String(10), nullable=False, default="INR")
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    approved_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    company = relationship("Company")
    contact = relationship("Contact")
    opportunity = relationship("Opportunity", back_populates="quotations")
    creator = relationship("User", foreign_keys=[created_by_id])
    approver = relationship("User", foreign_keys=[approved_by_id])
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan", order_by="QuotationItem.sort_order")
    contracts = relationship("Contract", back_populates="quotation")
    sales_orders = relationship("SalesOrder", back_populates="quotation")

class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    quotation_id = Column(String(36), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1.00)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(12, 2), nullable=False, default=0.00)
    sort_order = Column(Integer, nullable=False, default=0)

    quotation = relationship("Quotation", back_populates="items")
    product = relationship("Product")

class Contract(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "contracts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    contract_number = Column(String(50), unique=True, nullable=False, index=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    quotation_id = Column(String(36), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    contract_value = Column(Numeric(12, 2), nullable=False, default=0.00)
    currency = Column(String(10), nullable=False, default="INR")
    status = Column(String(50), nullable=False, default="Draft", index=True)
    # Draft, Pending Review, Pending Signature, Active, Expired, Terminated, Cancelled
    description = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    signed_date = Column(Date, nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    company = relationship("Company")
    contact = relationship("Contact")
    opportunity = relationship("Opportunity")
    quotation = relationship("Quotation", back_populates="contracts")
    creator = relationship("User", foreign_keys=[created_by_id])
    approver = relationship("User", foreign_keys=[approved_by_id])
    sales_orders = relationship("SalesOrder", back_populates="contract")

class SalesOrder(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sales_orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    quotation_id = Column(String(36), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    order_date = Column(Date, nullable=False, default=date.today)
    status = Column(String(50), nullable=False, default="Draft", index=True)
    # Draft, Confirmed, Processing, Completed, Cancelled
    currency = Column(String(10), nullable=False, default="INR")
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    notes = Column(Text, nullable=True)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confirmed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    company = relationship("Company")
    contact = relationship("Contact")
    opportunity = relationship("Opportunity")
    quotation = relationship("Quotation", back_populates="sales_orders")
    contract = relationship("Contract", back_populates="sales_orders")
    creator = relationship("User", foreign_keys=[created_by_id])
    confirmer = relationship("User", foreign_keys=[confirmed_by_id])
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")

class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sales_order_id = Column(String(36), ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1.00)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(12, 2), nullable=False, default=0.00)

    order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product")
