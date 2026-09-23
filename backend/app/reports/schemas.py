from typing import List, Optional, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field


# =====================================================================
# 1. GLOBAL FILTER SCHEMAS
# =====================================================================

class ReportFilterParams(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    date_preset: Optional[str] = None  # TODAY, YESTERDAY, THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, THIS_QUARTER, LAST_QUARTER, THIS_YEAR, LAST_YEAR, CUSTOM
    company_id: Optional[str] = None
    contact_id: Optional[str] = None
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    status: Optional[str] = None
    segment: Optional[str] = None
    pipeline_id: Optional[str] = None


# =====================================================================
# 2. SAVED REPORTS SCHEMAS
# =====================================================================

class SavedReportBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    report_type: str = Field(..., max_length=100)  # EXECUTIVE, SALES, PIPELINE, PROJECTS, QA, SERVICE, FINANCE, COMMUNICATIONS, TEAM
    filters_json: Dict[str, Any] = Field(default_factory=dict)
    columns_json: Optional[List[str]] = None
    is_favorite: bool = False
    is_shared: bool = False

class SavedReportCreate(SavedReportBase):
    pass

class SavedReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filters_json: Optional[Dict[str, Any]] = None
    columns_json: Optional[List[str]] = None
    is_favorite: Optional[bool] = None
    is_shared: Optional[bool] = None

class SavedReportResponse(SavedReportBase):
    id: str
    created_by_id: str
    updated_by_id: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# 3. EXECUTIVE DASHBOARD SCHEMAS
# =====================================================================

class CRMSummaryKPI(BaseModel):
    total_leads: int = 0
    new_leads: int = 0
    qualified_leads: int = 0
    total_opportunities: int = 0
    open_opportunities: int = 0
    won_opportunities: int = 0
    lost_opportunities: int = 0
    lead_conversion_rate: float = 0.0
    opportunity_win_rate: float = 0.0
    average_deal_value: float = 0.0

class SalesSummaryKPI(BaseModel):
    quotations_count: int = 0
    quotations_value: float = 0.0
    sales_orders_count: int = 0
    sales_orders_value: float = 0.0
    won_revenue: float = 0.0
    pending_proposals_value: float = 0.0
    negotiation_value: float = 0.0

class PipelineStageStat(BaseModel):
    stage_id: str
    stage_name: str
    order: int
    color: str
    opportunity_count: int
    opportunity_value: float
    weighted_value: float

class ProjectDeliveryKPI(BaseModel):
    active_projects: int = 0
    completed_projects: int = 0
    delayed_projects: int = 0
    at_risk_projects: int = 0
    average_progress: float = 0.0
    tasks_completed: int = 0
    tasks_pending: int = 0
    milestones_completed: int = 0
    milestones_pending: int = 0

class QASummaryKPI(BaseModel):
    total_bugs: int = 0
    open_bugs: int = 0
    critical_bugs: int = 0
    high_severity_bugs: int = 0
    resolved_bugs: int = 0
    total_test_cases: int = 0
    passed_executions: int = 0
    failed_executions: int = 0
    test_pass_rate: float = 0.0

class ServiceSummaryKPI(BaseModel):
    open_tickets: int = 0
    new_tickets: int = 0
    in_progress_tickets: int = 0
    waiting_customer_tickets: int = 0
    resolved_tickets: int = 0
    closed_tickets: int = 0
    sla_breaches: int = 0
    sla_compliance_rate: float = 0.0
    critical_tickets: int = 0
    avg_resolution_time_hours: float = 0.0

class FinanceSummaryKPI(BaseModel):
    total_invoiced: float = 0.0
    total_collected: float = 0.0
    outstanding_receivables: float = 0.0
    overdue_receivables: float = 0.0
    total_bills: float = 0.0
    outstanding_payables: float = 0.0
    operating_expenses: float = 0.0
    net_collections: float = 0.0

class CommunicationSummaryKPI(BaseModel):
    emails_sent: int = 0
    emails_received: int = 0
    whatsapp_messages: int = 0
    calls_logged: int = 0
    total_touchpoints: int = 0

class ExecutiveDashboardResponse(BaseModel):
    period_label: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    generated_at: str
    crm: CRMSummaryKPI
    sales: SalesSummaryKPI
    pipeline_stages: List[PipelineStageStat]
    projects: ProjectDeliveryKPI
    qa: QASummaryKPI
    service: ServiceSummaryKPI
    finance: FinanceSummaryKPI
    communications: CommunicationSummaryKPI


# =====================================================================
# 4. SALES & PIPELINE REPORT SCHEMAS
# =====================================================================

class LeadSourceMetric(BaseModel):
    source_name: str
    lead_count: int
    qualified_count: int
    converted_count: int
    conversion_rate: float
    total_opportunity_value: float

class SalesOwnerMetric(BaseModel):
    user_id: str
    user_name: str
    leads_assigned: int
    opportunities_count: int
    opportunities_value: float
    won_count: int
    won_value: float
    quotations_count: int
    sales_orders_count: int

class SalesReportResponse(BaseModel):
    period_label: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    total_leads: int
    qualified_leads: int
    conversion_rate: float
    total_quotations: int
    quotations_value: float
    total_sales_orders: int
    sales_orders_value: float
    lead_sources: List[LeadSourceMetric]
    owner_performance: List[SalesOwnerMetric]
    stages: List[PipelineStageStat]
    generated_at: str
    # Reconciled fields for frontend SalesReportData compatibility
    crm_summary: Optional[CRMSummaryKPI] = None
    sales_summary: Optional[SalesSummaryKPI] = None
    sales_owners: Optional[List[SalesOwnerMetric]] = None
    pipeline_stages: Optional[List[PipelineStageStat]] = None

class PipelineReportResponse(BaseModel):
    total_pipeline_value: float
    weighted_pipeline_value: float
    total_deals: int
    stages: List[PipelineStageStat]
    generated_at: str


# =====================================================================
# 4B. FOUNDER MVP CRM OPERATIONAL REPORT SCHEMAS
# =====================================================================

class LeadSegmentMetric(BaseModel):
    segment: str
    count: int

class LeadStatusMetric(BaseModel):
    status: str
    count: int

class LeadOwnerMetric(BaseModel):
    owner_id: Optional[str] = None
    owner_name: str
    total: int
    converted: int

class LeadsReportResponse(BaseModel):
    period_label: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    total_leads: int
    new_leads: int
    qualified_leads: int
    converted_leads: int
    lost_unqualified_leads: int
    follow_ups_due_today: int
    overdue_follow_ups: int
    leads_by_segment: List[LeadSegmentMetric]
    leads_by_source: List[LeadSourceMetric]
    leads_by_owner: List[LeadOwnerMetric]
    leads_by_status: List[LeadStatusMetric]
    generated_at: str

class ActivityTypeMetric(BaseModel):
    type: str
    count: int

class ActivityOwnerMetric(BaseModel):
    user_id: Optional[str] = None
    user_name: str
    completed: int
    pending: int

class ActivitiesReportResponse(BaseModel):
    period_label: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    total_activities: int
    completed_activities: int
    pending_activities: int
    follow_ups_due_today: int
    overdue_follow_ups: int
    activities_by_type: List[ActivityTypeMetric]
    activities_by_owner: List[ActivityOwnerMetric]
    generated_at: str

class TaskPriorityMetric(BaseModel):
    priority: str
    count: int

class TaskOwnerMetric(BaseModel):
    user_id: Optional[str] = None
    user_name: str
    open: int
    completed: int
    overdue: int

class TasksReportResponse(BaseModel):
    total_tasks: int
    open_tasks: int
    completed_tasks: int
    overdue_tasks: int
    tasks_due_today: int
    tasks_by_priority: List[TaskPriorityMetric]
    tasks_by_owner: List[TaskOwnerMetric]
    generated_at: str



# =====================================================================
# 5. PROJECTS & QA REPORT SCHEMAS
# =====================================================================

class ProjectHealthItem(BaseModel):
    project_id: str
    project_name: str
    company_name: str
    status: str
    health: str  # ON_TRACK, AT_RISK, DELAYED, COMPLETED
    progress_percentage: float
    budget: float
    open_tasks: int
    overdue_tasks: int
    completed_tasks: int
    open_bugs: int
    critical_bugs: int
    is_ready_for_delivery: bool

class ProjectsReportResponse(BaseModel):
    total_projects: int
    active_projects: int
    completed_projects: int
    delayed_projects: int
    at_risk_projects: int
    average_progress: float
    projects: List[ProjectHealthItem]
    generated_at: str

class SeverityCount(BaseModel):
    severity: str
    count: int

class StatusCount(BaseModel):
    status: str
    count: int

class QAReportResponse(BaseModel):
    total_test_suites: int
    total_test_cases: int
    executed_cases: int
    passed_cases: int
    failed_cases: int
    blocked_cases: int
    pass_rate: float
    total_bugs: int
    open_bugs: int
    critical_bugs: int
    high_bugs: int
    medium_bugs: int
    low_bugs: int
    bugs_by_severity: List[SeverityCount]
    bugs_by_status: List[StatusCount]
    generated_at: str


# =====================================================================
# 6. SERVICE / SUPPORT REPORT SCHEMAS
# =====================================================================

class CategoryTicketMetric(BaseModel):
    category_name: str
    ticket_count: int
    resolved_count: int

class AgentWorkloadMetric(BaseModel):
    agent_id: str
    agent_name: str
    assigned_count: int
    resolved_count: int
    sla_breached_count: int

class ServiceReportResponse(BaseModel):
    total_tickets: int
    open_tickets: int
    resolved_tickets: int
    closed_tickets: int
    critical_tickets: int
    overdue_tickets: int
    sla_breaches: int
    sla_compliance_rate: float
    avg_resolution_hours: float
    tickets_by_category: List[CategoryTicketMetric]
    agent_performance: List[AgentWorkloadMetric]
    generated_at: str


# =====================================================================
# 7. FINANCE REPORT SCHEMAS
# =====================================================================

class AgingSummary(BaseModel):
    current_0_30: float = 0.0
    past_31_60: float = 0.0
    past_61_90: float = 0.0
    past_90_plus: float = 0.0
    total_outstanding: float = 0.0

class FinanceReportResponse(BaseModel):
    period_label: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    total_invoiced: float
    total_collected: float
    outstanding_receivables: float
    overdue_receivables: float
    total_bills: float
    total_bill_payments: float
    outstanding_payables: float
    operating_expenses: float
    ar_aging: AgingSummary
    ap_aging: AgingSummary
    generated_at: str


# =====================================================================
# 8. COMMUNICATIONS REPORT SCHEMAS
# =====================================================================

class ChannelMetric(BaseModel):
    channel: str
    inbound_count: int
    outbound_count: int
    total: int

class DispositionMetric(BaseModel):
    disposition: str
    count: int

class CommunicationsReportResponse(BaseModel):
    total_communications: int
    emails_sent: int
    emails_received: int
    whatsapp_sent: int
    whatsapp_received: int
    calls_logged: int
    inbound_calls: int
    outbound_calls: int
    total_call_duration_minutes: float
    channels: List[ChannelMetric]
    call_dispositions: List[DispositionMetric]
    generated_at: str


# =====================================================================
# 9. TEAM WORKLOAD & ACTIVITY SCHEMAS
# =====================================================================

class UserWorkloadMetric(BaseModel):
    user_id: str
    user_name: str
    email: str
    role_name: str
    assigned_leads: int
    active_opportunities: int
    assigned_projects: int
    assigned_tasks: int
    completed_tasks: int
    overdue_tasks: int
    assigned_tickets: int
    logged_activities: int

class TeamWorkloadReportResponse(BaseModel):
    total_members: int
    members: List[UserWorkloadMetric]
    generated_at: str
