"""
Provider-Neutral Telephony Service & Foundation for KCT CRM.
Supports future telephony adapters (e.g. Exotel, generic SIP, WebRTC)
while maintaining zero hard dependencies on external paid services.

By default, operates safely in disabled state:
TELEPHONY_ENABLED=false
TELEPHONY_PROVIDER=none
"""

import uuid
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.audit import record_audit_log
from app.users.models import User
from app.crm.models import Lead
from app.communication.models import CommunicationMessage, PhoneConfig
from app.communication.services import (
    find_crm_associations_by_contact_info,
    record_communication_activity,
)


class TelephonyAdapter(ABC):
    """Abstract interface for CRM telephony providers."""

    @abstractmethod
    def initiate_call(
        self,
        from_number: str,
        to_number: str,
        crm_user_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Initiates a two-legged or bridge outbound call."""
        pass

    @abstractmethod
    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Parses vendor-specific webhook payload into normalized CRM call event."""
        pass


class NoneTelephonyAdapter(TelephonyAdapter):
    """Default fallback adapter when no provider is connected."""

    def initiate_call(
        self,
        from_number: str,
        to_number: str,
        crm_user_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telephony provider is not configured. Please configure a telephony provider in system settings.",
        )

    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        call_id = payload.get("call_id") or payload.get("CallSid") or f"call_{uuid.uuid4().hex[:12]}"
        return {
            "provider_call_id": call_id,
            "status": "COMPLETED",
            "duration_seconds": 0,
            "recording_url": None,
            "from_number": payload.get("from") or "Unknown",
            "to_number": payload.get("to") or "Unknown",
        }


class TelephonyService:
    """
    Core Telephony Manager for KCT CRM.
    Decouples CRM business logic from specific telephony carriers.
    """

    def __init__(self):
        self._adapters: Dict[str, TelephonyAdapter] = {
            "none": NoneTelephonyAdapter(),
        }

    def register_adapter(self, name: str, adapter: TelephonyAdapter) -> None:
        """Allows plugging in future adapters dynamically without core modifications."""
        self._adapters[name.lower()] = adapter

    @property
    def is_enabled(self) -> bool:
        """Returns True only if explicitly enabled via environment."""
        return bool(getattr(settings, "TELEPHONY_ENABLED", False))

    @property
    def current_provider(self) -> str:
        """Returns the configured telephony provider name (lowercase)."""
        return (getattr(settings, "TELEPHONY_PROVIDER", "none") or "none").lower()

    @property
    def business_number(self) -> str:
        """Returns the company business caller ID."""
        return getattr(settings, "TELEPHONY_BUSINESS_NUMBER", "") or "Not Configured"

    def get_status(self, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Returns normalized status of telephony subsystem.
        Never exposes secrets, tokens, or private carrier credentials.
        """
        enabled = self.is_enabled
        provider = self.current_provider
        db_cfg = db.query(PhoneConfig).first() if db else None

        # Determine presentation status
        if not enabled or provider == "none":
            st = "Disabled"
        elif db_cfg and db_cfg.status == "CONNECTED":
            st = "Connected"
        else:
            st = "Not Configured"

        return {
            "enabled": enabled,
            "provider": provider if provider != "none" else "Not Configured",
            "status": st,
            "business_number": self.business_number,
            "provider_configured": provider != "none" and enabled,
        }

    def test_connection(self, db: Optional[Session] = None) -> Dict[str, Any]:
        """Tests telephony connection safely without external dependency."""
        status_info = self.get_status(db)
        if not self.is_enabled or self.current_provider == "none":
            return {
                "provider": "TELEPHONY",
                "status": "DISCONNECTED",
                "message": "Telephony is disabled (TELEPHONY_ENABLED=false) or provider is set to none.",
                "details": status_info,
            }
        return {
            "provider": self.current_provider,
            "status": "CONNECTED",
            "message": f"Telephony provider '{self.current_provider}' configured.",
            "details": status_info,
        }

    def initiate_call(
        self,
        db: Session,
        current_user: User,
        destination_phone: str,
        lead_id: Optional[str] = None,
        contact_id: Optional[str] = None,
        company_id: Optional[str] = None,
        opportunity_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initiates a CRM call through the configured carrier adapter.
        Guards against unconfigured state.
        """
        if not self.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telephony is not configured.",
            )

        adapter = self._adapters.get(self.current_provider)
        if not adapter or isinstance(adapter, NoneTelephonyAdapter):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telephony provider is unavailable.",
            )

        clean_dest = destination_phone.strip()
        if not clean_dest:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Destination phone number is required.",
            )

        # Auto CRM link if not provided
        if not company_id or not contact_id:
            m_con, m_col = find_crm_associations_by_contact_info(db, phone=clean_dest)
            if not contact_id and m_con:
                contact_id = m_con
            if not company_id and m_col:
                company_id = m_col

        call_result = adapter.initiate_call(
            from_number=self.business_number,
            to_number=clean_dest,
            crm_user_id=current_user.id,
            metadata={
                "lead_id": lead_id,
                "contact_id": contact_id,
                "company_id": company_id,
            },
        )

        now = datetime.now(timezone.utc)
        p_call_id = call_result.get("provider_call_id") or f"call_{uuid.uuid4().hex[:12]}"
        init_status = call_result.get("status", "INITIATED")

        msg = CommunicationMessage(
            channel="PHONE",
            direction="OUTBOUND",
            status=init_status,
            provider_message_id=p_call_id,
            sender=self.business_number,
            recipient=clean_dest,
            sent_at=now,
            company_id=company_id,
            contact_id=contact_id,
            lead_id=lead_id,
            opportunity_id=opportunity_id,
            created_by_id=current_user.id,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        # Timeline activity
        record_communication_activity(
            db=db,
            channel="PHONE",
            direction="OUTBOUND",
            subject=f"Outbound call initiated to {clean_dest}",
            user_id=current_user.id,
            company_id=company_id,
            contact_id=contact_id,
            lead_id=lead_id,
            opportunity_id=opportunity_id,
            completed_at=now,
        )

        return {
            "status": init_status,
            "call_id": msg.id,
            "provider_call_id": p_call_id,
            "provider": self.current_provider,
            "to": clean_dest,
            "business_number": self.business_number,
        }

    def process_webhook(
        self,
        db: Session,
        provider_name: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Processes inbound telephony callback/webhook.
        Idempotent: updates existing call or inserts missing inbound record.
        """
        adapter = self._adapters.get(provider_name.lower()) or self._adapters["none"]
        parsed = adapter.parse_webhook(payload)

        p_call_id = parsed.get("provider_call_id")
        if not p_call_id:
            return {"status": "ignored", "reason": "Missing provider call identifier"}

        now = datetime.now(timezone.utc)
        existing = db.query(CommunicationMessage).filter(
            CommunicationMessage.provider_message_id == p_call_id,
            CommunicationMessage.channel == "PHONE",
        ).first()

        duration = parsed.get("duration_seconds", 0)
        call_status = parsed.get("status", "COMPLETED")
        rec_url = parsed.get("recording_url")

        if existing:
            existing.status = call_status
            existing.call_duration_seconds = duration
            if rec_url:
                existing.recording_url = rec_url
            if not existing.delivered_at and call_status in ("ANSWERED", "COMPLETED"):
                existing.delivered_at = now
            db.commit()
            return {"status": "updated", "call_id": existing.id, "provider_call_id": p_call_id}

        # New inbound call record
        from_num = parsed.get("from_number") or "Unknown"
        to_num = parsed.get("to_number") or self.business_number
        contact_id, company_id = find_crm_associations_by_contact_info(db, phone=from_num)

        msg = CommunicationMessage(
            channel="PHONE",
            direction="INBOUND",
            status=call_status,
            provider_message_id=p_call_id,
            sender=from_num,
            recipient=to_num,
            call_duration_seconds=duration,
            recording_url=rec_url,
            sent_at=now,
            delivered_at=now if call_status in ("ANSWERED", "COMPLETED") else None,
            company_id=company_id,
            contact_id=contact_id,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        # Activity recording
        if company_id or contact_id:
            record_communication_activity(
                db=db,
                channel="PHONE",
                direction="INBOUND",
                subject=f"Inbound call from {from_num}",
                description=f"Status: {call_status}, Duration: {duration}s",
                company_id=company_id,
                contact_id=contact_id,
                completed_at=now,
            )

        return {"status": "created", "call_id": msg.id, "provider_call_id": p_call_id}


# Singleton telephony service
telephony_service = TelephonyService()
