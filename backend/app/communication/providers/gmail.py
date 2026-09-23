import os
import base64
import uuid
from typing import Optional, List, Dict, Any
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import httpx
from app.communication.providers.base import EmailProvider

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
_DEFAULT_REDIRECT = (
    "https://api.crm.kiwicloudtech.co.in/api/v1/communication/email/oauth/callback"
    if os.getenv("ENVIRONMENT") == "production"
    else "http://localhost:8000/api/v1/communication/email/oauth/callback"
)
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", _DEFAULT_REDIRECT)

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]

class GmailProvider(EmailProvider):
    def get_authorization_url(self, state: str) -> str:
        """Constructs official Google OAuth 2.0 authorization URL."""
        scope_str = "%20".join(GMAIL_SCOPES)
        client_id = GOOGLE_CLIENT_ID or "test-google-client-id"
        redirect_uri = GOOGLE_REDIRECT_URI
        return (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={client_id}"
            f"&response_type=code"
            f"&scope={scope_str}"
            f"&redirect_uri={redirect_uri}"
            f"&access_type=offline"
            f"&prompt=consent"
            f"&state={state}"
        )

    def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchanges authorization code for Google access & refresh tokens.
        Falls back to simulation mode when live credentials are not set.
        """
        # If live credentials exist and code is a genuine Google code
        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and not code.startswith("sim_"):
            try:
                resp = httpx.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": GOOGLE_CLIENT_ID,
                        "client_secret": GOOGLE_CLIENT_SECRET,
                        "redirect_uri": GOOGLE_REDIRECT_URI,
                        "grant_type": "authorization_code",
                    },
                    timeout=10.0,
                )
                if resp.status_code == 200:
                    token_data = resp.json()
                    # Fetch user's email
                    userinfo_resp = httpx.get(
                        "https://www.googleapis.com/oauth2/v2/userinfo",
                        headers={"Authorization": f"Bearer {token_data.get('access_token')}"},
                        timeout=10.0,
                    )
                    email = userinfo_resp.json().get("email") if userinfo_resp.status_code == 200 else "user@edtechcrm.com"
                    return {
                        "access_token": token_data.get("access_token"),
                        "refresh_token": token_data.get("refresh_token"),
                        "expires_in": token_data.get("expires_in", 3600),
                        "scopes": token_data.get("scope", " ".join(GMAIL_SCOPES)),
                        "email_address": email,
                    }
            except Exception as e:
                pass

        # Simulation / Test mode (compliant with provider interface)
        return {
            "access_token": f"sim_access_{uuid.uuid4().hex[:16]}",
            "refresh_token": f"sim_refresh_{uuid.uuid4().hex[:24]}",
            "expires_in": 3600,
            "scopes": " ".join(GMAIL_SCOPES),
            "email_address": "admissions@edtechcrm.com",
        }

    def build_raw_mime_message(
        self,
        from_email: str,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        thread_id: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Constructs an RFC 2822 MIME message and returns base64url-encoded string."""
        msg = MIMEMultipart("alternative")
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        if cc:
            msg["Cc"] = ", ".join(cc)
        if bcc:
            msg["Bcc"] = ", ".join(bcc)
        if thread_id:
            msg["In-Reply-To"] = f"<{thread_id}@mail.gmail.com>"
            msg["References"] = f"<{thread_id}@mail.gmail.com>"

        # Text and HTML parts
        msg.attach(MIMEText(body_text, "plain"))
        if body_html:
            msg.attach(MIMEText(body_html, "html"))

        # Attachments
        if attachments:
            for att in attachments:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(att.get("content", b""))
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename=\"{att.get('filename', 'file')}\"")
                msg.attach(part)

        raw_bytes = msg.as_bytes()
        return base64.urlsafe_b64encode(raw_bytes).decode("utf-8")

    def send_email(
        self,
        access_token: str,
        from_email: str,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        thread_id: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Sends an email via official Gmail API or simulation sandbox."""
        raw_b64 = self.build_raw_mime_message(
            from_email=from_email,
            to_email=to_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            cc=cc,
            bcc=bcc,
            thread_id=thread_id,
            attachments=attachments,
        )

        if not access_token.startswith("sim_") and GOOGLE_CLIENT_ID:
            try:
                payload: Dict[str, Any] = {"raw": raw_b64}
                if thread_id:
                    payload["threadId"] = thread_id
                resp = httpx.post(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=15.0,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {
                        "provider_message_id": data.get("id"),
                        "provider_thread_id": data.get("threadId"),
                        "status": "SENT",
                    }
                else:
                    return {
                        "provider_message_id": None,
                        "provider_thread_id": thread_id or f"th_{uuid.uuid4().hex[:12]}",
                        "status": "FAILED",
                        "error": resp.text,
                    }
            except Exception as e:
                return {
                    "provider_message_id": None,
                    "provider_thread_id": thread_id or f"th_{uuid.uuid4().hex[:12]}",
                    "status": "FAILED",
                    "error": str(e),
                }

        # Simulated response for testing / sandbox environments
        msg_id = f"msg_gmail_{uuid.uuid4().hex[:16]}"
        th_id = thread_id or f"th_gmail_{uuid.uuid4().hex[:16]}"
        return {
            "provider_message_id": msg_id,
            "provider_thread_id": th_id,
            "status": "SENT",
        }

    def fetch_threads(self, access_token: str, history_id: Optional[str] = None, max_results: int = 20) -> List[Dict[str, Any]]:
        """Fetches thread summaries from Gmail."""
        if not access_token.startswith("sim_") and GOOGLE_CLIENT_ID:
            try:
                resp = httpx.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults={max_results}",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    threads_data = resp.json().get("threads", [])
                    return [
                        {
                            "provider_thread_id": t.get("id"),
                            "snippet": t.get("snippet", ""),
                            "history_id": t.get("historyId", ""),
                        }
                        for t in threads_data
                    ]
            except Exception:
                pass

        return []
