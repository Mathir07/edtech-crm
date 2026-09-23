from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime

class RoleBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: bool

    model_config = ConfigDict(from_attributes=True)

class PermissionBase(BaseModel):
    id: str
    code: str
    name: str
    module: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DepartmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TeamResponse(BaseModel):
    id: str
    department_id: str
    name: str
    leader_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role_ids: List[str] = []

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[List[str]] = None

class AdminPasswordResetRequest(BaseModel):
    new_password: str

class SuperuserUpdateRequest(BaseModel):
    is_superuser: bool

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    department: Optional[DepartmentResponse] = None
    team: Optional[TeamResponse] = None
    is_active: bool
    is_superuser: bool
    roles: List[RoleBase] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
