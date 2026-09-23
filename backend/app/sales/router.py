from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.audit import record_audit_log
from app.users.models import User
from app.organizations.models import Company, Contact
from app.sales.models import (
    Pipeline, PipelineStage, Opportunity,
    ProductCategory, Product, NumberSequence,
    Quotation, QuotationItem, Contract,
    SalesOrder, SalesOrderItem,
)
from app.sales.schemas import (
    PipelineResponse, PipelineCreate, PipelineStageCreate, PipelineStageResponse,
    OpportunityResponse, OpportunityCreate, OpportunityUpdate, OpportunityStageChangeRequest,
    ProductCategoryCreate, ProductCategoryUpdate, ProductCategoryResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    QuotationItemResponse, QuotationCreate, QuotationUpdate, QuotationResponse, QuotationCalculateRequest, QuotationCalculateResponse,
    ContractCreate, ContractUpdate, ContractResponse,
    SalesOrderItemResponse, SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse,
    SalesDashboardStatsResponse,
)
from app.sales.calculations import (
    calculate_line_item, calculate_financial_totals, generate_sequential_number, round_curr
)

router = APIRouter()

# =====================================================================
# 1. PIPELINES & OPPORTUNITIES (CRM CORE - PRESERVED)
# =====================================================================

@router.get("/pipelines", response_model=List[PipelineResponse])
def get_pipelines(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.view")),
):
    return db.query(Pipeline).filter(Pipeline.is_active == True).all()

@router.post("/pipelines", response_model=PipelineResponse)
def create_pipeline(
    data: PipelineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.pipelines.manage")),
):
    pipeline = Pipeline(
        name=data.name,
        description=data.description,
        is_default=data.is_default,
        is_active=data.is_active,
    )
    db.add(pipeline)
    db.flush()

    for stg in data.stages:
        stage = PipelineStage(
            pipeline_id=pipeline.id,
            name=stg.name,
            order=stg.order,
            probability=stg.probability,
            is_won=stg.is_won,
            is_lost=stg.is_lost,
            color=stg.color,
        )
        db.add(stage)

    db.commit()
    db.refresh(pipeline)
    return pipeline

def format_opportunity_response(opp: Opportunity) -> OpportunityResponse:
    r = OpportunityResponse.model_validate(opp)
    r.company_name = opp.company.organization_name if opp.company else None
    r.contact_name = opp.contact.name if opp.contact else None
    r.pipeline_name = opp.pipeline.name if opp.pipeline else None
    r.stage_name = opp.stage.name if opp.stage else None
    r.stage_color = opp.stage.color if opp.stage else None
    r.owner_name = opp.owner.full_name if opp.owner else None
    return r

@router.get("/opportunities", response_model=List[OpportunityResponse])
def list_opportunities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    pipeline_id: Optional[str] = None,
    stage_id: Optional[str] = None,
    status: Optional[str] = None,
    owner_id: Optional[str] = None,
    company_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.view")),
):
    query = db.query(Opportunity).filter(Opportunity.is_deleted == False)

    if pipeline_id:
        query = query.filter(Opportunity.pipeline_id == pipeline_id)
    if stage_id:
        query = query.filter(Opportunity.stage_id == stage_id)
    if status:
        query = query.filter(Opportunity.status == status)
    if owner_id:
        query = query.filter(Opportunity.owner_id == owner_id)
    if company_id:
        query = query.filter(Opportunity.company_id == company_id)
    if search:
        s = f"%{search}%"
        query = query.join(Company, Opportunity.company_id == Company.id, isouter=True).join(
            Contact, Opportunity.contact_id == Contact.id, isouter=True
        ).filter(
            (Opportunity.title.ilike(s))
            | (Opportunity.description.ilike(s))
            | (Company.organization_name.ilike(s))
            | (Contact.name.ilike(s))
        )

    opps = query.order_by(Opportunity.created_at.desc()).offset(skip).limit(limit).all()
    return [format_opportunity_response(o) for o in opps]

@router.post("/opportunities", response_model=OpportunityResponse)
def create_opportunity(
    data: OpportunityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.create")),
):
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    stage = db.query(PipelineStage).filter(PipelineStage.id == data.stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Pipeline stage not found")
    if stage.pipeline_id != data.pipeline_id:
        raise HTTPException(status_code=400, detail="Target stage does not belong to selected pipeline")

    opp = Opportunity(
        **data.model_dump(),
        created_by_id=current_user.id,
    )
    if not opp.owner_id:
        opp.owner_id = current_user.id

    if stage.is_won:
        opp.status = "Won"
        opp.won_at = datetime.now(timezone.utc)
    elif stage.is_lost:
        opp.status = "Lost"
        opp.lost_at = datetime.now(timezone.utc)

    db.add(opp)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="OPPORTUNITY",
        entity_id=opp.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(opp)

    return format_opportunity_response(opp)

@router.get("/opportunities/{opp_id}", response_model=OpportunityResponse)
def get_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.view")),
):
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id, Opportunity.is_deleted == False).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return format_opportunity_response(opp)

@router.put("/opportunities/{opp_id}", response_model=OpportunityResponse)
def update_opportunity(
    opp_id: str,
    data: OpportunityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.edit")),
):
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id, Opportunity.is_deleted == False).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    old_values = {k: getattr(opp, k) for k in data.model_dump(exclude_unset=True).keys()}
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(opp, key, value)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="OPPORTUNITY",
        entity_id=opp.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(opp)

    return format_opportunity_response(opp)

@router.patch("/opportunities/{opp_id}/stage", response_model=OpportunityResponse)
def move_opportunity_stage(
    opp_id: str,
    data: OpportunityStageChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.edit")),
):
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id, Opportunity.is_deleted == False).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    new_stage = db.query(PipelineStage).filter(PipelineStage.id == data.stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Target stage not found")

    if new_stage.pipeline_id != opp.pipeline_id:
        raise HTTPException(status_code=400, detail="Target stage does not belong to opportunity's pipeline")

    old_stage_name = opp.stage.name if opp.stage else "Unknown"
    old_stage_id = opp.stage_id
    old_status = opp.status

    opp.stage_id = new_stage.id
    opp.probability = new_stage.probability

    if new_stage.is_won:
        opp.status = "Won"
        opp.won_at = datetime.now(timezone.utc)
    elif new_stage.is_lost:
        opp.status = "Lost"
        opp.lost_at = datetime.now(timezone.utc)
        if data.lost_reason:
            opp.lost_reason = data.lost_reason
    else:
        opp.status = "Open"

    record_audit_log(
        db=db,
        action="STAGE_CHANGE",
        entity_type="OPPORTUNITY",
        entity_id=opp.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"stage_id": old_stage_id, "stage_name": old_stage_name, "status": old_status},
        new_values={"stage_id": new_stage.id, "stage_name": new_stage.name, "status": opp.status, "probability": opp.probability},
        request=request,
    )
    db.commit()
    db.refresh(opp)

    return format_opportunity_response(opp)

@router.delete("/opportunities/{opp_id}")
def delete_opportunity(
    opp_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.opportunities.delete")),
):
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id, Opportunity.is_deleted == False).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    opp.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="OPPORTUNITY",
        entity_id=opp.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Opportunity deleted"}


# =====================================================================
# 2. PRODUCT CATEGORIES & PRODUCTS
# =====================================================================

@router.get("/product-categories", response_model=List[ProductCategoryResponse])
def list_product_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.view")),
):
    return db.query(ProductCategory).order_by(ProductCategory.name.asc()).all()

@router.post("/product-categories", response_model=ProductCategoryResponse)
def create_product_category(
    data: ProductCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.create")),
):
    existing = db.query(ProductCategory).filter(ProductCategory.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")
    cat = ProductCategory(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/product-categories/{category_id}", response_model=ProductCategoryResponse)
def update_product_category(
    category_id: str,
    data: ProductCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.edit")),
):
    cat = db.query(ProductCategory).filter(ProductCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Product category not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/product-categories/{category_id}")
def delete_product_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.delete")),
):
    cat = db.query(ProductCategory).filter(ProductCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Product category not found")
    # Check if products linked
    prod_count = db.query(Product).filter(Product.category_id == category_id, Product.is_deleted == False).count()
    if prod_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category: {prod_count} active product(s) are assigned to it")
    db.delete(cat)
    db.commit()
    return {"message": "Product category deleted"}

@router.get("/products", response_model=List[ProductResponse])
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    category_id: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.view")),
):
    query = db.query(Product).filter(Product.is_deleted == False)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if type:
        query = query.filter(Product.type == type)
    if status:
        query = query.filter(Product.status == status)
    if search:
        s = f"%{search}%"
        query = query.filter((Product.name.ilike(s)) | (Product.code.ilike(s)) | (Product.description.ilike(s)))

    products = query.order_by(Product.name.asc()).offset(skip).limit(limit).all()
    res = []
    for p in products:
        item = ProductResponse.model_validate(p)
        item.category_name = p.category.name if p.category else None
        res.append(item)
    return res

@router.post("/products", response_model=ProductResponse)
def create_product(
    data: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.create")),
):
    existing = db.query(Product).filter(Product.code == data.code, Product.is_deleted == False).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with code '{data.code}' already exists")
    
    prod = Product(**data.model_dump())
    db.add(prod)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="PRODUCT",
        entity_id=prod.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values=data.model_dump(mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(prod)

    res = ProductResponse.model_validate(prod)
    res.category_name = prod.category.name if prod.category else None
    return res

@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.view")),
):
    prod = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    res = ProductResponse.model_validate(prod)
    res.category_name = prod.category.name if prod.category else None
    return res

@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    data: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.edit")),
):
    prod = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if data.code and data.code != prod.code:
        conflict = db.query(Product).filter(Product.code == data.code, Product.id != product_id, Product.is_deleted == False).first()
        if conflict:
            raise HTTPException(status_code=400, detail=f"Product with code '{data.code}' already exists")

    old_values = {k: getattr(prod, k) for k in data.model_dump(exclude_unset=True).keys()}
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(prod, k, v)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="PRODUCT",
        entity_id=prod.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(prod)

    res = ProductResponse.model_validate(prod)
    res.category_name = prod.category.name if prod.category else None
    return res

@router.patch("/products/{product_id}/status", response_model=ProductResponse)
def toggle_product_status(
    product_id: str,
    status_val: str = Query(..., alias="status"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.edit")),
):
    prod = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.status = status_val
    db.commit()
    db.refresh(prod)
    res = ProductResponse.model_validate(prod)
    res.category_name = prod.category.name if prod.category else None
    return res

@router.delete("/products/{product_id}")
def delete_product(
    product_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.products.delete")),
):
    prod = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="PRODUCT",
        entity_id=prod.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Product deleted"}


# =====================================================================
# 3. QUOTATIONS
# =====================================================================

def _format_quotation_response(q: Quotation) -> QuotationResponse:
    r = QuotationResponse.model_validate(q)
    r.company_name = q.company.organization_name if q.company else None
    r.contact_name = q.contact.name if q.contact else None
    r.opportunity_title = q.opportunity.title if q.opportunity else None
    r.creator_name = q.creator.full_name if q.creator else None
    r.approver_name = q.approver.full_name if q.approver else None
    
    # Items
    item_responses = []
    for it in q.items:
        it_resp = QuotationItemResponse(
            id=it.id,
            quotation_id=it.quotation_id,
            product_id=it.product_id,
            description=it.description,
            quantity=float(it.quantity),
            unit_price=float(it.unit_price),
            discount=float(it.discount),
            tax_rate=float(it.tax_rate),
            tax_amount=float(it.tax_amount),
            line_total=float(it.line_total),
            sort_order=it.sort_order,
            product_name=it.product.name if it.product else None,
            product_code=it.product.code if it.product else None,
        )
        item_responses.append(it_resp)
    r.items = item_responses
    return r

@router.post("/quotations/calculate", response_model=QuotationCalculateResponse)
def calculate_quotation_preview(
    payload: QuotationCalculateRequest,
    current_user: User = Depends(require_permission("sales.quotations.create")),
):
    items_raw = [item.model_dump() for item in payload.items]
    totals = calculate_financial_totals(items_raw)
    return QuotationCalculateResponse(
        subtotal=float(totals["subtotal"]),
        discount_amount=float(totals["discount_amount"]),
        tax_amount=float(totals["tax_amount"]),
        total_amount=float(totals["total_amount"]),
        items=[
            {
                **it,
                "quantity": float(it["quantity"]),
                "unit_price": float(it["unit_price"]),
                "discount": float(it["discount"]),
                "tax_rate": float(it["tax_rate"]),
                "tax_amount": float(it["tax_amount"]),
                "line_total": float(it["line_total"]),
            }
            for it in totals["items"]
        ],
    )

@router.get("/quotations", response_model=List[QuotationResponse])
def list_quotations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    company_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    opportunity_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.view")),
):
    query = db.query(Quotation).filter(Quotation.is_deleted == False)
    if company_id:
        query = query.filter(Quotation.company_id == company_id)
    if contact_id:
        query = query.filter(Quotation.contact_id == contact_id)
    if opportunity_id:
        query = query.filter(Quotation.opportunity_id == opportunity_id)
    if status:
        query = query.filter(Quotation.status == status)
    if search:
        s = f"%{search}%"
        query = query.filter((Quotation.quotation_number.ilike(s)) | (Quotation.notes.ilike(s)))

    quotes = query.order_by(Quotation.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_quotation_response(q) for q in quotes]

@router.post("/quotations", response_model=QuotationResponse)
def create_quotation(
    data: QuotationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.create")),
):
    # Validate company
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Validate contact belongs to company
    if data.contact_id:
        contact = db.query(Contact).filter(Contact.id == data.contact_id, Contact.company_id == data.company_id, Contact.is_deleted == False).first()
        if not contact:
            raise HTTPException(status_code=400, detail="Contact does not belong to the selected company")

    # Validate opportunity belongs to company
    if data.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == data.opportunity_id, Opportunity.company_id == data.company_id, Opportunity.is_deleted == False).first()
        if not opp:
            raise HTTPException(status_code=400, detail="Opportunity does not belong to the selected company")

    # Financial calculations
    items_raw = [item.model_dump() for item in data.items]
    financials = calculate_financial_totals(items_raw)

    quotation_number = generate_sequential_number(db, entity_type="quotation", prefix="QT")

    quote = Quotation(
        quotation_number=quotation_number,
        company_id=data.company_id,
        contact_id=data.contact_id,
        opportunity_id=data.opportunity_id,
        quotation_date=data.quotation_date or date.today(),
        valid_until=data.valid_until,
        status="Draft",
        currency=data.currency,
        subtotal=financials["subtotal"],
        discount_amount=financials["discount_amount"],
        tax_amount=financials["tax_amount"],
        total_amount=financials["total_amount"],
        notes=data.notes,
        terms=data.terms,
        created_by_id=current_user.id,
    )
    db.add(quote)
    db.flush()

    for it in financials["items"]:
        q_item = QuotationItem(
            quotation_id=quote.id,
            product_id=it.get("product_id"),
            description=it.get("description", ""),
            quantity=it.get("quantity"),
            unit_price=it.get("unit_price"),
            discount=it.get("discount"),
            tax_rate=it.get("tax_rate"),
            tax_amount=it.get("tax_amount"),
            line_total=it.get("line_total"),
            sort_order=it.get("sort_order", 0),
        )
        db.add(q_item)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={
            "quotation_number": quotation_number,
            "company_id": data.company_id,
            "total_amount": float(financials["total_amount"]),
        },
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
def get_quotation(
    quotation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.view")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _format_quotation_response(quote)

@router.put("/quotations/{quotation_id}", response_model=QuotationResponse)
def update_quotation(
    quotation_id: str,
    data: QuotationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.edit")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quote.status != "Draft":
        raise HTTPException(status_code=400, detail=f"Cannot edit quotation in '{quote.status}' status. Only Draft quotations are editable.")

    if data.items is not None:
        # Delete existing items and recreate
        db.query(QuotationItem).filter(QuotationItem.quotation_id == quote.id).delete()
        items_raw = [item.model_dump() for item in data.items]
        financials = calculate_financial_totals(items_raw)
        quote.subtotal = financials["subtotal"]
        quote.discount_amount = financials["discount_amount"]
        quote.tax_amount = financials["tax_amount"]
        quote.total_amount = financials["total_amount"]
        for it in financials["items"]:
            q_item = QuotationItem(
                quotation_id=quote.id,
                product_id=it.get("product_id"),
                description=it.get("description", ""),
                quantity=it.get("quantity"),
                unit_price=it.get("unit_price"),
                discount=it.get("discount"),
                tax_rate=it.get("tax_rate"),
                tax_amount=it.get("tax_amount"),
                line_total=it.get("line_total"),
                sort_order=it.get("sort_order", 0),
            )
            db.add(q_item)

    for field in ["company_id", "contact_id", "opportunity_id", "quotation_date", "valid_until", "currency", "notes", "terms"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(quote, field, val)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"total_amount": float(quote.total_amount)},
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.post("/quotations/{quotation_id}/submit", response_model=QuotationResponse)
def submit_quotation_for_approval(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.edit")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quote.status != "Draft":
        raise HTTPException(status_code=400, detail=f"Cannot submit quotation with status '{quote.status}'")
    
    quote.status = "Pending Approval"
    record_audit_log(
        db=db,
        action="SUBMIT_APPROVAL",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.post("/quotations/{quotation_id}/approve", response_model=QuotationResponse)
def approve_quotation(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.approve")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quote.status not in ["Draft", "Pending Approval"]:
        raise HTTPException(status_code=400, detail=f"Cannot approve quotation with status '{quote.status}'")

    quote.status = "Approved"
    quote.approved_by_id = current_user.id
    quote.approved_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        action="APPROVE",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.post("/quotations/{quotation_id}/reject", response_model=QuotationResponse)
def reject_quotation(
    quotation_id: str,
    reason: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.approve")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    quote.status = "Rejected"
    if reason:
        quote.notes = f"Rejected Reason: {reason}\n{quote.notes or ''}"

    record_audit_log(
        db=db,
        action="REJECT",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"reason": reason},
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.post("/quotations/{quotation_id}/send")
def send_quotation_to_client(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.edit")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quote.status not in ["Approved", "Sent"]:
        raise HTTPException(status_code=400, detail="Quotation must be Approved before sending to client")

    quote.status = "Sent"
    record_audit_log(
        db=db,
        action="SEND",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return {
        "status": "Sent",
        "email_integration_status": "Unconfigured (Communications Phase 3)",
        "message": "Quotation status updated to Sent. Email dispatch is safely guarded until the Communications module is configured.",
        "quotation": _format_quotation_response(quote),
    }

@router.post("/quotations/{quotation_id}/accept", response_model=QuotationResponse)
def accept_quotation(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.edit")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quote.status not in ["Approved", "Sent"]:
        raise HTTPException(status_code=400, detail=f"Cannot mark quotation '{quote.status}' as Accepted. Must be Approved or Sent.")

    quote.status = "Accepted"
    record_audit_log(
        db=db,
        action="ACCEPT",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.post("/quotations/{quotation_id}/duplicate", response_model=QuotationResponse)
def duplicate_quotation(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.create")),
):
    original = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not original:
        raise HTTPException(status_code=404, detail="Quotation not found")

    new_number = generate_sequential_number(db, entity_type="quotation", prefix="QT")
    cloned = Quotation(
        quotation_number=new_number,
        company_id=original.company_id,
        contact_id=original.contact_id,
        opportunity_id=original.opportunity_id,
        quotation_date=date.today(),
        valid_until=original.valid_until,
        status="Draft",
        currency=original.currency,
        subtotal=original.subtotal,
        discount_amount=original.discount_amount,
        tax_amount=original.tax_amount,
        total_amount=original.total_amount,
        notes=f"Cloned from {original.quotation_number}. {original.notes or ''}",
        terms=original.terms,
        created_by_id=current_user.id,
    )
    db.add(cloned)
    db.flush()

    for item in original.items:
        cloned_item = QuotationItem(
            quotation_id=cloned.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item.discount,
            tax_rate=item.tax_rate,
            tax_amount=item.tax_amount,
            line_total=item.line_total,
            sort_order=item.sort_order,
        )
        db.add(cloned_item)

    record_audit_log(
        db=db,
        action="DUPLICATE",
        entity_type="QUOTATION",
        entity_id=cloned.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"original_id": original.id, "new_quotation_number": new_number},
        request=request,
    )
    db.commit()
    db.refresh(cloned)
    return _format_quotation_response(cloned)

@router.post("/quotations/{quotation_id}/cancel", response_model=QuotationResponse)
def cancel_quotation(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.edit")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    quote.status = "Cancelled"
    record_audit_log(
        db=db,
        action="CANCEL",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(quote)
    return _format_quotation_response(quote)

@router.delete("/quotations/{quotation_id}")
def delete_quotation(
    quotation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.delete")),
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.is_deleted == False).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    quote.soft_delete()
    record_audit_log(
        db=db,
        action="DELETE",
        entity_type="QUOTATION",
        entity_id=quote.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Quotation deleted"}


# =====================================================================
# 4. CONTRACTS
# =====================================================================

def _format_contract_response(c: Contract) -> ContractResponse:
    r = ContractResponse.model_validate(c)
    r.company_name = c.company.organization_name if c.company else None
    r.contact_name = c.contact.name if c.contact else None
    r.opportunity_title = c.opportunity.title if c.opportunity else None
    r.quotation_number = c.quotation.quotation_number if c.quotation else None
    r.creator_name = c.creator.full_name if c.creator else None
    r.approver_name = c.approver.full_name if c.approver else None
    return r

@router.get("/contracts", response_model=List[ContractResponse])
def list_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.contracts.view")),
):
    query = db.query(Contract).filter(Contract.is_deleted == False)
    if company_id:
        query = query.filter(Contract.company_id == company_id)
    if status:
        query = query.filter(Contract.status == status)
    if search:
        s = f"%{search}%"
        query = query.filter((Contract.title.ilike(s)) | (Contract.contract_number.ilike(s)))

    contracts = query.order_by(Contract.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_contract_response(c) for c in contracts]

@router.post("/contracts", response_model=ContractResponse)
def create_contract(
    data: ContractCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.contracts.create")),
):
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    contract_number = generate_sequential_number(db, entity_type="contract", prefix="CT")
    contract = Contract(
        contract_number=contract_number,
        company_id=data.company_id,
        contact_id=data.contact_id,
        opportunity_id=data.opportunity_id,
        quotation_id=data.quotation_id,
        title=data.title,
        start_date=data.start_date,
        end_date=data.end_date,
        contract_value=data.contract_value,
        currency=data.currency,
        status=data.status or "Draft",
        description=data.description,
        terms=data.terms,
        signed_date=data.signed_date,
        created_by_id=current_user.id,
    )
    db.add(contract)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="CONTRACT",
        entity_id=contract.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"contract_number": contract_number, "title": data.title, "value": float(data.contract_value)},
        request=request,
    )
    db.commit()
    db.refresh(contract)
    return _format_contract_response(contract)

@router.get("/contracts/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.contracts.view")),
):
    c = db.query(Contract).filter(Contract.id == contract_id, Contract.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _format_contract_response(c)

@router.put("/contracts/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: str,
    data: ContractUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.contracts.edit")),
):
    c = db.query(Contract).filter(Contract.id == contract_id, Contract.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")

    old_values = {k: getattr(c, k) for k in data.model_dump(exclude_unset=True).keys()}
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="CONTRACT",
        entity_id=c.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_values,
        new_values=data.model_dump(exclude_unset=True, mode="json"),
        request=request,
    )
    db.commit()
    db.refresh(c)
    return _format_contract_response(c)

@router.post("/contracts/{contract_id}/activate", response_model=ContractResponse)
def activate_contract(
    contract_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.contracts.approve")),
):
    c = db.query(Contract).filter(Contract.id == contract_id, Contract.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    c.status = "Active"
    c.signed_date = date.today()
    c.approved_by_id = current_user.id

    record_audit_log(
        db=db,
        action="ACTIVATE",
        entity_type="CONTRACT",
        entity_id=c.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(c)
    return _format_contract_response(c)

@router.post("/contracts/{contract_id}/cancel", response_model=ContractResponse)
def cancel_contract(
    contract_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.contracts.edit")),
):
    c = db.query(Contract).filter(Contract.id == contract_id, Contract.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    c.status = "Cancelled"
    record_audit_log(
        db=db,
        action="CANCEL",
        entity_type="CONTRACT",
        entity_id=c.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(c)
    return _format_contract_response(c)


# =====================================================================
# 5. SALES ORDERS & PROJECT HANDOFF
# =====================================================================

def _format_sales_order_response(o: SalesOrder) -> SalesOrderResponse:
    r = SalesOrderResponse.model_validate(o)
    r.company_name = o.company.organization_name if o.company else None
    r.contact_name = o.contact.name if o.contact else None
    r.opportunity_title = o.opportunity.title if o.opportunity else None
    r.quotation_number = o.quotation.quotation_number if o.quotation else None
    r.contract_number = o.contract.contract_number if o.contract else None
    r.creator_name = o.creator.full_name if o.creator else None
    r.confirmer_name = o.confirmer.full_name if o.confirmer else None

    # Items
    item_responses = []
    for it in o.items:
        it_resp = SalesOrderItemResponse(
            id=it.id,
            sales_order_id=it.sales_order_id,
            product_id=it.product_id,
            description=it.description,
            quantity=float(it.quantity),
            unit_price=float(it.unit_price),
            discount=float(it.discount),
            tax_rate=float(it.tax_rate),
            tax_amount=float(it.tax_amount),
            line_total=float(it.line_total),
            product_name=it.product.name if it.product else None,
        )
        item_responses.append(it_resp)
    r.items = item_responses
    return r

@router.get("/sales-orders", response_model=List[SalesOrderResponse])
def list_sales_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    company_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.orders.view")),
):
    query = db.query(SalesOrder).filter(SalesOrder.is_deleted == False)
    if company_id:
        query = query.filter(SalesOrder.company_id == company_id)
    if status:
        query = query.filter(SalesOrder.status == status)
    if search:
        s = f"%{search}%"
        query = query.filter((SalesOrder.order_number.ilike(s)) | (SalesOrder.notes.ilike(s)))

    orders = query.order_by(SalesOrder.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_sales_order_response(o) for o in orders]

@router.post("/sales-orders", response_model=SalesOrderResponse)
def create_sales_order(
    data: SalesOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.orders.create")),
):
    company = db.query(Company).filter(Company.id == data.company_id, Company.is_deleted == False).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    items_to_calc = [it.model_dump() for it in data.items]
    # If no items explicitly supplied, and quotation_id provided, copy from quotation
    if not items_to_calc and data.quotation_id:
        quote = db.query(Quotation).filter(Quotation.id == data.quotation_id).first()
        if quote:
            for qi in quote.items:
                items_to_calc.append({
                    "product_id": qi.product_id,
                    "description": qi.description,
                    "quantity": float(qi.quantity),
                    "unit_price": float(qi.unit_price),
                    "discount": float(qi.discount),
                    "tax_rate": float(qi.tax_rate),
                })

    financials = calculate_financial_totals(items_to_calc)
    order_number = generate_sequential_number(db, entity_type="sales_order", prefix="SO")

    order = SalesOrder(
        order_number=order_number,
        company_id=data.company_id,
        contact_id=data.contact_id,
        opportunity_id=data.opportunity_id,
        quotation_id=data.quotation_id,
        contract_id=data.contract_id,
        order_date=data.order_date or date.today(),
        status="Draft",
        currency=data.currency,
        subtotal=financials["subtotal"],
        discount_amount=financials["discount_amount"],
        tax_amount=financials["tax_amount"],
        total_amount=financials["total_amount"],
        notes=data.notes,
        created_by_id=current_user.id,
    )
    db.add(order)
    db.flush()

    for it in financials["items"]:
        so_item = SalesOrderItem(
            sales_order_id=order.id,
            product_id=it.get("product_id"),
            description=it.get("description", ""),
            quantity=it.get("quantity"),
            unit_price=it.get("unit_price"),
            discount=it.get("discount"),
            tax_rate=it.get("tax_rate"),
            tax_amount=it.get("tax_amount"),
            line_total=it.get("line_total"),
        )
        db.add(so_item)

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="SALES_ORDER",
        entity_id=order.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"order_number": order_number, "total_amount": float(financials["total_amount"])},
        request=request,
    )
    db.commit()
    db.refresh(order)
    return _format_sales_order_response(order)

@router.get("/sales-orders/{order_id}", response_model=SalesOrderResponse)
def get_sales_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.orders.view")),
):
    o = db.query(SalesOrder).filter(SalesOrder.id == order_id, SalesOrder.is_deleted == False).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return _format_sales_order_response(o)

@router.put("/sales-orders/{order_id}", response_model=SalesOrderResponse)
def update_sales_order(
    order_id: str,
    data: SalesOrderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.orders.edit")),
):
    o = db.query(SalesOrder).filter(SalesOrder.id == order_id, SalesOrder.is_deleted == False).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    if o.status != "Draft":
        raise HTTPException(status_code=400, detail=f"Cannot edit sales order in '{o.status}' status. Only Draft orders are editable.")

    if data.items is not None:
        db.query(SalesOrderItem).filter(SalesOrderItem.sales_order_id == o.id).delete()
        financials = calculate_financial_totals([it.model_dump() for it in data.items])
        o.subtotal = financials["subtotal"]
        o.discount_amount = financials["discount_amount"]
        o.tax_amount = financials["tax_amount"]
        o.total_amount = financials["total_amount"]
        for it in financials["items"]:
            so_item = SalesOrderItem(
                sales_order_id=o.id,
                product_id=it.get("product_id"),
                description=it.get("description", ""),
                quantity=it.get("quantity"),
                unit_price=it.get("unit_price"),
                discount=it.get("discount"),
                tax_rate=it.get("tax_rate"),
                tax_amount=it.get("tax_amount"),
                line_total=it.get("line_total"),
            )
            db.add(so_item)

    for field in ["company_id", "contact_id", "opportunity_id", "quotation_id", "contract_id", "order_date", "currency", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(o, field, val)

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="SALES_ORDER",
        entity_id=o.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(o)
    return _format_sales_order_response(o)

@router.post("/sales-orders/{order_id}/confirm")
def confirm_sales_order(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.orders.confirm")),
):
    o = db.query(SalesOrder).filter(SalesOrder.id == order_id, SalesOrder.is_deleted == False).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    if o.status != "Draft":
        raise HTTPException(status_code=400, detail=f"Cannot confirm order with status '{o.status}'")

    o.status = "Confirmed"
    o.confirmed_by_id = current_user.id
    o.confirmed_at = datetime.now(timezone.utc)

    # Expose Project Handoff readiness payload
    handoff_payload = {
        "status": "Ready for Deployment & Milestone Setup",
        "company_id": o.company_id,
        "company_name": o.company.organization_name if o.company else None,
        "contract_id": o.contract_id,
        "order_id": o.id,
        "order_number": o.order_number,
        "total_value": float(o.total_amount),
        "items_count": len(o.items),
        "next_module": "projects",
    }

    record_audit_log(
        db=db,
        action="CONFIRM",
        entity_type="SALES_ORDER",
        entity_id=o.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "Confirmed", "handoff": handoff_payload},
        request=request,
    )
    db.commit()
    db.refresh(o)

    return {
        "order": _format_sales_order_response(o),
        "project_handoff": handoff_payload,
        "message": f"Sales Order {o.order_number} successfully confirmed. Handoff package prepared for Projects module.",
    }

@router.post("/sales-orders/{order_id}/cancel", response_model=SalesOrderResponse)
def cancel_sales_order(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.orders.cancel")),
):
    o = db.query(SalesOrder).filter(SalesOrder.id == order_id, SalesOrder.is_deleted == False).first()
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    o.status = "Cancelled"
    record_audit_log(
        db=db,
        action="CANCEL",
        entity_type="SALES_ORDER",
        entity_id=o.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    db.refresh(o)
    return _format_sales_order_response(o)


# =====================================================================
# 6. SALES DASHBOARD STATS
# =====================================================================

@router.get("/sales/dashboard/stats", response_model=SalesDashboardStatsResponse)
def get_sales_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.quotations.view")),
):
    quotes = db.query(Quotation).filter(Quotation.is_deleted == False).all()
    contracts = db.query(Contract).filter(Contract.is_deleted == False).all()
    orders = db.query(SalesOrder).filter(SalesOrder.is_deleted == False).all()

    total_quotations = len(quotes)
    draft_quotations = sum(1 for q in quotes if q.status == "Draft")
    pending_approval_quotations = sum(1 for q in quotes if q.status == "Pending Approval")
    approved_quotations = sum(1 for q in quotes if q.status == "Approved")
    accepted_quotations = sum(1 for q in quotes if q.status == "Accepted")

    quotation_pipeline_val = sum(float(q.total_amount) for q in quotes if q.status in ["Draft", "Pending Approval", "Approved", "Sent"])
    accepted_quotation_val = sum(float(q.total_amount) for q in quotes if q.status == "Accepted")

    total_contracts = len(contracts)
    active_contracts = sum(1 for c in contracts if c.status == "Active")
    active_contract_val = sum(float(c.contract_value) for c in contracts if c.status == "Active")

    total_orders = len(orders)
    confirmed_orders = sum(1 for o in orders if o.status == "Confirmed")
    confirmed_order_val = sum(float(o.total_amount) for o in orders if o.status == "Confirmed")

    # Top products by quotation item count
    top_prods_query = (
        db.query(Product.name, Product.code, func.count(QuotationItem.id).label("item_count"), func.sum(QuotationItem.line_total).label("total_sales"))
        .join(QuotationItem, QuotationItem.product_id == Product.id)
        .filter(Product.is_deleted == False)
        .group_by(Product.id, Product.name, Product.code)
        .order_by(func.count(QuotationItem.id).desc())
        .limit(5)
        .all()
    )
    top_products = [
        {
            "name": p[0],
            "code": p[1],
            "quotation_count": p[2],
            "total_value": float(p[3] or 0.0),
        }
        for p in top_prods_query
    ]

    # Recent 5 quotations
    recent_quotes = quotes[:5]
    recent_quotes_data = [
        {
            "id": q.id,
            "quotation_number": q.quotation_number,
            "company_name": q.company.organization_name if q.company else "Unknown",
            "total_amount": float(q.total_amount),
            "status": q.status,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
        for q in recent_quotes
    ]

    return SalesDashboardStatsResponse(
        total_quotations=total_quotations,
        draft_quotations=draft_quotations,
        pending_approval_quotations=pending_approval_quotations,
        approved_quotations=approved_quotations,
        accepted_quotations=accepted_quotations,
        quotation_pipeline_value=round(quotation_pipeline_val, 2),
        accepted_quotation_value=round(accepted_quotation_val, 2),
        total_contracts=total_contracts,
        active_contracts=active_contracts,
        active_contract_value=round(active_contract_val, 2),
        total_orders=total_orders,
        confirmed_orders=confirmed_orders,
        confirmed_order_value=round(confirmed_order_val, 2),
        top_products=top_products,
        recent_quotations=recent_quotes_data,
    )
