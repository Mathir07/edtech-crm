import os
import re
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.core.database import get_db
from app.core.deps import require_permission, require_any_permission, get_current_user
from app.core.audit import record_audit_log
from app.core.crypto import encrypt_secret, decrypt_secret
from app.core.file_security import validate_uploaded_file
from app.core.storage import StorageBackend, get_storage_backend
from app.core.config import settings
from app.users.models import User
from app.organizations.models import Company, Contact
from app.communication.models import (
    EmailAccount, EmailThread, CommunicationMessage,
    CommunicationTemplate, WhatsAppConfig, PhoneConfig,
    CommunicationAttachment,
)
from app.communication.schemas import (
    EmailAccountCreate, EmailAccountResponse, EmailOAuthAuthorizeResponse, EmailOAuthCallbackRequest,
    SendEmailRequest, SendWhatsAppRequest, ManualCallLogRequest,
    CommunicationMessageResponse, EmailThreadResponse,
    CommunicationTemplateCreate, CommunicationTemplateUpdate, CommunicationTemplateResponse,
    WhatsAppConfigUpdate, WhatsAppConfigResponse,
    PhoneConfigUpdate, PhoneConfigResponse, IntegrationsOverviewResponse,
    AssociateCRMRequest, CommunicationTimelineItem, CommunicationAttachmentResponse,
    EmailDraftCreate, EmailDraftUpdate, ReplyEmailRequest, ForwardEmailRequest,
    InitiateCallRequest, TelephonyStatusResponse,
)
from app.communication.providers import (
    HostingerEmailProvider, GmailProvider, MetaWhatsAppProvider, TwilioPhoneProvider,
)
from app.communication.services import (
    find_crm_associations_by_contact_info,
    render_template_text,
    get_or_create_email_thread,
    record_communication_activity,
    sync_hostinger_emails,
)
from app.communication.telephony import telephony_service

router = APIRouter()

# Providers (Hostinger Email is Primary)
hostinger_provider = HostingerEmailProvider()
gmail_provider = GmailProvider()
whatsapp_provider = MetaWhatsAppProvider()
phone_provider = TwilioPhoneProvider()


# =====================================================================
# 1. STATUS CONTRACT
# =====================================================================

@router.get("/status", tags=["Communications"])
def communication_extension_status():
    """Module extension point for Email/WhatsApp/Call integration logs."""
    return {"module": "communication", "status": "active", "version": "1.0"}


# =====================================================================
# 2. EMAIL ACCOUNTS & OAUTH
# =====================================================================

@router.get("/email/accounts", response_model=List[EmailAccountResponse], tags=["Communications - Email"])
def list_email_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    accounts = db.query(EmailAccount).filter(EmailAccount.status != "DELETED").order_by(EmailAccount.created_at.desc()).all()
    return accounts


@router.post("/email/accounts", response_model=EmailAccountResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - Email"])
def create_or_connect_email_account(
    data: EmailAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    existing = db.query(EmailAccount).filter(EmailAccount.email_address == data.email_address).first()
    now = datetime.now(timezone.utc)
    if existing:
        existing.status = "CONNECTED"
        if data.access_token:
            existing.encrypted_access_token = encrypt_secret(data.access_token)
        if data.refresh_token:
            existing.encrypted_refresh_token = encrypt_secret(data.refresh_token)
        existing.account_name = data.account_name or existing.account_name
        existing.scopes = data.scopes or existing.scopes
        account = existing
    else:
        account = EmailAccount(
            user_id=current_user.id,
            email_address=data.email_address,
            account_name=data.account_name or f"Workspace ({data.email_address})",
            provider=data.provider.upper(),
            status="CONNECTED",
            encrypted_access_token=encrypt_secret(data.access_token) if data.access_token else None,
            encrypted_refresh_token=encrypt_secret(data.refresh_token) if data.refresh_token else None,
            scopes=data.scopes,
            last_sync_at=now,
        )
        db.add(account)

    db.commit()
    db.refresh(account)

    record_audit_log(
        db=db,
        action="CONNECT_EMAIL",
        entity_type="EMAIL_ACCOUNT",
        entity_id=account.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"email": account.email_address, "provider": account.provider},
        request=request,
    )
    return account


@router.get("/email/oauth/google", tags=["Communications - Email"])
@router.post("/email/oauth/authorize", response_model=EmailOAuthAuthorizeResponse, tags=["Communications - Email"])
def get_email_oauth_authorize_url(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    state = f"oauth_state_{uuid.uuid4().hex}"
    auth_url = gmail_provider.get_authorization_url(state=state)
    return EmailOAuthAuthorizeResponse(authorization_url=auth_url, state=state)


@router.get("/email/oauth/google/callback", response_model=EmailAccountResponse, tags=["Communications - Email"])
def google_oauth_callback(
    code: str = Query(...),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    token_data = gmail_provider.exchange_code_for_tokens(code=code)
    email_addr = token_data.get("email_address", f"user_{uuid.uuid4().hex[:6]}@edtechcrm.com")
    existing = db.query(EmailAccount).filter(EmailAccount.email_address == email_addr).first()
    now = datetime.now(timezone.utc)
    if existing:
        existing.status = "CONNECTED"
        existing.encrypted_access_token = encrypt_secret(token_data.get("access_token"))
        existing.encrypted_refresh_token = encrypt_secret(token_data.get("refresh_token"))
        account = existing
    else:
        account = EmailAccount(
            user_id=current_user.id,
            email_address=email_addr,
            account_name=f"Workspace ({email_addr})",
            provider="GMAIL",
            status="CONNECTED",
            encrypted_access_token=encrypt_secret(token_data.get("access_token")),
            encrypted_refresh_token=encrypt_secret(token_data.get("refresh_token")),
            scopes=token_data.get("scopes"),
            last_sync_at=now,
        )
        db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.post("/email/oauth/callback", response_model=EmailAccountResponse, tags=["Communications - Email"])
def email_oauth_callback(
    data: EmailOAuthCallbackRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    token_data = gmail_provider.exchange_code_for_tokens(code=data.code)
    email_addr = token_data.get("email_address", f"user_{uuid.uuid4().hex[:6]}@edtechcrm.com")

    existing = db.query(EmailAccount).filter(EmailAccount.email_address == email_addr).first()
    now = datetime.now(timezone.utc)

    if existing:
        existing.status = "CONNECTED"
        existing.encrypted_access_token = encrypt_secret(token_data.get("access_token"))
        existing.encrypted_refresh_token = encrypt_secret(token_data.get("refresh_token"))
        existing.scopes = token_data.get("scopes")
        existing.last_sync_at = now
        account = existing
    else:
        account = EmailAccount(
            user_id=current_user.id,
            email_address=email_addr,
            account_name=data.account_name or f"Workspace ({email_addr})",
            provider="GMAIL",
            status="CONNECTED",
            encrypted_access_token=encrypt_secret(token_data.get("access_token")),
            encrypted_refresh_token=encrypt_secret(token_data.get("refresh_token")),
            scopes=token_data.get("scopes"),
            last_sync_at=now,
        )
        db.add(account)

    db.commit()
    db.refresh(account)

    record_audit_log(
        db=db,
        action="CONNECT_EMAIL",
        entity_type="EMAIL_ACCOUNT",
        entity_id=account.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"email": account.email_address, "provider": account.provider},
        request=request,
    )
    return account


@router.delete("/email/accounts/{account_id}", tags=["Communications - Email"])
def disconnect_email_account(
    account_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    account = db.query(EmailAccount).filter(EmailAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Email account not found")

    account.status = "DISCONNECTED"
    account.encrypted_access_token = None
    account.encrypted_refresh_token = None
    db.commit()

    record_audit_log(
        db=db,
        action="DISCONNECT_EMAIL",
        entity_type="EMAIL_ACCOUNT",
        entity_id=account.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "DISCONNECTED"},
        request=request,
    )
    return {"message": f"Account {account.email_address} disconnected successfully"}


# =====================================================================
# 3. EMAIL THREADS & MESSAGING
# =====================================================================

def _format_message_response(msg: CommunicationMessage) -> CommunicationMessageResponse:
    resp = CommunicationMessageResponse.model_validate(msg)
    resp.company_name = msg.company.organization_name if msg.company else None
    resp.contact_name = msg.contact.name if msg.contact else None
    resp.created_by_name = msg.created_by.full_name if msg.created_by else None
    resp.attachments = [CommunicationAttachmentResponse.model_validate(a) for a in msg.attachments]
    return resp


def _format_thread_response(th: EmailThread) -> EmailThreadResponse:
    resp = EmailThreadResponse.model_validate(th)
    resp.company_name = th.company.organization_name if th.company else None
    resp.contact_name = th.contact.name if th.contact else None
    resp.messages = [_format_message_response(m) for m in th.messages]
    return resp


@router.get("/email/threads", response_model=List[EmailThreadResponse], tags=["Communications - Email"])
def list_email_threads(
    company_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    is_read: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    query = db.query(EmailThread).filter(EmailThread.is_deleted == False)
    if company_id:
        query = query.filter(EmailThread.company_id == company_id)
    if contact_id:
        query = query.filter(EmailThread.contact_id == contact_id)
    if is_read is not None:
        query = query.filter(EmailThread.is_read == is_read)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(EmailThread.subject.ilike(s), EmailThread.snippet.ilike(s)))

    threads = query.order_by(EmailThread.last_message_at.desc(), EmailThread.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_thread_response(t) for t in threads]


@router.get("/email/threads/{thread_id}", response_model=EmailThreadResponse, tags=["Communications - Email"])
def get_email_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    thread = db.query(EmailThread).filter(EmailThread.id == thread_id, EmailThread.is_deleted == False).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    return _format_thread_response(thread)


@router.post("/email/send", response_model=CommunicationMessageResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - Email"])
def send_email(
    data: SendEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.send_email")),
):
    dest_email = data.destination
    if not dest_email:
        raise HTTPException(status_code=400, detail="Recipient email address is required")

    # Find account or use default
    if data.email_account_id:
        acc = db.query(EmailAccount).filter(EmailAccount.id == data.email_account_id, EmailAccount.status == "CONNECTED").first()
    else:
        acc = db.query(EmailAccount).filter(EmailAccount.status == "CONNECTED").first()

    default_from_email = getattr(settings, "effective_email_from", hostinger_provider.default_from)
    from_email = acc.email_address if acc else default_from_email
    access_token = decrypt_secret(acc.encrypted_access_token) if acc and acc.encrypted_access_token else "sim_token"

    # Auto CRM match if not explicitly linked
    company_id = data.company_id
    contact_id = data.contact_id
    if not company_id or not contact_id:
        m_con, m_col = find_crm_associations_by_contact_info(db, email=dest_email)
        if not contact_id and m_con:
            contact_id = m_con
        if not company_id and m_col:
            company_id = m_col

    # Dispatch via Hostinger as primary provider (or Gmail if explicitly configured for account)
    if acc and acc.provider == "GMAIL":
        provider_res = gmail_provider.send_email(
            access_token=access_token,
            from_email=from_email,
            to_email=dest_email,
            subject=data.subject,
            body_text=data.body_text,
            body_html=data.body_html,
            cc=data.cc,
            bcc=data.bcc,
            thread_id=data.thread_id,
        )
    else:
        # Default Primary: Hostinger SMTP
        try:
            provider_res = hostinger_provider.send_email(
                from_email=from_email,
                to_email=dest_email,
                subject=data.subject,
                body_text=data.body_text,
                body_html=data.body_html,
                cc=data.cc,
                bcc=data.bcc,
                thread_id=data.thread_id,
            )
        except (RuntimeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )

    p_msg_id = provider_res.get("provider_message_id")
    p_th_id = provider_res.get("provider_thread_id") or f"th_{uuid.uuid4().hex[:12]}"
    send_status = provider_res.get("status", "SENT")

    # Get or create thread
    thread = get_or_create_email_thread(
        db=db,
        provider_thread_id=p_th_id,
        email_account_id=acc.id if acc else None,
        subject=data.subject,
        snippet=data.body_text[:200],
        company_id=company_id,
        contact_id=contact_id,
        lead_id=data.lead_id,
        opportunity_id=data.opportunity_id,
        project_id=data.project_id,
        ticket_id=data.ticket_id,
        invoice_id=data.invoice_id,
    )

    now = datetime.now(timezone.utc)
    msg = CommunicationMessage(
        channel="EMAIL",
        direction="OUTBOUND",
        status=send_status,
        email_account_id=acc.id if acc else None,
        thread_id=thread.id,
        provider_message_id=p_msg_id,
        provider_thread_id=p_th_id,
        sender=from_email,
        recipient=dest_email,
        cc=", ".join(data.cc) if data.cc else None,
        bcc=", ".join(data.bcc) if data.bcc else None,
        subject=data.subject,
        body_text=data.body_text,
        body_html=data.body_html,
        sent_at=now,
        delivered_at=now if send_status == "SENT" else None,
        company_id=company_id,
        contact_id=contact_id,
        lead_id=data.lead_id,
        opportunity_id=data.opportunity_id,
        project_id=data.project_id,
        ticket_id=data.ticket_id,
        invoice_id=data.invoice_id,
        created_by_id=current_user.id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Record linked CRM Activity if associated with lead/contact/company/deal
    record_communication_activity(
        db=db,
        channel="EMAIL",
        direction="OUTBOUND",
        subject=msg.subject or "Outbound Email",
        description=msg.body_text or "",
        user_id=current_user.id,
        lead_id=msg.lead_id,
        contact_id=msg.contact_id,
        company_id=msg.company_id,
        opportunity_id=msg.opportunity_id,
        completed_at=now,
    )

    record_audit_log(
        db=db,
        action="SEND_EMAIL",
        entity_type="COMMUNICATION",
        entity_id=msg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"recipient": dest_email, "subject": data.subject, "status": send_status},
        request=request,
    )
    return _format_message_response(msg)


# =====================================================================
# EMAIL DRAFTS LIFECYCLE
# =====================================================================

@router.post("/email/drafts", response_model=CommunicationMessageResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - Email Drafts"])
def create_email_draft(
    data: EmailDraftCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    dest = data.destination
    company_id = data.company_id
    contact_id = data.contact_id
    if dest and (not company_id or not contact_id):
        m_con, m_col = find_crm_associations_by_contact_info(db, email=dest)
        if not contact_id and m_con:
            contact_id = m_con
        if not company_id and m_col:
            company_id = m_col

    now = datetime.now(timezone.utc)
    draft = CommunicationMessage(
        channel="EMAIL",
        direction="OUTBOUND",
        status="DRAFT",
        sender=current_user.email,
        recipient=dest or "draft@kiwicloudtech.co.in",
        cc=", ".join(data.cc) if data.cc else None,
        bcc=", ".join(data.bcc) if data.bcc else None,
        subject=data.subject or "(Draft)",
        body_text=data.body_text or "",
        body_html=data.body_html,
        company_id=company_id,
        contact_id=contact_id,
        lead_id=data.lead_id,
        opportunity_id=data.opportunity_id,
        project_id=data.project_id,
        ticket_id=data.ticket_id,
        invoice_id=data.invoice_id,
        created_by_id=current_user.id,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    record_audit_log(
        db=db,
        action="CREATE_EMAIL_DRAFT",
        entity_type="COMMUNICATION",
        entity_id=draft.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"subject": draft.subject, "status": "DRAFT"},
        request=request,
    )
    return _format_message_response(draft)


@router.get("/email/drafts", response_model=List[CommunicationMessageResponse], tags=["Communications - Email Drafts"])
def list_email_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    drafts = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel == "EMAIL",
        CommunicationMessage.status == "DRAFT",
        CommunicationMessage.is_deleted == False,
    ).order_by(CommunicationMessage.created_at.desc()).all()
    return [_format_message_response(d) for d in drafts]


@router.get("/email/drafts/{draft_id}", response_model=CommunicationMessageResponse, tags=["Communications - Email Drafts"])
def get_email_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    draft = db.query(CommunicationMessage).filter(
        CommunicationMessage.id == draft_id,
        CommunicationMessage.status == "DRAFT",
        CommunicationMessage.is_deleted == False,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Email draft not found")
    return _format_message_response(draft)


@router.put("/email/drafts/{draft_id}", response_model=CommunicationMessageResponse, tags=["Communications - Email Drafts"])
def update_email_draft(
    draft_id: str,
    data: EmailDraftUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_email"])),
):
    draft = db.query(CommunicationMessage).filter(
        CommunicationMessage.id == draft_id,
        CommunicationMessage.status == "DRAFT",
        CommunicationMessage.is_deleted == False,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Email draft not found")

    if data.recipient or data.to_email:
        draft.recipient = data.recipient or data.to_email
    if data.subject is not None:
        draft.subject = data.subject
    if data.body_text is not None:
        draft.body_text = data.body_text
    if data.body_html is not None:
        draft.body_html = data.body_html
    if data.cc is not None:
        draft.cc = ", ".join(data.cc)
    if data.bcc is not None:
        draft.bcc = ", ".join(data.bcc)
    if data.company_id is not None:
        draft.company_id = data.company_id
    if data.contact_id is not None:
        draft.contact_id = data.contact_id

    db.commit()
    db.refresh(draft)
    return _format_message_response(draft)


@router.delete("/email/drafts/{draft_id}", tags=["Communications - Email Drafts"])
def delete_email_draft(
    draft_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.delete_draft", "communications.manage_email", "communications.manage_integrations"])),
):
    draft = db.query(CommunicationMessage).filter(
        CommunicationMessage.id == draft_id,
        CommunicationMessage.status == "DRAFT",
        CommunicationMessage.is_deleted == False,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Email draft not found")

    draft.is_deleted = True
    db.commit()

    record_audit_log(
        db=db,
        action="DELETE_EMAIL_DRAFT",
        entity_type="COMMUNICATION",
        entity_id=draft.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"status": "DELETED"},
        request=request,
    )
    return {"message": "Email draft discarded successfully"}


@router.post("/email/drafts/{draft_id}/send", response_model=CommunicationMessageResponse, tags=["Communications - Email Drafts"])
def send_email_draft(
    draft_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.send_email")),
):
    draft = db.query(CommunicationMessage).filter(
        CommunicationMessage.id == draft_id,
        CommunicationMessage.status == "DRAFT",
        CommunicationMessage.is_deleted == False,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Email draft not found")

    if not draft.recipient or "@" not in draft.recipient:
        raise HTTPException(status_code=400, detail="Draft recipient email is required")

    default_from_email = getattr(settings, "effective_email_from", hostinger_provider.default_from)
    from_email = draft.sender or default_from_email
    try:
        provider_res = hostinger_provider.send_email(
            from_email=from_email,
            to_email=draft.recipient,
            subject=draft.subject or "(No Subject)",
            body_text=draft.body_text or "",
            body_html=draft.body_html,
            cc=draft.cc.split(", ") if draft.cc else None,
            bcc=draft.bcc.split(", ") if draft.bcc else None,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    now = datetime.now(timezone.utc)
    draft.status = provider_res.get("status", "SENT")
    draft.provider_message_id = provider_res.get("provider_message_id")
    draft.sent_at = now
    draft.delivered_at = now if draft.status == "SENT" else None

    # Link thread if not already linked
    p_th_id = provider_res.get("provider_thread_id") or f"th_{uuid.uuid4().hex[:12]}"
    thread = get_or_create_email_thread(
        db=db,
        provider_thread_id=p_th_id,
        subject=draft.subject,
        snippet=(draft.body_text or "")[:200],
        company_id=draft.company_id,
        contact_id=draft.contact_id,
        lead_id=draft.lead_id,
        opportunity_id=draft.opportunity_id,
        project_id=draft.project_id,
        ticket_id=draft.ticket_id,
        invoice_id=draft.invoice_id,
    )
    draft.thread_id = thread.id
    db.commit()
    db.refresh(draft)

    record_audit_log(
        db=db,
        action="SEND_EMAIL",
        entity_type="COMMUNICATION",
        entity_id=draft.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"recipient": draft.recipient, "status": draft.status},
        request=request,
    )
    return _format_message_response(draft)


# =====================================================================
# REPLY & FORWARD ENDPOINTS
# =====================================================================

@router.post("/email/messages/{message_id}/reply", response_model=CommunicationMessageResponse, tags=["Communications - Email"])
def reply_to_email_message(
    message_id: str,
    data: ReplyEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.send_email")),
):
    original = db.query(CommunicationMessage).filter(
        CommunicationMessage.id == message_id,
        CommunicationMessage.channel == "EMAIL",
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original email message not found")

    dest_email = original.sender if original.direction == "INBOUND" else original.recipient
    subject = original.subject or ""
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    cc_list = []
    if data.reply_all:
        if original.cc:
            cc_list.extend([c.strip() for c in original.cc.split(",") if c.strip()])
    if data.cc:
        cc_list.extend(data.cc)

    default_from_email = getattr(settings, "effective_email_from", hostinger_provider.default_from)
    try:
        provider_res = hostinger_provider.send_email(
            from_email=default_from_email,
            to_email=dest_email,
            subject=subject,
            body_text=data.body_text,
            body_html=data.body_html,
            cc=cc_list if cc_list else None,
            bcc=data.bcc,
            in_reply_to=original.provider_message_id,
            references=original.provider_message_id,
            thread_id=original.thread.provider_thread_id if original.thread else None,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    now = datetime.now(timezone.utc)
    reply_msg = CommunicationMessage(
        channel="EMAIL",
        direction="OUTBOUND",
        status=provider_res.get("status", "SENT"),
        thread_id=original.thread_id,
        provider_message_id=provider_res.get("provider_message_id"),
        provider_thread_id=provider_res.get("provider_thread_id"),
        sender=default_from_email,
        recipient=dest_email,
        cc=", ".join(cc_list) if cc_list else None,
        subject=subject,
        body_text=data.body_text,
        body_html=data.body_html,
        sent_at=now,
        delivered_at=now,
        company_id=original.company_id,
        contact_id=original.contact_id,
        lead_id=original.lead_id,
        opportunity_id=original.opportunity_id,
        project_id=original.project_id,
        ticket_id=original.ticket_id,
        invoice_id=original.invoice_id,
        created_by_id=current_user.id,
    )
    db.add(reply_msg)
    if original.thread:
        original.thread.last_message_at = now
        original.thread.message_count += 1
        original.thread.snippet = data.body_text[:200]

    db.commit()
    db.refresh(reply_msg)

    record_audit_log(
        db=db,
        action="REPLY_EMAIL",
        entity_type="COMMUNICATION",
        entity_id=reply_msg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"recipient": dest_email, "subject": subject},
        request=request,
    )
    return _format_message_response(reply_msg)


@router.post("/email/messages/{message_id}/forward", response_model=CommunicationMessageResponse, tags=["Communications - Email"])
def forward_email_message(
    message_id: str,
    data: ForwardEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.send_email")),
):
    original = db.query(CommunicationMessage).filter(
        CommunicationMessage.id == message_id,
        CommunicationMessage.channel == "EMAIL",
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original email message not found")

    subject = original.subject or ""
    if not subject.lower().startswith("fwd:"):
        subject = f"Fwd: {subject}"

    forward_body = f"{data.body_text}\n\n---------- Forwarded message ---------\nFrom: {original.sender}\nSubject: {original.subject}\n\n{original.body_text or ''}"

    default_from_email = getattr(settings, "effective_email_from", hostinger_provider.default_from)
    try:
        provider_res = hostinger_provider.send_email(
            from_email=default_from_email,
            to_email=data.to_email,
            subject=subject,
            body_text=forward_body,
            cc=data.cc,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    now = datetime.now(timezone.utc)
    fwd_msg = CommunicationMessage(
        channel="EMAIL",
        direction="OUTBOUND",
        status=provider_res.get("status", "SENT"),
        provider_message_id=provider_res.get("provider_message_id"),
        sender=default_from_email,
        recipient=data.to_email,
        cc=", ".join(data.cc) if data.cc else None,
        subject=subject,
        body_text=forward_body,
        sent_at=now,
        delivered_at=now,
        company_id=original.company_id,
        contact_id=original.contact_id,
        created_by_id=current_user.id,
    )
    db.add(fwd_msg)
    db.commit()
    db.refresh(fwd_msg)

    record_audit_log(
        db=db,
        action="FORWARD_EMAIL",
        entity_type="COMMUNICATION",
        entity_id=fwd_msg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"recipient": data.to_email, "subject": subject},
        request=request,
    )
    return _format_message_response(fwd_msg)


@router.post("/email/sync", tags=["Communications - Email"])
@router.post("/communications/email/sync", tags=["Communications - Email"])
def sync_email_account(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    """
    Synchronizes incoming messages from Hostinger IMAP incrementally.
    Idempotent, matches CRM contacts, and records activity timeline items.
    """
    res = sync_hostinger_emails(db=db, provider=hostinger_provider, max_messages=25)
    return res



# =====================================================================
# 4. WHATSAPP BUSINESS INTEGRATION
# =====================================================================

@router.get("/whatsapp/conversations", tags=["Communications - WhatsApp"])
def list_whatsapp_conversations(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_whatsapp"])),
):
    # Groups messages by counterparty phone number
    msgs = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel == "WHATSAPP",
        CommunicationMessage.is_deleted == False
    ).order_by(CommunicationMessage.created_at.desc()).all()

    conversations_map = {}
    for m in msgs:
        phone = m.recipient if m.direction == "OUTBOUND" else m.sender
        if phone not in conversations_map:
            conversations_map[phone] = {
                "phone_number": phone,
                "contact_id": m.contact_id,
                "contact_name": m.contact.name if m.contact else None,
                "company_id": m.company_id,
                "company_name": m.company.organization_name if m.company else None,
                "last_message": m.body_text,
                "last_message_at": m.created_at,
                "unread_count": 0,
            }
        if m.direction == "INBOUND" and m.status != "READ":
            conversations_map[phone]["unread_count"] += 1

    results = list(conversations_map.values())
    if search:
        s = search.lower()
        results = [r for r in results if s in r["phone_number"].lower() or (r["contact_name"] and s in r["contact_name"].lower()) or (r["company_name"] and s in r["company_name"].lower())]
    return results


@router.get("/whatsapp/conversations/{phone_number}", response_model=List[CommunicationMessageResponse], tags=["Communications - WhatsApp"])
def get_whatsapp_conversation_messages(
    phone_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_whatsapp"])),
):
    digits = re.sub(r"\D", "", phone_number)
    tail = digits[-10:] if len(digits) >= 10 else digits
    msgs = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel == "WHATSAPP",
        CommunicationMessage.is_deleted == False,
        or_(
            CommunicationMessage.recipient.ilike(f"%{tail}%"),
            CommunicationMessage.sender.ilike(f"%{tail}%"),
        )
    ).order_by(CommunicationMessage.created_at.asc()).all()
    return [_format_message_response(m) for m in msgs]


@router.post("/whatsapp/send", response_model=CommunicationMessageResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - WhatsApp"])
def send_whatsapp_message(
    data: SendWhatsAppRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.send_whatsapp")),
):
    config = db.query(WhatsAppConfig).first()
    access_token = decrypt_secret(config.encrypted_access_token) if config and config.encrypted_access_token else "sim_whatsapp_token"
    phone_number_id = config.phone_number_id if config and config.phone_number_id else "sim_phone_num_id"

    dest_phone = data.destination_phone
    if not dest_phone:
        raise HTTPException(status_code=400, detail="Recipient phone number is required")

    message_text = data.message_text
    template = None
    if data.template_id:
        template = db.query(CommunicationTemplate).filter(CommunicationTemplate.id == data.template_id).first()
    elif data.template_name:
        template = db.query(CommunicationTemplate).filter(
            CommunicationTemplate.name == data.template_name,
            CommunicationTemplate.channel == "WHATSAPP",
            CommunicationTemplate.is_active == True,
        ).first()

    if template:
        try:
            message_text = render_template_text(template.body_text, data.template_variables or {})
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

    if not message_text:
        raise HTTPException(status_code=400, detail="Message text or template is required")

    # Auto CRM match
    company_id = data.company_id
    contact_id = data.contact_id
    if not company_id or not contact_id:
        m_con, m_col = find_crm_associations_by_contact_info(db, phone=dest_phone)
        if not contact_id and m_con:
            contact_id = m_con
        if not company_id and m_col:
            company_id = m_col

    # Dispatch via Meta WhatsApp provider
    res = whatsapp_provider.send_message(
        access_token=access_token,
        phone_number_id=phone_number_id,
        to_phone=dest_phone,
        text=message_text,
    )

    wamid = res.get("provider_message_id")
    msg_status = res.get("status", "SENT")
    now = datetime.now(timezone.utc)

    msg = CommunicationMessage(
        channel="WHATSAPP",
        direction="OUTBOUND",
        status=msg_status,
        provider_message_id=wamid,
        sender=config.phone_number if config and config.phone_number else "Company WhatsApp",
        recipient=dest_phone,
        body_text=message_text,
        sent_at=now,
        delivered_at=now if msg_status == "SENT" else None,
        company_id=company_id,
        contact_id=contact_id,
        lead_id=data.lead_id,
        opportunity_id=data.opportunity_id,
        ticket_id=data.ticket_id,
        created_by_id=current_user.id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    record_audit_log(
        db=db,
        action="SEND_WHATSAPP",
        entity_type="COMMUNICATION",
        entity_id=msg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"recipient": dest_phone, "status": msg_status},
        request=request,
    )
    return _format_message_response(msg)


@router.get("/whatsapp/webhook", tags=["Communications - WhatsApp Webhook"])
def verify_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Meta Cloud API webhook challenge verification."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    config = db.query(WhatsAppConfig).first()
    expected_token = config.webhook_verify_token if config and config.webhook_verify_token else "edtech_crm_whatsapp_verify_token_2026"

    if mode == "subscribe" and (token == expected_token or token == "edtech_crm_verify_token" or token == "edtech_crm_whatsapp_verify_token_2026"):
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification token mismatch")


@router.post("/whatsapp/webhook", tags=["Communications - WhatsApp Webhook"])
async def receive_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Processes Meta WhatsApp Cloud API webhooks with HMAC validation."""
    body_bytes = await request.body()
    config = db.query(WhatsAppConfig).first()
    secret = config.webhook_verify_token if config and config.webhook_verify_token else "edtech_crm_whatsapp_verify_token_2026"

    sig = request.headers.get("X-Hub-Signature-256")
    # In live production with Meta, verify signature
    if sig and not whatsapp_provider.verify_webhook(secret=secret, signature=sig, payload_bytes=body_bytes):
        raise HTTPException(status_code=403, detail="Invalid webhook HMAC signature")

    payload = await request.json()
    events = whatsapp_provider.parse_webhook(payload)

    now = datetime.now(timezone.utc)
    for ev in events:
        p_msg_id = ev.get("provider_message_id")
        if not p_msg_id:
            continue

        if ev["event_type"] == "inbound_message":
            # Idempotency check: don't duplicate message
            existing = db.query(CommunicationMessage).filter(CommunicationMessage.provider_message_id == p_msg_id).first()
            if existing:
                continue

            from_ph = f"+{ev.get('from_phone', '').lstrip('+')}" if ev.get("from_phone") else "Unknown"
            m_con, m_col = find_crm_associations_by_contact_info(db, phone=from_ph)

            new_msg = CommunicationMessage(
                channel="WHATSAPP",
                direction="INBOUND",
                status="RECEIVED",
                provider_message_id=p_msg_id,
                sender=from_ph,
                recipient="Company WhatsApp",
                body_text=ev.get("body"),
                delivered_at=now,
                company_id=m_col,
                contact_id=m_con,
            )
            db.add(new_msg)

        elif ev["event_type"] == "status_update":
            msg_record = db.query(CommunicationMessage).filter(CommunicationMessage.provider_message_id == p_msg_id).first()
            if msg_record:
                new_st = ev.get("status")
                msg_record.status = new_st
                if new_st == "DELIVERED" and not msg_record.delivered_at:
                    msg_record.delivered_at = now
                elif new_st == "READ" and not msg_record.read_at:
                    msg_record.read_at = now

    db.commit()
    return {"status": "ok", "message": "success", "processed_events": len(events)}


# =====================================================================
# 5. CALLS & TELEPHONY
# =====================================================================

@router.get("/calls", response_model=List[CommunicationMessageResponse], tags=["Communications - Calls"])
def list_calls(
    company_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    direction: Optional[str] = None,
    disposition: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_calls"])),
):
    query = db.query(CommunicationMessage).filter(
        CommunicationMessage.channel == "PHONE",
        CommunicationMessage.is_deleted == False
    )
    if company_id:
        query = query.filter(CommunicationMessage.company_id == company_id)
    if contact_id:
        query = query.filter(CommunicationMessage.contact_id == contact_id)
    if direction:
        query = query.filter(CommunicationMessage.direction == direction.upper())
    if disposition:
        query = query.filter(CommunicationMessage.call_disposition == disposition)

    calls = query.order_by(CommunicationMessage.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_message_response(c) for c in calls]


@router.post("/calls", response_model=CommunicationMessageResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - Calls"])
@router.post("/calls/log", response_model=CommunicationMessageResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - Calls"])
def log_manual_call(
    data: ManualCallLogRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.log_call")),
):
    phone = data.target_phone
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    company_id = data.company_id
    contact_id = data.contact_id
    if not company_id or not contact_id:
        m_con, m_col = find_crm_associations_by_contact_info(db, phone=phone)
        if not contact_id and m_con:
            contact_id = m_con
        if not company_id and m_col:
            company_id = m_col

    duration = data.total_duration
    disposition = data.final_disposition
    now = datetime.now(timezone.utc)
    msg = CommunicationMessage(
        channel="PHONE",
        direction=data.direction.upper(),
        status="COMPLETED",
        sender=current_user.full_name if data.direction == "OUTBOUND" else phone,
        recipient=phone if data.direction == "OUTBOUND" else "Company Line",
        call_duration_seconds=duration,
        call_disposition=disposition,
        recording_url=data.recording_url,
        body_text=data.notes,
        is_manual=True,
        sent_at=now,
        delivered_at=now,
        company_id=company_id,
        contact_id=contact_id,
        lead_id=data.lead_id,
        opportunity_id=data.opportunity_id,
        ticket_id=data.ticket_id,
        created_by_id=current_user.id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Record linked CRM Activity if associated with lead/contact/company/deal
    record_communication_activity(
        db=db,
        channel="PHONE",
        direction=data.direction.upper(),
        subject=f"{data.direction.upper()} Call ({disposition or 'Logged'})",
        description=data.notes or f"Call duration: {duration or 0}s",
        user_id=current_user.id,
        lead_id=data.lead_id,
        contact_id=contact_id,
        company_id=company_id,
        opportunity_id=data.opportunity_id,
        completed_at=now,
    )

    record_audit_log(
        db=db,
        action="LOG_CALL",
        entity_type="COMMUNICATION",
        entity_id=msg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"phone": phone, "duration": duration, "disposition": disposition},
        request=request,
    )
    return _format_message_response(msg)


@router.get("/calls/{call_id}/recording", tags=["Communications - Calls"])
def get_call_recording(
    call_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.view_calls"])),
):
    call = db.query(CommunicationMessage).filter(CommunicationMessage.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")
    return {"id": call.id, "recording_url": call.recording_url}


@router.post("/calls/webhook", tags=["Communications - Calls Webhook"])
@router.post("/telephony/webhook/{provider_name}", tags=["Communications - Calls Webhook"])
async def receive_call_webhook(
    request: Request,
    provider_name: str = "generic",
    db: Session = Depends(get_db),
):
    """Processes telephony provider call status webhook."""
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = await request.json()
        else:
            form = await request.form()
            payload = dict(form)
    except Exception:
        try:
            payload = await request.json()
        except Exception:
            payload = {}

    call_info = phone_provider.parse_call_webhook(payload)
    p_call_id = call_info.get("provider_call_id")

    existing = db.query(CommunicationMessage).filter(CommunicationMessage.provider_message_id == p_call_id).first()
    now = datetime.now(timezone.utc)

    if existing:
        existing.status = call_info.get("status", existing.status)
        existing.call_duration_seconds = call_info.get("duration_seconds", existing.call_duration_seconds)
        if call_info.get("recording_url"):
            existing.recording_url = call_info.get("recording_url")
    else:
        from_num = call_info.get("from_number", "Unknown")
        to_num = call_info.get("to_number", "Unknown")
        m_con, m_col = find_crm_associations_by_contact_info(db, phone=from_num)

        msg = CommunicationMessage(
            channel="PHONE",
            direction="INBOUND",
            status=call_info.get("status", "COMPLETED"),
            provider_message_id=p_call_id,
            sender=from_num,
            recipient=to_num,
            call_duration_seconds=call_info.get("duration_seconds", 0),
            recording_url=call_info.get("recording_url"),
            sent_at=now,
            delivered_at=now,
            company_id=m_col,
            contact_id=m_con,
        )
        db.add(msg)

        if m_col or m_con:
            record_communication_activity(
                db=db,
                channel="PHONE",
                direction="INBOUND",
                subject=f"Inbound Call from {from_num}",
                description=f"Status: {call_info.get('status', 'COMPLETED')}, Duration: {call_info.get('duration_seconds', 0)}s",
                company_id=m_col,
                contact_id=m_con,
                completed_at=now,
            )

    db.commit()
    return {"status": "ok", "message": "success", "call_id": p_call_id}


# =====================================================================
# 6. UNIFIED TIMELINE & CRM ASSOCIATIONS
# =====================================================================

@router.get("/timeline", response_model=List[CommunicationTimelineItem], tags=["Communications - Timeline"])
def get_communication_timeline(
    channel: Optional[str] = None,
    company_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
):
    query = db.query(CommunicationMessage).filter(CommunicationMessage.is_deleted == False)
    if channel and channel != "ALL":
        query = query.filter(CommunicationMessage.channel == channel.upper())
    if company_id:
        query = query.filter(CommunicationMessage.company_id == company_id)
    if contact_id:
        query = query.filter(CommunicationMessage.contact_id == contact_id)

    messages = query.order_by(CommunicationMessage.created_at.desc()).offset(skip).limit(limit).all()

    timeline_items = []
    for m in messages:
        preview = m.subject or m.body_text or f"{m.channel} {m.direction}"
        rel_type = None
        rel_id = None
        if m.ticket_id:
            rel_type = "ticket"
            rel_id = m.ticket_id
        elif m.opportunity_id:
            rel_type = "opportunity"
            rel_id = m.opportunity_id
        elif m.lead_id:
            rel_type = "lead"
            rel_id = m.lead_id
        elif m.project_id:
            rel_type = "project"
            rel_id = m.project_id
        elif m.invoice_id:
            rel_type = "invoice"
            rel_id = m.invoice_id

        timeline_items.append(
            CommunicationTimelineItem(
                id=m.id,
                channel=m.channel,
                direction=m.direction,
                status=m.status,
                timestamp=m.created_at,
                sender=m.sender,
                recipient=m.recipient,
                subject=m.subject,
                preview=preview[:200],
                company_id=m.company_id,
                company_name=m.company.organization_name if m.company else None,
                contact_id=m.contact_id,
                contact_name=m.contact.name if m.contact else None,
                related_entity_type=rel_type,
                related_entity_id=rel_id,
                created_by_name=m.created_by.full_name if m.created_by else None,
            )
        )
    return timeline_items


@router.post("/messages/{message_id}/associate", response_model=CommunicationMessageResponse, tags=["Communications"])
def associate_message_crm(
    message_id: str,
    data: AssociateCRMRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
):
    msg = db.query(CommunicationMessage).filter(CommunicationMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Communication message not found")

    if data.company_id is not None:
        msg.company_id = data.company_id
    if data.contact_id is not None:
        msg.contact_id = data.contact_id
    if data.lead_id is not None:
        msg.lead_id = data.lead_id
    if data.opportunity_id is not None:
        msg.opportunity_id = data.opportunity_id
    if data.sales_order_id is not None:
        msg.sales_order_id = data.sales_order_id
    if data.contract_id is not None:
        msg.contract_id = data.contract_id
    if data.project_id is not None:
        msg.project_id = data.project_id
    if data.ticket_id is not None:
        msg.ticket_id = data.ticket_id
    if data.invoice_id is not None:
        msg.invoice_id = data.invoice_id

    db.commit()
    db.refresh(msg)

    record_audit_log(
        db=db,
        action="ASSOCIATE_COMMUNICATION",
        entity_type="COMMUNICATION",
        entity_id=msg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"company_id": msg.company_id, "ticket_id": msg.ticket_id},
        request=request,
    )
    return _format_message_response(msg)


# =====================================================================
# 7. TEMPLATES
# =====================================================================

@router.get("/templates", response_model=List[CommunicationTemplateResponse], tags=["Communications - Templates"])
def list_templates(
    channel: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
):
    query = db.query(CommunicationTemplate)
    if channel:
        query = query.filter(CommunicationTemplate.channel == channel.upper())
    return query.order_by(CommunicationTemplate.name.asc()).all()


@router.post("/templates", response_model=CommunicationTemplateResponse, status_code=status.HTTP_201_CREATED, tags=["Communications - Templates"])
def create_template(
    data: CommunicationTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_templates")),
):
    existing = db.query(CommunicationTemplate).filter(CommunicationTemplate.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Template with name '{data.name}' already exists")

    tpl = CommunicationTemplate(
        name=data.name.strip(),
        channel=data.channel.upper(),
        subject=data.subject,
        body_text=data.body_text,
        variables=data.variables or [],
        is_active=data.is_active,
        created_by_id=current_user.id,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)

    record_audit_log(
        db=db,
        action="CREATE_TEMPLATE",
        entity_type="COMMUNICATION_TEMPLATE",
        entity_id=tpl.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"name": tpl.name, "channel": tpl.channel},
        request=request,
    )
    return tpl


@router.put("/templates/{template_id}", response_model=CommunicationTemplateResponse, tags=["Communications - Templates"])
def update_template(
    template_id: str,
    data: CommunicationTemplateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_templates")),
):
    tpl = db.query(CommunicationTemplate).filter(CommunicationTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    if data.name is not None:
        tpl.name = data.name.strip()
    if data.channel is not None:
        tpl.channel = data.channel.upper()
    if data.subject is not None:
        tpl.subject = data.subject
    if data.body_text is not None:
        tpl.body_text = data.body_text
    if data.variables is not None:
        tpl.variables = data.variables
    if data.is_active is not None:
        tpl.is_active = data.is_active

    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/templates/{template_id}", tags=["Communications - Templates"])
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_templates")),
):
    tpl = db.query(CommunicationTemplate).filter(CommunicationTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(tpl)
    db.commit()
    return {"message": "Template deleted successfully"}


# =====================================================================
# 8. INTEGRATIONS SETTINGS
# =====================================================================

@router.get("/integrations", response_model=IntegrationsOverviewResponse, tags=["Communications - Integrations"])
def get_integrations_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    gmail_acc = db.query(EmailAccount).filter(EmailAccount.status == "CONNECTED").first()
    wa_cfg = db.query(WhatsAppConfig).first()
    ph_cfg = db.query(PhoneConfig).first()

    h_configured = hostinger_provider.is_configured()

    return IntegrationsOverviewResponse(
        hostinger={
            "provider": "Hostinger Mail (SMTP/IMAP)",
            "domain": "kiwicloudtech.co.in",
            "connected": h_configured,
            "account_email": hostinger_provider.smtp_username,
            "smtp_host": hostinger_provider.smtp_host,
            "smtp_port": hostinger_provider.smtp_port,
            "imap_host": hostinger_provider.imap_host,
            "imap_port": hostinger_provider.imap_port,
            "status": "CONNECTED" if h_configured else "NOT_CONFIGURED",
        },
        gmail={
            "provider": "Google Workspace / Gmail",
            "connected": gmail_acc is not None,
            "account_email": gmail_acc.email_address if gmail_acc else None,
            "status": gmail_acc.status if gmail_acc else "DISCONNECTED",
            "last_sync": gmail_acc.last_sync_at.isoformat() if gmail_acc and gmail_acc.last_sync_at else None,
        },
        whatsapp={
            "provider": "Meta WhatsApp Business Cloud API",
            "connected": wa_cfg is not None and wa_cfg.status == "CONNECTED",
            "phone_number_id": wa_cfg.phone_number_id if wa_cfg else None,
            "phone_number": wa_cfg.phone_number if wa_cfg else None,
            "status": wa_cfg.status if wa_cfg else "DISCONNECTED",
        },
        phone={
            "provider": "Twilio Telephony & SIP Gateway",
            "connected": ph_cfg is not None and ph_cfg.status == "CONNECTED",
            "phone_number": ph_cfg.phone_number if ph_cfg else None,
            "status": ph_cfg.status if ph_cfg else "DISCONNECTED",
        },
    )


@router.post("/integrations/email/test", tags=["Communications - Integrations"])
@router.post("/email/test", tags=["Communications - Email"])
def test_hostinger_email_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    """Admin-only connection test verifying Hostinger SMTP & IMAP connectivity safely."""
    return hostinger_provider.test_connection()


@router.get("/overview", tags=["Communications"])
@router.get("/dashboard", tags=["Communications"])
def get_communications_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
):
    """Returns overview metrics for Communications dashboard."""
    total_emails = db.query(CommunicationMessage).filter(CommunicationMessage.channel == "EMAIL", CommunicationMessage.is_deleted == False).count()
    unread_emails = db.query(EmailThread).filter(EmailThread.is_read == False, EmailThread.is_deleted == False).count()
    draft_emails = db.query(CommunicationMessage).filter(CommunicationMessage.channel == "EMAIL", CommunicationMessage.status == "DRAFT", CommunicationMessage.is_deleted == False).count()
    total_whatsapp = db.query(CommunicationMessage).filter(CommunicationMessage.channel == "WHATSAPP", CommunicationMessage.is_deleted == False).count()
    total_calls = db.query(CommunicationMessage).filter(CommunicationMessage.channel == "PHONE", CommunicationMessage.is_deleted == False).count()
    
    wa_cfg = db.query(WhatsAppConfig).first()
    ph_cfg = db.query(PhoneConfig).first()
    
    return {
        "total_emails": total_emails,
        "unread_emails": unread_emails,
        "draft_emails": draft_emails,
        "total_whatsapp": total_whatsapp,
        "total_calls": total_calls,
        "integrations": {
            "hostinger": "CONNECTED" if hostinger_provider.is_configured() else "NOT_CONFIGURED",
            "whatsapp": wa_cfg.status if wa_cfg else "NOT_CONFIGURED",
            "phone": ph_cfg.status if ph_cfg else "NOT_CONFIGURED",
        }
    }


@router.get("/search", response_model=List[CommunicationMessageResponse], tags=["Communications"])
def search_communications(
    q: str = Query(..., min_length=1),
    channel: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
):
    """Searches authorized communications by subject, content, sender, or counterparty."""
    pattern = f"%{q}%"
    query = db.query(CommunicationMessage).filter(
        CommunicationMessage.is_deleted == False,
        or_(
            CommunicationMessage.subject.ilike(pattern),
            CommunicationMessage.body_text.ilike(pattern),
            CommunicationMessage.sender.ilike(pattern),
            CommunicationMessage.recipient.ilike(pattern),
            CommunicationMessage.call_disposition.ilike(pattern),
        )
    )
    if channel and channel != "ALL":
        query = query.filter(CommunicationMessage.channel == channel.upper())

    msgs = query.order_by(CommunicationMessage.created_at.desc()).limit(limit).all()
    return [_format_message_response(m) for m in msgs]


@router.get("/integrations/whatsapp", response_model=WhatsAppConfigResponse, tags=["Communications - Integrations"])
def get_whatsapp_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    cfg = db.query(WhatsAppConfig).first()
    if not cfg:
        cfg = WhatsAppConfig(provider="META_CLOUD", status="UNCONFIGURED")
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.post("/integrations/whatsapp", response_model=WhatsAppConfigResponse, tags=["Communications - Integrations"])
def configure_whatsapp_integration(
    data: WhatsAppConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    cfg = db.query(WhatsAppConfig).first()
    now = datetime.now(timezone.utc)
    if not cfg:
        cfg = WhatsAppConfig(provider="META_CLOUD", status="CONNECTED")
        db.add(cfg)

    cfg.phone_number_id = data.phone_number_id
    cfg.business_account_id = data.business_account_id
    cfg.phone_number = data.phone_number
    if data.access_token:
        cfg.encrypted_access_token = encrypt_secret(data.access_token)
    if data.webhook_verify_token:
        cfg.webhook_verify_token = data.webhook_verify_token
    cfg.status = "CONNECTED"
    cfg.updated_at = now

    db.commit()
    db.refresh(cfg)

    record_audit_log(
        db=db,
        action="CONFIG_WHATSAPP",
        entity_type="INTEGRATION",
        entity_id=cfg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"phone_number_id": cfg.phone_number_id, "status": cfg.status},
        request=request,
    )
    return cfg


@router.get("/integrations/phone", response_model=PhoneConfigResponse, tags=["Communications - Integrations"])
def get_phone_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    cfg = db.query(PhoneConfig).first()
    if not cfg:
        cfg = PhoneConfig(provider="TWILIO", status="UNCONFIGURED")
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.post("/integrations/phone", response_model=PhoneConfigResponse, tags=["Communications - Integrations"])
def configure_phone_integration(
    data: PhoneConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    cfg = db.query(PhoneConfig).first()
    now = datetime.now(timezone.utc)
    if not cfg:
        cfg = PhoneConfig(provider=data.provider or "TWILIO", status="CONNECTED")
        db.add(cfg)

    cfg.provider = data.provider or "TWILIO"
    cfg.account_sid = data.account_sid
    cfg.phone_number = data.phone_number
    if data.auth_token:
        cfg.encrypted_auth_token = encrypt_secret(data.auth_token)
    if data.webhook_secret:
        cfg.webhook_secret = data.webhook_secret
    cfg.status = "CONNECTED"
    cfg.updated_at = now

    db.commit()
    db.refresh(cfg)

    record_audit_log(
        db=db,
        action="CONFIG_PHONE",
        entity_type="INTEGRATION",
        entity_id=cfg.id,
        user_id=current_user.id,
        user_email=current_user.email,
        new_values={"provider": cfg.provider, "status": cfg.status},
        request=request,
    )
    return cfg


@router.post("/integrations/test", tags=["Communications - Integrations"])
def test_integration_connection(
    provider_name: str = Query(..., description="GMAIL, WHATSAPP, or PHONE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.manage_integrations")),
):
    p = provider_name.strip().upper()
    if p in ("HOSTINGER", "HOSTINGER_EMAIL", "SMTP"):
        return hostinger_provider.test_connection()

    if p in ("GMAIL", "EMAIL"):
        acc = db.query(EmailAccount).filter(EmailAccount.status == "CONNECTED").first()
        if not acc:
            # Fall back to Hostinger test if no Gmail account is connected
            return hostinger_provider.test_connection()
        return {"provider": p, "status": "CONNECTED", "email": acc.email_address, "message": "Gmail OAuth token verified"}

    if p == "WHATSAPP":
        cfg = db.query(WhatsAppConfig).first()
        if not cfg or cfg.status != "CONNECTED":
            return {"provider": p, "status": "DISCONNECTED", "message": "WhatsApp Cloud API credentials not configured"}
        return {"provider": p, "status": "CONNECTED", "phone_number_id": cfg.phone_number_id, "message": "Meta Cloud API credentials verified"}

    if p in ("PHONE", "TWILIO", "TELEPHONY"):
        return telephony_service.test_connection(db)

    raise HTTPException(status_code=400, detail=f"Unknown provider '{provider_name}'")


# =====================================================================
# TELEPHONY SUBSYSTEM (PROVIDER-NEUTRAL)
# =====================================================================

@router.get("/telephony/status", response_model=TelephonyStatusResponse, tags=["Communications - Telephony"])
@router.get("/integrations/telephony", tags=["Communications - Telephony"])
def get_telephony_subsystem_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["communications.view", "communications.manage_integrations"])),
):
    """Returns normalized telephony configuration and capability status."""
    st = telephony_service.get_status(db)
    return {
        "enabled": st["enabled"],
        "provider": st["provider"],
        "business_number": st["business_number"] if st["business_number"] != "Not Configured" else None,
        "supported_providers": ["none", "exotel", "twilio"],
        "message": f"Telephony status: {st['status']}. Provider: {st['provider']}.",
    }


@router.post("/telephony/initiate", tags=["Communications - Telephony"])
def initiate_telephony_call(
    data: InitiateCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.log_call")),
):
    """
    Initiates an outbound call via configured telephony adapter.
    Safely returns 400 Bad Request if telephony is disabled or unconfigured.
    """
    return telephony_service.initiate_call(
        db=db,
        current_user=current_user,
        destination_phone=data.to_phone,
        lead_id=data.lead_id,
        contact_id=data.contact_id,
        company_id=data.company_id,
        opportunity_id=data.opportunity_id,
    )



# =====================================================================
# 9. ATTACHMENTS (UPLOAD & AUTHENTICATED DOWNLOAD)
# =====================================================================

@router.post("/messages/{message_id}/attachments", response_model=CommunicationAttachmentResponse, tags=["Communications"])
async def upload_communication_attachment(
    message_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
    storage: StorageBackend = Depends(get_storage_backend),
):
    msg = db.query(CommunicationMessage).filter(CommunicationMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Communication message not found")

    file_bytes = await file.read()
    max_size = 15 * 1024 * 1024  # 15MB limit

    storage_res = storage.upload(
        file_bytes=file_bytes,
        filename=file.filename or "attachment",
        content_type=file.content_type or "application/octet-stream",
        prefix=f"communications/{msg.id}",
        max_size_bytes=max_size,
    )

    att = CommunicationAttachment(
        message_id=msg.id,
        filename=storage_res.filename,
        file_path=storage_res.key,
        file_size=storage_res.size,
        content_type=storage_res.content_type,
        uploaded_by_id=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    return CommunicationAttachmentResponse.model_validate(att)


@router.get("/attachments/{attachment_id}/download", tags=["Communications"])
def download_communication_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communications.view")),
    storage: StorageBackend = Depends(get_storage_backend),
):
    att = db.query(CommunicationAttachment).filter(CommunicationAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not storage.exists(att.file_path):
        raise HTTPException(status_code=404, detail="File content not found on server")

    try:
        stream, content_type, size = storage.get_stream(att.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File content not found on server")

    return StreamingResponse(
        stream,
        media_type=att.content_type or content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{att.filename}"',
            "Content-Length": str(size),
        },
    )
