from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any

class EmailProvider(ABC):
    def connect(self) -> bool:
        """Establishes connection with email provider (SMTP/IMAP)."""
        return True

    def test_connection(self) -> Dict[str, Any]:
        """Tests SMTP/IMAP connectivity and returns status report."""
        return {"status": "CONNECTED", "provider": "GENERIC"}

    @abstractmethod
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
        """Sends an email and returns provider message ID and thread ID."""
        pass

    def sync_messages(
        self,
        folder: str = "INBOX",
        last_uid: Optional[int] = None,
        max_messages: int = 50,
    ) -> List[Dict[str, Any]]:
        """Synchronizes incoming messages incrementally via IMAP."""
        return []

    def fetch_message(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Fetches a specific message by Message-ID or provider UID."""
        return None

    def download_attachment(self, message_id: str, attachment_id: str) -> Optional[bytes]:
        """Downloads raw attachment bytes."""
        return None

    def close(self) -> None:
        """Closes any open SMTP or IMAP connection sessions."""
        pass

    # Optional OAuth2 methods for OAuth providers (e.g. Gmail/Workspace)
    def get_authorization_url(self, state: str) -> str:
        return ""

    def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        return {}

    def fetch_threads(self, access_token: str, history_id: Optional[str] = None, max_results: int = 20) -> List[Dict[str, Any]]:
        return []


class WhatsAppProvider(ABC):
    @abstractmethod
    def send_message(self, access_token: str, phone_number_id: str, to_phone: str, text: str) -> Dict[str, Any]:
        """Sends a text message via WhatsApp Business API."""
        pass

    @abstractmethod
    def send_template(
        self,
        access_token: str,
        phone_number_id: str,
        to_phone: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Sends an approved WhatsApp template message."""
        pass

    @abstractmethod
    def verify_webhook(self, secret: str, signature: Optional[str], payload_bytes: bytes) -> bool:
        """Verifies HMAC signature of incoming webhook."""
        pass

    @abstractmethod
    def parse_webhook(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parses webhook events (inbound messages, status updates)."""
        pass


class PhoneProvider(ABC):
    @abstractmethod
    def initiate_call(self, auth_token: str, account_sid: str, from_number: str, to_number: str) -> Dict[str, Any]:
        """Initiates an outbound call via telephony provider."""
        pass

    @abstractmethod
    def verify_webhook(self, auth_token: str, signature: Optional[str], url: str, params: Dict[str, Any]) -> bool:
        """Verifies telephony provider webhook signature."""
        pass

    @abstractmethod
    def parse_call_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Parses call status update from webhook."""
        pass
