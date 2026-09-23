from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import date, datetime

VALID_BUSINESS_SEGMENTS = {"EdTech", "IT Services", "Talent", "Higher Education"}

class LeadSourceBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class LeadSourceCreate(LeadSourceBase):
    pass

class LeadSourceResponse(LeadSourceBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LeadBase(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    source_id: Optional[str] = None
    owner_id: Optional[str] = None
    status: str = "New"  # New, Contacted, Qualified, Unqualified, Converted, Lost
    priority: str = "Medium"  # Low, Medium, High, Urgent
    expected_value: Optional[float] = 0.0
    expected_close_date: Optional[date] = None
    qualification_status: str = "Pending"  # Pending, Qualified, Disqualified
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    company_name: Optional[str] = None
    business_segment: Optional[str] = None
    next_action: Optional[str] = None
    next_follow_up_date: Optional[datetime] = None

    @field_validator("business_segment")
    @classmethod
    def validate_business_segment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_BUSINESS_SEGMENTS:
            raise ValueError(f"business_segment must be one of: {', '.join(sorted(VALID_BUSINESS_SEGMENTS))}")
        return v

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    source_id: Optional[str] = None
    owner_id: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    expected_value: Optional[float] = None
    expected_close_date: Optional[date] = None
    qualification_status: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    company_name: Optional[str] = None
    business_segment: Optional[str] = None
    next_action: Optional[str] = None
    next_follow_up_date: Optional[datetime] = None

    @field_validator("business_segment")
    @classmethod
    def validate_business_segment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_BUSINESS_SEGMENTS:
            raise ValueError(f"business_segment must be one of: {', '.join(sorted(VALID_BUSINESS_SEGMENTS))}")
        return v

class LeadConvertRequest(BaseModel):
    company_id: Optional[str] = None
    company_name: Optional[str] = None  # If company doesn't exist yet, creates it
    company_code: Optional[str] = None
    opportunity_title: str
    pipeline_id: Optional[str] = None
    stage_id: Optional[str] = None
    value: Optional[float] = None
    expected_close_date: Optional[date] = None

class LeadResponse(LeadBase):
    id: str
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    source_name: Optional[str] = None
    owner_name: Optional[str] = None
    last_activity_at: Optional[datetime] = None
    converted_opportunity_id: Optional[str] = None
    converted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
