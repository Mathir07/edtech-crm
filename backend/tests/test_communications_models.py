import pytest
from datetime import datetime, timezone
from app.core.crypto import encrypt_secret, decrypt_secret
from app.communication.models import (
    EmailAccount,
    EmailThread,
    CommunicationMessage,
    CommunicationTemplate,
    WhatsAppConfig,
    PhoneConfig,
    CommunicationAttachment,
)
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.users.models import User

def test_crypto_encryption_and_decryption():
    secret_token = "ya29.a0ARrdaM-sensitive_oauth_token_12345"
    encrypted = encrypt_secret(secret_token)
    assert encrypted is not None
    assert encrypted != secret_token
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret_token

def test_crypto_none_handling():
    assert encrypt_secret(None) is None
    assert decrypt_secret(None) is None

def test_communication_template_model(db_session):
    admin_user = db_session.query(User).filter(User.email == "test.admin@edtechcrm.com").first()
    template = CommunicationTemplate(
        name="Semester Exam Notification",
        channel="email",
        subject="Upcoming Exams for {{company_name}}",
        body_text="Dear {{contact_name}}, your exams will begin on {{exam_date}}.",
        variables={"company_name": "string", "contact_name": "string", "exam_date": "string"},
        created_by_id=admin_user.id if admin_user else None
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    assert template.id is not None
    assert template.name == "Semester Exam Notification"
    assert template.channel == "email"
    assert template.is_active is True
    assert "company_name" in template.variables

def test_whatsapp_and_phone_configs(db_session):
    wa_config = WhatsAppConfig(
        provider="meta",
        phone_number_id="10987654321",
        business_account_id="9876543210",
        phone_number="+919876543210",
        encrypted_access_token=encrypt_secret("meta_access_token_super_secret"),
        webhook_verify_token="custom_verify_token_123",
        status="configured"
    )
    phone_config = PhoneConfig(
        provider="twilio",
        account_sid="AC1234567890abcdef",
        phone_number="+18005550199",
        encrypted_auth_token=encrypt_secret("twilio_auth_token_secret"),
        status="configured"
    )
    db_session.add_all([wa_config, phone_config])
    db_session.commit()

    db_session.refresh(wa_config)
    db_session.refresh(phone_config)

    assert wa_config.id is not None
    assert decrypt_secret(wa_config.encrypted_access_token) == "meta_access_token_super_secret"
    assert phone_config.id is not None
    assert decrypt_secret(phone_config.encrypted_auth_token) == "twilio_auth_token_secret"

def test_email_thread_and_messages_polymorphic(db_session):
    admin_user = db_session.query(User).filter(User.email == "test.admin@edtechcrm.com").first()
    college = Company(
        organization_name="PSG Tech Communications Lab",
        code="PSGTECH-COMM",
        state="Tamil Nadu",
        city="Coimbatore",
        status="active"
    )
    db_session.add(college)
    db_session.flush()

    contact = Contact(
        company_id=college.id,
        name="Dr. Sundar Rajan",
        email="sundar.rajan@psgtech.ac.in",
        phone="+919443322110",
        is_primary=True
    )
    db_session.add(contact)
    db_session.flush()

    account = EmailAccount(
        user_id=admin_user.id,
        email_address="edtech.admin@company.com",
        account_name="Official EdTech Support",
        provider="google",
        status="connected",
        encrypted_access_token=encrypt_secret("google_access_token"),
        encrypted_refresh_token=encrypt_secret("google_refresh_token"),
    )
    db_session.add(account)
    db_session.flush()

    thread = EmailThread(
        provider_thread_id="th_psg_101",
        email_account_id=account.id,
        subject="Regarding LMS Platform Integration",
        snippet="Thank you for the proposal. We would like to proceed...",
        company_id=college.id,
        contact_id=contact.id,
        message_count=1,
        is_read=True
    )
    db_session.add(thread)
    db_session.flush()

    message = CommunicationMessage(
        channel="email",
        direction="outbound",
        sender="edtech.admin@company.com",
        recipient="sundar.rajan@psgtech.ac.in",
        subject="Regarding LMS Platform Integration",
        body_text="Dear Dr. Sundar, Attached is the SLA contract for the LMS integration.",
        status="delivered",
        provider_message_id="msg_psg_out_001",
        provider_thread_id="th_psg_101",
        email_account_id=account.id,
        thread_id=thread.id,
        company_id=college.id,
        contact_id=contact.id,
        created_by_id=admin_user.id if admin_user else None
    )
    db_session.add(message)
    db_session.flush()

    attachment = CommunicationAttachment(
        message_id=message.id,
        filename="LMS_Integration_SLA.pdf",
        content_type="application/pdf",
        file_size=204800,
        file_path="communications/attachments/psg_sla.pdf"
    )
    db_session.add(attachment)
    db_session.commit()

    db_session.refresh(thread)
    db_session.refresh(message)
    assert len(message.attachments) == 1
    assert message.attachments[0].filename == "LMS_Integration_SLA.pdf"
    assert message.company_id == college.id
    assert message.contact_id == contact.id
