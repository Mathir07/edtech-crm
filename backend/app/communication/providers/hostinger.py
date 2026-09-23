import os
import re
import ssl
import socket
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.header import decode_header
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
import uuid

from app.core.config import settings
from app.communication.providers.base import EmailProvider

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def sanitize_header(val: Optional[str]) -> str:
    """Decodes MIME encoded-words in email headers safely."""
    if not val:
        return ""
    decoded_parts = decode_header(val)
    out = []
    for part, enc in decoded_parts:
        if isinstance(part, bytes):
            try:
                out.append(part.decode(enc or "utf-8", errors="replace"))
            except Exception:
                out.append(part.decode("latin1", errors="replace"))
        else:
            out.append(str(part))
    return "".join(out)


class HostingerEmailProvider(EmailProvider):
    """
    Production-ready Email Provider implementing SMTP and IMAP for Hostinger Webmail.
    Supports RFC 2822 MIME message construction, Message-ID threading, incremental IMAP sync,
    attachment extraction, and safe fallback handling when credentials are not configured.
    """

    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        smtp_use_tls: Optional[bool] = None,
        smtp_use_ssl: Optional[bool] = None,
        imap_host: Optional[str] = None,
        imap_port: Optional[int] = None,
        imap_username: Optional[str] = None,
        imap_password: Optional[str] = None,
        imap_use_ssl: Optional[bool] = None,
        default_from: Optional[str] = None,
        default_from_name: Optional[str] = None,
    ):
        self.smtp_host = smtp_host or getattr(settings, "effective_smtp_host", "")
        self.smtp_port = smtp_port or getattr(settings, "effective_smtp_port", 465)
        self.smtp_username = smtp_username or getattr(settings, "effective_smtp_username", "")
        self.smtp_password = smtp_password if smtp_password is not None else getattr(settings, "effective_smtp_password", "")
        self.smtp_use_tls = smtp_use_tls if smtp_use_tls is not None else settings.HOSTINGER_SMTP_USE_TLS
        self.smtp_use_ssl = smtp_use_ssl if smtp_use_ssl is not None else settings.HOSTINGER_SMTP_USE_SSL

        self.imap_host = imap_host or getattr(settings, "effective_imap_host", "")
        self.imap_port = imap_port or getattr(settings, "effective_imap_port", 993)
        self.imap_username = imap_username or getattr(settings, "effective_imap_username", "")
        self.imap_password = imap_password if imap_password is not None else getattr(settings, "effective_imap_password", "")
        self.imap_use_ssl = imap_use_ssl if imap_use_ssl is not None else settings.HOSTINGER_IMAP_USE_SSL

        self.default_from = default_from or getattr(settings, "effective_email_from", "")
        self.default_from_name = default_from_name or getattr(settings, "effective_email_from_name", "Kiwi Cloud Tech")

        self._smtp_conn = None
        self._imap_conn = None

    def is_configured(self) -> bool:
        """Returns True only if both username and password credentials are set."""
        return bool(self.smtp_username and self.smtp_password and self.imap_username and self.imap_password)

    def test_connection(self) -> Dict[str, Any]:
        """
        Tests Hostinger SMTP and IMAP connection.
        Never returns passwords or secrets.
        """
        if not self.is_configured():
            return {
                "provider": "HOSTINGER",
                "status": "NOT_CONFIGURED",
                "smtp": "NOT_CONFIGURED",
                "imap": "NOT_CONFIGURED",
                "message": "Hostinger credentials not configured in environment.",
                "smtp_host": self.smtp_host,
                "smtp_port": self.smtp_port,
                "imap_host": self.imap_host,
                "imap_port": self.imap_port,
                "email": self.smtp_username,
            }

        smtp_status = "UNKNOWN"
        imap_status = "UNKNOWN"
        errors = []

        # 1. Test SMTP
        try:
            if self.smtp_use_ssl or self.smtp_port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=8) as server:
                    server.login(self.smtp_username, self.smtp_password)
                    smtp_status = "CONNECTED"
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=8) as server:
                    if self.smtp_use_tls:
                        server.starttls()
                    server.login(self.smtp_username, self.smtp_password)
                    smtp_status = "CONNECTED"
        except (smtplib.SMTPAuthenticationError, smtplib.SMTPConnectError, socket.error, socket.timeout) as e:
            smtp_status = "ERROR"
            errors.append(f"SMTP Error: {type(e).__name__}")
        except Exception as e:
            smtp_status = "ERROR"
            errors.append(f"SMTP failure: {type(e).__name__}")

        # 2. Test IMAP
        try:
            if self.imap_use_ssl or self.imap_port == 993:
                context = ssl.create_default_context()
                with imaplib.IMAP4_SSL(self.imap_host, self.imap_port, ssl_context=context) as imap:
                    imap.login(self.imap_username, self.imap_password)
                    imap_status = "CONNECTED"
            else:
                with imaplib.IMAP4(self.imap_host, self.imap_port) as imap:
                    imap.login(self.imap_username, self.imap_password)
                    imap_status = "CONNECTED"
        except (imaplib.IMAP4.error, socket.error, socket.timeout) as e:
            imap_status = "ERROR"
            errors.append(f"IMAP Error: {type(e).__name__}")
        except Exception as e:
            imap_status = "ERROR"
            errors.append(f"IMAP failure: {type(e).__name__}")

        overall_status = "CONNECTED" if (smtp_status == "CONNECTED" and imap_status == "CONNECTED") else "ERROR"
        return {
            "provider": "HOSTINGER",
            "status": overall_status,
            "smtp": smtp_status,
            "imap": imap_status,
            "message": "Connected to Hostinger Mail successfully" if overall_status == "CONNECTED" else "; ".join(errors),
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "imap_host": self.imap_host,
            "imap_port": self.imap_port,
            "email": self.smtp_username,
        }

    def send_email(
        self,
        access_token: Optional[str] = None,
        from_email: str = "",
        to_email: str = "",
        subject: str = "",
        body_text: str = "",
        body_html: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        thread_id: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Sends an RFC 2822 email via Hostinger SMTP.
        If credentials are not configured, runs safe simulation with realistic message ID.
        """
        # Validate recipient format
        to_clean = to_email.strip()
        if not to_clean or not EMAIL_REGEX.match(to_clean):
            raise ValueError(f"Invalid recipient email address: '{to_email}'")

        sender_addr = (from_email or self.default_from).strip()
        sender_name = self.default_from_name
        msg_id_domain = sender_addr.split("@")[-1] if "@" in sender_addr else "kiwicloudtech.co.in"
        rfc_message_id = f"<{uuid.uuid4().hex}@{msg_id_domain}>"

        # Build MIME Message
        msg = MIMEMultipart("mixed")
        msg["From"] = f'"{sender_name}" <{sender_addr}>'
        msg["To"] = to_clean
        msg["Subject"] = subject or "(No Subject)"
        msg["Message-ID"] = rfc_message_id
        msg["Date"] = email.utils.formatdate(localtime=True)

        if cc:
            msg["Cc"] = ", ".join(cc)
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
        if references:
            msg["References"] = references
        elif in_reply_to:
            msg["References"] = in_reply_to

        # Alternative part for Text and HTML
        alt_part = MIMEMultipart("alternative")
        text_part = MIMEText(body_text or "", "plain", "utf-8")
        alt_part.attach(text_part)

        if body_html:
            html_part = MIMEText(body_html, "html", "utf-8")
            alt_part.attach(html_part)

        msg.attach(alt_part)

        # Attachments
        if attachments:
            for att in attachments:
                file_path = att.get("file_path")
                filename = att.get("filename") or "attachment"
                content_type = att.get("content_type", "application/octet-stream")
                maintype, subtype = content_type.split("/", 1) if "/" in content_type else ("application", "octet-stream")

                part = MIMEBase(maintype, subtype)
                if file_path and os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        part.set_payload(f.read())
                elif att.get("data"):
                    part.set_payload(att["data"])
                else:
                    part.set_payload(b"")

                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename=\"{filename}\"")
                msg.attach(part)

        all_recipients = [to_clean]
        if cc:
            all_recipients.extend([c.strip() for c in cc if c.strip()])
        if bcc:
            all_recipients.extend([b.strip() for b in bcc if b.strip()])

        # Enforce configuration - never claim success without configured credentials
        if not self.is_configured():
            raise RuntimeError("Hostinger SMTP is not configured. Please configure MAIL_SMTP_PASSWORD in server environment.")

        # Dispatch via Hostinger SMTP
        use_ssl = (self.smtp_use_ssl or self.smtp_port == 465 or getattr(settings, "MAIL_SMTP_SECURITY", "ssl").lower() == "ssl")
        try:
            if use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=15) as server:
                    server.login(self.smtp_username, self.smtp_password)
                    server.sendmail(sender_addr, all_recipients, msg.as_string())
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                    if self.smtp_use_tls or self.smtp_port == 587 or getattr(settings, "MAIL_SMTP_SECURITY", "ssl").lower() in ("starttls", "tls"):
                        server.starttls()
                    server.login(self.smtp_username, self.smtp_password)
                    server.sendmail(sender_addr, all_recipients, msg.as_string())
        except smtplib.SMTPRecipientsRefused:
            raise ValueError(f"SMTP Recipient Refused: {to_clean}")
        except smtplib.SMTPAuthenticationError:
            raise RuntimeError("Hostinger SMTP Authentication failed. Please check credentials.")
        except Exception as e:
            raise RuntimeError(f"Hostinger SMTP Send Failed: {type(e).__name__}")

        p_thread_id = thread_id or f"th_{uuid.uuid4().hex[:12]}"
        return {
            "status": "SENT",
            "provider": "HOSTINGER",
            "provider_message_id": rfc_message_id,
            "provider_thread_id": p_thread_id,
            "in_reply_to": in_reply_to,
            "references": references or in_reply_to,
            "to": to_clean,
            "from": sender_addr,
            "subject": subject,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

    def sync_messages(
        self,
        folder: str = "INBOX",
        last_uid: Optional[int] = None,
        max_messages: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Connects to Hostinger IMAP and synchronizes messages incrementally.
        Extracts headers, bodies, threading metadata, and attachments.
        """
        if not self.is_configured():
            return []

        messages = []
        try:
            context = ssl.create_default_context() if (self.imap_use_ssl or self.imap_port == 993) else None
            imap_cls = imaplib.IMAP4_SSL if (self.imap_use_ssl or self.imap_port == 993) else imaplib.IMAP4
            
            with (imap_cls(self.imap_host, self.imap_port, ssl_context=context) if context else imap_cls(self.imap_host, self.imap_port)) as imap:
                imap.login(self.imap_username, self.imap_password)
                status, _ = imap.select(folder, readonly=True)
                if status != "OK":
                    return []

                # Incremental sync via UID
                search_criteria = f"UID {last_uid + 1}:*" if last_uid else "ALL"
                status, data = imap.uid("search", None, search_criteria)
                if status != "OK" or not data or not data[0]:
                    return []

                uids = data[0].split()
                # Sort newest first, limited by max_messages
                for uid_bytes in reversed(uids[-max_messages:]):
                    uid_str = uid_bytes.decode("ascii")
                    status, msg_data = imap.uid("fetch", uid_str, "(RFC822)")
                    if status != "OK" or not msg_data or not msg_data[0]:
                        continue

                    raw_email = msg_data[0][1]
                    email_msg = email.message_from_bytes(raw_email)
                    parsed = self._parse_email_message(email_msg, uid=int(uid_str))
                    if parsed:
                        messages.append(parsed)
        except Exception:
            return []

        return messages

    def _parse_email_message(self, msg: email.message.Message, uid: int) -> Dict[str, Any]:
        """Parses an RFC 822 email message into structured dict."""
        subject = sanitize_header(msg.get("Subject"))
        from_hdr = sanitize_header(msg.get("From"))
        to_hdr = sanitize_header(msg.get("To"))
        cc_hdr = sanitize_header(msg.get("Cc"))
        message_id = msg.get("Message-ID") or f"<{uuid.uuid4().hex}@kiwicloudtech.co.in>"
        in_reply_to = msg.get("In-Reply-To")
        references = msg.get("References")
        date_hdr = msg.get("Date")

        body_text = ""
        body_html = ""
        attachments = []

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))
                filename = part.get_filename()

                if filename or "attachment" in content_disposition:
                    clean_filename = sanitize_header(filename) or "attachment"
                    payload = part.get_payload(decode=True)
                    attachments.append({
                        "filename": clean_filename,
                        "content_type": content_type,
                        "size": len(payload) if payload else 0,
                        "data": payload,
                    })
                elif content_type == "text/plain" and not body_text:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body_text = payload.decode(charset, errors="replace")
                elif content_type == "text/html" and not body_html:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body_html = payload.decode(charset, errors="replace")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                if msg.get_content_type() == "text/html":
                    body_html = payload.decode(charset, errors="replace")
                else:
                    body_text = payload.decode(charset, errors="replace")

        return {
            "provider_message_id": message_id,
            "provider_uid": uid,
            "subject": subject,
            "from": from_hdr,
            "to": to_hdr,
            "cc": cc_hdr,
            "date": date_hdr,
            "in_reply_to": in_reply_to,
            "references": references,
            "body_text": body_text,
            "body_html": body_html,
            "attachments": attachments,
        }

    def close(self) -> None:
        """Closes active connections."""
        if self._smtp_conn:
            try:
                self._smtp_conn.quit()
            except Exception:
                pass
            self._smtp_conn = None
        if self._imap_conn:
            try:
                self._imap_conn.logout()
            except Exception:
                pass
            self._imap_conn = None
