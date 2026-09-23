import pytest
from app.users.models import User, Role, Permission
from app.core.security import get_password_hash, create_access_token

@pytest.fixture
def comms_restricted_headers(db_session):
    # Role with only college view permission, zero communications permissions
    perm = db_session.query(Permission).filter(Permission.code == "crm.companies.view").first()
    role = Role(name="Restricted Communications Viewer", description="No Comms Access")
    role.permissions = [perm]
    db_session.add(role)
    db_session.flush()

    user = User(
        email="restricted.user@edtechcrm.com",
        hashed_password=get_password_hash("SecretPass123"),
        first_name="Restricted",
        last_name="User",
        is_active=True
    )
    user.roles = [role]
    db_session.add(user)
    db_session.commit()

    token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"Authorization": f"Bearer {token}"}

def test_unauthenticated_requests_fail(client):
    assert client.get("/api/v1/communications/timeline").status_code == 401
    assert client.get("/api/v1/communications/email/threads").status_code == 401
    assert client.post("/api/v1/communications/email/send", json={}).status_code == 401
    assert client.post("/api/v1/communications/whatsapp/send", json={}).status_code == 401
    assert client.post("/api/v1/communications/calls/log", json={}).status_code == 401

def test_unauthorized_user_forbidden(client, comms_restricted_headers):
    # Timeline
    res = client.get("/api/v1/communications/timeline", headers=comms_restricted_headers)
    assert res.status_code == 403

    # Send email
    res = client.post(
        "/api/v1/communications/email/send",
        json={"recipient": "test@college.edu", "subject": "Test", "body_text": "Test"},
        headers=comms_restricted_headers
    )
    assert res.status_code == 403

    # Send WhatsApp
    res = client.post(
        "/api/v1/communications/whatsapp/send",
        json={"recipient": "+919876543210", "message_text": "Hello"},
        headers=comms_restricted_headers
    )
    assert res.status_code == 403

    # Manage Integrations
    res = client.post(
        "/api/v1/communications/integrations/whatsapp",
        json={"provider": "meta", "phone_number_id": "123"},
        headers=comms_restricted_headers
    )
    assert res.status_code == 403

def test_sensitive_tokens_redacted_at_rest_and_transit(client, admin_headers):
    # Configure WhatsApp with secret token
    save_res = client.post(
        "/api/v1/communications/integrations/whatsapp",
        json={
            "provider": "meta",
            "phone_number_id": "1234567890",
            "business_account_id": "9876543210",
            "phone_number": "+919876543210",
            "access_token": "EAAX_super_confidential_meta_key_456",
            "webhook_verify_token": "edtech_crm_verify_token"
        },
        headers=admin_headers
    )
    assert save_res.status_code == 200, save_res.text
    saved_data = save_res.json()
    assert "encrypted_access_token" not in saved_data
    assert "EAAX_super_confidential" not in str(saved_data)

    # Fetching the integration details
    get_res = client.get("/api/v1/communications/integrations/whatsapp", headers=admin_headers)
    assert get_res.status_code == 200
    config_data = get_res.json()
    assert "encrypted_access_token" not in config_data
    assert "EAAX_super_confidential" not in str(config_data)
