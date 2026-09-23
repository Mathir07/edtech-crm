import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.audit import record_audit_log
from app.users.models import User, Role, Permission
from app.activities.models import Task, Meeting, Activity
from app.crm.models import Lead
from app.sales.models import Opportunity
from app.accounting.models import Invoice, CustomerPayment
from app.service.models import Ticket
from app.projects.models import Project, Milestone
from app.qa.models import Bug
from app.notifications.models import Notification, AutomationRule, AutomationJobLog
from app.notifications.email_dispatcher import dispatch_notification_email

logger = logging.getLogger(__name__)

DEFAULT_RULES = [
    {
        "rule_key": "TASK_REMINDERS",
        "name": "Task Due & Overdue Alerts",
        "description": "Scans tasks approaching due dates or becoming overdue and alerts assigned owners.",
        "config_json": {"advance_hours": 24},
    },
    {
        "rule_key": "MEETING_REMINDERS",
        "name": "Meeting Timely Reminders",
        "description": "Generates 24-hour and 1-hour advance reminders for scheduled meetings.",
        "config_json": {"intervals_hours": [24, 1]},
    },
    {
        "rule_key": "LEAD_FOLLOWUP",
        "name": "Stale Lead Follow-up Warnings",
        "description": "Reminds lead owners when leads have no recent updates or follow-up activities.",
        "config_json": {"stale_days": 7},
    },
    {
        "rule_key": "OPPORTUNITY_FOLLOWUP",
        "name": "Opportunity Inactivity Alerts",
        "description": "Alerts deal owners when high-value opportunities remain untouched.",
        "config_json": {"stale_days": 7},
    },
    {
        "rule_key": "INVOICE_REMINDERS",
        "name": "Invoice Due & Aging Alerts",
        "description": "Monitors unpaid student and college invoices approaching due dates or becoming overdue.",
        "config_json": {"approaching_days": 3},
    },
    {
        "rule_key": "PAYMENT_RECEIVED",
        "name": "Customer Payment Receipts",
        "description": "Dispatches internal alerts to finance and sales teams upon recording client payments.",
        "config_json": {},
    },
    {
        "rule_key": "SERVICE_SLA",
        "name": "Service SLA Warnings & Breaches",
        "description": "Proactively flags tickets nearing SLA expiration and escalates actual breaches.",
        "config_json": {"response_warn_mins": 30, "resolution_warn_mins": 60},
    },
    {
        "rule_key": "PROJECT_DELAY",
        "name": "Project Delay & Milestone Alerts",
        "description": "Detects slipping milestones, delayed deliverables, and project readiness blockers.",
        "config_json": {},
    },
    {
        "rule_key": "QA_CRITICAL_BUG",
        "name": "Critical QA Bug Escalations",
        "description": "Immediately escalates CRITICAL severity bugs to PMs and QA leads.",
        "config_json": {},
    },
]


def ensure_default_rules(db: Session, organization_id: str = "kct-default"):
    """Seeds default startup automation rules if not present for this tenant."""
    for item in DEFAULT_RULES:
        existing = db.query(AutomationRule).filter(
            AutomationRule.organization_id == organization_id,
            AutomationRule.rule_key == item["rule_key"],
        ).first()
        if not existing:
            rule = AutomationRule(
                organization_id=organization_id,
                rule_key=item["rule_key"],
                name=item["name"],
                description=item["description"],
                is_enabled=True,
                config_json=item["config_json"],
            )
            db.add(rule)
    db.commit()


def get_users_by_permission(db: Session, perm_code: str) -> List[User]:
    """Finds all active users possessing a given permission or superusers."""
    users = db.query(User).filter(User.is_active == True).all()
    matching = []
    for u in users:
        if u.is_superuser or perm_code in u.get_permission_codes():
            matching.append(u)
    return matching


def create_notification_if_unique(
    db: Session,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    priority: str = "MEDIUM",
    dedup_key: Optional[str] = None,
    organization_id: str = "kct-default",
) -> Optional[Notification]:
    """
    Creates an in-app notification if a matching dedup_key does not already exist.
    Also conditionally attempts an email notification via Hostinger.
    """
    if dedup_key:
        existing = db.query(Notification).filter(
            Notification.organization_id == organization_id,
            Notification.dedup_key == dedup_key,
        ).first()
        if existing:
            return None

    notification = Notification(
        organization_id=organization_id,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        priority=priority,
        is_read=False,
        dedup_key=dedup_key,
    )
    db.add(notification)
    db.flush()

    # Attempt email dispatch
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        dispatch_notification_email(
            db=db,
            user=user,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
        )

    return notification


# --- 1. Task Reminders ---
def scan_task_reminders(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    twenty_four_hours = now + timedelta(hours=24)
    tasks = db.query(Task).filter(
        Task.status.notin_(["Completed", "Cancelled"]),
        Task.due_date.isnot(None),
    ).all()

    processed = 0
    created = 0

    for t in tasks:
        processed += 1
        owner_id = t.assigned_to_id or t.created_by_id
        if not owner_id:
            continue

        due_date = t.due_date
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)

        # Overdue
        if due_date < now:
            dedup = f"task:{t.id}:overdue:{due_date.date().isoformat()}"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="TASK_OVERDUE",
                title=f"Task Overdue: {t.title}",
                message=f"The task '{t.title}' was due on {due_date.strftime('%Y-%m-%d %H:%M')}. Please review and update its status.",
                entity_type="task",
                entity_id=t.id,
                priority="HIGH",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1
        # Due soon (within 24 hours)
        elif now <= due_date <= twenty_four_hours:
            dedup = f"task:{t.id}:due:{due_date.date().isoformat()}"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="TASK_DUE",
                title=f"Task Due Soon: {t.title}",
                message=f"The task '{t.title}' is due in less than 24 hours ({due_date.strftime('%Y-%m-%d %H:%M')}).",
                entity_type="task",
                entity_id=t.id,
                priority="MEDIUM",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 2. Meeting Reminders ---
def scan_meeting_reminders(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    meetings = db.query(Meeting).filter(
        Meeting.status == "Scheduled",
        Meeting.start_time.isnot(None),
    ).all()

    processed = 0
    created = 0

    for m in meetings:
        processed += 1
        owner_id = m.organizer_id or m.created_by_id
        if not owner_id:
            continue

        start_time = m.start_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)

        time_diff = start_time - now
        total_seconds = time_diff.total_seconds()

        # 24 Hours before (23h to 25h window)
        if 23 * 3600 <= total_seconds <= 25 * 3600:
            dedup = f"meeting:{m.id}:24h"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="MEETING_REMINDER",
                title=f"Upcoming Meeting in 24h: {m.title}",
                message=f"You have a scheduled meeting '{m.title}' tomorrow at {start_time.strftime('%H:%M UTC')}.",
                entity_type="meeting",
                entity_id=m.id,
                priority="MEDIUM",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

        # 1 Hour before (45m to 75m window)
        elif 45 * 60 <= total_seconds <= 75 * 60:
            dedup = f"meeting:{m.id}:1h"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="MEETING_REMINDER",
                title=f"Meeting Starting in 1 Hour: {m.title}",
                message=f"Reminder: Meeting '{m.title}' begins in approximately 1 hour at {start_time.strftime('%H:%M UTC')}.",
                entity_type="meeting",
                entity_id=m.id,
                priority="HIGH",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 3. Lead Follow-up ---
def scan_lead_followups(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    today_str = now.date().isoformat()

    leads = db.query(Lead).filter(
        Lead.status.in_(["New", "Contacted", "Qualified"]),
    ).all()

    processed = 0
    created = 0

    for ld in leads:
        processed += 1
        owner_id = ld.owner_id
        if not owner_id:
            continue

        ref_time = ld.updated_at or ld.created_at
        if ref_time and ref_time.tzinfo is None:
            ref_time = ref_time.replace(tzinfo=timezone.utc)

        if ref_time and ref_time < seven_days_ago:
            dedup = f"lead:{ld.id}:stale:{today_str}"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="LEAD_FOLLOWUP",
                title=f"Lead Follow-up Needed: {ld.title}",
                message=f"Lead '{ld.title}' has had no recorded activity or updates in over 7 days. Please follow up with the company contact.",
                entity_type="lead",
                entity_id=ld.id,
                priority="MEDIUM",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 4. Opportunity Follow-up ---
def scan_opportunity_followups(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    today_str = now.date().isoformat()

    opps = db.query(Opportunity).filter(
        Opportunity.status == "Open",
    ).all()

    processed = 0
    created = 0

    for op in opps:
        processed += 1
        owner_id = op.owner_id
        if not owner_id:
            continue

        ref_time = op.updated_at or op.created_at
        if ref_time and ref_time.tzinfo is None:
            ref_time = ref_time.replace(tzinfo=timezone.utc)

        if ref_time and ref_time < seven_days_ago:
            dedup = f"opp:{op.id}:stale:{today_str}"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="OPPORTUNITY_FOLLOWUP",
                title=f"Opportunity Stagnant: {op.title}",
                message=f"Opportunity '{op.title}' valued at INR {op.value or 0:,.2f} has had no recent engagement for 7+ days.",
                entity_type="opportunity",
                entity_id=op.id,
                priority="HIGH",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 5. Invoice Reminders ---
def scan_invoice_reminders(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    today = date.today()
    three_days_later = today + timedelta(days=3)

    invoices = db.query(Invoice).filter(
        Invoice.status.in_(["SENT", "PARTIALLY_PAID", "OVERDUE"]),
        Invoice.due_date.isnot(None),
    ).all()

    processed = 0
    created = 0

    finance_users = get_users_by_permission(db, "accounting.view")

    for inv in invoices:
        processed += 1
        due_d = inv.due_date
        recipients = list(finance_users)

        # Overdue
        if due_d < today:
            dedup = f"inv:{inv.id}:overdue:{due_d.isoformat()}"
            for u in recipients:
                notif = create_notification_if_unique(
                    db=db,
                    user_id=u.id,
                    notification_type="INVOICE_DUE",
                    title=f"Invoice Overdue: {inv.invoice_number}",
                    message=f"Invoice {inv.invoice_number} is overdue since {due_d.isoformat()}. Amount Due: INR {inv.amount_due or 0:,.2f}.",
                    entity_type="invoice",
                    entity_id=inv.id,
                    priority="HIGH",
                    dedup_key=f"{dedup}:{u.id}",
                    organization_id=organization_id,
                )
                if notif:
                    created += 1
        # Due in 3 days or today
        elif today <= due_d <= three_days_later:
            dedup = f"inv:{inv.id}:due:{due_d.isoformat()}"
            for u in recipients:
                notif = create_notification_if_unique(
                    db=db,
                    user_id=u.id,
                    notification_type="INVOICE_DUE",
                    title=f"Invoice Approaching Due Date: {inv.invoice_number}",
                    message=f"Invoice {inv.invoice_number} is due on {due_d.isoformat()}. Amount Due: INR {inv.amount_due or 0:,.2f}.",
                    entity_type="invoice",
                    entity_id=inv.id,
                    priority="MEDIUM",
                    dedup_key=f"{dedup}:{u.id}",
                    organization_id=organization_id,
                )
                if notif:
                    created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 6. Payment Received ---
def scan_payment_received(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    # Scans posted payments and alerts finance/sales
    payments = db.query(CustomerPayment).filter(
        CustomerPayment.status == "POSTED",
    ).order_by(CustomerPayment.created_at.desc()).limit(50).all()

    processed = 0
    created = 0
    finance_users = get_users_by_permission(db, "accounting.view")

    for pay in payments:
        processed += 1
        dedup_base = f"payment:{pay.id}:received"
        for u in finance_users:
            notif = create_notification_if_unique(
                db=db,
                user_id=u.id,
                notification_type="PAYMENT_RECEIVED",
                title=f"Payment Received: {pay.payment_number}",
                message=f"Customer payment of INR {pay.amount or 0:,.2f} recorded under reference {pay.payment_number} via {pay.payment_method}.",
                entity_type="payment",
                entity_id=pay.id,
                priority="MEDIUM",
                dedup_key=f"{dedup_base}:{u.id}",
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 7. Service SLA ---
def scan_service_sla(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    tickets = db.query(Ticket).filter(
        Ticket.status.in_(["NEW", "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "REOPENED", "New", "Assigned", "In Progress"]),
    ).all()

    processed = 0
    created = 0

    for tk in tickets:
        processed += 1
        owner_id = tk.assigned_to_id
        if not owner_id:
            svc_mgrs = get_users_by_permission(db, "service.manage")
            owner_id = svc_mgrs[0].id if svc_mgrs else None
        if not owner_id:
            continue

        # Check response SLA warning (due within 30 min and not yet responded)
        if tk.first_response_due_at and not tk.first_response_at:
            resp_due = tk.first_response_due_at
            if resp_due.tzinfo is None:
                resp_due = resp_due.replace(tzinfo=timezone.utc)

            if resp_due < now or tk.sla_breached or tk.sla_status == "BREACHED":
                # Breached
                dedup = f"ticket:{tk.id}:sla_resp_breached"
                notif = create_notification_if_unique(
                    db=db,
                    user_id=owner_id,
                    notification_type="SLA_BREACH",
                    title=f"SLA Response Breached: Ticket #{tk.ticket_number}",
                    message=f"First response SLA breached for Ticket #{tk.ticket_number} ('{tk.subject}').",
                    entity_type="ticket",
                    entity_id=tk.id,
                    priority="CRITICAL",
                    dedup_key=dedup,
                    organization_id=organization_id,
                )
                if notif:
                    created += 1
            elif now <= resp_due <= now + timedelta(minutes=30):
                # Warning
                dedup = f"ticket:{tk.id}:sla_resp_warn"
                notif = create_notification_if_unique(
                    db=db,
                    user_id=owner_id,
                    notification_type="SLA_WARNING",
                    title=f"SLA Response Warning: Ticket #{tk.ticket_number}",
                    message=f"Ticket #{tk.ticket_number} response deadline is in less than 30 minutes.",
                    entity_type="ticket",
                    entity_id=tk.id,
                    priority="HIGH",
                    dedup_key=dedup,
                    organization_id=organization_id,
                )
                if notif:
                    created += 1

        # Check resolution SLA warning (due within 60 min and not resolved)
        if tk.due_at and tk.status not in ("RESOLVED", "CLOSED", "Resolved", "Closed"):
            res_due = tk.due_at
            if res_due.tzinfo is None:
                res_due = res_due.replace(tzinfo=timezone.utc)

            if res_due < now or tk.sla_breached or tk.sla_status == "BREACHED":
                dedup = f"ticket:{tk.id}:sla_res_breached"
                notif = create_notification_if_unique(
                    db=db,
                    user_id=owner_id,
                    notification_type="SLA_BREACH",
                    title=f"SLA Resolution Breached: Ticket #{tk.ticket_number}",
                    message=f"Resolution SLA breached for Ticket #{tk.ticket_number} ('{tk.subject}'). Immediate resolution required.",
                    entity_type="ticket",
                    entity_id=tk.id,
                    priority="CRITICAL",
                    dedup_key=dedup,
                    organization_id=organization_id,
                )
                if notif:
                    created += 1
            elif now <= res_due <= now + timedelta(minutes=60):
                dedup = f"ticket:{tk.id}:sla_res_warn"
                notif = create_notification_if_unique(
                    db=db,
                    user_id=owner_id,
                    notification_type="SLA_WARNING",
                    title=f"SLA Resolution Warning: Ticket #{tk.ticket_number}",
                    message=f"Resolution deadline for Ticket #{tk.ticket_number} is approaching within 1 hour.",
                    entity_type="ticket",
                    entity_id=tk.id,
                    priority="HIGH",
                    dedup_key=dedup,
                    organization_id=organization_id,
                )
                if notif:
                    created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 8. Project Delay ---
def scan_project_delays(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    today = now.date()

    processed = 0
    created = 0

    # A. Delayed projects
    projects = db.query(Project).filter(
        Project.status.in_(["Delayed", "At Risk"]),
    ).all()

    for p in projects:
        processed += 1
        owner_id = p.project_manager_id
        if not owner_id:
            pms = get_users_by_permission(db, "projects.manage")
            owner_id = pms[0].id if pms else None
        if not owner_id:
            continue

        dedup = f"project:{p.id}:delayed:{today.isoformat()}"
        notif = create_notification_if_unique(
            db=db,
            user_id=owner_id,
            notification_type="PROJECT_DELAY",
            title=f"Project Milestone at Risk: {p.name}",
            message=f"Project '{p.name}' is currently flagged as {p.status}. Delivery timeline requires mitigation.",
            entity_type="project",
            entity_id=p.id,
            priority="HIGH",
            dedup_key=dedup,
            organization_id=organization_id,
        )
        if notif:
            created += 1

    # B. Overdue Milestones
    milestones = db.query(Milestone).filter(
        Milestone.status != "Completed",
        Milestone.due_date.isnot(None),
    ).all()

    for m in milestones:
        processed += 1
        proj = db.query(Project).filter(Project.id == m.project_id).first()
        owner_id = proj.project_manager_id if proj else None
        if not owner_id:
            pms = get_users_by_permission(db, "projects.manage")
            owner_id = pms[0].id if pms else None
        if not owner_id:
            continue

        m_due = m.due_date
        if isinstance(m_due, datetime):
            m_due = m_due.date()

        if m_due < today:
            dedup = f"milestone:{m.id}:overdue:{m_due.isoformat()}"
            notif = create_notification_if_unique(
                db=db,
                user_id=owner_id,
                notification_type="PROJECT_DELAY",
                title=f"Overdue Milestone: {m.name}",
                message=f"Milestone '{m.name}' in project '{proj.name if proj else 'Unknown'}' is past its due date ({m_due.isoformat()}).",
                entity_type="milestone",
                entity_id=m.id,
                priority="HIGH",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


# --- 9. Critical QA Bug ---
def scan_critical_qa_bugs(db: Session, organization_id: str = "kct-default") -> Dict[str, int]:
    bugs = db.query(Bug).filter(
        Bug.severity == "CRITICAL",
        Bug.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED", "Open", "Assigned", "In Progress", "Reopened", "New"]),
    ).all()

    processed = 0
    created = 0

    for b in bugs:
        processed += 1
        recipients = set()
        if b.assigned_to_id:
            recipients.add(b.assigned_to_id)
        if b.reported_by_id:
            recipients.add(b.reported_by_id)

        # Also notify QA Leads / Project Managers
        qa_leads = get_users_by_permission(db, "bugs.view")
        for u in qa_leads[:3]:
            recipients.add(u.id)

        for uid in recipients:
            dedup = f"bug:{b.id}:critical:{uid}"
            notif = create_notification_if_unique(
                db=db,
                user_id=uid,
                notification_type="QA_CRITICAL_BUG",
                title=f"CRITICAL Bug Escalated: {b.bug_number}",
                message=f"CRITICAL severity bug '{b.title}' (#{b.bug_number}) is active and blocking delivery readiness.",
                entity_type="bug",
                entity_id=b.id,
                priority="CRITICAL",
                dedup_key=dedup,
                organization_id=organization_id,
            )
            if notif:
                created += 1

    return {"items_processed": processed, "notifications_created": created}


AUTOMATION_HANDLERS = {
    "TASK_REMINDERS": scan_task_reminders,
    "MEETING_REMINDERS": scan_meeting_reminders,
    "LEAD_FOLLOWUP": scan_lead_followups,
    "OPPORTUNITY_FOLLOWUP": scan_opportunity_followups,
    "INVOICE_REMINDERS": scan_invoice_reminders,
    "PAYMENT_RECEIVED": scan_payment_received,
    "SERVICE_SLA": scan_service_sla,
    "PROJECT_DELAY": scan_project_delays,
    "QA_CRITICAL_BUG": scan_critical_qa_bugs,
}


def execute_automation_rule(db: Session, rule_key: str, organization_id: str = "kct-default") -> AutomationJobLog:
    """Executes a single automation rule safely and writes an execution log."""
    ensure_default_rules(db, organization_id)
    rule = db.query(AutomationRule).filter(
        AutomationRule.organization_id == organization_id,
        AutomationRule.rule_key == rule_key,
    ).first()

    handler = AUTOMATION_HANDLERS.get(rule_key)
    if not handler:
        raise ValueError(f"Unknown automation rule key: {rule_key}")

    log = AutomationJobLog(
        organization_id=organization_id,
        job_name=rule_key,
        status="RUNNING",
        started_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.flush()

    if rule and not rule.is_enabled:
        log.status = "SUCCESS"
        log.items_processed = 0
        log.notifications_created = 0
        log.error_message = "Rule is currently disabled"
        log.finished_at = datetime.now(timezone.utc)
        db.flush()
        return log

    try:
        results = handler(db, organization_id)
        log.status = "SUCCESS"
        log.items_processed = results.get("items_processed", 0)
        log.notifications_created = results.get("notifications_created", 0)
        log.finished_at = datetime.now(timezone.utc)

        if rule:
            rule.last_run_at = datetime.now(timezone.utc)

        record_audit_log(
            db=db,
            action="AUTOMATION_EXECUTED",
            entity_type="automation_rule",
            entity_id=rule.id if rule else None,
            new_values={
                "rule_key": rule_key,
                "items_processed": log.items_processed,
                "notifications_created": log.notifications_created,
            },
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Automation execution failed for {rule_key}: {e}", exc_info=True)
        log.status = "FAILED"
        log.error_message = str(e)
        log.finished_at = datetime.now(timezone.utc)
        db.add(log)
        db.commit()

    return log


def execute_all_automations(db: Session, organization_id: str = "kct-default") -> List[AutomationJobLog]:
    """Runs all 9 startup business automation scans sequentially."""
    ensure_default_rules(db, organization_id)
    logs = []
    for key in AUTOMATION_HANDLERS:
        log = execute_automation_rule(db, key, organization_id)
        logs.append(log)
    return logs
