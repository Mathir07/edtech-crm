from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

from app.users.models import User
from app.organizations.models import Company, Contact
from app.crm.models import Lead
from app.sales.models import Opportunity, Quotation, Product
from app.projects.models import Project, Milestone, ProjectTask
from app.projects.calculations import recalculate_project_progress, validate_project_delivery_readiness
from app.qa.models import Bug, TestSuite, TestCase
from app.service.models import Ticket
from app.accounting.models import Invoice, CustomerPayment, Bill
from app.accounting.reports import get_ar_aging
from app.activities.models import Task, Meeting
from app.reports.queries import (
    get_crm_summary_data,
    get_sales_summary_data,
    get_projects_summary_data,
    get_qa_summary_data,
    get_service_summary_data,
    get_finance_summary_data,
)


def _check_permission(user: User, perm: str) -> bool:
    if getattr(user, "is_superuser", False) or getattr(user, "role", "") == "ADMIN":
        return True
    codes = user.get_permission_codes() if hasattr(user, "get_permission_codes") else []
    return "*" in codes or perm in codes


def tool_search_crm(db: Session, user: User, query: str, limit: int = 8) -> Dict[str, Any]:
    perms = user.get_permission_codes() if hasattr(user, "get_permission_codes") else []
    is_super = getattr(user, "is_superuser", False) or "*" in perms
    s = f"%{query}%"
    results: List[Dict[str, Any]] = []

    # Colleges
    if is_super or "crm.companies.view" in perms:
        cols = db.query(Company).filter(
            Company.is_deleted == False,
            (Company.organization_name.ilike(s)) | (Company.code.ilike(s)) | (Company.city.ilike(s))
        ).limit(limit).all()
        for c in cols:
            results.append({
                "id": c.id,
                "type": "company",
                "title": c.organization_name,
                "subtitle": f"Code: {c.code} | {c.city or 'India'}",
                "url": f"/companies/{c.id}",
            })

    # Projects
    if is_super or "projects.view" in perms:
        prjs = db.query(Project).filter(
            Project.is_deleted == False,
            (Project.name.ilike(s)) | (Project.project_number.ilike(s))
        ).limit(limit).all()
        for p in prjs:
            results.append({
                "id": p.id,
                "type": "project",
                "title": f"{p.project_number}: {p.name}",
                "subtitle": f"Status: {p.status} | Progress: {float(p.progress_percentage):.0f}%",
                "url": f"/projects/{p.id}",
            })

    # Service Tickets
    if is_super or "service.view" in perms or "crm.companies.view" in perms:
        tks = db.query(Ticket).filter(
            Ticket.is_deleted == False,
            (Ticket.subject.ilike(s)) | (Ticket.ticket_number.ilike(s))
        ).limit(limit).all()
        for tk in tks:
            results.append({
                "id": tk.id,
                "type": "ticket",
                "title": f"{tk.ticket_number}: {tk.subject}",
                "subtitle": f"Priority: {tk.priority} | Status: {tk.status} | SLA: {tk.sla_status}",
                "url": f"/service/tickets/{tk.id}",
            })

    # Bugs
    if is_super or "bugs.view" in perms or "qa.view" in perms:
        bgs = db.query(Bug).filter(
            Bug.is_deleted == False,
            (Bug.title.ilike(s)) | (Bug.bug_number.ilike(s))
        ).limit(limit).all()
        for b in bgs:
            results.append({
                "id": b.id,
                "type": "bug",
                "title": f"{b.bug_number}: {b.title}",
                "subtitle": f"Severity: {b.severity} | Status: {b.status}",
                "url": f"/bugs/{b.id}",
            })

    # Leads & Opportunities
    if is_super or "crm.leads.view" in perms:
        leads = db.query(Lead).filter(
            Lead.is_deleted == False,
            (Lead.title.ilike(s)) | (Lead.description.ilike(s))
        ).limit(limit).all()
        for l in leads:
            results.append({
                "id": l.id,
                "type": "lead",
                "title": l.title,
                "subtitle": f"Status: {l.status} | Value: ₹{l.expected_value:,.2f}",
                "url": f"/leads/{l.id}",
            })

    # Invoices (strictly permission-gated)
    if is_super or "accounting.view" in perms:
        invs = db.query(Invoice).filter(
            Invoice.is_deleted == False,
            (Invoice.invoice_number.ilike(s))
        ).limit(limit).all()
        for inv in invs:
            results.append({
                "id": inv.id,
                "type": "invoice",
                "title": f"Invoice {inv.invoice_number}",
                "subtitle": f"Status: {inv.status} | Total: ₹{float(inv.total_amount):,.2f}",
                "url": f"/accounting/invoices/{inv.id}",
            })

    return {"search": results[:limit]}


def tool_company_summary(db: Session, user: User, target: str) -> Dict[str, Any]:
    if not _check_permission(user, "crm.companies.view"):
        return {"permission_denied": True, "message": "You do not have permission to view College records."}

    col = db.query(Company).filter(
        Company.is_deleted == False,
        or_(Company.id == target, Company.organization_name.ilike(f"%{target}%"), Company.code.ilike(target))
    ).first()

    if not col:
        return {"company": None}

    contacts = db.query(Contact).filter(Contact.company_id == col.id, Contact.is_deleted == False).all()
    leads = db.query(Lead).filter(Lead.company_id == col.id, Lead.is_deleted == False).all()
    opps = db.query(Opportunity).filter(Opportunity.company_id == col.id, Opportunity.is_deleted == False).all()
    projects = db.query(Project).filter(Project.company_id == col.id, Project.is_deleted == False).all()
    tickets = db.query(Ticket).filter(
        Ticket.company_id == col.id,
        Ticket.is_deleted == False,
        Ticket.status.notin_(["RESOLVED", "CLOSED"])
    ).all()

    has_finance = _check_permission(user, "accounting.view")
    unpaid_count = 0
    outstanding_bal = 0.0

    if has_finance:
        invoices = db.query(Invoice).filter(
            Invoice.company_id == col.id,
            Invoice.is_deleted == False,
            Invoice.status.in_(["SENT", "PARTIALLY_PAID", "OVERDUE"])
        ).all()
        unpaid_count = len(invoices)
        outstanding_bal = sum(float(inv.amount_due or 0.0) for inv in invoices)

    recent_tks = [{
        "id": t.id,
        "ticket_number": t.ticket_number,
        "subject": t.subject,
        "status": t.status,
        "sla_status": t.sla_status,
    } for t in tickets[:5]]

    recent_opps = [{
        "id": o.id,
        "title": o.title,
        "value": float(o.value or 0.0),
        "stage": o.stage.name if o.stage else "Open",
    } for o in opps[:5]]

    return {
        "company": {
            "id": col.id,
            "name": col.organization_name,
            "code": col.code,
            "type": col.type,
            "city": col.city,
            "contact_count": len(contacts),
            "lead_count": len(leads),
            "opportunity_count": len(opps),
            "opportunity_value": sum(float(o.value or 0.0) for o in opps),
            "project_count": len(projects),
            "open_ticket_count": len(tickets),
            "recent_tickets": recent_tks,
            "recent_opportunities": recent_opps,
            "has_finance_access": has_finance,
            "unpaid_invoices_count": unpaid_count,
            "outstanding_balance": outstanding_bal,
        }
    }


def tool_project_summary(db: Session, user: User, target: str) -> Dict[str, Any]:
    if not _check_permission(user, "projects.view"):
        return {"permission_denied": True, "message": "You do not have permission to view Project records."}

    prj = db.query(Project).filter(
        Project.is_deleted == False,
        or_(Project.id == target, Project.name.ilike(f"%{target}%"), Project.project_number.ilike(target))
    ).first()

    if not prj:
        return {"project": None}

    # Authoritative calculations
    progress = recalculate_project_progress(db, prj.id)
    readiness = validate_project_delivery_readiness(db, prj.id)

    milestones = db.query(Milestone).filter(Milestone.project_id == prj.id).all()
    completed_m = sum(1 for m in milestones if m.status == "COMPLETED")

    # Bugs
    critical_bugs = db.query(Bug).filter(
        Bug.project_id == prj.id,
        Bug.is_deleted == False,
        Bug.severity == "CRITICAL",
        Bug.status.notin_(["CLOSED", "RESOLVED"])
    ).count()

    high_bugs = db.query(Bug).filter(
        Bug.project_id == prj.id,
        Bug.is_deleted == False,
        Bug.severity == "HIGH",
        Bug.status.notin_(["CLOSED", "RESOLVED"])
    ).count()

    total_open_bugs = db.query(Bug).filter(
        Bug.project_id == prj.id,
        Bug.is_deleted == False,
        Bug.status.notin_(["CLOSED", "RESOLVED"])
    ).count()

    return {
        "project": {
            "id": prj.id,
            "name": prj.name,
            "project_number": prj.project_number,
            "status": prj.status,
            "company_id": prj.company_id,
            "company_name": prj.company.organization_name if prj.company else "N/A",
            "progress_percentage": progress,
            "total_milestones": len(milestones),
            "completed_milestones": completed_m,
            "delivery_readiness": readiness.get("readiness_status", "UNKNOWN"),
            "blocking_issues": readiness.get("blocking_issues", []),
            "bugs_summary": {
                "critical": critical_bugs,
                "high": high_bugs,
                "open_total": total_open_bugs,
            },
        }
    }


def tool_service_summary(db: Session, user: User, query: Optional[str] = None) -> Dict[str, Any]:
    if not (_check_permission(user, "service.view") or _check_permission(user, "crm.companies.view")):
        return {"permission_denied": True, "message": "You do not have permission to view Service and Support records."}

    open_tickets = db.query(Ticket).filter(
        Ticket.is_deleted == False,
        Ticket.status.notin_(["RESOLVED", "CLOSED"])
    ).all()

    breached = []
    at_risk = []

    for tk in open_tickets:
        is_breached = tk.sla_breached or tk.sla_status == "BREACHED"
        if is_breached:
            breached.append({
                "id": tk.id,
                "ticket_number": tk.ticket_number,
                "subject": tk.subject,
                "status": tk.status,
                "priority": tk.priority,
                "sla_status": "BREACHED",
            })
        elif tk.sla_status == "AT_RISK":
            at_risk.append({
                "id": tk.id,
                "ticket_number": tk.ticket_number,
                "subject": tk.subject,
                "status": tk.status,
                "priority": tk.priority,
                "sla_status": "AT_RISK",
            })

    return {
        "service": {
            "total_open": len(open_tickets),
            "breached_tickets": breached,
            "at_risk_tickets": at_risk,
        }
    }


def tool_qa_summary(db: Session, user: User, target: Optional[str] = None) -> Dict[str, Any]:
    if not (_check_permission(user, "bugs.view") or _check_permission(user, "qa.view")):
        return {"permission_denied": True, "message": "You do not have permission to view QA & Bug records."}

    q = db.query(Bug).filter(
        Bug.is_deleted == False,
        Bug.status.notin_(["CLOSED", "RESOLVED"])
    )
    if target:
        q = q.filter(or_(Bug.title.ilike(f"%{target}%"), Bug.bug_number.ilike(target)))

    open_bugs = q.all()
    critical = [b for b in open_bugs if b.severity == "CRITICAL"]
    high = [b for b in open_bugs if b.severity == "HIGH"]

    crit_list = [{
        "id": b.id,
        "bug_number": b.bug_number,
        "title": b.title,
        "status": b.status,
        "project_name": b.project.name if b.project else "N/A",
    } for b in critical]

    return {
        "qa": {
            "total_open_bugs": len(open_bugs),
            "critical_bugs_count": len(critical),
            "high_bugs_count": len(high),
            "critical_bugs": crit_list,
        }
    }


def tool_finance_summary(db: Session, user: User, query: Optional[str] = None) -> Dict[str, Any]:
    if not _check_permission(user, "accounting.view"):
        return {
            "permission_denied": True,
            "message": "I don't have access to financial information for your account.",
        }

    # Authoritative query for overdue & pending invoices
    now = datetime.now(timezone.utc).date()
    invoices = db.query(Invoice).filter(
        Invoice.is_deleted == False,
        Invoice.status.in_(["SENT", "PARTIALLY_PAID", "OVERDUE"])
    ).all()

    overdue_invoices = []
    total_overdue = 0.0
    total_outstanding = 0.0

    for inv in invoices:
        due_val = float(inv.amount_due or 0.0)
        total_outstanding += due_val
        is_overdue = inv.status == "OVERDUE" or (inv.due_date and inv.due_date < now)
        if is_overdue:
            total_overdue += due_val
            overdue_invoices.append({
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "company_name": inv.company.organization_name if inv.company else "Customer",
                "balance_due": due_val,
                "due_date": str(inv.due_date),
            })

    return {
        "finance": {
            "total_pending_invoices": len(invoices),
            "total_ar_outstanding": total_outstanding,
            "overdue_count": len(overdue_invoices),
            "total_overdue_amount": total_overdue,
            "overdue_invoices": overdue_invoices[:5],
        }
    }


def tool_followups(db: Session, user: User) -> Dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    today = now_utc.date()
    cutoff_7d = now_utc - timedelta(days=7)

    # 1. Overdue tasks for user (or all if admin)
    task_q = db.query(Task).filter(
        Task.status.notin_(["Completed", "Cancelled", "COMPLETED", "CANCELLED"]),
        Task.due_date < now_utc
    )
    if not (getattr(user, "is_superuser", False) or getattr(user, "role", "") == "ADMIN"):
        task_q = task_q.filter(Task.assigned_to_id == user.id)
    overdue_tasks = task_q.limit(5).all()

    # 2. Upcoming meetings today
    meet_q = db.query(Meeting).filter(
        func.date(Meeting.start_time) == today,
        Meeting.status.in_(["Scheduled", "SCHEDULED"])
    )
    if not (getattr(user, "is_superuser", False) or getattr(user, "role", "") == "ADMIN"):
        meet_q = meet_q.filter(Meeting.organizer_id == user.id)
    meetings = meet_q.limit(5).all()

    # 3. Dormant leads (> 7 days without update)
    lead_q = db.query(Lead).filter(
        Lead.is_deleted == False,
        Lead.status.notin_(["Converted", "Disqualified", "Lost"]),
        Lead.updated_at < cutoff_7d
    )
    if not (getattr(user, "is_superuser", False) or getattr(user, "role", "") == "ADMIN"):
        lead_q = lead_q.filter(Lead.owner_id == user.id)
    dormant_leads = lead_q.limit(5).all()

    # 4. Dormant opportunities (> 7 days without update)
    opp_q = db.query(Opportunity).filter(
        Opportunity.is_deleted == False,
        Opportunity.status == "Open",
        Opportunity.updated_at < cutoff_7d
    )
    if not (getattr(user, "is_superuser", False) or getattr(user, "role", "") == "ADMIN"):
        opp_q = opp_q.filter(Opportunity.owner_id == user.id)
    dormant_opps = opp_q.limit(5).all()

    return {
        "followups": {
            "overdue_tasks": [{
                "id": t.id,
                "title": t.title,
                "due_date": str(t.due_date),
                "priority": t.priority,
            } for t in overdue_tasks],
            "upcoming_meetings": [{
                "id": m.id,
                "title": m.title,
                "start_time": m.start_time.isoformat() if m.start_time else "",
            } for m in meetings],
            "dormant_leads": [{
                "id": l.id,
                "title": l.title,
                "status": l.status,
                "owner_name": (l.owner.full_name if hasattr(l.owner, "full_name") else f"{l.owner.first_name} {l.owner.last_name}") if l.owner else "Unassigned",
            } for l in dormant_leads],
            "dormant_opportunities": [{
                "id": o.id,
                "title": o.title,
                "value": float(o.value or 0.0),
                "stage": o.stage.name if o.stage else "Open",
            } for o in dormant_opps],
        }
    }


def tool_reports_explanation(db: Session, user: User, report_type: str) -> Dict[str, Any]:
    rt = report_type.lower().strip()
    if "sale" in rt or "pipeline" in rt:
        if not (_check_permission(user, "reports.view_sales") or _check_permission(user, "reports.view")):
            return {"permission_denied": True, "message": "You do not have permission to view Sales reports."}
        data = get_sales_summary_data(db)
        return {
            "reports": {
                "title": "Sales & Pipeline Report Explanation",
                "summary": "Current pipeline and conversion metrics across open and closed deals.",
                "metrics": {
                    "Total Quotations Value (INR)": data.get("quotations_value", 0.0),
                    "Quotations Count": data.get("quotations_count", 0),
                    "Sales Orders Count": data.get("sales_orders_count", 0),
                    "Sales Orders Value (INR)": data.get("sales_orders_value", 0.0),
                    "Won Revenue (INR)": data.get("won_revenue", 0.0),
                }
            }
        }

    if "finance" in rt or "aging" in rt:
        if not (_check_permission(user, "reports.view_finance") or _check_permission(user, "accounting.view")):
            return {"permission_denied": True, "message": "I don't have access to financial information for your account."}
        data = get_finance_summary_data(db)
        return {
            "reports": {
                "title": "Finance & Aging Report Explanation",
                "summary": "Authoritative summary of accounts receivable aging and revenue.",
                "metrics": {
                    "Total Invoiced (INR)": data.get("total_invoiced", 0.0),
                    "Total Collected (INR)": data.get("total_collected", 0.0),
                    "Total AR Outstanding (INR)": data.get("total_ar_outstanding", 0.0),
                    "Total AP Outstanding (INR)": data.get("total_ap_outstanding", 0.0),
                }
            }
        }

    if "service" in rt or "sla" in rt:
        if not (_check_permission(user, "reports.view_service") or _check_permission(user, "reports.view")):
            return {"permission_denied": True, "message": "You do not have permission to view Service reports."}
        data = get_service_summary_data(db)
        return {
            "reports": {
                "title": "Service & SLA Report Explanation",
                "summary": "Ticket resolution volume, first-response times, and SLA compliance metrics.",
                "metrics": {
                    "Total Open Tickets": data.get("open_tickets", 0),
                    "Resolved Tickets": data.get("resolved_tickets", 0),
                    "SLA Compliance Rate": f"{data.get('sla_compliance_rate', 100.0):.1f}%",
                    "SLA Breaches": data.get("sla_breaches", 0),
                }
            }
        }

    # Default to executive / crm dashboard
    if not (_check_permission(user, "reports.view_executive") or _check_permission(user, "reports.view")):
        return {"permission_denied": True, "message": "You do not have permission to view Executive reports."}
    data = get_crm_summary_data(db)
    return {
        "reports": {
            "title": "Executive CRM Overview Explanation",
            "summary": "High-level health of Kiwi Cloud Tech CRM operations across Leads and Opportunities.",
            "metrics": {
                "Total Leads": data.get("total_leads", 0),
                "Qualified Leads": data.get("qualified_leads", 0),
                "Total Opportunities": data.get("total_opportunities", 0),
                "Open Opportunities": data.get("open_opportunities", 0),
                "Win Rate": f"{data.get('opportunity_win_rate', 0.0) * 100:.1f}%",
            }
        }
    }


def tool_draft_communication(
    db: Session,
    user: User,
    channel: str = "EMAIL",
    recipient: str = "Customer",
    topic: str = "follow-up",
    context: Optional[str] = None
) -> Dict[str, Any]:
    ch = channel.upper()
    sub = f"Update regarding {topic.title()}"
    greeting = f"Dear {recipient},"

    if "payment" in topic.lower() or "invoice" in topic.lower():
        if not _check_permission(user, "accounting.view"):
            return {"permission_denied": True, "message": "You do not have permission to draft financial communications."}
        sub = f"Gentle Reminder: Outstanding Invoice from Kiwi Cloud Tech"
        body = (
            f"{greeting}\n\n"
            f"We hope this email finds you well. This is a friendly reminder regarding your pending invoice with Kiwi Cloud Tech. "
            f"Please let us know if you need another copy of the invoice or assistance with payment details.\n\n"
            f"We appreciate your prompt partnership.\n\n"
            f"Warm regards,\n"
            f"{getattr(user, 'name', 'Finance Team')}\n"
            f"Kiwi Cloud Tech"
        )
    elif "service" in topic.lower() or "ticket" in topic.lower():
        sub = f"Update regarding your Service Request with Kiwi Cloud Tech"
        body = (
            f"{greeting}\n\n"
            f"Thank you for contacting Kiwi Cloud Tech Support. We are actively reviewing your ticket. "
            f"Our engineering team is addressing the reported item to ensure complete resolution.\n\n"
            f"We will update you as soon as further progress is confirmed.\n\n"
            f"Best regards,\n"
            f"{getattr(user, 'name', 'Support Agent')}\n"
            f"Kiwi Cloud Tech Support Team"
        )
    elif "project" in topic.lower():
        sub = f"Project Milestone Status Update — Kiwi Cloud Tech"
        body = (
            f"{greeting}\n\n"
            f"Here is a brief status update on your ongoing deployment project. All deliverables are being tracked "
            f"according to schedule and our delivery milestones.\n\n"
            f"Please reach out if you have any questions or schedule adjustments.\n\n"
            f"Sincerely,\n"
            f"{getattr(user, 'name', 'Project Lead')}\n"
            f"Kiwi Cloud Tech Projects"
        )
    else:
        body = (
            f"{greeting}\n\n"
            f"I hope you are having a productive week. Following up on our recent conversation regarding {topic}, "
            f"we would love to know if you have any questions or if there is anything we can assist you with.\n\n"
            f"Looking forward to connecting soon.\n\n"
            f"Best regards,\n"
            f"{getattr(user, 'name', 'CRM Associate')}\n"
            f"Kiwi Cloud Tech"
        )

    return {
        "draft": {
            "channel": ch,
            "recipient": recipient,
            "subject": sub,
            "content": body,
            "note": "Draft generated successfully. Manual user review is required before dispatch.",
        }
    }


tool_college_summary = tool_company_summary
