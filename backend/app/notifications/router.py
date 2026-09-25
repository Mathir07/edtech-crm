from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.config import settings
from app.core.audit import record_audit_log
from app.users.models import User
from app.notifications.models import (
    Notification,
    NotificationPreference,
    AutomationRule,
    AutomationJobLog,
)
from app.notifications.schemas import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    MarkReadRequest,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    AutomationRuleResponse,
    AutomationRuleToggleRequest,
    AutomationRuleUpdateRequest,
    AutomationJobLogResponse,
    AutomationRunResponse,
    TestNotificationRequest,
)
from app.notifications.automation import (
    ensure_default_rules,
    execute_all_automations,
    execute_automation_rule,
    create_notification_if_unique,
)

# 1. Notifications Router
router = APIRouter()

# 2. Automation Router
automation_router = APIRouter()


# --- Extension Point Compatibility ---
@router.get("/status")
def notifications_extension_status():
    """Module status for in-app reminders and notifications."""
    return {"module": "notifications", "status": "active", "version": "1.1"}


# --- Notifications Endpoints ---

@router.get("", response_model=NotificationListResponse)
def list_notifications(
    is_read: Optional[bool] = None,
    notification_type: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists notifications for the authenticated user with optional filtering by read status, type, and priority.
    Applies RBAC filtering so unauthorized users cannot inspect sensitive financial events.
    """
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
    )

    # Permission check for finance events: If notification is financial, user must possess accounting.view or be superuser
    user_perms = current_user.get_permission_codes()
    has_finance_access = current_user.is_superuser or ("accounting.view" in user_perms)
    if not has_finance_access:
        query = query.filter(
            Notification.notification_type.notin_(["INVOICE_DUE", "PAYMENT_RECEIVED"])
        )

    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    if priority:
        query = query.filter(Notification.priority == priority)

    total = query.count()

    # Total unread count for current user
    unread_query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    if not has_finance_access:
        unread_query = unread_query.filter(
            Notification.notification_type.notin_(["INVOICE_DUE", "PAYMENT_RECEIVED"])
        )
    unread_count = unread_query.count()

    items = query.order_by(desc(Notification.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
    }


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns unread notification badge counter for the top navigation bar."""
    query = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    user_perms = current_user.get_permission_codes()
    if not (current_user.is_superuser or "accounting.view" in user_perms):
        query = query.filter(
            Notification.notification_type.notin_(["INVOICE_DUE", "PAYMENT_RECEIVED"])
        )
    count = query.scalar() or 0
    return {"unread_count": count}


@router.post("/mark-read")
def mark_notifications_read(
    payload: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks selected notifications or all notifications as read for current user."""
    now = datetime.now(timezone.utc)
    marked_count = 0

    if payload.mark_all:
        notifications = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        ).all()
        for n in notifications:
            n.is_read = True
            n.read_at = now
            marked_count += 1
        db.commit()
    elif payload.notification_ids:
        notifications = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.id.in_(payload.notification_ids),
        ).all()
        for n in notifications:
            if not n.is_read:
                n.is_read = True
                n.read_at = now
                marked_count += 1
        db.commit()

    return {"success": True, "marked_count": marked_count}


@router.get("/preferences", response_model=NotificationPreferenceResponse)
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetches user notification preferences, provisioning defaults if absent."""
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates in-app and email preferences per category."""
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        db.flush()

    old_vals = {k: getattr(pref, k) for k in payload.model_dump(exclude_unset=True).keys()}

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(pref, field, val)

    pref.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pref)

    record_audit_log(
        db=db,
        action="NOTIFICATION_PREFERENCES_UPDATED",
        entity_type="notification_preferences",
        entity_id=pref.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=payload.model_dump(exclude_unset=True),
        request=request,
    )
    return pref


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes an in-app notification owned by the current user."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"success": True, "message": "Notification deleted"}


@router.post("/test", response_model=NotificationResponse)
def trigger_test_notification(
    payload: TestNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sends a real-time test notification to the current logged-in user."""
    notif = create_notification_if_unique(
        db=db,
        user_id=current_user.id,
        notification_type=payload.notification_type or "SYSTEM_TEST",
        title=payload.title,
        message=payload.message,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        priority=payload.priority or "HIGH",
        dedup_key=None,
    )
    db.commit()
    db.refresh(notif)
    return notif


# --- Automation Rules & Job Logs Endpoints ---

@automation_router.get("/rules", response_model=List[AutomationRuleResponse])
def list_automation_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automation.view")),
):
    """Lists all configured automation rules and their enabled status."""
    ensure_default_rules(db)
    rules = db.query(AutomationRule).order_by(AutomationRule.created_at.asc()).all()
    return rules


@automation_router.put("/rules/{rule_id}/toggle", response_model=AutomationRuleResponse)
def toggle_automation_rule(
    rule_id: str,
    payload: AutomationRuleToggleRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automation.manage")),
):
    """Enables or disables an automation rule."""
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    old_status = rule.is_enabled
    rule.is_enabled = payload.is_enabled
    rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rule)

    record_audit_log(
        db=db,
        action="AUTOMATION_RULE_TOGGLED",
        entity_type="automation_rule",
        entity_id=rule.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values={"is_enabled": old_status},
        new_values={"is_enabled": rule.is_enabled},
        request=request,
    )
    return rule


@automation_router.put("/rules/{rule_id}", response_model=AutomationRuleResponse)
def update_automation_rule(
    rule_id: str,
    payload: AutomationRuleUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automation.manage")),
):
    """Updates automation rule settings or custom trigger thresholds."""
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    update_data = payload.model_dump(exclude_unset=True)
    old_vals = {k: getattr(rule, k) for k in update_data.keys()}

    for k, v in update_data.items():
        setattr(rule, k, v)

    rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rule)

    record_audit_log(
        db=db,
        action="AUTOMATION_RULE_UPDATED",
        entity_type="automation_rule",
        entity_id=rule.id,
        user_id=current_user.id,
        user_email=current_user.email,
        old_values=old_vals,
        new_values=update_data,
        request=request,
    )
    return rule


def verify_automation_trigger_auth(
    request: Request,
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Authorizes /api/v1/automation/run for either:
    1. Vercel Cron invocation via Authorization: Bearer <CRON_SECRET>
    2. CRM Admin user with 'automation.manage' permission via standard JWT
    """
    auth_header = request.headers.get("Authorization", "")
    cron_secret = getattr(settings, "CRON_SECRET", "")

    if cron_secret and auth_header == f"Bearer {cron_secret}":
        return None  # Authorized via Vercel CRON_SECRET

    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for automation trigger.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header[7:]
    user = get_current_user(db=db, token=token)
    user_perms = user.get_permission_codes()
    if "*" not in user_perms and "automation.manage" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Required permission: 'automation.manage'",
        )
    return user


@automation_router.api_route("/run", methods=["GET", "POST"], response_model=AutomationRunResponse)
def trigger_automations(
    request: Request,
    rule_key: Optional[str] = Query(None, description="Optional specific rule key to execute"),
    db: Session = Depends(get_db),
    _auth: Optional[User] = Depends(verify_automation_trigger_auth),
):
    """Triggers background automation scans across the CRM system (via Vercel Cron GET or Admin POST)."""
    if rule_key:
        log = execute_automation_rule(db, rule_key)
        logs = [log]
    else:
        logs = execute_all_automations(db)

    total_created = sum(l.notifications_created for l in logs)
    total_emails = sum(l.emails_sent for l in logs)

    return {
        "status": "COMPLETED",
        "jobs_executed": len(logs),
        "total_notifications_created": total_created,
        "total_emails_sent": total_emails,
        "logs": logs,
    }



@automation_router.get("/logs", response_model=List[AutomationJobLogResponse])
def list_automation_logs(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("automation.view")),
):
    """Lists recent automation execution logs for audit and monitoring."""
    logs = db.query(AutomationJobLog).order_by(
        desc(AutomationJobLog.started_at)
    ).limit(limit).all()
    return logs
