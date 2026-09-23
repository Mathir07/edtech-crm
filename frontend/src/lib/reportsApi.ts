import { api } from "./api";

export interface ReportFilterParams {
  date_from?: string;
  date_to?: string;
  date_preset?: string;
  company_id?: string;
  contact_id?: string;
  owner_id?: string;
  team_id?: string;
  status?: string;
  segment?: string;
  pipeline_id?: string;
}

export interface ExecutiveDashboardData {
  crm: {
    total_companies: number;
    active_companies: number;
    total_leads: number;
    open_leads: number;
    total_opportunities: number;
    open_opportunities: number;
    pipeline_value: number;
    weighted_pipeline_value: number;
    won_opportunities: number;
    won_revenue: number;
    lost_opportunities: number;
    lead_conversion_rate: number;
    opportunity_win_rate: number;
    average_deal_value: number;
  };
  sales: {
    quotations_count: number;
    quotations_value: number;
    sales_orders_count: number;
    sales_orders_value: number;
    won_revenue: number;
    pending_proposals_value: number;
    negotiation_value: number;
  };
  pipeline_stages: Array<{
    stage_id: string;
    stage_name: string;
    stage_order: number;
    opportunity_count: number;
    stage_value: number;
    probability: number;
    weighted_value: number;
  }>;
  projects: {
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    on_hold_projects: number;
    cancelled_projects: number;
    on_track_projects: number;
    at_risk_projects: number;
    delayed_projects: number;
    overdue_tasks_count: number;
    average_project_progress: number;
  };
  qa: {
    total_test_suites: number;
    total_test_cases: number;
    passed_cases: number;
    failed_cases: number;
    blocked_cases: number;
    retest_cases: number;
    test_pass_rate: number;
    total_bugs: number;
    critical_bugs: number;
    high_bugs: number;
    medium_bugs: number;
    low_bugs: number;
    open_bugs: number;
    resolved_bugs: number;
    closed_bugs: number;
  };
  service: {
    total_tickets: number;
    open_tickets: number;
    in_progress_tickets: number;
    waiting_tickets: number;
    resolved_tickets: number;
    closed_tickets: number;
    sla_response_breached_count: number;
    sla_resolution_breached_count: number;
    sla_response_compliance_rate: number;
    sla_resolution_compliance_rate: number;
    average_resolution_hours: number;
  };
  finance: {
    total_invoiced: number;
    total_collected: number;
    outstanding_ar: number;
    overdue_ar: number;
    total_billed: number;
    total_paid: number;
    outstanding_ap: number;
    total_expenses: number;
    net_operating_cashflow: number;
  };
  communications: {
    total_emails_sent: number;
    total_emails_received: number;
    total_whatsapp_messages: number;
    total_calls_logged: number;
    total_activities: number;
    total_touchpoints: number;
  };
  generated_at: string;
}

export interface SalesReportData {
  crm_summary: ExecutiveDashboardData["crm"];
  sales_summary: ExecutiveDashboardData["sales"];
  pipeline_stages: ExecutiveDashboardData["pipeline_stages"];
  lead_sources: Array<{
    source_name: string;
    leads_count: number;
    converted_leads: number;
    conversion_rate: number;
    opportunities_count: number;
    won_revenue: number;
  }>;
  sales_owners: Array<{
    user_id: string;
    user_name: string;
    leads_assigned: number;
    opportunities_count: number;
    opportunities_value: number;
    won_count: number;
    won_value: number;
    quotations_count: number;
    sales_orders_count: number;
  }>;
  generated_at: string;
}

export interface PipelineReportData {
  pipeline_summary: ExecutiveDashboardData["crm"];
  pipeline_stages: ExecutiveDashboardData["pipeline_stages"];
  stage_conversion_rates: Record<string, number>;
  generated_at: string;
}

export interface ProjectsReportData {
  kpis: ExecutiveDashboardData["projects"];
  health_breakdown: Array<{
    project_id: string;
    project_name: string;
    company_name?: string;
    project_manager_name?: string;
    status: string;
    health_status: string;
    progress_percentage: number;
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    total_milestones: number;
    achieved_milestones: number;
    start_date?: string;
    end_date?: string;
  }>;
  generated_at: string;
}

export interface QAReportData {
  kpis: ExecutiveDashboardData["qa"];
  bugs_by_severity: Array<{ severity: string; count: number }>;
  bugs_by_status: Array<{ status: string; count: number }>;
  test_suites_summary: Array<{
    suite_id: string;
    suite_name: string;
    project_name?: string;
    total_cases: number;
    passed: number;
    failed: number;
    blocked: number;
    pass_rate: number;
  }>;
  generated_at: string;
}

export interface ServiceReportData {
  kpis: ExecutiveDashboardData["service"];
  tickets_by_category: Array<{
    category: string;
    count: number;
    resolved_count: number;
    breached_count: number;
  }>;
  agent_workloads: Array<{
    agent_id: string;
    agent_name: string;
    assigned_count: number;
    resolved_count: number;
    in_progress_count: number;
    breached_count: number;
    avg_resolution_hours: number;
  }>;
  generated_at: string;
}

export interface FinanceReportData {
  kpis: ExecutiveDashboardData["finance"];
  ar_aging: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total: number;
  };
  ap_aging: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total: number;
  };
  generated_at: string;
}

export interface CommunicationsReportData {
  kpis: ExecutiveDashboardData["communications"];
  channel_metrics: Array<{
    channel: string;
    outbound_count: number;
    inbound_count: number;
    total_count: number;
  }>;
  call_dispositions: Array<{
    disposition: string;
    count: number;
  }>;
  daily_activity_trends: Array<{
    date: string;
    emails: number;
    whatsapp: number;
    calls: number;
    total: number;
  }>;
  generated_at: string;
}

export interface TeamWorkloadReportData {
  total_members: number;
  members: Array<{
    user_id: string;
    user_name: string;
    email: string;
    role_name: string;
    assigned_leads: number;
    active_opportunities: number;
    assigned_projects: number;
    assigned_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    assigned_tickets: number;
    logged_activities: number;
  }>;
  generated_at: string;
}

export interface LeadSegmentMetric {
  segment: string;
  count: number;
}

export interface LeadStatusMetric {
  status: string;
  count: number;
}

export interface LeadOwnerMetric {
  owner_id?: string;
  owner_name: string;
  total: number;
  converted: number;
}

export interface LeadsReportResponse {
  total_leads: number;
  new_leads: number;
  qualified_leads: number;
  converted_leads: number;
  lost_unqualified_leads: number;
  follow_ups_due_today: number;
  overdue_follow_ups: number;
  leads_by_segment: LeadSegmentMetric[];
  leads_by_source: Array<{
    source_name: string;
    lead_count: number;
    qualified_count: number;
    converted_count: number;
    conversion_rate: number;
    total_opportunity_value: number;
  }>;
  leads_by_status: LeadStatusMetric[];
  leads_by_owner: LeadOwnerMetric[];
  generated_at: string;
}

export interface ActivityTypeMetric {
  type: string;
  count: number;
}

export interface ActivityOwnerMetric {
  user_id?: string;
  user_name: string;
  completed: number;
  pending: number;
}

export interface ActivitiesReportResponse {
  total_activities: number;
  completed_activities: number;
  pending_activities: number;
  follow_ups_due_today: number;
  overdue_follow_ups: number;
  activities_by_type: ActivityTypeMetric[];
  activities_by_owner: ActivityOwnerMetric[];
  generated_at: string;
}

export interface TaskPriorityMetric {
  priority: string;
  count: number;
}

export interface TaskOwnerMetric {
  user_id?: string;
  user_name: string;
  open: number;
  completed: number;
  overdue: number;
}

export interface TasksReportResponse {
  total_tasks: number;
  open_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  tasks_due_today: number;
  tasks_by_priority: TaskPriorityMetric[];
  tasks_by_owner: TaskOwnerMetric[];
  generated_at: string;
}

export interface SavedReport {
  id: string;
  name: string;
  description?: string;
  report_type: string;
  filters_json?: Record<string, any>;
  filters?: ReportFilterParams;
  columns_json?: string[];
  columns?: string[];
  is_shared: boolean;
  is_public?: boolean;
  is_favorite?: boolean;
  created_by_id?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

function buildQuery(params?: ReportFilterParams): string {
  if (!params) return "";
  const query = new URLSearchParams();
  if (params.date_preset) query.append("date_preset", params.date_preset);
  if (params.date_from) query.append("date_from", params.date_from);
  if (params.date_to) query.append("date_to", params.date_to);
  if (params.company_id) query.append("company_id", params.company_id);
  if (params.contact_id) query.append("contact_id", params.contact_id);
  if (params.owner_id) query.append("owner_id", params.owner_id);
  if (params.team_id) query.append("team_id", params.team_id);
  if (params.status) query.append("status", params.status);
  if (params.segment) query.append("segment", params.segment);
  if (params.pipeline_id) query.append("pipeline_id", params.pipeline_id);
  const qStr = query.toString();
  return qStr ? `?${qStr}` : "";
}

export const reportsApi = {
  getExecutiveDashboard: (filters?: ReportFilterParams) =>
    api.get<ExecutiveDashboardData>(`/reports/executive${buildQuery(filters)}`),

  getSalesReport: (filters?: ReportFilterParams) =>
    api.get<SalesReportData>(`/reports/sales${buildQuery(filters)}`),

  getLeadsReport: (filters?: ReportFilterParams) =>
    api.get<LeadsReportResponse>(`/reports/leads${buildQuery(filters)}`),

  getActivitiesReport: (filters?: ReportFilterParams) =>
    api.get<ActivitiesReportResponse>(`/reports/activities${buildQuery(filters)}`),

  getTasksReport: (filters?: ReportFilterParams) =>
    api.get<TasksReportResponse>(`/reports/tasks${buildQuery(filters)}`),

  getPipelineReport: (filters?: ReportFilterParams) =>
    api.get<PipelineReportData>(`/reports/pipeline${buildQuery(filters)}`),

  getProjectsReport: (filters?: ReportFilterParams) =>
    api.get<ProjectsReportData>(`/reports/projects${buildQuery(filters)}`),

  getQAReport: (filters?: ReportFilterParams) =>
    api.get<QAReportData>(`/reports/qa${buildQuery(filters)}`),

  getServiceReport: (filters?: ReportFilterParams) =>
    api.get<ServiceReportData>(`/reports/service${buildQuery(filters)}`),

  getFinanceReport: (filters?: ReportFilterParams) =>
    api.get<FinanceReportData>(`/reports/finance${buildQuery(filters)}`),

  getCommunicationsReport: (filters?: ReportFilterParams) =>
    api.get<CommunicationsReportData>(`/reports/communications${buildQuery(filters)}`),

  getTeamWorkloadReport: (filters?: ReportFilterParams) =>
    api.get<TeamWorkloadReportData>(`/reports/team${buildQuery(filters)}`),

  exportCsv: async (reportType: string, filters?: ReportFilterParams) => {
    const q = new URLSearchParams();
    q.append("report_type", reportType);
    if (filters?.date_preset) q.append("date_preset", filters.date_preset);
    if (filters?.date_from) q.append("date_from", filters.date_from);
    if (filters?.date_to) q.append("date_to", filters.date_to);
    if (filters?.company_id) q.append("company_id", filters.company_id);
    if (filters?.owner_id) q.append("owner_id", filters.owner_id);
    if (filters?.status) q.append("status", filters.status);
    if (filters?.segment) q.append("segment", filters.segment);
    if (filters?.pipeline_id) q.append("pipeline_id", filters.pipeline_id);

    const blob = await api.download(`/reports/export?${q.toString()}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType.toLowerCase()}_report_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  getSavedReports: (reportType?: string) =>
    api.get<SavedReport[]>(`/reports/saved${reportType ? `?report_type=${reportType}` : ""}`),

  getSavedReport: (id: string) =>
    api.get<SavedReport>(`/reports/saved/${id}`),

  createSavedReport: (payload: {
    name: string;
    description?: string;
    report_type: string;
    filters?: ReportFilterParams;
    filters_json?: Record<string, any>;
    columns?: string[];
    is_public?: boolean;
    is_shared?: boolean;
  }) =>
    api.post<SavedReport>("/reports/saved", {
      name: payload.name,
      description: payload.description,
      report_type: payload.report_type,
      filters_json: payload.filters_json || payload.filters || {},
      columns_json: payload.columns,
      is_shared: payload.is_shared ?? payload.is_public ?? false,
    }),

  updateSavedReport: (
    id: string,
    payload: {
      name?: string;
      description?: string;
      filters?: ReportFilterParams;
      filters_json?: Record<string, any>;
      columns?: string[];
      is_public?: boolean;
      is_shared?: boolean;
    }
  ) =>
    api.put<SavedReport>(`/reports/saved/${id}`, {
      name: payload.name,
      description: payload.description,
      filters_json: payload.filters_json || payload.filters,
      columns_json: payload.columns,
      is_shared: payload.is_shared ?? payload.is_public,
    }),

  deleteSavedReport: (id: string) =>
    api.delete<{ message: string }>(`/reports/saved/${id}`),
};
