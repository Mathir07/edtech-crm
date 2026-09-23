import re
import uuid
from typing import Optional, Tuple, Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.organizations.models import Contact, Company
from app.crm.models import Lead
from app.activities.models import Activity
from app.communication.models import EmailThread, CommunicationMessage, EmailAccount
from app.communication.providers.whatsapp import normalize_phone

def find_crm_associations_by_contact_info(
    db: Session,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Finds Contact ID and Company ID by matching email or phone number.
    Returns (contact_id, company_id).
    """
    if email:
        clean_email = email.strip().lower()
        contact = db.query(Contact).filter(Contact.email.ilike(clean_email), Contact.is_deleted == False).first()
        if contact:
            return contact.id, contact.company_id

        company = db.query(Company).filter(Company.email.ilike(clean_email), Company.is_deleted == False).first()
        if company:
            return None, company.id

    if phone:
        digits = normalize_phone(phone)
        if len(digits) >= 8:
            tail = digits[-10:]  # Match last 10 digits for Indian / international phone flexibility
            contact = db.query(Contact).filter(
                (Contact.phone.ilike(f"%{tail}%")) | (Contact.alternate_phone.ilike(f"%{tail}%")),
                Contact.is_deleted == False,
            ).first()
            if contact:
                return contact.id, contact.company_id

            company = db.query(Company).filter(
                Company.phone.ilike(f"%{tail}%"),
                Company.is_deleted == False,
            ).first()
            if company:
                return None, company.id

    return None, None


def render_template_text(template_text: str, variables: Dict[str, Any]) -> str:
    """
    Renders template text with variables.
    Throws ValueError if unresolved variables remain (e.g. {{variable}}).
    """
    rendered = template_text
    for k, v in variables.items():
        placeholder = f"{{{{{k}}}}}"
        rendered = rendered.replace(placeholder, str(v))

    # Strict check: any unresolved {{...}} variables?
    unresolved = re.findall(r"\{\{([a-zA-Z0-9_]+)\}\}", rendered)
    if unresolved:
        raise ValueError(f"Unresolved template variables: {', '.join(unresolved)}")

    return rendered


def get_or_create_email_thread(
    db: Session,
    provider_thread_id: str,
    email_account_id: Optional[str] = None,
    subject: Optional[str] = None,
    snippet: Optional[str] = None,
    company_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    opportunity_id: Optional[str] = None,
    project_id: Optional[str] = None,
    ticket_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
) -> EmailThread:
    """Gets existing email thread by provider_thread_id or creates a new one."""
    thread = db.query(EmailThread).filter(EmailThread.provider_thread_id == provider_thread_id).first()
    now = datetime.now(timezone.utc)

    if thread:
        thread.last_message_at = now
        thread.message_count += 1
        if snippet:
            thread.snippet = snippet[:500]
        # Propagate CRM associations if not already set
        if company_id and not thread.company_id:
            thread.company_id = company_id
        if contact_id and not thread.contact_id:
            thread.contact_id = contact_id
        if lead_id and not thread.lead_id:
            thread.lead_id = lead_id
        if opportunity_id and not thread.opportunity_id:
            thread.opportunity_id = opportunity_id
        if project_id and not thread.project_id:
            thread.project_id = project_id
        if ticket_id and not thread.ticket_id:
            thread.ticket_id = ticket_id
        if invoice_id and not thread.invoice_id:
            thread.invoice_id = invoice_id
        db.flush()
        return thread

    # Create new thread
    thread = EmailThread(
        provider_thread_id=provider_thread_id,
        email_account_id=email_account_id,
        subject=subject or "No Subject",
        snippet=snippet[:500] if snippet else None,
        last_message_at=now,
        message_count=1,
        is_read=True,
        company_id=company_id,
        contact_id=contact_id,
        lead_id=lead_id,
        opportunity_id=opportunity_id,
        project_id=project_id,
        ticket_id=ticket_id,
        invoice_id=invoice_id,
    )
    db.add(thread)
    db.flush()
    return thread


def record_communication_activity(
    db: Session,
    channel: str,  # "EMAIL" or "PHONE"
    direction: str,  # "INBOUND" or "OUTBOUND"
    subject: str,
    description: Optional[str] = None,
    user_id: Optional[str] = None,
    company_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    opportunity_id: Optional[str] = None,
    completed_at: Optional[datetime] = None,
) -> Optional[Activity]:
    """
    Creates an Activity event (type='Email' or 'Call') in the CRM timeline.
    Also updates lead.last_activity_at if associated with a Lead.
    """
    now = completed_at or datetime.now(timezone.utc)
    rel_type = None
    rel_id = None

    if lead_id:
        rel_type = "lead"
        rel_id = lead_id
    elif contact_id:
        rel_type = "contact"
        rel_id = contact_id
    elif company_id:
        rel_type = "company"
        rel_id = company_id
    elif opportunity_id:
        rel_type = "opportunity"
        rel_id = opportunity_id

    if not rel_type or not rel_id:
        return None

    act_type = "Email" if channel.upper() == "EMAIL" else "Call"
    act = Activity(
        type=act_type,
        subject=subject[:255] if subject else f"{act_type} ({direction})",
        description=(description or "")[:1000] if description else None,
        due_at=now,
        completed_at=now,
        is_completed=True,
        assigned_to_id=user_id,
        created_by_id=user_id,
        related_entity_type=rel_type,
        related_entity_id=rel_id,
    )
    db.add(act)

    # If associated with a Lead, update lead.last_activity_at
    if rel_type == "lead":
        lead = db.query(Lead).filter(Lead.id == rel_id, Lead.is_deleted == False).first()
        if lead:
            lead.last_activity_at = now

    db.flush()
    return act


def sync_hostinger_emails(
    db: Session,
    provider: Any,
    max_messages: int = 50,
) -> Dict[str, Any]:
    """
    Synchronizes incoming emails from Hostinger IMAP.
    Idempotent: skips already imported provider_message_ids.
    Matches senders against known Contacts, Companies & Leads.
    Creates Activity records for linked CRM entities.
    Returns summary stats without leaking email bodies.
    """
    if not provider.is_configured():
        return {
            "status": "completed",
            "messages_synced": 0,
            "synced": 0,
            "synced_count": 0,
            "skipped": 0,
            "failed": 0,
            "message": "Hostinger IMAP credentials not configured in environment.",
        }

    raw_messages = provider.sync_messages(folder="INBOX", max_messages=max_messages)
    synced = 0
    skipped = 0
    failed = 0
    now = datetime.now(timezone.utc)

    # Find or default Hostinger email account
    hostinger_acc = db.query(EmailAccount).filter(
        EmailAccount.email_address == provider.smtp_username,
        EmailAccount.status != "DELETED",
    ).first()

    for item in raw_messages:
        try:
            p_msg_id = item.get("provider_message_id")
            if not p_msg_id:
                failed += 1
                continue

            # Idempotency check: Skip if already synced
            existing = db.query(CommunicationMessage).filter(
                CommunicationMessage.provider_message_id == p_msg_id
            ).first()
            if existing:
                skipped += 1
                continue

            from_raw = item.get("from", "")
            to_raw = item.get("to", "")
            subject = item.get("subject", "(No Subject)")
            body_text = item.get("body_text", "")
            body_html = item.get("body_html")
            in_reply_to = item.get("in_reply_to")
            references = item.get("references")

            # Extract clean email address from "From" header
            sender_email = from_raw
            if "<" in from_raw and ">" in from_raw:
                sender_email = from_raw.split("<")[1].split(">")[0].strip()

            # Match sender with CRM Contact / Company / Lead
            contact_id, company_id = find_crm_associations_by_contact_info(db, email=sender_email)
            lead = db.query(Lead).filter(
                Lead.contact_email.ilike(sender_email.strip().lower()),
                Lead.is_deleted == False,
            ).first()
            lead_id = lead.id if lead else None

            # Determine thread: if in_reply_to or references match existing message, link to same thread
            thread = None
            if in_reply_to or references:
                ref_id = in_reply_to or references
                orig = db.query(CommunicationMessage).filter(
                    CommunicationMessage.provider_message_id == ref_id
                ).first()
                if orig and orig.thread:
                    thread = orig.thread

            if not thread:
                p_th_id = f"th_{uuid.uuid4().hex[:12]}"
                thread = get_or_create_email_thread(
                    db=db,
                    provider_thread_id=p_th_id,
                    email_account_id=hostinger_acc.id if hostinger_acc else None,
                    subject=subject,
                    snippet=body_text[:200] if body_text else None,
                    company_id=company_id,
                    contact_id=contact_id,
                    lead_id=lead_id,
                )
            else:
                thread.last_message_at = now
                thread.message_count += 1
                if body_text:
                    thread.snippet = body_text[:200]
                thread.is_read = False

            msg = CommunicationMessage(
                channel="EMAIL",
                direction="INBOUND",
                status="RECEIVED",
                email_account_id=hostinger_acc.id if hostinger_acc else None,
                thread_id=thread.id,
                provider_message_id=p_msg_id,
                provider_thread_id=thread.provider_thread_id,
                sender=from_raw,
                recipient=to_raw or provider.default_from,
                cc=item.get("cc"),
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                sent_at=now,
                delivered_at=now,
                company_id=company_id,
                contact_id=contact_id,
                lead_id=lead_id,
            )
            db.add(msg)
            db.flush()

            # Record Activity if linked to CRM entity
            if lead_id or contact_id or company_id:
                record_communication_activity(
                    db=db,
                    channel="EMAIL",
                    direction="INBOUND",
                    subject=f"Email received: {subject}",
                    description=body_text[:500] if body_text else None,
                    company_id=company_id,
                    contact_id=contact_id,
                    lead_id=lead_id,
                    completed_at=now,
                )

            synced += 1
        except Exception:
            failed += 1

    db.commit()
    return {
        "status": "completed",
        "messages_synced": synced,
        "synced": synced,
        "synced_count": synced,
        "skipped": skipped,
        "failed": failed,
    }
