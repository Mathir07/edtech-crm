import pytest
from app.organizations.models import Company, Contact
from app.communication.models import CommunicationMessage

def test_manual_call_logging(client, admin_headers, db_session):
    college = Company(organization_name="SRM Institute", code="SRM-UNIV", state="Tamil Nadu", city="Chennai")
    db_session.add(college)
    db_session.flush()

    contact = Contact(
        company_id=college.id,
        name="Prof. Balaji V",
        email="balaji.v@srmist.edu.in",
        phone="+919940112233",
        is_primary=True
    )
    db_session.add(contact)
    db_session.commit()

    # Log a phone call
    res = client.post(
        "/api/v1/communications/calls/log",
        json={
            "recipient": "+919940112233",
            "direction": "outbound",
            "call_disposition": "connected",
            "duration_seconds": 345,
            "notes": "Discussed semester ERP license renewal and technical training dates.",
            "company_id": college.id,
            "contact_id": contact.id,
            "recording_url": "https://storage.edtechcrm.com/recordings/call_rec_098.mp3"
        },
        headers=admin_headers
    )
    assert res.status_code == 201, res.text
    call_data = res.json()
    assert call_data["channel"].lower() == "phone"
    assert call_data["call_disposition"].lower() == "connected"
    assert call_data["call_duration_seconds"] == 345
    assert call_data["company_id"] == college.id
    assert call_data["contact_id"] == contact.id
    call_id = call_data["id"]

    # Verify call in listing
    calls_res = client.get("/api/v1/communications/calls", headers=admin_headers)
    assert calls_res.status_code == 200
    calls_list = calls_res.json()
    assert len(calls_list) >= 1
    found = next(c for c in calls_list if c["id"] == call_id)
    assert found["call_disposition"] == "connected"

    # Verify recording reference endpoint
    rec_res = client.get(f"/api/v1/communications/calls/{call_id}/recording", headers=admin_headers)
    assert rec_res.status_code == 200
    assert rec_res.json()["recording_url"] == "https://storage.edtechcrm.com/recordings/call_rec_098.mp3"

def test_telephony_webhook_status_update(client, admin_headers, db_session):
    # First create an in-progress call
    call = CommunicationMessage(
        channel="phone",
        direction="inbound",
        sender="+919988776655",
        recipient="+18005550199",
        status="in-progress",
        provider_message_id="CA_test_call_sid_12345"
    )
    db_session.add(call)
    db_session.commit()

    # Webhook callback from provider
    res = client.post(
        "/api/v1/communications/calls/webhook",
        data={
            "CallSid": "CA_test_call_sid_12345",
            "CallStatus": "completed",
            "CallDuration": "182",
            "RecordingUrl": "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123"
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    db_session.refresh(call)
    assert call.status.lower() == "completed"
    assert call.call_duration_seconds == 182
    assert "RE123" in call.recording_url
