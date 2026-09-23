import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.users.models import User
from app.notifications.models import NotificationPreference
from app.communication.providers.hostinger import HostingerEmailProvider

logger = logging.getLogger(__name__)

# Map notification categories to preference fields
CATEGORY_PREF_MAP = {
    "TASK": "tasks_email",
    "MEETING": "meetings_email",
    "LEAD": "sales_email",
    "OPPORTUNITY": "sales_email",
    "INVOICE": "finance_email",
    "PAYMENT": "finance_email",
    "SLA": "service_email",
    "PROJECT": "projects_email",
    "QA": "qa_email",
}


def can_send_email_notification(db: Session, user_id: str, notification_type: str, priority: str) -> bool:
    """
    Evaluates whether an email notification should be sent based on user preferences.
    Critical notifications (e.g. CRITICAL QA bug or SLA breach) bypass category toggle
    if global email_enabled is true.
    """
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if not pref:
        # Default policy: allowed for important events
        return priority in ("HIGH", "CRITICAL")

    if not pref.email_enabled:
        return False

    # Check category preference
    category = None
    for prefix in CATEGORY_PREF_MAP:
        if prefix in notification_type.upper():
            category = prefix
            break

    if category and hasattr(pref, CATEGORY_PREF_MAP[category]):
        category_allowed = getattr(pref, CATEGORY_PREF_MAP[category])
        if category_allowed:
            return True

    # Policy exception: CRITICAL priority is always sent if email_enabled is True
    if priority == "CRITICAL":
        return True

    return False


def dispatch_notification_email(
    db: Session,
    user: User,
    notification_type: str,
    title: str,
    message: str,
    priority: str = "MEDIUM",
) -> bool:
    """
    Safely dispatches an email notification via HostingerEmailProvider.
    Returns True if an email was sent (or simulated), False otherwise.
    Never raises an uncaught exception.
    """
    try:
        if not user or not user.email:
            return False

        if not can_send_email_notification(db, user.id, notification_type, priority):
            return False

        provider = HostingerEmailProvider()

        subject = f"[Kiwi CRM] [{priority}] {title}"
        body_text = f"Hello {user.first_name},\n\n{message}\n\nType: {notification_type}\nPriority: {priority}\n\n---\nKiwi Cloud Tech CRM Notification Engine\nhttps://kiwicloudtech.co.in"
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0284c7; color: #ffffff; padding: 16px 20px;">
                <h2 style="margin: 0; font-size: 18px;">Kiwi Cloud Tech CRM Alert</h2>
            </div>
            <div style="padding: 20px;">
                <p style="font-size: 14px; color: #475569; margin-top: 0;">Hello <strong>{user.first_name}</strong>,</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0;">
                    <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">{title}</h3>
                    <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.5;">{message}</p>
                </div>
                <p style="font-size: 12px; color: #64748b;">
                    <strong>Event Type:</strong> {notification_type} &nbsp;|&nbsp; 
                    <strong>Priority:</strong> <span style="color: {'#dc2626' if priority == 'CRITICAL' else '#ea580c' if priority == 'HIGH' else '#0284c7'};">{priority}</span>
                </p>
            </div>
            <div style="background-color: #f1f5f9; padding: 12px 20px; font-size: 12px; color: #94a3b8; text-align: center;">
                Kiwi Cloud Tech CRM Notification Engine &bull; kiwicloudtech.co.in
            </div>
        </div>
        """

        provider.send_email(
            to_email=user.email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )
        return True
    except Exception as e:
        logger.warning(f"Failed to dispatch notification email to {getattr(user, 'email', None)}: {e}")
        return False
