import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

from app.core.config import settings
from app.users.models import User
from app.crm.models import Lead
from app.organizations.models import Company, Contact
from app.activities.models import Activity
from app.communication.models import CommunicationMessage, EmailAccount
from app.communication.providers.hostinger import HostingerEmailProvider
from app.communication.telephony import telephony_service, NoneTelephonyAdapter
from app.communication.services import record_communication_activity, sync_hostinger_emails


# =====================================================================
# STEP 1A: HOSTINGER EMAIL TESTS
# =====================================================================

def test_hostinger_unconfigured_fails_safely():
    """When credentials are empty, is_configured() is False and send_email raises without fake delivery."""
    provider = HostingerEmailProvider(
        smtp_host="smtp.hostinger.com",
        smtp_port=465,
        smtp_username="",
        smtp_password="",
        imap_host="imap.hostinger.com",
        imap_port=993,
        imap_username="",
        imap_password="",
    )
    assert not provider.is_configured()

    # Connection test returns safe NOT_CONFIGURED status
    conn_res = provider.test_connection()
    assert conn_res["status"] == "NOT_CONFIGURED"
    assert "password" not in str(conn_res).lower()

    # Sending email raises RuntimeError and does not pretend success
    with pytest.raises(RuntimeError) as exc_info:
        provider.send_email(
            from_email="info@kiwicloudtech.co.in",
            to_email="client@example.com",
            subject="Test",
            body_text="Body",
        )
    assert "not configured" in str(exc_info.value).lower()


def test_hostinger_sync_emails_idempotency_and_crm_activity(db_session):
    """sync_hostinger_emails parses messages, skips duplicates, and creates CRM Activity."""
    # Create Lead
    lead = Lead(
        title="Hostinger Sync Prospect",
        contact_name="Ramesh Kumar",
        contact_email="ramesh@kiwicloudtech.co.in",
        contact_phone="+919876543210",
        status="New",
    )
    db_session.add(lead)
    db_session.commit()

    mock_provider = MagicMock()
    mock_provider.is_configured.return_value = True
    mock_provider.smtp_username = "info@kiwicloudtech.co.in"
    mock_provider.sync_messages.return_value = [
        {
            "provider_message_id": "<msg_hostinger_unique_001@hostinger.com>",
            "from": "ramesh@kiwicloudtech.co.in",
            "to": "info@kiwicloudtech.co.in",
            "subject": "Inquiry regarding CRM software",
            "body_text": "Please share pricing details.",
            "body_html": "<p>Please share pricing details.</p>",
            "date": datetime.now(timezone.utc),
        }
    ]

    # First sync
    res1 = sync_hostinger_emails(db=db_session, provider=mock_provider, max_messages=10)
    assert res1["synced_count"] == 1
    assert res1["skipped"] == 0

    # Verify message in DB
    msg = db_session.query(CommunicationMessage).filter(
        CommunicationMessage.provider_message_id == "<msg_hostinger_unique_001@hostinger.com>"
    ).first()
    assert msg is not None
    assert msg.lead_id == lead.id
    assert msg.channel == "EMAIL"
    assert msg.direction == "INBOUND"

    # Verify Activity recorded and lead.last_activity_at updated
    act = db_session.query(Activity).filter(
        Activity.related_entity_type == "lead",
        Activity.related_entity_id == lead.id,
        Activity.type == "Email",
    ).first()
    assert act is not None
    assert "Inquiry regarding CRM software" in act.subject

    db_session.refresh(lead)
    assert lead.last_activity_at is not None

    # Second sync (idempotency check: should be skipped)
    res2 = sync_hostinger_emails(db=db_session, provider=mock_provider, max_messages=10)
    assert res2["synced_count"] == 0
    assert res2["skipped"] == 1


# =====================================================================
# STEP 1B: PROVIDER-NEUTRAL TELEPHONY TESTS
# =====================================================================

def test_telephony_status_disabled_by_default(client, admin_headers):
    """GET /api/v1/communications/telephony/status returns disabled/none status."""
    res = client.get("/api/v1/communications/telephony/status", headers=admin_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["enabled"] is False
    assert data["provider"] in ("none", "Not Configured")
    assert "supported_providers" in data
    assert "exotel" in data["supported_providers"]
    assert "twilio" in data["supported_providers"]


def test_telephony_initiate_fails_gracefully_when_disabled(client, admin_headers):
    """POST /api/v1/communications/telephony/initiate returns 400 with graceful message."""
    res = client.post(
        "/api/v1/communications/telephony/initiate",
        json={"to_phone": "+919876543210"},
        headers=admin_headers,
    )
    assert res.status_code == 400
    detail = res.json().get("detail", "")
    assert "telephony" in detail.lower()
    assert "not configured" in detail.lower()


def test_telephony_test_connection_endpoint(client, admin_headers):
    """Testing telephony integration connection returns DISCONNECTED safely without 500."""
    res = client.post(
        "/api/v1/communications/integrations/test?provider_name=TELEPHONY",
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DISCONNECTED"
    assert "disabled" in data["message"].lower() or "not configured" in data["message"].lower()


def test_manual_call_logging_records_crm_activity(client, admin_headers, db_session):
    """POST /api/v1/communications/calls/log creates Activity record and updates Lead last_activity_at."""
    lead = Lead(
        title="Telephony Manual Call Prospect",
        contact_name="Sunil Joshi",
        contact_email="sunil@example.com",
        contact_phone="+919123456780",
        status="In Progress",
    )
    db_session.add(lead)
    db_session.commit()

    res = client.post(
        "/api/v1/communications/calls/log",
        json={
            "phone_number": "+919123456780",
            "direction": "OUTBOUND",
            "call_disposition": "CONNECTED",
            "duration_seconds": 120,
            "notes": "Discussed implementation schedule with Sunil.",
            "lead_id": lead.id,
        },
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text

    # Verify Activity created
    act = db_session.query(Activity).filter(
        Activity.related_entity_type == "lead",
        Activity.related_entity_id == lead.id,
        Activity.type == "Call",
    ).first()
    assert act is not None
    assert "OUTBOUND Call" in act.subject

    db_session.refresh(lead)
    assert lead.last_activity_at is not None
