from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.deps import get_current_user, require_permission, get_current_active_superuser
from app.core.audit import record_audit_log
from app.users.models import User, Role, Permission, Department, Team
from app.users.schemas import (
    UserResponse,
    UserCreate,
    UserUpdate,
    RoleBase,
    DepartmentResponse,
    TeamResponse,
    AdminPasswordResetRequest,
    SuperuserUpdateRequest,
)

router = APIRouter()

@router.get("/users", response_model=List[UserResponse])
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(User)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_fmt)) |
            (User.last_name.ilike(search_fmt)) |
            (User.email.ilike(search_fmt))
        )
    return query.offset(skip).limit(limit).all()

@router.post("/users", response_model=UserResponse)
def create_user(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    norm_email = str(data.email).strip().lower()
    existing = db.query(User).filter(User.email == norm_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    new_user = User(
        email=norm_email,
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        phone=data.phone.strip() if data.phone else None,
        department_id=data.department_id,
        team_id=data.team_id,
        is_active=data.is_active,
    )

    if data.role_ids:
        roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
        new_user.roles = roles

    db.add(new_user)
    db.flush()

    record_audit_log(
        db=db,
        action="CREATE",
        entity_type="USER",
        entity_id=new_user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"email": new_user.email, "name": new_user.full_name},
        request=request,
    )
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_vals = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "department_id": user.department_id,
        "team_id": user.team_id,
        "is_active": user.is_active,
        "role_ids": [r.id for r in user.roles],
    }

    if data.email is not None:
        norm_email = str(data.email).strip().lower()
        if norm_email != user.email:
            conflict = db.query(User).filter(User.email == norm_email, User.id != user.id).first()
            if conflict:
                raise HTTPException(status_code=400, detail="A user with this email already exists")
            user.email = norm_email

    if data.first_name is not None:
        user.first_name = data.first_name.strip()
    if data.last_name is not None:
        user.last_name = data.last_name.strip()
    if data.phone is not None:
        user.phone = data.phone.strip() if data.phone else None
    if data.department_id is not None:
        user.department_id = data.department_id if data.department_id else None
    if data.team_id is not None:
        user.team_id = data.team_id if data.team_id else None

    if data.is_active is not None:
        if data.is_active is False and user.is_superuser and user.is_active:
            active_super_count = db.query(User).filter(User.is_superuser == True, User.is_active == True).count()
            if active_super_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the only active Super Administrator in the system",
                )
        user.is_active = data.is_active

    if data.role_ids is not None:
        roles = db.query(Role).filter(Role.id.in_(data.role_ids)).all()
        user.roles = roles

    new_vals = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "department_id": user.department_id,
        "team_id": user.team_id,
        "is_active": user.is_active,
        "role_ids": [r.id for r in user.roles],
    }

    record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="USER",
        entity_id=user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=new_vals,
        request=request,
    )
    db.commit()
    db.refresh(user)
    return user

@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: str,
    data: AdminPasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    user.hashed_password = get_password_hash(data.new_password)

    record_audit_log(
        db=db,
        action="PASSWORD_RESET",
        entity_type="USER",
        entity_id=user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"user_email": user.email},
        request=request,
    )
    db.commit()
    return {"message": f"Password reset successfully for {user.email}"}

@router.put("/users/{user_id}/superuser", response_model=UserResponse)
def update_superuser_status(
    user_id: str,
    data: SuperuserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.is_superuser is False and user.is_superuser:
        active_super_count = db.query(User).filter(User.is_superuser == True, User.is_active == True).count()
        if active_super_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot revoke superuser privileges from the only active Super Administrator in the system",
            )

    old_status = user.is_superuser
    user.is_superuser = data.is_superuser

    action_name = "SUPERUSER_GRANT" if data.is_superuser else "SUPERUSER_REVOKE"
    record_audit_log(
        db=db,
        action=action_name,
        entity_type="USER",
        entity_id=user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"is_superuser": old_status},
        new_values={"is_superuser": data.is_superuser},
        request=request,
    )
    db.commit()
    db.refresh(user)
    return user

@router.get("/roles", response_model=List[RoleBase])
def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Role).all()

@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Department).all()

@router.get("/teams", response_model=List[TeamResponse])
def get_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Team).all()
