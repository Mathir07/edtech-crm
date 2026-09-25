from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.users.models import User
from app.notifications.automation import create_notification_if_unique, get_users_by_permission


def notify_quotation_submitted(db: Session, quote, submitted_by_user: User):
    """Notifies approvers and sales managers when a quotation is submitted for review."""
    approvers = get_users_by_permission(db, "sales.quotations.approve")
    submitter_name = f"{submitted_by_user.first_name or ''} {submitted_by_user.last_name or ''}".strip() or submitted_by_user.email
    
    for mgr in approvers:
        # Don't skip submitter if they are the only approver, but typically notify all with approve power
        create_notification_if_unique(
            db=db,
            user_id=mgr.id,
            notification_type="QUOTATION_SUBMITTED",
            title=f"Quotation {quote.quotation_number} Awaiting Approval",
            message=f"{submitter_name} submitted quotation {quote.quotation_number} for review.",
            entity_type="QUOTATION",
            entity_id=quote.id,
            priority="HIGH",
            dedup_key=f"quote_submitted_{quote.id}_{int(datetime.now(timezone.utc).timestamp() // 300)}",
        )


def notify_quotation_approved(db: Session, quote, approved_by_user: User):
    """Notifies quotation creator that their quote has been approved."""
    if not quote.created_by_id:
        return
    approver_name = f"{approved_by_user.first_name or ''} {approved_by_user.last_name or ''}".strip() or approved_by_user.email
    
    create_notification_if_unique(
        db=db,
        user_id=quote.created_by_id,
        notification_type="QUOTATION_APPROVED",
        title=f"Quotation {quote.quotation_number} Approved",
        message=f"Quotation {quote.quotation_number} was approved by {approver_name}. It can now be sent to the client.",
        entity_type="QUOTATION",
        entity_id=quote.id,
        priority="MEDIUM",
        dedup_key=f"quote_approved_{quote.id}",
    )


def notify_quotation_rejected(db: Session, quote, rejected_by_user: User, reason: Optional[str] = None):
    """Notifies quotation creator that their quote was rejected."""
    if not quote.created_by_id:
        return
    rejecter_name = f"{rejected_by_user.first_name or ''} {rejected_by_user.last_name or ''}".strip() or rejected_by_user.email
    reason_text = f" Reason: {reason}" if reason else ""
    
    create_notification_if_unique(
        db=db,
        user_id=quote.created_by_id,
        notification_type="QUOTATION_REJECTED",
        title=f"Quotation {quote.quotation_number} Rejected",
        message=f"Quotation {quote.quotation_number} was rejected by {rejecter_name}.{reason_text}",
        entity_type="QUOTATION",
        entity_id=quote.id,
        priority="HIGH",
        dedup_key=f"quote_rejected_{quote.id}_{int(datetime.now(timezone.utc).timestamp() // 60)}",
    )


def notify_ticket_assigned(db: Session, ticket, assignee: User, assigner: Optional[User] = None):
    """Notifies a support agent that a ticket was assigned to them."""
    assigner_text = f" by {assigner.first_name or assigner.email}" if assigner else ""
    priority = "HIGH" if str(ticket.priority).upper() in ["HIGH", "CRITICAL", "URGENT"] else "MEDIUM"
    
    create_notification_if_unique(
        db=db,
        user_id=assignee.id,
        notification_type="TICKET_ASSIGNED",
        title=f"Ticket #{ticket.ticket_number} Assigned",
        message=f"You have been assigned ticket '{ticket.subject}'{assigner_text} (Priority: {ticket.priority}).",
        entity_type="TICKET",
        entity_id=ticket.id,
        priority=priority,
        dedup_key=f"ticket_assigned_{ticket.id}_{assignee.id}_{int(datetime.now(timezone.utc).timestamp() // 120)}",
    )


def notify_lead_assigned(db: Session, lead, assignee: User, assigner: Optional[User] = None):
    """Notifies a sales rep that a lead was assigned to them."""
    lead_name = f"{lead.first_name or ''} {lead.last_name or ''}".strip() or "Prospect"
    college_info = f" ({lead.college_name})" if getattr(lead, "college_name", None) else ""
    assigner_text = f" by {assigner.first_name or assigner.email}" if assigner else ""

    create_notification_if_unique(
        db=db,
        user_id=assignee.id,
        notification_type="LEAD_ASSIGNED",
        title=f"New Lead Assigned: {lead_name}",
        message=f"You were assigned lead {lead_name}{college_info}{assigner_text}.",
        entity_type="LEAD",
        entity_id=lead.id,
        priority="MEDIUM",
        dedup_key=f"lead_assigned_{lead.id}_{assignee.id}",
    )


def notify_invoice_paid(db: Session, invoice, recorded_by_user: Optional[User] = None):
    """Notifies invoice creator or accounting managers that invoice has been paid in full."""
    recorder_text = f" recorded by {recorded_by_user.first_name or recorded_by_user.email}" if recorded_by_user else ""
    target_user_ids = set()
    if getattr(invoice, "created_by_id", None):
        target_user_ids.add(invoice.created_by_id)
        
    for uid in target_user_ids:
        create_notification_if_unique(
            db=db,
            user_id=uid,
            notification_type="PAYMENT_RECEIVED",
            title=f"Invoice #{invoice.invoice_number} Paid",
            message=f"Invoice #{invoice.invoice_number} has been marked as fully paid{recorder_text}.",
            entity_type="INVOICE",
            entity_id=invoice.id,
            priority="MEDIUM",
            dedup_key=f"invoice_paid_{invoice.id}",
        )
