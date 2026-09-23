from typing import Optional, Dict, Any
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy.orm import Session
from fastapi import Request
from app.audit.models import AuditLog

def _sanitize_json(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: _sanitize_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [_sanitize_json(x) for x in val]
    return str(val)

def record_audit_log(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    ip_address = None
    user_agent = None
    if request:
        client = getattr(request, "client", None)
        if client:
            ip_address = client.host
        user_agent = request.headers.get("user-agent")

    log_entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=_sanitize_json(old_values) if old_values is not None else None,
        new_values=_sanitize_json(new_values) if new_values is not None else None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log_entry)
    db.flush()
    return log_entry
