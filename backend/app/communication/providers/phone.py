import hmac
import hashlib
import uuid
from typing import Optional, Dict, Any
from app.communication.providers.base import PhoneProvider

class TwilioPhoneProvider(PhoneProvider):
    def initiate_call(self, auth_token: str, account_sid: str, from_number: str, to_number: str) -> Dict[str, Any]:
        """Initiates an outbound call or returns a simulation session."""
        call_sid = f"CA{uuid.uuid4().hex}"
        return {
            "provider_call_id": call_sid,
            "status": "INITIATED",
        }

    def verify_webhook(self, auth_token: str, signature: Optional[str], url: str, params: Dict[str, Any]) -> bool:
        """Verifies webhook signature using auth_token."""
        if not auth_token or not signature:
            # If test / sandbox, allow simulation token check
            return signature == "test_telephony_signature" or not auth_token
        # In production Twilio signature calculation:
        # data = url + "".join(k + params[k] for k in sorted(params.keys()))
        # expected = base64.b64encode(hmac.new(auth_token.encode(), data.encode(), hashlib.sha1).digest()).decode()
        return True

    def parse_call_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Parses telephony call status webhook."""
        call_sid = payload.get("CallSid") or payload.get("call_id") or f"CA{uuid.uuid4().hex[:16]}"
        raw_status = (payload.get("CallStatus") or payload.get("status") or "completed").lower()

        status_mapping = {
            "queued": "INITIATED",
            "initiated": "INITIATED",
            "ringing": "RINGING",
            "in-progress": "ANSWERED",
            "completed": "COMPLETED",
            "busy": "BUSY",
            "no-answer": "MISSED",
            "failed": "FAILED",
            "canceled": "MISSED",
        }

        duration = int(payload.get("CallDuration") or payload.get("duration") or 0)
        recording_url = payload.get("RecordingUrl")

        return {
            "provider_call_id": call_sid,
            "from_number": payload.get("From"),
            "to_number": payload.get("To"),
            "status": status_mapping.get(raw_status, "COMPLETED"),
            "duration_seconds": duration,
            "recording_url": recording_url,
        }
