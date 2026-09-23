from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import date, datetime

# --- PIPELINE & STAGES ---

class PipelineStageBase(BaseModel):
    name: str
    order: int
    probability: int = 10
    is_won: bool = False
    is_lost: bool = False
    color: str = "#3b82f6"

class PipelineStageCreate(PipelineStageBase):
    pass

class PipelineStageResponse(PipelineStageBase):
    id: str
    pipeline_id: str

    model_config = ConfigDict(from_attributes=True)

class PipelineBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    is_active: bool = True

class PipelineCreate(PipelineBase):
    stages: List[PipelineStageCreate] = []

class PipelineResponse(PipelineBase):
    id: str
    stages: List[PipelineStageResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- OPPORTUNITIES ---

class OpportunityBase(BaseModel):
    company_id: str
    contact_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    pipeline_id: str
    stage_id: str
    owner_id: Optional[str] = None
    value: float = 0.0
    probability: int = 10
    expected_close_date: Optional[date] = None
    status: str = "Open"
    lost_reason: Optional[str] = None

class OpportunityCreate(OpportunityBase):
    pass

class OpportunityUpdate(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    pipeline_id: Optional[str] = None
    stage_id: Optional[str] = None
    owner_id: Optional[str] = None
    value: Optional[float] = None
    probability: Optional[int] = None
    expected_close_date: Optional[date] = None
    status: Optional[str] = None
    lost_reason: Optional[str] = None

class OpportunityStageChangeRequest(BaseModel):
    stage_id: str
    lost_reason: Optional[str] = None

class OpportunityResponse(OpportunityBase):
    id: str
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    pipeline_name: Optional[str] = None
    stage_name: Optional[str] = None
    stage_color: Optional[str] = None
    owner_name: Optional[str] = None
    won_at: Optional[datetime] = None
    lost_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- PRODUCT CATEGORIES ---

class ProductCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "Active"

class ProductCategoryCreate(ProductCategoryBase):
    pass

class ProductCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class ProductCategoryResponse(ProductCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- PRODUCTS ---

class ProductBase(BaseModel):
    category_id: Optional[str] = None
    name: str
    code: str
    description: Optional[str] = None
    type: str = "Product"  # Product, Service, Subscription, Custom
    unit: str = "Unit"
    base_price: float = 0.00
    tax_rate: float = 18.00
    status: str = "Active"

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    unit: Optional[str] = None
    base_price: Optional[float] = None
    tax_rate: Optional[float] = None
    status: Optional[str] = None

class ProductResponse(ProductBase):
    id: str
    category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- QUOTATION ITEMS ---

class QuotationItemBase(BaseModel):
    product_id: Optional[str] = None
    description: str
    quantity: float = 1.00
    unit_price: float = 0.00
    discount: float = 0.00
    tax_rate: float = 18.00
    sort_order: int = 0

class QuotationItemCreate(QuotationItemBase):
    pass

class QuotationItemResponse(QuotationItemBase):
    id: str
    quotation_id: str
    tax_amount: float = 0.00
    line_total: float = 0.00
    product_name: Optional[str] = None
    product_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- QUOTATIONS ---

class QuotationBase(BaseModel):
    company_id: str
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    quotation_date: Optional[date] = None
    valid_until: Optional[date] = None
    currency: str = "INR"
    notes: Optional[str] = None
    terms: Optional[str] = None

class QuotationCreate(QuotationBase):
    items: List[QuotationItemCreate] = []

class QuotationUpdate(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    quotation_date: Optional[date] = None
    valid_until: Optional[date] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: Optional[List[QuotationItemCreate]] = None

class QuotationCalculateRequest(BaseModel):
    items: List[QuotationItemCreate]

class QuotationCalculateResponse(BaseModel):
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    items: List[Dict[str, Any]]

class QuotationResponse(QuotationBase):
    id: str
    quotation_number: str
    status: str
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    opportunity_title: Optional[str] = None
    created_by_id: Optional[str] = None
    creator_name: Optional[str] = None
    approved_by_id: Optional[str] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    items: List[QuotationItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- CONTRACTS ---

class ContractBase(BaseModel):
    company_id: str
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    quotation_id: Optional[str] = None
    title: str
    start_date: date
    end_date: date
    contract_value: float = 0.00
    currency: str = "INR"
    status: str = "Draft"
    description: Optional[str] = None
    terms: Optional[str] = None
    signed_date: Optional[date] = None

class ContractCreate(ContractBase):
    pass

class ContractUpdate(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    quotation_id: Optional[str] = None
    title: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    contract_value: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    terms: Optional[str] = None
    signed_date: Optional[date] = None

class ContractResponse(ContractBase):
    id: str
    contract_number: str
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    opportunity_title: Optional[str] = None
    quotation_number: Optional[str] = None
    created_by_id: Optional[str] = None
    creator_name: Optional[str] = None
    approved_by_id: Optional[str] = None
    approver_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- SALES ORDERS ---

class SalesOrderItemBase(BaseModel):
    product_id: Optional[str] = None
    description: str
    quantity: float = 1.00
    unit_price: float = 0.00
    discount: float = 0.00
    tax_rate: float = 18.00

class SalesOrderItemCreate(SalesOrderItemBase):
    pass

class SalesOrderItemResponse(SalesOrderItemBase):
    id: str
    sales_order_id: str
    tax_amount: float = 0.00
    line_total: float = 0.00
    product_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SalesOrderBase(BaseModel):
    company_id: str
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    quotation_id: Optional[str] = None
    contract_id: Optional[str] = None
    order_date: Optional[date] = None
    currency: str = "INR"
    notes: Optional[str] = None

class SalesOrderCreate(SalesOrderBase):
    items: List[SalesOrderItemCreate] = []

class SalesOrderUpdate(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    quotation_id: Optional[str] = None
    contract_id: Optional[str] = None
    order_date: Optional[date] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[SalesOrderItemCreate]] = None

class SalesOrderResponse(SalesOrderBase):
    id: str
    order_number: str
    status: str
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    opportunity_title: Optional[str] = None
    quotation_number: Optional[str] = None
    contract_number: Optional[str] = None
    created_by_id: Optional[str] = None
    creator_name: Optional[str] = None
    confirmed_by_id: Optional[str] = None
    confirmer_name: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    items: List[SalesOrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- SALES DASHBOARD STATS ---

class SalesDashboardStatsResponse(BaseModel):
    total_quotations: int = 0
    draft_quotations: int = 0
    pending_approval_quotations: int = 0
    approved_quotations: int = 0
    accepted_quotations: int = 0
    quotation_pipeline_value: float = 0.00
    accepted_quotation_value: float = 0.00
    total_contracts: int = 0
    active_contracts: int = 0
    active_contract_value: float = 0.00
    total_orders: int = 0
    confirmed_orders: int = 0
    confirmed_order_value: float = 0.00
    top_products: List[Dict[str, Any]] = []
    recent_quotations: List[Dict[str, Any]] = []
