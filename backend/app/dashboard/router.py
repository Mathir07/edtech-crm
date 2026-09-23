from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.users.models import User
from app.organizations.models import Company
from app.crm.models import Lead, LeadSource
from app.sales.models import Opportunity, Pipeline, PipelineStage
from app.activities.models import Activity, Task, Meeting

router = APIRouter()

@router.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    now = datetime.now(timezone.utc)
    start_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_day = start_day + timedelta(days=1)
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Companies / Accounts
    total_companies = db.query(func.count(Company.id)).filter(Company.is_deleted == False).scalar() or 0

    # Leads
    active_leads = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.status.notin_(["Converted", "Lost"])
    ).scalar() or 0

    new_leads_today = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.created_at >= start_day,
        Lead.created_at < end_day,
    ).scalar() or 0

    new_leads_month = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.created_at >= start_month,
    ).scalar() or 0

    leads_missing_next_action = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.status.notin_(["Converted", "Lost"]),
        or_(
            Lead.next_action.is_(None),
            Lead.next_action == "",
            Lead.next_follow_up_date.is_(None),
        )
    ).scalar() or 0

    # Opportunities / Deals
    open_opps = db.query(func.count(Opportunity.id)).filter(
        Opportunity.is_deleted == False,
        Opportunity.status == "Open"
    ).scalar() or 0

    pipeline_value = db.query(func.sum(Opportunity.value)).filter(
        Opportunity.is_deleted == False,
        Opportunity.status == "Open"
    ).scalar() or 0.0

    won_opps = db.query(func.count(Opportunity.id)).filter(
        Opportunity.is_deleted == False,
        Opportunity.status == "Won"
    ).scalar() or 0

    lost_opps = db.query(func.count(Opportunity.id)).filter(
        Opportunity.is_deleted == False,
        Opportunity.status == "Lost"
    ).scalar() or 0

    # Pipeline breakdown by active pipelines
    pipelines = db.query(Pipeline).filter(Pipeline.is_active == True).order_by(Pipeline.name.asc()).all()
    pipeline_breakdown = []
    for pipe in pipelines:
        opp_stats = db.query(
            func.count(Opportunity.id),
            func.coalesce(func.sum(Opportunity.value), 0.0)
        ).filter(
            Opportunity.pipeline_id == pipe.id,
            Opportunity.status == "Open",
            Opportunity.is_deleted == False,
        ).first()
        deal_count = opp_stats[0] if opp_stats else 0
        deal_val = float(opp_stats[1]) if opp_stats else 0.0
        pipeline_breakdown.append({
            "pipeline_id": pipe.id,
            "pipeline_name": pipe.name,
            "open_deals_count": deal_count,
            "total_value": deal_val,
        })

    # Follow-ups & Activities
    act_today = db.query(func.count(Activity.id)).filter(
        Activity.due_at >= start_day,
        Activity.due_at < end_day,
        Activity.is_completed == False,
    ).scalar() or 0

    lead_follow_ups_today = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.status.notin_(["Converted", "Lost"]),
        Lead.next_follow_up_date >= start_day,
        Lead.next_follow_up_date < end_day,
    ).scalar() or 0

    follow_ups_today = act_today + lead_follow_ups_today

    act_overdue = db.query(func.count(Activity.id)).filter(
        Activity.due_at < now,
        Activity.is_completed == False,
    ).scalar() or 0

    lead_overdue = db.query(func.count(Lead.id)).filter(
        Lead.is_deleted == False,
        Lead.status.notin_(["Converted", "Lost"]),
        Lead.next_follow_up_date < now,
    ).scalar() or 0

    overdue_follow_ups = act_overdue + lead_overdue

    # Tasks
    tasks_due_today = db.query(func.count(Task.id)).filter(
        Task.due_date >= start_day,
        Task.due_date < end_day,
        Task.status.notin_(["Completed", "Cancelled"]),
    ).scalar() or 0

    overdue_tasks = db.query(func.count(Task.id)).filter(
        Task.due_date < now,
        Task.status.notin_(["Completed", "Cancelled"]),
    ).scalar() or 0

    open_tasks = db.query(func.count(Task.id)).filter(
        Task.status.notin_(["Completed", "Cancelled"]),
    ).scalar() or 0

    upcoming_meetings = db.query(func.count(Meeting.id)).filter(
        Meeting.start_time > now,
        Meeting.status == "Scheduled",
    ).scalar() or 0

    return {
        "total_companies": total_companies,
        "active_leads": active_leads,
        "new_leads_today": new_leads_today,
        "new_leads_month": new_leads_month,
        "leads_missing_next_action": leads_missing_next_action,
        "open_opportunities": open_opps,
        "open_deals": open_opps,
        "pipeline_value": float(pipeline_value),
        "open_pipeline_value": float(pipeline_value),
        "pipeline_breakdown": pipeline_breakdown,
        "won_opportunities": won_opps,
        "lost_opportunities": lost_opps,
        "follow_ups_today": follow_ups_today,
        "overdue_follow_ups": overdue_follow_ups,
        "overdue_actions": overdue_follow_ups + overdue_tasks,
        "tasks_due_today": tasks_due_today,
        "overdue_tasks": overdue_tasks,
        "open_tasks": open_tasks,
        "upcoming_meetings": upcoming_meetings,
    }

@router.get("/dashboard/charts")
def get_dashboard_charts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("crm.companies.view")),
):
    # Leads by status
    leads_status_rows = db.query(
        Lead.status, func.count(Lead.id)
    ).filter(Lead.is_deleted == False).group_by(Lead.status).all()
    leads_by_status = [{"status": r[0], "count": r[1]} for r in leads_status_rows]

    # Leads by segment
    leads_segment_rows = db.query(
        func.coalesce(Lead.business_segment, "Unclassified"), func.count(Lead.id)
    ).filter(Lead.is_deleted == False).group_by(Lead.business_segment).all()
    leads_by_segment = [{"segment": r[0], "count": r[1]} for r in leads_segment_rows]

    # Opportunities by stage (all stages with pipeline info)
    stages = db.query(PipelineStage).join(Pipeline, PipelineStage.pipeline_id == Pipeline.id).order_by(
        Pipeline.name.asc(), PipelineStage.order.asc()
    ).all()
    stage_stats = []
    for stg in stages:
        opps = db.query(
            func.count(Opportunity.id),
            func.coalesce(func.sum(Opportunity.value), 0.0)
        ).filter(
            Opportunity.stage_id == stg.id,
            Opportunity.is_deleted == False
        ).first()
        count = opps[0] if opps else 0
        val = float(opps[1]) if opps else 0.0
        stage_stats.append({
            "stage_id": stg.id,
            "stage_name": stg.name,
            "pipeline_id": stg.pipeline_id,
            "pipeline_name": stg.pipeline.name if stg.pipeline else "Unknown",
            "order": stg.order,
            "color": stg.color,
            "count": count,
            "value": val,
        })

    # Lead source performance
    sources_rows = db.query(
        LeadSource.name, func.count(Lead.id)
    ).join(Lead, Lead.source_id == LeadSource.id).filter(
        Lead.is_deleted == False
    ).group_by(LeadSource.name).all()
    lead_source_performance = [{"source": r[0], "count": r[1]} for r in sources_rows]

    return {
        "leads_by_status": leads_by_status,
        "leads_by_segment": leads_by_segment,
        "opportunities_by_stage": stage_stats,
        "deals_by_pipeline_stage": stage_stats,
        "lead_source_performance": lead_source_performance,
    }
