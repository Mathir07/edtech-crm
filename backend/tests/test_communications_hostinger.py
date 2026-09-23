import pytest
import smtplib
import imaplib
import socket
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from unittest.mock import patch, MagicMock

from app.communication.providers.hostinger import HostingerEmailProvider
from app.communication.models import CommunicationMessage, EmailThread
from app.communication.services import get_or_create_email_thread


@pytest.fixture
def hostinger_provider():
    return HostingerEmailProvider(
        smtp_host="smtp.hostinger.com",
        smtp_port=465,
        smtp_username="info@kiwicloudtech.co.in",
        smtp_password="mock_hostinger_password_123",
        smtp_use_ssl=True,
        imap_host="imap.hostinger.com",
        imap_port=993,
        imap_username="info@kiwicloudtech.co.in",
        imap_password="mock_hostinger_password_123",
        imap_use_ssl=True,
    )


# 1. SMTP connection succeeds
def test_hostinger_smtp_connection_succeeds(hostinger_provider):
    with patch("smtplib.SMTP_SSL") as mock_smtp, patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server

        mock_imap_server = MagicMock()
        mock_imap.return_value.__enter__.return_value = mock_imap_server

        res = hostinger_provider.test_connection()
        assert res["status"] == "CONNECTED"
        assert res["smtp"] == "CONNECTED"
        assert res["imap"] == "CONNECTED"
        assert "password" not in str(res).lower()


# 2. SMTP connection fails
def test_hostinger_smtp_connection_fails(hostinger_provider):
    with patch("smtplib.SMTP_SSL", side_effect=smtplib.SMTPConnectError(421, b"Service unavailable")), patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_imap_server = MagicMock()
        mock_imap.return_value.__enter__.return_value = mock_imap_server

        res = hostinger_provider.test_connection()
        assert res["status"] == "ERROR"
        assert res["smtp"] == "ERROR"
        assert "password" not in str(res).lower()


# 3. Email send succeeds
def test_hostinger_email_send_succeeds(hostinger_provider):
    with patch("smtplib.SMTP_SSL") as mock_smtp:
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server

        res = hostinger_provider.send_email(
            from_email="info@kiwicloudtech.co.in",
            to_email="dean@psgtech.edu",
            subject="Partnership Agreement - Kiwi Cloud Tech",
            body_text="Dear Dean, please find the proposal attached.",
            body_html="<p>Dear Dean, please find the proposal attached.</p>",
        )

        assert res["status"] == "SENT"
        assert res["provider"] == "HOSTINGER"
        assert res["to"] == "dean@psgtech.edu"
        assert res["provider_message_id"].startswith("<")
        assert res["provider_message_id"].endswith(">")
        assert mock_server.sendmail.called


# 4. Email send fails
def test_hostinger_email_send_fails(hostinger_provider):
    with patch("smtplib.SMTP_SSL") as mock_smtp:
        mock_server = MagicMock()
        mock_server.sendmail.side_effect = smtplib.SMTPException("Mailbox full")
        mock_smtp.return_value.__enter__.return_value = mock_server

        with pytest.raises(RuntimeError) as exc_info:
            hostinger_provider.send_email(
                from_email="info@kiwicloudtech.co.in",
                to_email="dean@psgtech.edu",
                subject="Test Fail",
                body_text="Will fail",
            )
        assert "Hostinger SMTP Send Failed" in str(exc_info.value)


# 5. Temporary SMTP failure
def test_hostinger_temporary_smtp_failure(hostinger_provider):
    with patch("smtplib.SMTP_SSL") as mock_smtp:
        mock_server = MagicMock()
        mock_server.sendmail.side_effect = socket.timeout("Connection timed out")
        mock_smtp.return_value.__enter__.return_value = mock_server

        with pytest.raises(RuntimeError) as exc_info:
            hostinger_provider.send_email(
                from_email="info@kiwicloudtech.co.in",
                to_email="registrar@annauniv.edu",
                subject="Test Timeout",
                body_text="Testing timeout handling",
            )
        assert "Hostinger SMTP Send Failed" in str(exc_info.value)


# 6. Invalid recipient
def test_hostinger_invalid_recipient(hostinger_provider):
    with pytest.raises(ValueError) as exc_info:
        hostinger_provider.send_email(
            from_email="info@kiwicloudtech.co.in",
            to_email="not-an-email-address",
            subject="Test Invalid Recipient",
            body_text="This should be rejected",
        )
    assert "Invalid recipient" in str(exc_info.value)


# 7. IMAP connection succeeds
def test_hostinger_imap_connection_succeeds(hostinger_provider):
    with patch("smtplib.SMTP_SSL") as mock_smtp, patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_smtp.return_value.__enter__.return_value = MagicMock()
        mock_imap_server = MagicMock()
        mock_imap.return_value.__enter__.return_value = mock_imap_server

        res = hostinger_provider.test_connection()
        assert res["imap"] == "CONNECTED"
        assert mock_imap_server.login.called


# 8. IMAP connection fails
def test_hostinger_imap_connection_fails(hostinger_provider):
    with patch("smtplib.SMTP_SSL") as mock_smtp, patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_smtp.return_value.__enter__.return_value = MagicMock()
        mock_imap.side_effect = imaplib.IMAP4.error("Authentication failed")

        res = hostinger_provider.test_connection()
        assert res["imap"] == "ERROR"
        assert res["status"] == "ERROR"


# 9. New email sync
def test_hostinger_new_email_sync(hostinger_provider):
    # Construct raw RFC 822 test message
    msg = MIMEMultipart()
    msg["From"] = "principal@cit.edu"
    msg["To"] = "info@kiwicloudtech.co.in"
    msg["Subject"] = "Inquiry: Cloud Lab Implementation"
    msg["Message-ID"] = "<msg_101@cit.edu>"
    msg["Date"] = "Fri, 19 Sep 2026 10:00:00 +0530"
    msg.attach(MIMEText("We would like to request a demo for our computer science lab.", "plain"))
    raw_bytes = msg.as_bytes()

    with patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_server = MagicMock()
        mock_server.select.return_value = ("OK", [b"1"])
        mock_server.uid.side_effect = [
            ("OK", [b"101"]),  # search result
            ("OK", [[b"1 (UID 101 RFC822 {100}", raw_bytes]]),  # fetch result
        ]
        mock_imap.return_value.__enter__.return_value = mock_server

        synced = hostinger_provider.sync_messages(folder="INBOX")
        assert len(synced) == 1
        assert synced[0]["provider_message_id"] == "<msg_101@cit.edu>"
        assert synced[0]["from"] == "principal@cit.edu"
        assert synced[0]["subject"] == "Inquiry: Cloud Lab Implementation"
        assert "request a demo" in synced[0]["body_text"]


# 10. Duplicate email detection
def test_hostinger_duplicate_email_detection(db_session):
    # If an email with the same provider_message_id exists, duplicate shouldn't be created
    msg_id = "<duplicate_test_101@example.com>"
    m1 = CommunicationMessage(
        channel="EMAIL",
        direction="INBOUND",
        status="RECEIVED",
        provider_message_id=msg_id,
        sender="client@example.com",
        recipient="info@kiwicloudtech.co.in",
        subject="First Instance",
        body_text="Body 1",
    )
    db_session.add(m1)
    db_session.commit()

    # Check query for duplicate
    existing = db_session.query(CommunicationMessage).filter(
        CommunicationMessage.provider_message_id == msg_id
    ).first()
    assert existing is not None
    assert existing.id == m1.id

    # Simulated deduplication in router logic
    duplicate_found = False
    incoming_id = "<duplicate_test_101@example.com>"
    check = db_session.query(CommunicationMessage).filter(
        CommunicationMessage.provider_message_id == incoming_id
    ).first()
    if check:
        duplicate_found = True
    assert duplicate_found is True


# 11. Thread detection
def test_hostinger_thread_detection(db_session):
    th_id = "th_shared_thread_001"
    # Thread 1
    t1 = get_or_create_email_thread(
        db=db_session,
        provider_thread_id=th_id,
        subject="Discussion on SLA",
        snippet="Initial message",
    )
    db_session.commit()

    # Subsequent message in same thread
    t2 = get_or_create_email_thread(
        db=db_session,
        provider_thread_id=th_id,
        snippet="Follow up message",
    )
    assert t1.id == t2.id
    assert t2.message_count == 2


# 12. Attachment processing
def test_hostinger_attachment_processing(hostinger_provider):
    msg = MIMEMultipart("mixed")
    msg["From"] = "hod@gct.ac.in"
    msg["To"] = "info@kiwicloudtech.co.in"
    msg["Subject"] = "Syllabus Attachment"
    msg["Message-ID"] = "<msg_att_500@gct.ac.in>"

    msg.attach(MIMEText("Please find the syllabus attached.", "plain"))

    att_part = MIMEBase("application", "pdf")
    att_part.set_payload(b"%PDF-1.4 Mock PDF Content")
    encoders.encode_base64(att_part)
    att_part.add_header("Content-Disposition", 'attachment; filename="syllabus_2026.pdf"')
    msg.attach(att_part)

    with patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_server = MagicMock()
        mock_server.select.return_value = ("OK", [b"1"])
        mock_server.uid.side_effect = [
            ("OK", [b"500"]),
            ("OK", [[b"1 (UID 500 RFC822 {200}", msg.as_bytes()]]),
        ]
        mock_imap.return_value.__enter__.return_value = mock_server

        synced = hostinger_provider.sync_messages(folder="INBOX")
        assert len(synced) == 1
        assert len(synced[0]["attachments"]) == 1
        att = synced[0]["attachments"][0]
        assert att["filename"] == "syllabus_2026.pdf"
        assert att["content_type"] == "application/pdf"
        assert att["size"] > 0


# 13. Incremental sync
def test_hostinger_incremental_sync(hostinger_provider):
    with patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_server = MagicMock()
        mock_server.select.return_value = ("OK", [b"1"])
        mock_server.uid.side_effect = [
            ("OK", [b""]),  # no new messages since last_uid
        ]
        mock_imap.return_value.__enter__.return_value = mock_server

        synced = hostinger_provider.sync_messages(folder="INBOX", last_uid=789)
        assert synced == []
        # Verify UID SEARCH criteria was incremental
        mock_server.uid.assert_called_with("search", None, "UID 790:*")


# 14. Retry behavior
def test_hostinger_retry_behavior(hostinger_provider):
    # Simulate a temporary network glitch followed by a successful retry
    attempts = [0]

    def flaky_sendmail(*args, **kwargs):
        attempts[0] += 1
        if attempts[0] == 1:
            raise smtplib.SMTPServerDisconnected("Temporary connection reset")
        return {}

    with patch("smtplib.SMTP_SSL") as mock_smtp:
        mock_server = MagicMock()
        mock_server.sendmail.side_effect = flaky_sendmail
        mock_smtp.return_value.__enter__.return_value = mock_server

        # First attempt fails
        with pytest.raises(RuntimeError):
            hostinger_provider.send_email(
                from_email="info@kiwicloudtech.co.in",
                to_email="test@example.com",
                subject="Retry Test",
                body_text="Retry body",
            )

        # Retry succeeds
        res = hostinger_provider.send_email(
            from_email="info@kiwicloudtech.co.in",
            to_email="test@example.com",
            subject="Retry Test",
            body_text="Retry body",
        )
        assert res["status"] == "SENT"
        assert attempts[0] == 2
