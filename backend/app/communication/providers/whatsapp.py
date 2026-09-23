import hmac
import hashlib
import uuid
import re
from typing import Optional, List, Dict, Any
import httpx
from app.communication.providers.base import WhatsAppProvider

def normalize_phone(phone: str) -> str:
    """Normalizes phone string to digits only (E.164 compatible)."""
    return re.sub(r"[^\d+]", "", phone)

class MetaWhatsAppProvider(WhatsAppProvider):
    def send_message(self, access_token: str, phone_number_id: str, to_phone: str, text: str) -> Dict[str, Any]:
        """Sends a text message via official Meta WhatsApp Cloud API."""
        clean_to = normalize_phone(to_phone).lstrip("+")
        
        # If live credentials exist
        if access_token and not access_token.startswith("sim_") and phone_number_id and not phone_number_id.startswith("sim_"):
            try:
                url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": clean_to,
                    "type": "text",
                    "text": {"preview_url": False, "body": text},
                }
                resp = httpx.post(
                    url,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=15.0,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    msg_id = data.get("messages", [{}])[0].get("id")
                    return {
                        "provider_message_id": msg_id,
                        "status": "SENT",
                    }
                else:
                    return {
                        "provider_message_id": None,
                        "status": "FAILED",
                        "error": resp.text,
                    }
            except Exception as e:
                return {
                    "provider_message_id": None,
                    "status": "FAILED",
                    "error": str(e),
                }

        # Simulated response for testing / sandbox environments
        wamid = f"wamid.{uuid.uuid4().hex}"
        return {
            "provider_message_id": wamid,
            "status": "SENT",
        }

    def send_template(
        self,
        access_token: str,
        phone_number_id: str,
        to_phone: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Sends an approved Meta WhatsApp template message."""
        clean_to = normalize_phone(to_phone).lstrip("+")
        if access_token and not access_token.startswith("sim_") and phone_number_id and not phone_number_id.startswith("sim_"):
            try:
                url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
                payload = {
                    "messaging_product": "whatsapp",
                    "to": clean_to,
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": language_code},
                        "components": components or [],
                    },
                }
                resp = httpx.post(
                    url,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=15.0,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    msg_id = data.get("messages", [{}])[0].get("id")
                    return {"provider_message_id": msg_id, "status": "SENT"}
                else:
                    return {"provider_message_id": None, "status": "FAILED", "error": resp.text}
            except Exception as e:
                return {"provider_message_id": None, "status": "FAILED", "error": str(e)}

        return {
            "provider_message_id": f"wamid.template_{uuid.uuid4().hex}",
            "status": "SENT",
        }

    def verify_webhook(self, secret: str, signature: Optional[str], payload_bytes: bytes) -> bool:
        """Verifies Meta X-Hub-Signature-256 header."""
        if not signature or not secret:
            return False
        expected_sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    def parse_webhook(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parses Meta Cloud API webhook events."""
        events = []
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                val = change.get("value", {})
                
                # Inbound messages
                messages = val.get("messages", [])
                for msg in messages:
                    events.append({
                        "event_type": "inbound_message",
                        "provider_message_id": msg.get("id"),
                        "from_phone": msg.get("from"),
                        "timestamp": msg.get("timestamp"),
                        "body": msg.get("text", {}).get("body", "") if msg.get("text") or msg.get("type") == "text" else f"[{msg.get('type', 'media')} media]",
                    })

                # Status updates
                statuses = val.get("statuses", [])
                for st in statuses:
                    status_val = st.get("status", "").upper()  # sent, delivered, read, failed
                    events.append({
                        "event_type": "status_update",
                        "provider_message_id": st.get("id"),
                        "recipient_phone": st.get("recipient_id"),
                        "status": status_val,
                        "timestamp": st.get("timestamp"),
                    })
        return events
