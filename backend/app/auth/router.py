from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user
from app.core.audit import record_audit_log
from app.users.models import User
from app.auth.schemas import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    PasswordChangeRequest,
    UserAuthResponse,
    UserUpdateProfileRequest,
)

router = APIRouter()

@router.get("/me", response_model=UserAuthResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return UserAuthResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        phone=current_user.phone,
        department_name=current_user.department.name if current_user.department else None,
        team_name=current_user.team.name if current_user.team else None,
        is_active=current_user.is_active,
        is_superuser=current_user.is_superuser,
        roles=[role.name for role in current_user.roles],
        permissions=list(current_user.get_permission_codes()),
    )

@router.put("/me", response_model=UserAuthResponse)
def update_current_user_profile(
    data: UserUpdateProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    old_vals = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
    }
    if data.first_name is not None:
        current_user.first_name = data.first_name.strip()
    if data.last_name is not None:
        current_user.last_name = data.last_name.strip()
    if data.phone is not None:
        current_user.phone = data.phone.strip() if data.phone else None

    new_vals = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
    }

    record_audit_log(
        db=db,
        action="PROFILE_UPDATE",
        entity_type="USER",
        entity_id=current_user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=new_vals,
        request=request,
    )
    db.commit()
    db.refresh(current_user)
    return UserAuthResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        phone=current_user.phone,
        department_name=current_user.department.name if current_user.department else None,
        team_name=current_user.team.name if current_user.team else None,
        is_active=current_user.is_active,
        is_superuser=current_user.is_superuser,
        roles=[role.name for role in current_user.roles],
        permissions=list(current_user.get_permission_codes()),
    )

@router.post("/login", response_model=TokenResponse)
def login(request_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request_data.email).first()
    if not user or not verify_password(request_data.password, user.hashed_password):
        record_audit_log(
            db=db,
            action="LOGIN_FAILED",
            entity_type="USER",
            user_email=request_data.email,
            request=request,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact your administrator.",
        )

    roles = [role.name for role in user.roles]
    permissions = list(user.get_permission_codes())

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": user.id, "email": user.email})

    record_audit_log(
        db=db,
        action="LOGIN",
        entity_type="USER",
        entity_id=user.id,
        user_id=user.id,
        user_email=user.email,
        request=request,
    )
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=roles,
        permissions=permissions,
    )

@router.post("/refresh")
def refresh_token(request_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(request_data.refresh_token)
    if not payload or payload.get("token_type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active",
        )
    new_access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record_audit_log(
        db=db,
        action="LOGOUT",
        entity_type="USER",
        entity_id=current_user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Successfully logged out"}

@router.post("/change-password")
def change_password(
    data: PasswordChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid existing password")
    
    current_user.hashed_password = get_password_hash(data.new_password)
    record_audit_log(
        db=db,
        action="PASSWORD_CHANGE",
        entity_type="USER",
        entity_id=current_user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        request=request,
    )
    db.commit()
    return {"message": "Password updated successfully"}
