from datetime import datetime, timezone, timedelta, time
from typing import Optional, Tuple, Dict, Any
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.sales.calculations import generate_sequential_number
from app.service.models import SLAPolicy, Ticket

DEFAULT_TIMEZONE = "Asia/Kolkata"
WORK_START_HOUR = 9
WORK_START_MINUTE = 0
WORK_END_HOUR = 18
WORK_END_MINUTE = 0
WORK_DAYS = {0, 1, 2, 3, 4, 5}  # Monday (0) to Saturday (5), Sunday (6) is off

VALID_STATUS_TRANSITIONS: Dict[str, list[str]] = {
    "NEW": ["OPEN", "ASSIGNED", "CANCELLED"],
    "OPEN": ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
    "ASSIGNED": ["IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_INTERNAL", "RESOLVED", "CANCELLED"],
    "IN_PROGRESS": ["WAITING_FOR_CUSTOMER", "WAITING_FOR_INTERNAL", "RESOLVED", "ASSIGNED", "CANCELLED"],
    "WAITING_FOR_CUSTOMER": ["IN_PROGRESS", "WAITING_FOR_INTERNAL", "RESOLVED"],
    "WAITING_FOR_INTERNAL": ["IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"],
    "RESOLVED": ["CUSTOMER_CONFIRMATION", "REOPENED", "CLOSED"],
    "CUSTOMER_CONFIRMATION": ["CLOSED", "REOPENED", "IN_PROGRESS"],
    "CLOSED": ["REOPENED"],
    "REOPENED": ["IN_PROGRESS", "ASSIGNED", "RESOLVED"],
    "CANCELLED": ["REOPENED"],
}


def validate_status_transition(current_status: Optional[str], new_status: Optional[str]) -> None:
    if not current_status or not new_status:
        return
    cur = current_status.strip().upper()
    nxt = new_status.strip().upper()
    if cur == nxt:
        return
    allowed = VALID_STATUS_TRANSITIONS.get(cur, [])
    if nxt not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from '{current_status}' to '{new_status}'. Allowed: {', '.join(allowed) if allowed else 'None'}"
        )


def generate_ticket_number(db: Session) -> str:
    return generate_sequential_number(db, entity_type="ticket", prefix="TKT")


def match_sla_policy(db: Session, priority: str, severity: str) -> Optional[SLAPolicy]:
    # 1. Exact priority & severity match
    policy = db.query(SLAPolicy).filter(
        SLAPolicy.active == True,
        SLAPolicy.priority == priority,
        SLAPolicy.severity == severity
    ).first()
    if policy:
        return policy

    # 2. Priority match with ALL severity
    policy = db.query(SLAPolicy).filter(
        SLAPolicy.active == True,
        SLAPolicy.priority == priority,
        SLAPolicy.severity == "ALL"
    ).first()
    if policy:
        return policy

    # 3. Severity match with ALL priority
    policy = db.query(SLAPolicy).filter(
        SLAPolicy.active == True,
        SLAPolicy.priority == "ALL",
        SLAPolicy.severity == severity
    ).first()
    if policy:
        return policy

    # 4. Global default (ALL / ALL)
    policy = db.query(SLAPolicy).filter(
        SLAPolicy.active == True,
        SLAPolicy.priority == "ALL",
        SLAPolicy.severity == "ALL"
    ).first()
    if policy:
        return policy

    # 5. First active policy
    return db.query(SLAPolicy).filter(SLAPolicy.active == True).first()


def add_business_minutes(
    start_dt: datetime,
    minutes_to_add: int,
    business_hours_only: bool = True,
    timezone_str: str = DEFAULT_TIMEZONE
) -> datetime:
    if not business_hours_only or minutes_to_add <= 0:
        return start_dt + timedelta(minutes=minutes_to_add)

    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = timezone.utc

    # Convert to local timezone
    if start_dt.tzinfo is None:
        local_dt = start_dt.replace(tzinfo=timezone.utc).astimezone(tz)
    else:
        local_dt = start_dt.astimezone(tz)

    remaining_minutes = minutes_to_add

    while remaining_minutes > 0:
        # Check if current day is a working day
        if local_dt.weekday() not in WORK_DAYS:
            # Advance to next morning at start of work
            local_dt = (local_dt + timedelta(days=1)).replace(
                hour=WORK_START_HOUR, minute=WORK_START_MINUTE, second=0, microsecond=0
            )
            continue

        # Day is a working day. Determine work start and end today
        work_start = local_dt.replace(
            hour=WORK_START_HOUR, minute=WORK_START_MINUTE, second=0, microsecond=0
        )
        work_end = local_dt.replace(
            hour=WORK_END_HOUR, minute=WORK_END_MINUTE, second=0, microsecond=0
        )

        if local_dt < work_start:
            local_dt = work_start

        if local_dt >= work_end:
            # Advance to next day's work start
            local_dt = (local_dt + timedelta(days=1)).replace(
                hour=WORK_START_HOUR, minute=WORK_START_MINUTE, second=0, microsecond=0
            )
            continue

        # Minutes left in today's work window
        minutes_left_today = int((work_end - local_dt).total_seconds() / 60)

        if remaining_minutes <= minutes_left_today:
            local_dt = local_dt + timedelta(minutes=remaining_minutes)
            remaining_minutes = 0
        else:
            remaining_minutes -= minutes_left_today
            local_dt = (local_dt + timedelta(days=1)).replace(
                hour=WORK_START_HOUR, minute=WORK_START_MINUTE, second=0, microsecond=0
            )

    return local_dt.astimezone(timezone.utc)


def calculate_ticket_due_dates(
    policy: Optional[SLAPolicy],
    created_at: Optional[datetime] = None,
    timezone_str: str = DEFAULT_TIMEZONE
) -> Tuple[datetime, datetime]:
    base_time = created_at or datetime.now(timezone.utc)
    if not policy:
        # Defaults: 60m response, 480m resolution
        return (
            base_time + timedelta(minutes=60),
            base_time + timedelta(minutes=480),
        )

    first_resp_due = add_business_minutes(
        start_dt=base_time,
        minutes_to_add=policy.first_response_minutes,
        business_hours_only=policy.business_hours_only,
        timezone_str=timezone_str
    )
    resolution_due = add_business_minutes(
        start_dt=base_time,
        minutes_to_add=policy.resolution_minutes,
        business_hours_only=policy.business_hours_only,
        timezone_str=timezone_str
    )
    return first_resp_due, resolution_due


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def update_ticket_sla_lifecycle(ticket: Ticket, now: Optional[datetime] = None) -> Dict[str, Any]:
    current_time = ensure_utc(now) or datetime.now(timezone.utc)

    # 1. Check if paused
    if ticket.status == "WAITING_FOR_CUSTOMER":
        ticket.sla_status = "PAUSED"
        time_rem = 0
        due_utc = ensure_utc(ticket.due_at)
        if due_utc:
            time_rem = max(0, int((due_utc - current_time).total_seconds() / 60))
        return {
            "sla_status": "PAUSED",
            "time_remaining_minutes": time_rem,
            "sla_breached": ticket.sla_breached,
        }

    # 2. Check if completed
    if ticket.status in ("RESOLVED", "CUSTOMER_CONFIRMATION", "CLOSED"):
        if ticket.sla_breached:
            ticket.sla_status = "BREACHED"
        else:
            ticket.sla_status = "COMPLETED"
        return {
            "sla_status": ticket.sla_status,
            "time_remaining_minutes": 0,
            "sla_breached": ticket.sla_breached,
        }

    # 3. Active in-progress evaluation
    due_utc = ensure_utc(ticket.due_at)
    if due_utc:
        seconds_remaining = (due_utc - current_time).total_seconds()
        minutes_remaining = int(seconds_remaining / 60)

        if seconds_remaining <= 0:
            ticket.sla_status = "BREACHED"
            if not ticket.sla_breached:
                ticket.sla_breached = True
                ticket.sla_breached_at = current_time
        else:
            # Check if at risk (< 25% resolution time left or < 60 min)
            total_target = ticket.sla_policy.resolution_minutes if ticket.sla_policy else 480
            at_risk_threshold = max(30, int(total_target * 0.25))
            if minutes_remaining <= at_risk_threshold:
                ticket.sla_status = "AT_RISK"
            else:
                ticket.sla_status = "ON_TRACK"

        return {
            "sla_status": ticket.sla_status,
            "time_remaining_minutes": max(0, minutes_remaining),
            "sla_breached": ticket.sla_breached,
        }

    ticket.sla_status = "ON_TRACK"
    return {
        "sla_status": "ON_TRACK",
        "time_remaining_minutes": 0,
        "sla_breached": False,
    }
