import pytest
from app.organizations.models import Company, Contact
from app.communication.models import CommunicationTemplate, CommunicationMessage

def test_whatsapp_send_and_template_interpolation(client, admin_headers, db_session):
    college = Company(organization_name="Anna University Center", code="ANNA-UNIV", state="Tamil Nadu", city="Chennai")
    db_session.add(college)
    db_session.flush()

    contact = Contact(
        company_id=college.id,
        name="Priya Natarajan",
        email="priya@annauniv.edu",
        phone="+919876543299",
        is_primary=True
    )
    db_session.add(contact)
    db_session.commit()

    # Create Template
    tpl_res = client.post(
        "/api/v1/communications/templates",
        json={
            "name": "Ticket Resolution Update",
            "channel": "whatsapp",
            "body_text": "Hello {{contact_name}}, your ticket #{{ticket_id}} for {{company_name}} has been updated to {{status}}.",
            "variables": {"contact_name": "string", "ticket_id": "string", "company_name": "string", "status": "string"}
        },
        headers=admin_headers
    )
    assert tpl_res.status_code == 201
    tpl_id = tpl_res.json()["id"]

    # Send with full variables
    send_res = client.post(
        "/api/v1/communications/whatsapp/send",
        json={
            "recipient": "+919876543299",
            "template_id": tpl_id,
            "template_variables": {
                "contact_name": "Priya",
                "ticket_id": "TKT-2026-999",
                "company_name": "Anna University",
                "status": "Resolved"
            },
            "company_id": college.id,
            "contact_id": contact.id
        },
        headers=admin_headers
    )
    assert send_res.status_code == 201, send_res.text
    msg = send_res.json()
    assert msg["channel"].lower() == "whatsapp"
    assert "Hello Priya, your ticket #TKT-2026-999" in msg["body_text"]
    assert "Resolved." in msg["body_text"]
    assert msg["status"].lower() in ["sent", "delivered"]

def test_whatsapp_template_missing_variables_fails(client, admin_headers, db_session):
    tpl_res = client.post(
        "/api/v1/communications/templates",
        json={
            "name": "Payment Reminder",
            "channel": "whatsapp",
            "body_text": "Greetings {{contact_name}}, your invoice {{invoice_number}} of amount {{amount}} is due on {{due_date}}.",
        },
        headers=admin_headers
    )
    assert tpl_res.status_code == 201
    tpl_id = tpl_res.json()["id"]

    # Omit amount and due_date
    send_res = client.post(
        "/api/v1/communications/whatsapp/send",
        json={
            "recipient": "+919876543299",
            "template_id": tpl_id,
            "template_variables": {
                "contact_name": "Priya",
                "invoice_number": "INV-2026-001"
            }
        },
        headers=admin_headers
    )
    assert send_res.status_code == 400
    assert "Unresolved template variables" in send_res.json()["detail"] or "Missing" in send_res.json()["detail"]

def test_whatsapp_webhook_challenge(client):
    # Verify token challenge response
    res = client.get("/api/v1/communications/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test_challenge_abc_123&hub.verify_token=edtech_crm_verify_token")
    assert res.status_code == 200
    assert res.text == "test_challenge_abc_123"

def test_whatsapp_webhook_inbound_message(client, db_session):
    college = Company(organization_name="Kumaraguru Tech", code="KCT-CAMPUS", state="Tamil Nadu", city="Coimbatore")
    db_session.add(college)
    db_session.flush()

    contact = Contact(
        company_id=college.id,
        name="Ramesh Kannan",
        email="ramesh@kct.ac.in",
        phone="+919842112233",
        is_primary=True
    )
    db_session.add(contact)
    db_session.commit()

    webhook_payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919842112233",
                        "id": "wamid.HBgMOTE5ODQyMTEyMjMzFQIAERgSQURBMzY1RDM3ODEx",
                        "text": {"body": "Hi, we need to schedule student onboarding next week."}
                    }]
                }
            }]
        }]
    }

    res = client.post("/api/v1/communications/whatsapp/webhook", json=webhook_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # Verify message was stored and auto-associated to Ramesh & Kumaraguru Tech
    msg = db_session.query(CommunicationMessage).filter(
        CommunicationMessage.sender == "+919842112233"
    ).first()
    assert msg is not None
    assert msg.channel.lower() == "whatsapp"
    assert msg.direction.lower() == "inbound"
    assert msg.company_id == college.id
    assert msg.contact_id == contact.id
    assert "schedule student onboarding" in msg.body_text
