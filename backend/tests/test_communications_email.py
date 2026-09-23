from unittest.mock import patch
from app.communication.models import EmailAccount, EmailThread, CommunicationMessage
from app.organizations.models import Company, Contact
from app.communication.router import hostinger_provider

def test_email_account_management(client, admin_headers, db_session):
    # Connect/create an email account
    res = client.post(
        "/api/v1/communications/email/accounts",
        json={
            "email_address": "admissions@edtechpartners.edu",
            "account_name": "Admissions Inquiries",
            "provider": "google",
            "access_token": "simulated_oauth_access_token_123",
            "refresh_token": "simulated_oauth_refresh_token_123",
            "scopes": "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"
        },
        headers=admin_headers
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["email_address"] == "admissions@edtechpartners.edu"
    assert data["status"].lower() == "connected"
    account_id = data["id"]

    # Listing accounts should NEVER expose encrypted tokens
    list_res = client.get("/api/v1/communications/email/accounts", headers=admin_headers)
    assert list_res.status_code == 200
    accounts = list_res.json()
    assert len(accounts) >= 1
    found = next(a for a in accounts if a["id"] == account_id)
    assert "encrypted_access_token" not in found
    assert "encrypted_refresh_token" not in found

def test_send_email_outbound(client, admin_headers, db_session):
    college = Company(organization_name="Coimbatore Institute of Engineering", code="CIE-TECH", state="Tamil Nadu", city="Coimbatore")
    db_session.add(college)
    db_session.flush()

    contact = Contact(
        company_id=college.id,
        name="Dr. Arul Kumaran",
        email="arul.kumaran@cie.edu",
        phone="+919488112233",
        is_primary=True
    )
    db_session.add(contact)
    db_session.commit()

    # Send outbound email
    payload = {
        "recipient": "arul.kumaran@cie.edu",
        "subject": "Platform Architecture Demo Schedule",
        "body_text": "Hello Dr. Arul, We are pleased to confirm our engineering demo on Monday.",
        "company_id": college.id,
        "contact_id": contact.id
    }
    with patch.object(hostinger_provider, "send_email", return_value={
        "status": "SENT",
        "provider": "HOSTINGER",
        "provider_message_id": "<test_msg_001@hostinger.com>",
        "to": "arul.kumaran@cie.edu",
    }):
        res = client.post("/api/v1/communications/email/send", json=payload, headers=admin_headers)
    assert res.status_code == 201, res.text
    msg_data = res.json()
    assert msg_data["channel"].lower() == "email"
    assert msg_data["direction"].lower() == "outbound"
    assert msg_data["recipient"] == "arul.kumaran@cie.edu"
    assert msg_data["company_id"] == college.id
    assert msg_data["contact_id"] == contact.id
    assert msg_data["thread_id"] is not None

    # Verify thread was created and populated
    thread_res = client.get(f"/api/v1/communications/email/threads/{msg_data['thread_id']}", headers=admin_headers)
    assert thread_res.status_code == 200
    thread_data = thread_res.json()
    assert thread_data["subject"] == "Platform Architecture Demo Schedule"
    assert thread_data["company_id"] == college.id
    assert thread_data["message_count"] == 1

def test_sync_email_threads(client, admin_headers, db_session):
    # Trigger email sync
    res = client.post("/api/v1/communications/email/sync", headers=admin_headers)
    assert res.status_code == 200, res.text
    sync_result = res.json()
    assert "messages_synced" in sync_result
    assert sync_result["status"] == "completed"

def test_gmail_oauth_endpoints(client, admin_headers):
    # Initiate OAuth
    auth_res = client.get("/api/v1/communications/email/oauth/google", headers=admin_headers)
    assert auth_res.status_code == 200
    auth_data = auth_res.json()
    assert "authorization_url" in auth_data
    assert "google" in auth_data["authorization_url"].lower()

    # Simulate Callback
    callback_res = client.get(
        "/api/v1/communications/email/oauth/google/callback?code=mock_oauth_auth_code_789&state=mock_state",
        headers=admin_headers
    )
    assert callback_res.status_code == 200
    cb_data = callback_res.json()
    assert cb_data["status"].lower() == "connected"
    assert "email_address" in cb_data
