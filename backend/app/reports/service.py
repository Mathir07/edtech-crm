from datetime import date, datetime, timezone
from typing import Optional, Dict, Any, List
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.reports.schemas import (
    ReportFilterParams,
    ExecutiveDashboardResponse,
    CRMSummaryKPI, SalesSummaryKPI, PipelineStageStat, ProjectDeliveryKPI,
    QASummaryKPI, ServiceSummaryKPI, FinanceSummaryKPI, CommunicationSummaryKPI,
    SalesReportResponse, LeadSourceMetric, SalesOwnerMetric,
    PipelineReportResponse,
    ProjectsReportResponse, ProjectHealthItem,
    QAReportResponse, SeverityCount, StatusCount,
    ServiceReportResponse, CategoryTicketMetric, AgentWorkloadMetric,
    FinanceReportResponse, AgingSummary,
    CommunicationsReportResponse, ChannelMetric, DispositionMetric,
    TeamWorkloadReportResponse, UserWorkloadMetric,
    LeadsReportResponse, LeadSegmentMetric, LeadStatusMetric, LeadOwnerMetric,
    ActivitiesReportResponse, ActivityTypeMetric, ActivityOwnerMetric,
    TasksReportResponse, TaskPriorityMetric, TaskOwnerMetric,
)
from app.reports.calculations import get_date_range_preset, safe_div, is_date_overdue
from app.reports.queries import (
    get_crm_summary_data, get_sales_summary_data, get_pipeline_stages_data,
    get_projects_summary_data, get_qa_summary_data, get_service_summary_data,
    get_finance_summary_data, get_communication_summary_data,
)
from app.reports.export import generate_csv_response

from app.crm.models import Lead, LeadSource
from app.sales.models import Opportunity, PipelineStage, Quotation, SalesOrder
from app.projects.models import Project, Milestone, ProjectTask
from app.qa.models import Bug, TestCase, TestSuite
from app.service.models import Ticket, ServiceCategory
from app.accounting.models import Invoice, CustomerPayment, Bill, VendorPayment, Expense
from app.communication.models import CommunicationMessage
from app.users.models import User
from app.organizations.models import Company
from app.activities.models import Activity, Task

from app.projects.calculations import recalculate_project_progress, validate_project_delivery_readiness
from app.accounting.reports import get_ar_aging, get_ap_aging


def get_executive_dashboard(db: Session, filters: ReportFilterParams) -> ExecutiveDashboardResponse:
    start_d, end_d, period_label = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)

    crm_data = get_crm_summary_data(db, date_from=start_d, date_to=end_d, company_id=filters.company_id, owner_id=filters.owner_id)
    sales_data = get_sales_summary_data(db, date_from=start_d, date_to=end_d, company_id=filters.company_id, owner_id=filters.owner_id)
    stages_data = get_pipeline_stages_data(db, company_id=filters.company_id, owner_id=filters.owner_id, date_from=start_d, date_to=end_d)
    projects_data = get_projects_summary_data(db, company_id=filters.company_id)
    qa_data = get_qa_summary_data(db)
    service_data = get_service_summary_data(db, company_id=filters.company_id, date_from=start_d, date_to=end_d)
    finance_data = get_finance_summary_data(db, company_id=filters.company_id, date_from=start_d, date_to=end_d)
    comm_data = get_communication_summary_data(db, company_id=filters.company_id, date_from=start_d, date_to=end_d)

    return ExecutiveDashboardResponse(
        period_label=period_label,
        date_from=start_d,
        date_to=end_d,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
        crm=CRMSummaryKPI(**crm_data),
        sales=SalesSummaryKPI(**sales_data),
        pipeline_stages=[PipelineStageStat(**s) for s in stages_data],
        projects=ProjectDeliveryKPI(**projects_data),
        qa=QASummaryKPI(**qa_data),
        service=ServiceSummaryKPI(**service_data),
        finance=FinanceSummaryKPI(**finance_data),
        communications=CommunicationSummaryKPI(**comm_data),
    )


def get_sales_report(db: Session, filters: ReportFilterParams) -> SalesReportResponse:
    start_d, end_d, period_label = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)

    # Lead sources breakdown
    sources = db.query(LeadSource).all()
    source_metrics: List[LeadSourceMetric] = []
    for s in sources:
        lq = db.query(Lead).filter(Lead.source_id == s.id, Lead.is_deleted == False)
        if filters.company_id:
            lq = lq.filter(Lead.company_id == filters.company_id)
        if filters.owner_id:
            lq = lq.filter(Lead.owner_id == filters.owner_id)
        if start_d:
            lq = lq.filter(func.date(Lead.created_at) >= start_d)
        if end_d:
            lq = lq.filter(func.date(Lead.created_at) <= end_d)

        leads = lq.all()
        cnt = len(leads)
        qual = sum(1 for l in leads if l.status in ["Qualified", "Converted"])
        conv = sum(1 for l in leads if l.status == "Converted")
        c_rate = safe_div(conv, cnt)

        # Opportunity value associated with these converted leads
        converted_opp_ids = [l.converted_opportunity_id for l in leads if l.converted_opportunity_id]
        opp_val = 0.0
        if converted_opp_ids:
            ov = db.query(func.coalesce(func.sum(Opportunity.value), 0.0)).filter(
                Opportunity.id.in_(converted_opp_ids),
                Opportunity.is_deleted == False
            ).scalar()
            opp_val = float(ov or 0.0)

        source_metrics.append(LeadSourceMetric(
            source_name=s.name,
            lead_count=cnt,
            qualified_count=qual,
            converted_count=conv,
            conversion_rate=c_rate,
            total_opportunity_value=round(opp_val, 2),
        ))

    # Sales owner metrics
    users = db.query(User).filter(User.is_active == True).all()
    owner_metrics: List[SalesOwnerMetric] = []
    for u in users:
        leads_assigned = db.query(func.count(Lead.id)).filter(Lead.owner_id == u.id, Lead.is_deleted == False).scalar() or 0
        opps = db.query(Opportunity).filter(Opportunity.owner_id == u.id, Opportunity.is_deleted == False).all()
        opp_cnt = len(opps)
        opp_val = sum(float(o.value or 0.0) for o in opps)
        won_opps = [o for o in opps if o.status == "Won"]
        won_cnt = len(won_opps)
        won_val = sum(float(o.value or 0.0) for o in won_opps)

        quots_cnt = db.query(func.count(Quotation.id)).filter(Quotation.created_by_id == u.id, Quotation.is_deleted == False).scalar() or 0
        sos_cnt = db.query(func.count(SalesOrder.id)).filter(SalesOrder.created_by_id == u.id, SalesOrder.is_deleted == False).scalar() or 0

        if leads_assigned > 0 or opp_cnt > 0 or quots_cnt > 0:
            owner_metrics.append(SalesOwnerMetric(
                user_id=u.id,
                user_name=u.full_name or u.email,
                leads_assigned=leads_assigned,
                opportunities_count=opp_cnt,
                opportunities_value=round(opp_val, 2),
                won_count=won_cnt,
                won_value=round(won_val, 2),
                quotations_count=quots_cnt,
                sales_orders_count=sos_cnt,
            ))

    crm_data = get_crm_summary_data(db, start_d, end_d, filters.company_id, filters.owner_id)
    sales_data = get_sales_summary_data(db, start_d, end_d, filters.company_id, filters.owner_id)
    stages = get_pipeline_stages_data(db, filters.company_id, filters.owner_id, start_d, end_d)

    crm_summary_kpi = CRMSummaryKPI(**crm_data)
    sales_summary_kpi = SalesSummaryKPI(**sales_data)
    pipeline_stage_stats = [PipelineStageStat(**s) for s in stages]

    return SalesReportResponse(
        period_label=period_label,
        date_from=start_d,
        date_to=end_d,
        total_leads=crm_data["total_leads"],
        qualified_leads=crm_data["qualified_leads"],
        conversion_rate=crm_data["lead_conversion_rate"],
        total_quotations=sales_data["quotations_count"],
        quotations_value=sales_data["quotations_value"],
        total_sales_orders=sales_data["sales_orders_count"],
        sales_orders_value=sales_data["sales_orders_value"],
        lead_sources=source_metrics,
        owner_performance=owner_metrics,
        stages=pipeline_stage_stats,
        crm_summary=crm_summary_kpi,
        sales_summary=sales_summary_kpi,
        sales_owners=owner_metrics,
        pipeline_stages=pipeline_stage_stats,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_pipeline_report(db: Session, filters: ReportFilterParams) -> PipelineReportResponse:
    start_d, end_d, _ = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)
    stages_data = get_pipeline_stages_data(db, filters.company_id, filters.owner_id, start_d, end_d)

    tot_val = sum(s["opportunity_value"] for s in stages_data)
    weighted = sum(s["weighted_value"] for s in stages_data)
    tot_deals = sum(s["opportunity_count"] for s in stages_data)

    return PipelineReportResponse(
        total_pipeline_value=round(tot_val, 2),
        weighted_pipeline_value=round(weighted, 2),
        total_deals=tot_deals,
        stages=[PipelineStageStat(**s) for s in stages_data],
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_leads_report(db: Session, filters: ReportFilterParams) -> LeadsReportResponse:
    start_d, end_d, period_label = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)
    
    query = db.query(Lead).filter(Lead.is_deleted == False)
    if start_d:
        query = query.filter(Lead.created_at >= datetime(start_d.year, start_d.month, start_d.day, 0, 0, 0, tzinfo=timezone.utc))
    if end_d:
        query = query.filter(Lead.created_at <= datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59, 999999, tzinfo=timezone.utc))
    if filters.company_id:
        query = query.filter(Lead.company_id == filters.company_id)
    if filters.owner_id:
        query = query.filter(Lead.owner_id == filters.owner_id)
    if filters.segment:
        query = query.filter(Lead.business_segment == filters.segment)
    if filters.status:
        query = query.filter(Lead.status == filters.status)

    leads = query.all()
    total_leads = len(leads)
    new_leads = sum(1 for l in leads if l.status == "New")
    qualified_leads = sum(1 for l in leads if l.status == "Qualified")
    converted_leads = sum(1 for l in leads if l.status == "Converted")
    lost_unqualified_leads = sum(1 for l in leads if l.status in ("Lost", "Unqualified"))

    now_utc = datetime.now(timezone.utc)
    start_today = datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0, tzinfo=timezone.utc)
    end_today = datetime(now_utc.year, now_utc.month, now_utc.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    follow_ups_due_today = 0
    overdue_follow_ups = 0
    for l in leads:
        if l.status not in ("Converted", "Lost") and l.next_follow_up_date:
            dt = l.next_follow_up_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if start_today <= dt <= end_today:
                follow_ups_due_today += 1
            elif dt < now_utc:
                overdue_follow_ups += 1

    # Group by actual stored business segment (Correction 1)
    seg_counts: Dict[str, int] = {}
    for l in leads:
        seg = l.business_segment or "Unclassified"
        seg_counts[seg] = seg_counts.get(seg, 0) + 1
    leads_by_segment = [LeadSegmentMetric(segment=k, count=v) for k, v in sorted(seg_counts.items(), key=lambda x: -x[1])]

    # Leads by source
    sources = db.query(LeadSource).filter(LeadSource.is_active == True).all()
    source_metrics = []
    for s in sources:
        s_leads = [l for l in leads if l.source_id == s.id]
        if s_leads:
            s_qual = sum(1 for l in s_leads if l.status == "Qualified")
            s_conv = sum(1 for l in s_leads if l.status == "Converted")
            c_rate = round(safe_div(float(s_conv), float(len(s_leads))) * 100.0, 1)
            source_metrics.append(LeadSourceMetric(
                source_name=s.name,
                lead_count=len(s_leads),
                qualified_count=s_qual,
                converted_count=s_conv,
                conversion_rate=c_rate,
                total_opportunity_value=0.0,
            ))
    no_src_leads = [l for l in leads if not l.source_id]
    if no_src_leads:
        source_metrics.append(LeadSourceMetric(
            source_name="Direct / Unknown",
            lead_count=len(no_src_leads),
            qualified_count=sum(1 for l in no_src_leads if l.status == "Qualified"),
            converted_count=sum(1 for l in no_src_leads if l.status == "Converted"),
            conversion_rate=round(safe_div(float(sum(1 for l in no_src_leads if l.status == "Converted")), float(len(no_src_leads))) * 100.0, 1),
            total_opportunity_value=0.0,
        ))

    # Leads by owner
    owners_map: Dict[Optional[str], Dict[str, Any]] = {}
    for l in leads:
        oid = l.owner_id
        if oid not in owners_map:
            oname = l.owner.full_name if l.owner else "Unassigned"
            owners_map[oid] = {"owner_id": oid, "owner_name": oname, "total": 0, "converted": 0}
        owners_map[oid]["total"] += 1
        if l.status == "Converted":
            owners_map[oid]["converted"] += 1
    leads_by_owner = [LeadOwnerMetric(**m) for m in sorted(owners_map.values(), key=lambda x: -x["total"])]

    # Leads by status
    status_counts: Dict[str, int] = {}
    for l in leads:
        status_counts[l.status] = status_counts.get(l.status, 0) + 1
    leads_by_status = [LeadStatusMetric(status=k, count=v) for k, v in sorted(status_counts.items(), key=lambda x: -x[1])]

    return LeadsReportResponse(
        period_label=period_label,
        date_from=start_d,
        date_to=end_d,
        total_leads=total_leads,
        new_leads=new_leads,
        qualified_leads=qualified_leads,
        converted_leads=converted_leads,
        lost_unqualified_leads=lost_unqualified_leads,
        follow_ups_due_today=follow_ups_due_today,
        overdue_follow_ups=overdue_follow_ups,
        leads_by_segment=leads_by_segment,
        leads_by_source=source_metrics,
        leads_by_owner=leads_by_owner,
        leads_by_status=leads_by_status,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_activities_report(db: Session, filters: ReportFilterParams) -> ActivitiesReportResponse:
    start_d, end_d, period_label = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)
    
    query = db.query(Activity)
    if start_d:
        query = query.filter(Activity.created_at >= datetime(start_d.year, start_d.month, start_d.day, 0, 0, 0, tzinfo=timezone.utc))
    if end_d:
        query = query.filter(Activity.created_at <= datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59, 999999, tzinfo=timezone.utc))
    if filters.owner_id:
        query = query.filter(Activity.assigned_to_id == filters.owner_id)

    activities = query.all()
    total_activities = len(activities)
    completed_activities = sum(1 for a in activities if a.is_completed)
    pending_activities = total_activities - completed_activities

    now_utc = datetime.now(timezone.utc)
    start_today = datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0, tzinfo=timezone.utc)
    end_today = datetime(now_utc.year, now_utc.month, now_utc.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    # Activity-based follow-ups
    act_today = 0
    act_overdue = 0
    for a in activities:
        if not a.is_completed and a.due_at:
            dt = a.due_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if start_today <= dt <= end_today:
                act_today += 1
            elif dt < now_utc:
                act_overdue += 1

    # Lead follow-up synchronization
    lead_query = db.query(Lead).filter(Lead.is_deleted == False, Lead.status.notin_(["Converted", "Lost"]))
    if filters.owner_id:
        lead_query = lead_query.filter(Lead.owner_id == filters.owner_id)
    lead_today = 0
    lead_overdue = 0
    for l in lead_query.all():
        if l.next_follow_up_date:
            dt = l.next_follow_up_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if start_today <= dt <= end_today:
                lead_today += 1
            elif dt < now_utc:
                lead_overdue += 1

    follow_ups_due_today = act_today + lead_today
    overdue_follow_ups = act_overdue + lead_overdue

    # Activities by type
    type_counts: Dict[str, int] = {}
    for a in activities:
        t = a.type or "Task"
        type_counts[t] = type_counts.get(t, 0) + 1
    activities_by_type = [ActivityTypeMetric(type=k, count=v) for k, v in sorted(type_counts.items(), key=lambda x: -x[1])]

    # Activities by owner
    owners_map: Dict[Optional[str], Dict[str, Any]] = {}
    for a in activities:
        uid = a.assigned_to_id
        if uid not in owners_map:
            uname = a.assigned_to.full_name if a.assigned_to else "Unassigned"
            owners_map[uid] = {"user_id": uid, "user_name": uname, "completed": 0, "pending": 0}
        if a.is_completed:
            owners_map[uid]["completed"] += 1
        else:
            owners_map[uid]["pending"] += 1
    activities_by_owner = [ActivityOwnerMetric(**m) for m in sorted(owners_map.values(), key=lambda x: -(x["completed"] + x["pending"]))]

    return ActivitiesReportResponse(
        period_label=period_label,
        date_from=start_d,
        date_to=end_d,
        total_activities=total_activities,
        completed_activities=completed_activities,
        pending_activities=pending_activities,
        follow_ups_due_today=follow_ups_due_today,
        overdue_follow_ups=overdue_follow_ups,
        activities_by_type=activities_by_type,
        activities_by_owner=activities_by_owner,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_tasks_report(db: Session, filters: ReportFilterParams) -> TasksReportResponse:
    query = db.query(Task)
    if filters.owner_id:
        query = query.filter(Task.assigned_to_id == filters.owner_id)
    if filters.status:
        query = query.filter(Task.status == filters.status)

    tasks = query.all()
    total_tasks = len(tasks)
    open_tasks = sum(1 for t in tasks if t.status not in ("Completed", "Cancelled"))
    completed_tasks = sum(1 for t in tasks if t.status == "Completed")

    now_utc = datetime.now(timezone.utc)
    start_today = datetime(now_utc.year, now_utc.month, now_utc.day, 0, 0, 0, tzinfo=timezone.utc)
    end_today = datetime(now_utc.year, now_utc.month, now_utc.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    overdue_tasks = 0
    tasks_due_today = 0
    for t in tasks:
        if t.status not in ("Completed", "Cancelled") and t.due_date:
            dt = t.due_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if start_today <= dt <= end_today:
                tasks_due_today += 1
            elif dt < now_utc:
                overdue_tasks += 1

    # Tasks by priority
    priority_counts: Dict[str, int] = {}
    for t in tasks:
        p = t.priority or "Medium"
        priority_counts[p] = priority_counts.get(p, 0) + 1
    tasks_by_priority = [TaskPriorityMetric(priority=k, count=v) for k, v in sorted(priority_counts.items(), key=lambda x: -x[1])]

    # Tasks by owner
    owners_map: Dict[Optional[str], Dict[str, Any]] = {}
    for t in tasks:
        uid = t.assigned_to_id
        if uid not in owners_map:
            uname = t.assigned_to.full_name if t.assigned_to else "Unassigned"
            owners_map[uid] = {"user_id": uid, "user_name": uname, "open": 0, "completed": 0, "overdue": 0}
        if t.status == "Completed":
            owners_map[uid]["completed"] += 1
        elif t.status != "Cancelled":
            owners_map[uid]["open"] += 1
            if t.due_date:
                dt = t.due_date
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < now_utc:
                    owners_map[uid]["overdue"] += 1
    tasks_by_owner = [TaskOwnerMetric(**m) for m in sorted(owners_map.values(), key=lambda x: -(x["open"] + x["completed"]))]

    return TasksReportResponse(
        total_tasks=total_tasks,
        open_tasks=open_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        tasks_due_today=tasks_due_today,
        tasks_by_priority=tasks_by_priority,
        tasks_by_owner=tasks_by_owner,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )



def get_projects_report(db: Session, filters: ReportFilterParams) -> ProjectsReportResponse:
    pq = db.query(Project).filter(Project.is_deleted == False)
    if filters.company_id:
        pq = pq.filter(Project.company_id == filters.company_id)
    if filters.owner_id:
        pq = pq.filter(Project.project_manager_id == filters.owner_id)

    projects = pq.order_by(Project.created_at.desc()).all()
    today = date.today()

    items: List[ProjectHealthItem] = []
    tot_prog = 0.0
    active = 0
    completed = 0
    delayed = 0
    at_risk = 0

    for p in projects:
        prog = recalculate_project_progress(db, p.id)
        tot_prog += prog

        tasks = db.query(ProjectTask).filter(ProjectTask.project_id == p.id, ProjectTask.is_deleted == False).all()
        milestones = db.query(Milestone).filter(Milestone.project_id == p.id).all()
        bugs = db.query(Bug).filter(Bug.project_id == p.id, Bug.is_deleted == False).all()

        open_tasks = sum(1 for t in tasks if t.status != "COMPLETED")
        overdue_tasks = sum(1 for t in tasks if is_date_overdue(t.due_date, today) and t.status != "COMPLETED")
        completed_tasks = sum(1 for t in tasks if t.status == "COMPLETED")

        open_bugs = sum(1 for b in bugs if b.status not in ["CLOSED", "WONT_FIX"])
        critical_bugs = sum(1 for b in bugs if b.severity in ["CRITICAL", "HIGH"] and b.status not in ["CLOSED", "WONT_FIX"])

        qa_readiness = validate_project_delivery_readiness(db, p.id)
        is_ready = qa_readiness.get("is_ready", False)

        has_overdue_milestone = any(m.due_date and m.due_date < today and m.status != "COMPLETED" for m in milestones)

        if p.status == "COMPLETED":
            health = "COMPLETED"
            completed += 1
        elif has_overdue_milestone or overdue_tasks > 0:
            health = "DELAYED"
            delayed += 1
            active += 1
        elif critical_bugs > 0 or not is_ready:
            health = "AT_RISK"
            at_risk += 1
            active += 1
        else:
            health = "ON_TRACK"
            active += 1

        company_name = p.company.organization_name if p.company else "N/A"

        items.append(ProjectHealthItem(
            project_id=p.id,
            project_name=p.name,
            company_name=company_name,
            status=p.status,
            health=health,
            progress_percentage=prog,
            budget=float(p.budget or 0.0),
            open_tasks=open_tasks,
            overdue_tasks=overdue_tasks,
            completed_tasks=completed_tasks,
            open_bugs=open_bugs,
            critical_bugs=critical_bugs,
            is_ready_for_delivery=is_ready,
        ))

    avg_prog = round(tot_prog / len(projects), 2) if projects else 0.0

    return ProjectsReportResponse(
        total_projects=len(projects),
        active_projects=active,
        completed_projects=completed,
        delayed_projects=delayed,
        at_risk_projects=at_risk,
        average_progress=avg_prog,
        projects=items,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_qa_report(db: Session, filters: ReportFilterParams) -> QAReportResponse:
    suites_cnt = db.query(func.count(TestSuite.id)).scalar() or 0
    test_cases = db.query(TestCase).all()
    bugs = db.query(Bug).filter(Bug.is_deleted == False).all()

    tot_cases = len(test_cases)
    passed = sum(1 for t in test_cases if t.status == "PASSED")
    failed = sum(1 for t in test_cases if t.status == "FAILED")
    blocked = sum(1 for t in test_cases if t.status == "BLOCKED")
    executed = passed + failed + blocked
    pass_rate = safe_div(passed, (passed + failed)) if (passed + failed) > 0 else 0.0

    tot_bugs = len(bugs)
    open_bugs = sum(1 for b in bugs if b.status not in ["CLOSED", "WONT_FIX"])
    critical = sum(1 for b in bugs if b.severity == "CRITICAL" and b.status not in ["CLOSED", "WONT_FIX"])
    high = sum(1 for b in bugs if b.severity == "HIGH" and b.status not in ["CLOSED", "WONT_FIX"])
    medium = sum(1 for b in bugs if b.severity == "MEDIUM" and b.status not in ["CLOSED", "WONT_FIX"])
    low = sum(1 for b in bugs if b.severity == "LOW" and b.status not in ["CLOSED", "WONT_FIX"])

    sev_map: Dict[str, int] = {}
    stat_map: Dict[str, int] = {}
    for b in bugs:
        sev = b.severity or "UNKNOWN"
        stat = b.status or "UNKNOWN"
        sev_map[sev] = sev_map.get(sev, 0) + 1
        stat_map[stat] = stat_map.get(stat, 0) + 1

    bugs_by_sev = [SeverityCount(severity=k, count=v) for k, v in sorted(sev_map.items())]
    bugs_by_stat = [StatusCount(status=k, count=v) for k, v in sorted(stat_map.items())]

    return QAReportResponse(
        total_test_suites=suites_cnt,
        total_test_cases=tot_cases,
        executed_cases=executed,
        passed_cases=passed,
        failed_cases=failed,
        blocked_cases=blocked,
        pass_rate=pass_rate,
        total_bugs=tot_bugs,
        open_bugs=open_bugs,
        critical_bugs=critical,
        high_bugs=high,
        medium_bugs=medium,
        low_bugs=low,
        bugs_by_severity=bugs_by_sev,
        bugs_by_status=bugs_by_stat,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_service_report(db: Session, filters: ReportFilterParams) -> ServiceReportResponse:
    start_d, end_d, _ = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)
    summary = get_service_summary_data(db, filters.company_id, start_d, end_d)

    # Categories breakdown
    categories = db.query(ServiceCategory).all()
    cat_metrics: List[CategoryTicketMetric] = []
    for cat in categories:
        cq = db.query(Ticket).filter(Ticket.category_id == cat.id, Ticket.is_deleted == False)
        if filters.company_id:
            cq = cq.filter(Ticket.company_id == filters.company_id)
        if start_d:
            cq = cq.filter(func.date(Ticket.created_at) >= start_d)
        if end_d:
            cq = cq.filter(func.date(Ticket.created_at) <= end_d)

        tickets = cq.all()
        cnt = len(tickets)
        res = sum(1 for t in tickets if t.status in ["RESOLVED", "CLOSED"])
        if cnt > 0:
            cat_metrics.append(CategoryTicketMetric(
                category_name=cat.name,
                ticket_count=cnt,
                resolved_count=res,
            ))

    # Agent breakdown
    users = db.query(User).filter(User.is_active == True).all()
    agent_metrics: List[AgentWorkloadMetric] = []
    for u in users:
        uq = db.query(Ticket).filter(Ticket.assigned_to_id == u.id, Ticket.is_deleted == False)
        if start_d:
            uq = uq.filter(func.date(Ticket.created_at) >= start_d)
        if end_d:
            uq = uq.filter(func.date(Ticket.created_at) <= end_d)

        u_tickets = uq.all()
        if u_tickets:
            assigned_cnt = len(u_tickets)
            res_cnt = sum(1 for t in u_tickets if t.status in ["RESOLVED", "CLOSED"])
            breached = sum(1 for t in u_tickets if t.sla_breached)
            agent_metrics.append(AgentWorkloadMetric(
                agent_id=u.id,
                agent_name=u.full_name or u.email,
                assigned_count=assigned_cnt,
                resolved_count=res_cnt,
                sla_breached_count=breached,
            ))

    tot_tickets = summary["open_tickets"] + summary["resolved_tickets"] + summary["closed_tickets"]

    return ServiceReportResponse(
        total_tickets=tot_tickets,
        open_tickets=summary["open_tickets"],
        resolved_tickets=summary["resolved_tickets"],
        closed_tickets=summary["closed_tickets"],
        critical_tickets=summary["critical_tickets"],
        overdue_tickets=summary["sla_breaches"],
        sla_breaches=summary["sla_breaches"],
        sla_compliance_rate=summary["sla_compliance_rate"],
        avg_resolution_hours=summary["avg_resolution_time_hours"],
        tickets_by_category=cat_metrics,
        agent_performance=agent_metrics,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_finance_report(db: Session, filters: ReportFilterParams) -> FinanceReportResponse:
    start_d, end_d, period_label = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)
    summary = get_finance_summary_data(db, filters.company_id, start_d, end_d)

    # Authoritative AR Aging
    ar_resp = get_ar_aging(db)
    ar_summary = AgingSummary(
        current_0_30=float(ar_resp.total_0_30),
        past_31_60=float(ar_resp.total_31_60),
        past_61_90=float(ar_resp.total_61_90),
        past_90_plus=float(ar_resp.total_90_plus),
        total_outstanding=float(ar_resp.grand_total),
    )

    # Authoritative AP Aging
    ap_resp = get_ap_aging(db)
    ap_summary = AgingSummary(
        current_0_30=float(ap_resp.total_0_30),
        past_31_60=float(ap_resp.total_31_60),
        past_61_90=float(ap_resp.total_61_90),
        past_90_plus=float(ap_resp.total_90_plus),
        total_outstanding=float(ap_resp.grand_total),
    )

    # Vendor payments
    tot_vendor_payments = db.query(func.coalesce(func.sum(VendorPayment.amount), 0.0)).filter(
        VendorPayment.status == "POSTED"
    ).scalar()

    return FinanceReportResponse(
        period_label=period_label,
        date_from=start_d,
        date_to=end_d,
        total_invoiced=summary["total_invoiced"],
        total_collected=summary["total_collected"],
        outstanding_receivables=summary["outstanding_receivables"],
        overdue_receivables=summary["overdue_receivables"],
        total_bills=summary["total_bills"],
        total_bill_payments=float(tot_vendor_payments or 0.0),
        outstanding_payables=summary["outstanding_payables"],
        operating_expenses=summary["operating_expenses"],
        ar_aging=ar_summary,
        ap_aging=ap_summary,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_communications_report(db: Session, filters: ReportFilterParams) -> CommunicationsReportResponse:
    start_d, end_d, _ = get_date_range_preset(filters.date_preset, filters.date_from, filters.date_to)
    cq = db.query(CommunicationMessage).filter(CommunicationMessage.is_deleted == False)
    if filters.company_id:
        cq = cq.filter(CommunicationMessage.company_id == filters.company_id)
    if start_d:
        cq = cq.filter(func.date(CommunicationMessage.created_at) >= start_d)
    if end_d:
        cq = cq.filter(func.date(CommunicationMessage.created_at) <= end_d)

    msgs = cq.all()
    emails = [m for m in msgs if m.channel == "EMAIL"]
    wa = [m for m in msgs if m.channel == "WHATSAPP"]
    phone = [m for m in msgs if m.channel == "PHONE"]

    channels = [
        ChannelMetric(
            channel="Email",
            inbound_count=sum(1 for m in emails if m.direction == "INBOUND"),
            outbound_count=sum(1 for m in emails if m.direction == "OUTBOUND"),
            total=len(emails),
        ),
        ChannelMetric(
            channel="WhatsApp",
            inbound_count=sum(1 for m in wa if m.direction == "INBOUND"),
            outbound_count=sum(1 for m in wa if m.direction == "OUTBOUND"),
            total=len(wa),
        ),
        ChannelMetric(
            channel="Phone Calls",
            inbound_count=sum(1 for m in phone if m.direction == "INBOUND"),
            outbound_count=sum(1 for m in phone if m.direction == "OUTBOUND"),
            total=len(phone),
        ),
    ]

    disp_map: Dict[str, int] = {}
    for p in phone:
        disp = p.call_disposition or "COMPLETED"
        disp_map[disp] = disp_map.get(disp, 0) + 1

    dispositions = [DispositionMetric(disposition=k, count=v) for k, v in sorted(disp_map.items())]

    tot_call_secs = sum(p.call_duration_seconds or 0 for p in phone)
    tot_call_mins = round(tot_call_secs / 60.0, 1)

    return CommunicationsReportResponse(
        total_communications=len(msgs),
        emails_sent=sum(1 for m in emails if m.direction == "OUTBOUND"),
        emails_received=sum(1 for m in emails if m.direction == "INBOUND"),
        whatsapp_sent=sum(1 for m in wa if m.direction == "OUTBOUND"),
        whatsapp_received=sum(1 for m in wa if m.direction == "INBOUND"),
        calls_logged=len(phone),
        inbound_calls=sum(1 for m in phone if m.direction == "INBOUND"),
        outbound_calls=sum(1 for m in phone if m.direction == "OUTBOUND"),
        total_call_duration_minutes=tot_call_mins,
        channels=channels,
        call_dispositions=dispositions,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def get_team_workload_report(db: Session, filters: ReportFilterParams) -> TeamWorkloadReportResponse:
    users = db.query(User).filter(User.is_active == True).all()
    today = date.today()
    metrics: List[UserWorkloadMetric] = []

    for u in users:
        leads_cnt = db.query(func.count(Lead.id)).filter(Lead.owner_id == u.id, Lead.is_deleted == False).scalar() or 0
        opps_cnt = db.query(func.count(Opportunity.id)).filter(Opportunity.owner_id == u.id, Opportunity.status == "Open", Opportunity.is_deleted == False).scalar() or 0
        projects_cnt = db.query(func.count(Project.id)).filter(Project.project_manager_id == u.id, Project.is_deleted == False).scalar() or 0

        tasks = db.query(ProjectTask).filter(ProjectTask.assigned_to_id == u.id, ProjectTask.is_deleted == False).all()
        tasks_cnt = len(tasks)
        tasks_done = sum(1 for t in tasks if t.status == "COMPLETED")
        tasks_overdue = sum(1 for t in tasks if is_date_overdue(t.due_date, today) and t.status != "COMPLETED")

        tickets_cnt = db.query(func.count(Ticket.id)).filter(
            Ticket.assigned_to_id == u.id,
            Ticket.status.notin_(["RESOLVED", "CLOSED", "CANCELLED"]),
            Ticket.is_deleted == False
        ).scalar() or 0

        activities_cnt = db.query(func.count(Activity.id)).filter(
            or_(Activity.assigned_to_id == u.id, Activity.created_by_id == u.id)
        ).scalar() or 0

        role_name = u.roles[0].name if u.roles else "User"

        metrics.append(UserWorkloadMetric(
            user_id=u.id,
            user_name=u.full_name or u.email,
            email=u.email,
            role_name=role_name,
            assigned_leads=leads_cnt,
            active_opportunities=opps_cnt,
            assigned_projects=projects_cnt,
            assigned_tasks=tasks_cnt,
            completed_tasks=tasks_done,
            overdue_tasks=tasks_overdue,
            assigned_tickets=tickets_cnt,
            logged_activities=activities_cnt,
        ))

    return TeamWorkloadReportResponse(
        total_members=len(users),
        members=metrics,
        generated_at=datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p"),
    )


def export_report_csv(db: Session, report_type: str, filters: ReportFilterParams):
    r_type = report_type.upper().strip()

    if r_type == "EXECUTIVE":
        data = get_executive_dashboard(db, filters)
        headers = ["Section", "KPI Metric", "Value"]
        rows = [
            ["CRM", "Total Leads", data.crm.total_leads],
            ["CRM", "Qualified Leads", data.crm.qualified_leads],
            ["CRM", "Lead Conversion Rate (%)", data.crm.lead_conversion_rate],
            ["CRM", "Open Opportunities", data.crm.open_opportunities],
            ["CRM", "Won Opportunities", data.crm.won_opportunities],
            ["CRM", "Opportunity Win Rate (%)", data.crm.opportunity_win_rate],
            ["Sales", "Quotations Count", data.sales.quotations_count],
            ["Sales", "Quotations Value", data.sales.quotations_value],
            ["Sales", "Sales Orders Count", data.sales.sales_orders_count],
            ["Sales", "Sales Orders Value", data.sales.sales_orders_value],
            ["Projects", "Active Projects", data.projects.active_projects],
            ["Projects", "Average Progress (%)", data.projects.average_progress],
            ["QA", "Open Bugs", data.qa.open_bugs],
            ["QA", "Critical Bugs", data.qa.critical_bugs],
            ["QA", "Test Pass Rate (%)", data.qa.test_pass_rate],
            ["Service", "Open Tickets", data.service.open_tickets],
            ["Service", "SLA Breaches", data.service.sla_breaches],
            ["Service", "SLA Compliance Rate (%)", data.service.sla_compliance_rate],
            ["Finance", "Total Invoiced", data.finance.total_invoiced],
            ["Finance", "Total Collected", data.finance.total_collected],
            ["Finance", "Outstanding AR", data.finance.outstanding_receivables],
            ["Communications", "Total Touchpoints", data.communications.total_touchpoints],
        ]
        return generate_csv_response("executive_management_report.csv", headers, rows)

    elif r_type in ["SALES", "PIPELINE"]:
        data = get_sales_report(db, filters)
        headers = ["Category", "Name", "Count / Metric", "Value / Rate"]
        rows = [
            ["Summary", "Total Leads", data.total_leads, ""],
            ["Summary", "Qualified Leads", data.qualified_leads, f"{data.conversion_rate}%"],
            ["Summary", "Quotations", data.total_quotations, data.quotations_value],
            ["Summary", "Sales Orders", data.total_sales_orders, data.sales_orders_value],
        ]
        for s in data.lead_sources:
            rows.append(["Lead Source", s.source_name, f"Leads: {s.lead_count}, Conv: {s.converted_count}", f"₹{s.total_opportunity_value}"])
        for o in data.owner_performance:
            rows.append(["Sales Owner", o.user_name, f"Deals: {o.opportunities_count}, Won: {o.won_count}", f"₹{o.won_value}"])
        return generate_csv_response("sales_pipeline_report.csv", headers, rows)

    elif r_type == "PROJECTS":
        data = get_projects_report(db, filters)
        headers = ["Project Name", "Company", "Status", "Health", "Progress (%)", "Budget", "Open Tasks", "Overdue Tasks", "Open Bugs", "Delivery Ready"]
        rows = []
        for p in data.projects:
            rows.append([
                p.project_name, p.company_name, p.status, p.health,
                f"{p.progress_percentage}%", p.budget, p.open_tasks, p.overdue_tasks,
                p.open_bugs, "YES" if p.is_ready_for_delivery else "NO"
            ])
        return generate_csv_response("projects_delivery_report.csv", headers, rows)

    elif r_type == "QA":
        data = get_qa_report(db, filters)
        headers = ["Metric Category", "Item", "Value"]
        rows = [
            ["Test Suites", "Total Suites", data.total_test_suites],
            ["Test Cases", "Total Cases", data.total_test_cases],
            ["Test Cases", "Passed Cases", data.passed_cases],
            ["Test Cases", "Failed Cases", data.failed_cases],
            ["Test Cases", "Pass Rate (%)", data.pass_rate],
            ["Bugs", "Total Bugs", data.total_bugs],
            ["Bugs", "Open Bugs", data.open_bugs],
            ["Bugs", "Critical Bugs", data.critical_bugs],
            ["Bugs", "High Severity Bugs", data.high_bugs],
        ]
        return generate_csv_response("qa_quality_report.csv", headers, rows)

    elif r_type == "SERVICE":
        data = get_service_report(db, filters)
        headers = ["Category / Agent", "Type", "Assigned / Total", "Resolved", "SLA Breaches"]
        rows = [
            ["Summary", "Total Tickets", data.total_tickets, data.resolved_tickets, data.sla_breaches],
            ["Summary", "Compliance Rate", f"{data.sla_compliance_rate}%", "", ""],
        ]
        for c in data.tickets_by_category:
            rows.append([c.category_name, "Category", c.ticket_count, c.resolved_count, ""])
        for a in data.agent_performance:
            rows.append([a.agent_name, "Support Agent", a.assigned_count, a.resolved_count, a.sla_breached_count])
        return generate_csv_response("service_support_report.csv", headers, rows)

    elif r_type == "FINANCE":
        data = get_finance_report(db, filters)
        headers = ["Financial Statement Metric", "Value (₹)"]
        rows = [
            ["Total Invoiced", data.total_invoiced],
            ["Total Collected", data.total_collected],
            ["Outstanding Receivables (AR)", data.outstanding_receivables],
            ["Overdue Receivables", data.overdue_receivables],
            ["Total Vendor Bills (AP)", data.total_bills],
            ["Total Bill Payments", data.total_bill_payments],
            ["Outstanding Payables", data.outstanding_payables],
            ["Operating Expenses", data.operating_expenses],
            ["AR Aging Current (0-30 Days)", data.ar_aging.current_0_30],
            ["AR Aging Past Due (31-60 Days)", data.ar_aging.past_31_60],
            ["AR Aging Past Due (61-90 Days)", data.ar_aging.past_61_90],
            ["AR Aging Past Due (90+ Days)", data.ar_aging.past_90_plus],
        ]
        return generate_csv_response("financial_performance_report.csv", headers, rows)

    elif r_type == "COMMUNICATIONS":
        data = get_communications_report(db, filters)
        headers = ["Channel", "Inbound", "Outbound", "Total"]
        rows = []
        for ch in data.channels:
            rows.append([ch.channel, ch.inbound_count, ch.outbound_count, ch.total])
        for disp in data.call_dispositions:
            rows.append([f"Call Disposition: {disp.disposition}", "", "", disp.count])
        return generate_csv_response("communications_outreach_report.csv", headers, rows)

    elif r_type == "TEAM":
        data = get_team_workload_report(db, filters)
        headers = ["Member Name", "Email", "Role", "Leads", "Opportunities", "Projects", "Tasks Assigned", "Tasks Completed", "Tasks Overdue", "Tickets", "Activities"]
        rows = []
        for m in data.members:
            rows.append([
                m.user_name, m.email, m.role_name, m.assigned_leads,
                m.active_opportunities, m.assigned_projects, m.assigned_tasks,
                m.completed_tasks, m.overdue_tasks, m.assigned_tickets, m.logged_activities
            ])
        return generate_csv_response("team_workload_report.csv", headers, rows)

    elif r_type == "LEADS":
        data = get_leads_report(db, filters)
        headers = ["Section", "Dimension / Metric", "Count / Detail"]
        rows = [
            ["Summary", "Total Leads", data.total_leads],
            ["Summary", "New Leads", data.new_leads],
            ["Summary", "Qualified Leads", data.qualified_leads],
            ["Summary", "Converted Leads", data.converted_leads],
            ["Summary", "Lost / Unqualified Leads", data.lost_unqualified_leads],
            ["Summary", "Follow-ups Due Today", data.follow_ups_due_today],
            ["Summary", "Overdue Follow-ups", data.overdue_follow_ups],
        ]
        for seg in data.leads_by_segment:
            rows.append(["Segment", seg.segment, seg.count])
        for src in data.leads_by_source:
            rows.append(["Source", src.source_name, f"Leads: {src.lead_count}, Converted: {src.converted_count} ({src.conversion_rate}%)"])
        for o in data.leads_by_owner:
            rows.append(["Owner", o.owner_name, f"Total: {o.total}, Converted: {o.converted}"])
        return generate_csv_response("leads_operational_report.csv", headers, rows)

    elif r_type == "ACTIVITIES":
        data = get_activities_report(db, filters)
        headers = ["Category", "Item / Type / Owner", "Metric / Count", "Detail"]
        rows = [
            ["Summary", "Total Activities", data.total_activities, ""],
            ["Summary", "Completed Activities", data.completed_activities, ""],
            ["Summary", "Pending Activities", data.pending_activities, ""],
            ["Summary", "Follow-ups Due Today", data.follow_ups_due_today, ""],
            ["Summary", "Overdue Follow-ups", data.overdue_follow_ups, ""],
        ]
        for t in data.activities_by_type:
            rows.append(["Type", t.type, t.count, ""])
        for o in data.activities_by_owner:
            rows.append(["Owner", o.user_name, o.completed + o.pending, f"Completed: {o.completed}, Pending: {o.pending}"])
        return generate_csv_response("activities_operational_report.csv", headers, rows)

    elif r_type == "TASKS":
        data = get_tasks_report(db, filters)
        headers = ["Category", "Dimension", "Metric", "Detail"]
        rows = [
            ["Summary", "Total Tasks", data.total_tasks, ""],
            ["Summary", "Open Tasks", data.open_tasks, ""],
            ["Summary", "Completed Tasks", data.completed_tasks, ""],
            ["Summary", "Overdue Tasks", data.overdue_tasks, ""],
            ["Summary", "Tasks Due Today", data.tasks_due_today, ""],
        ]
        for p in data.tasks_by_priority:
            rows.append(["Priority", p.priority, p.count, ""])
        for o in data.tasks_by_owner:
            rows.append(["Owner", o.user_name, o.open + o.completed, f"Open: {o.open}, Completed: {o.completed}, Overdue: {o.overdue}"])
        return generate_csv_response("tasks_operational_report.csv", headers, rows)

    # Fallback generic
    return generate_csv_response(f"{report_type.lower()}_report.csv", ["Report", "Status"], [[report_type, "Generated"]])
