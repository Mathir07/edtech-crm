from datetime import date, datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

from app.crm.models import Lead, LeadSource
from app.sales.models import Opportunity, PipelineStage, Quotation, SalesOrder
from app.projects.models import Project, Milestone, ProjectTask
from app.qa.models import Bug, TestCase, TestExecution
from app.service.models import Ticket, ServiceCategory
from app.accounting.models import Invoice, CustomerPayment, Bill, VendorPayment, Expense
from app.communication.models import CommunicationMessage
from app.users.models import User
from app.organizations.models import Company
from app.activities.models import Activity, Task

from app.reports.calculations import safe_div, is_date_overdue
from app.projects.calculations import recalculate_project_progress, validate_project_delivery_readiness
from app.accounting.reports import get_ar_aging, get_ap_aging


def get_crm_summary_data(
    db: Session,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    company_id: Optional[str] = None,
    owner_id: Optional[str] = None,
) -> Dict[str, Any]:
    lead_q = db.query(Lead).filter(Lead.is_deleted == False)
    opp_q = db.query(Opportunity).filter(Opportunity.is_deleted == False)

    if company_id:
        lead_q = lead_q.filter(Lead.company_id == company_id)
        opp_q = opp_q.filter(Opportunity.company_id == company_id)
    if owner_id:
        lead_q = lead_q.filter(Lead.owner_id == owner_id)
        opp_q = opp_q.filter(Opportunity.owner_id == owner_id)
    if date_from:
        lead_q = lead_q.filter(func.date(Lead.created_at) >= date_from)
        opp_q = opp_q.filter(func.date(Opportunity.created_at) >= date_from)
    if date_to:
        lead_q = lead_q.filter(func.date(Lead.created_at) <= date_to)
        opp_q = opp_q.filter(func.date(Opportunity.created_at) <= date_to)

    leads = lead_q.all()
    opps = opp_q.all()

    total_leads = len(leads)
    new_leads = sum(1 for l in leads if l.status == "New")
    qualified_leads = sum(1 for l in leads if l.status in ["Qualified", "Converted"])

    total_opps = len(opps)
    open_opps = sum(1 for o in opps if o.status == "Open")
    won_opps = sum(1 for o in opps if o.status == "Won")
    lost_opps = sum(1 for o in opps if o.status == "Lost")
    total_opp_val = sum(float(o.value or 0.0) for o in opps)

    conv_rate = safe_div(qualified_leads, total_leads)
    win_rate = safe_div(won_opps, (won_opps + lost_opps)) if (won_opps + lost_opps) > 0 else 0.0
    avg_deal_val = round(total_opp_val / total_opps, 2) if total_opps > 0 else 0.0

    return {
        "total_leads": total_leads,
        "new_leads": new_leads,
        "qualified_leads": qualified_leads,
        "total_opportunities": total_opps,
        "open_opportunities": open_opps,
        "won_opportunities": won_opps,
        "lost_opportunities": lost_opps,
        "lead_conversion_rate": conv_rate,
        "opportunity_win_rate": win_rate,
        "average_deal_value": avg_deal_val,
    }


def get_sales_summary_data(
    db: Session,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    company_id: Optional[str] = None,
    owner_id: Optional[str] = None,
) -> Dict[str, Any]:
    quot_q = db.query(Quotation).filter(Quotation.is_deleted == False)
    so_q = db.query(SalesOrder).filter(SalesOrder.is_deleted == False)
    opp_q = db.query(Opportunity).filter(Opportunity.is_deleted == False)

    if company_id:
        quot_q = quot_q.filter(Quotation.company_id == company_id)
        so_q = so_q.filter(SalesOrder.company_id == company_id)
        opp_q = opp_q.filter(Opportunity.company_id == company_id)
    if owner_id:
        quot_q = quot_q.filter(Quotation.created_by_id == owner_id)
        so_q = so_q.filter(SalesOrder.created_by_id == owner_id)
        opp_q = opp_q.filter(Opportunity.owner_id == owner_id)
    if date_from:
        quot_q = quot_q.filter(func.date(Quotation.created_at) >= date_from)
        so_q = so_q.filter(func.date(SalesOrder.created_at) >= date_from)
        opp_q = opp_q.filter(func.date(Opportunity.created_at) >= date_from)
    if date_to:
        quot_q = quot_q.filter(func.date(Quotation.created_at) <= date_to)
        so_q = so_q.filter(func.date(SalesOrder.created_at) <= date_to)
        opp_q = opp_q.filter(func.date(Opportunity.created_at) <= date_to)

    quots = quot_q.all()
    sos = so_q.all()
    opps = opp_q.all()

    quots_count = len(quots)
    quots_val = float(sum(Decimal(str(q.total_amount or 0.0)) for q in quots))
    sos_count = len(sos)
    sos_val = float(sum(Decimal(str(s.total_amount or 0.0)) for s in sos))

    won_rev = float(sum(Decimal(str(o.value or 0.0)) for o in opps if o.status == "Won"))

    # Proposals pending / negotiation
    pending_props = float(sum(Decimal(str(o.value or 0.0)) for o in opps if o.status == "Open" and o.stage and "proposal" in o.stage.name.lower()))
    neg_val = float(sum(Decimal(str(o.value or 0.0)) for o in opps if o.status == "Open" and o.stage and "negot" in o.stage.name.lower()))

    return {
        "quotations_count": quots_count,
        "quotations_value": round(quots_val, 2),
        "sales_orders_count": sos_count,
        "sales_orders_value": round(sos_val, 2),
        "won_revenue": round(won_rev, 2),
        "pending_proposals_value": round(pending_props, 2),
        "negotiation_value": round(neg_val, 2),
    }


def get_pipeline_stages_data(
    db: Session,
    company_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[Dict[str, Any]]:
    stages = db.query(PipelineStage).order_by(PipelineStage.order.asc()).all()
    res = []

    for stg in stages:
        q = db.query(Opportunity).filter(
            Opportunity.stage_id == stg.id,
            Opportunity.is_deleted == False,
        )
        if company_id:
            q = q.filter(Opportunity.company_id == company_id)
        if owner_id:
            q = q.filter(Opportunity.owner_id == owner_id)
        if date_from:
            q = q.filter(func.date(Opportunity.created_at) >= date_from)
        if date_to:
            q = q.filter(func.date(Opportunity.created_at) <= date_to)

        opps = q.all()
        cnt = len(opps)
        val = sum(float(o.value or 0.0) for o in opps)
        prob = float(stg.probability if stg.probability is not None else 0.0)
        weighted = val * (prob / 100.0)

        res.append({
            "stage_id": stg.id,
            "stage_name": stg.name,
            "order": stg.order,
            "color": stg.color or "#6366f1",
            "opportunity_count": cnt,
            "opportunity_value": round(val, 2),
            "weighted_value": round(weighted, 2),
        })
    return res


def get_projects_summary_data(
    db: Session,
    company_id: Optional[str] = None,
) -> Dict[str, Any]:
    pq = db.query(Project).filter(Project.is_deleted == False)
    if company_id:
        pq = pq.filter(Project.company_id == company_id)

    projects = pq.all()
    total_projects = len(projects)
    active = sum(1 for p in projects if p.status in ["IN_PROGRESS", "NOT_STARTED"])
    completed = sum(1 for p in projects if p.status == "COMPLETED")

    # Evaluate health and milestones
    delayed = 0
    at_risk = 0
    total_progress = 0.0

    today = date.today()
    tasks_done = 0
    tasks_pending = 0
    milestones_done = 0
    milestones_pending = 0

    for p in projects:
        # Recalculate live progress
        prog = recalculate_project_progress(db, p.id)
        total_progress += prog

        # Check tasks & milestones
        p_tasks = db.query(ProjectTask).filter(ProjectTask.project_id == p.id, ProjectTask.is_deleted == False).all()
        p_milestones = db.query(Milestone).filter(Milestone.project_id == p.id).all()

        t_done = sum(1 for t in p_tasks if t.status == "COMPLETED")
        t_pend = len(p_tasks) - t_done
        tasks_done += t_done
        tasks_pending += t_pend

        m_done = sum(1 for m in p_milestones if m.status == "COMPLETED")
        m_pend = len(p_milestones) - m_done
        milestones_done += m_done
        milestones_pending += m_pend

        # Check delays
        has_overdue_task = any(is_date_overdue(t.due_date, today) and t.status != "COMPLETED" for t in p_tasks)
        has_overdue_milestone = any(is_date_overdue(m.due_date, today) and m.status != "COMPLETED" for m in p_milestones)

        # Check QA readiness
        qa_readiness = validate_project_delivery_readiness(db, p.id)
        has_critical_bugs = qa_readiness.get("critical_high_bugs", 0) > 0

        if p.status == "COMPLETED":
            pass
        elif has_overdue_milestone or has_overdue_task:
            delayed += 1
        elif has_critical_bugs or not qa_readiness.get("is_ready", True):
            at_risk += 1

    avg_prog = round(total_progress / total_projects, 2) if total_projects > 0 else 0.0

    return {
        "active_projects": active,
        "completed_projects": completed,
        "delayed_projects": delayed,
        "at_risk_projects": at_risk,
        "average_progress": avg_prog,
        "tasks_completed": tasks_done,
        "tasks_pending": tasks_pending,
        "milestones_completed": milestones_done,
        "milestones_pending": milestones_pending,
    }


def get_qa_summary_data(
    db: Session,
    project_id: Optional[str] = None,
) -> Dict[str, Any]:
    bq = db.query(Bug).filter(Bug.is_deleted == False)
    tq = db.query(TestCase)

    if project_id:
        bq = bq.filter(Bug.project_id == project_id)
        tq = tq.filter(TestCase.project_id == project_id)

    bugs = bq.all()
    test_cases = tq.all()

    total_bugs = len(bugs)
    open_bugs = sum(1 for b in bugs if b.status not in ["CLOSED", "WONT_FIX"])
    critical_bugs = sum(1 for b in bugs if b.severity == "CRITICAL" and b.status not in ["CLOSED", "WONT_FIX"])
    high_bugs = sum(1 for b in bugs if b.severity == "HIGH" and b.status not in ["CLOSED", "WONT_FIX"])
    resolved_bugs = sum(1 for b in bugs if b.status in ["RESOLVED", "VERIFIED", "CLOSED"])

    total_cases = len(test_cases)
    passed_cases = sum(1 for tc in test_cases if tc.status == "PASSED")
    failed_cases = sum(1 for tc in test_cases if tc.status == "FAILED")
    executed = passed_cases + failed_cases
    pass_rate = safe_div(passed_cases, executed) if executed > 0 else 0.0

    return {
        "total_bugs": total_bugs,
        "open_bugs": open_bugs,
        "critical_bugs": critical_bugs,
        "high_severity_bugs": high_bugs,
        "resolved_bugs": resolved_bugs,
        "total_test_cases": total_cases,
        "passed_executions": passed_cases,
        "failed_executions": failed_cases,
        "test_pass_rate": pass_rate,
    }


def get_service_summary_data(
    db: Session,
    company_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> Dict[str, Any]:
    tq = db.query(Ticket).filter(Ticket.is_deleted == False)
    if company_id:
        tq = tq.filter(Ticket.company_id == company_id)
    if date_from:
        tq = tq.filter(func.date(Ticket.created_at) >= date_from)
    if date_to:
        tq = tq.filter(func.date(Ticket.created_at) <= date_to)

    tickets = tq.all()
    total_tickets = len(tickets)

    open_statuses = ["NEW", "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_INTERNAL", "REOPENED"]
    open_count = sum(1 for t in tickets if t.status in open_statuses)
    new_count = sum(1 for t in tickets if t.status == "NEW")
    in_prog = sum(1 for t in tickets if t.status in ["IN_PROGRESS", "ASSIGNED"])
    waiting = sum(1 for t in tickets if t.status in ["WAITING_FOR_CUSTOMER", "WAITING_FOR_INTERNAL"])
    resolved = sum(1 for t in tickets if t.status in ["RESOLVED", "CUSTOMER_CONFIRMATION"])
    closed = sum(1 for t in tickets if t.status == "CLOSED")

    sla_breaches = sum(1 for t in tickets if t.sla_breached or t.sla_status == "BREACHED")
    compliant = total_tickets - sla_breaches
    sla_rate = safe_div(compliant, total_tickets) if total_tickets > 0 else 100.0

    critical = sum(1 for t in tickets if t.priority == "CRITICAL" and t.status in open_statuses)

    # Resolution time calculation
    res_durations = []
    for t in tickets:
        if t.resolved_at and t.created_at:
            delta = (t.resolved_at - t.created_at).total_seconds() / 3600.0
            if delta >= 0:
                res_durations.append(delta)
    avg_res_hours = round(sum(res_durations) / len(res_durations), 1) if res_durations else 0.0

    return {
        "open_tickets": open_count,
        "new_tickets": new_count,
        "in_progress_tickets": in_prog,
        "waiting_customer_tickets": waiting,
        "resolved_tickets": resolved,
        "closed_tickets": closed,
        "sla_breaches": sla_breaches,
        "sla_compliance_rate": sla_rate,
        "critical_tickets": critical,
        "avg_resolution_time_hours": avg_res_hours,
    }


def get_finance_summary_data(
    db: Session,
    company_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> Dict[str, Any]:
    inv_q = db.query(Invoice).filter(Invoice.is_deleted == False)
    pay_q = db.query(CustomerPayment)
    bill_q = db.query(Bill)
    exp_q = db.query(Expense)

    if company_id:
        inv_q = inv_q.filter(Invoice.company_id == company_id)
        pay_q = pay_q.filter(CustomerPayment.company_id == company_id)

    if date_from:
        inv_q = inv_q.filter(func.date(Invoice.invoice_date) >= date_from)
        pay_q = pay_q.filter(func.date(CustomerPayment.payment_date) >= date_from)
        bill_q = bill_q.filter(func.date(Bill.bill_date) >= date_from)
        exp_q = exp_q.filter(func.date(Expense.expense_date) >= date_from)
    if date_to:
        inv_q = inv_q.filter(func.date(Invoice.invoice_date) <= date_to)
        pay_q = pay_q.filter(func.date(CustomerPayment.payment_date) <= date_to)
        bill_q = bill_q.filter(func.date(Bill.bill_date) <= date_to)
        exp_q = exp_q.filter(func.date(Expense.expense_date) <= date_to)

    invoices = inv_q.all()
    payments = pay_q.all()
    bills = bill_q.all()
    expenses = exp_q.all()

    tot_invoiced = sum(Decimal(str(i.total_amount or 0.0)) for i in invoices if i.status not in ["DRAFT", "VOID", "CANCELLED"])
    tot_collected = sum(Decimal(str(p.amount or 0.0)) for p in payments if p.status == "POSTED")
    out_ar = sum(Decimal(str(i.amount_due or 0.0)) for i in invoices if i.status in ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])

    today = date.today()
    overdue_ar = sum(Decimal(str(i.amount_due or 0.0)) for i in invoices if i.status in ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] and i.due_date and i.due_date < today)

    tot_bills = sum(Decimal(str(b.total_amount or 0.0)) for b in bills if b.status not in ["DRAFT", "VOID", "CANCELLED"])
    out_ap = sum(Decimal(str(b.amount_due or 0.0)) for b in bills if b.status in ["RECEIVED", "PARTIALLY_PAID", "OVERDUE"])

    tot_expenses = sum(Decimal(str(e.amount or 0.0)) for e in expenses if e.status == "POSTED")

    net_coll = tot_collected - tot_expenses

    return {
        "total_invoiced": float(tot_invoiced),
        "total_collected": float(tot_collected),
        "outstanding_receivables": float(out_ar),
        "overdue_receivables": float(overdue_ar),
        "total_bills": float(tot_bills),
        "outstanding_payables": float(out_ap),
        "operating_expenses": float(tot_expenses),
        "net_collections": float(net_coll),
    }


def get_communication_summary_data(
    db: Session,
    company_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> Dict[str, Any]:
    cq = db.query(CommunicationMessage).filter(CommunicationMessage.is_deleted == False)
    if company_id:
        cq = cq.filter(CommunicationMessage.company_id == company_id)
    if date_from:
        cq = cq.filter(func.date(CommunicationMessage.created_at) >= date_from)
    if date_to:
        cq = cq.filter(func.date(CommunicationMessage.created_at) <= date_to)

    msgs = cq.all()
    emails_sent = sum(1 for m in msgs if m.channel == "EMAIL" and m.direction == "OUTBOUND")
    emails_received = sum(1 for m in msgs if m.channel == "EMAIL" and m.direction == "INBOUND")
    wa_msgs = sum(1 for m in msgs if m.channel == "WHATSAPP")
    calls = sum(1 for m in msgs if m.channel == "PHONE")
    total = len(msgs)

    return {
        "emails_sent": emails_sent,
        "emails_received": emails_received,
        "whatsapp_messages": wa_msgs,
        "calls_logged": calls,
        "total_touchpoints": total,
    }
