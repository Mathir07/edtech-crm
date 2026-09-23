from pydantic import BaseModel, EmailStr, HttpUrl, ConfigDict
from typing import Optional, List, Any
from datetime import datetime

class ContactBase(BaseModel):
    name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    is_primary: bool = False
    status: str = "Active"

class ContactCreate(ContactBase):
    company_id: str

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    is_primary: Optional[bool] = None
    status: Optional[str] = None

class ContactResponse(ContactBase):
    id: str
    company_id: str
    company_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ContactDetailResponse(BaseModel):
    contact: ContactResponse
    company: Optional[Any] = None
    leads: List[Any] = []
    opportunities: List[Any] = []
    activities: List[Any] = []
    tasks: List[Any] = []

class CompanyBase(BaseModel):
    organization_name: str
    code: str
    type: str = "Corporate"
    website: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    postal_code: Optional[str] = None
    industry: str = "IT Services"
    source: Optional[str] = None
    owner_id: Optional[str] = None
    status: str = "Prospect"
    notes: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    organization_name: Optional[str] = None
    type: Optional[str] = None
    website: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    industry: Optional[str] = None
    source: Optional[str] = None
    owner_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class CompanyResponse(CompanyBase):
    id: str
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    contacts_count: int = 0
    active_leads_count: int = 0
    open_opportunities_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class TimelineItem(BaseModel):
    id: str
    type: str  # 'activity', 'audit', 'note', 'meeting'
    title: str
    description: Optional[str] = None
    timestamp: datetime
    author: Optional[str] = None
    metadata: Optional[dict] = None

class Company360Response(BaseModel):
    company: CompanyResponse
    contacts: List[ContactResponse] = []
    leads: List[Any] = []
    opportunities: List[Any] = []
    activities: List[Any] = []
    tasks: List[Any] = []
    meetings: List[Any] = []
    notes: List[Any] = []
    timeline: List[TimelineItem] = []
    # Future extension points
    quotations: List[Any] = []
    contracts: List[Any] = []
    sales_orders: List[Any] = []
    projects: List[Any] = []
    tickets: List[Any] = []
    invoices: List[Any] = []
    payments: List[Any] = []
