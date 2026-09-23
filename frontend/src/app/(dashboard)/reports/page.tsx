"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Target,
  FolderGit2,
  Bug,
  LifeBuoy,
  Landmark,
  Headphones,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  ExecutiveDashboardData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";
import { formatCurrency } from "@/lib/utils";

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilterParams>({
    date_preset: "THIS_MONTH",
  });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  const fetchData = useCallback(async (activeFilters: ReportFilterParams) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getExecutiveDashboard(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load executive dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Reports & Intelligence
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Real-time cross-departmental executive oversight, KPIs, and operational intelligence.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="EXECUTIVE"
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          fetchData(newFilters);
        }}
        onRefresh={() => fetchData(filters)}
        isLoading={loading}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        currentFilters={filters}
      />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aggregating cross-functional intelligence...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top High-Impact Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pipeline Value */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Active Pipeline</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(data.crm.pipeline_value)}
                </div>
                <div className="flex items-center space-x-2 text-2xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    Weighted: {formatCurrency(data.crm.weighted_pipeline_value)}
                  </span>
                  <span>•</span>
                  <span>{data.crm.open_opportunities} open deals</span>
                </div>
              </div>
            </div>

            {/* Won Revenue */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Won Revenue</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(data.crm.won_revenue)}
                </div>
                <div className="flex items-center space-x-2 text-2xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    {data.crm.won_opportunities} deals closed
                  </span>
                  <span>•</span>
                  <span>Win Rate: {data.crm.opportunity_win_rate}%</span>
                </div>
              </div>
            </div>

            {/* Total Invoiced & AR */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Invoiced & AR</span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(data.finance.total_invoiced)}
                </div>
                <div className="flex items-center space-x-2 text-2xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="text-teal-700 dark:text-teal-300 font-medium">
                    Collected: {formatCurrency(data.finance.total_collected)}
                  </span>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    AR: {formatCurrency(data.finance.outstanding_ar)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery & SLA Health */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>SLA Compliance</span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                  {data.service.sla_resolution_compliance_rate}%
                </div>
                <div className="flex items-center space-x-2 text-2xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>{data.service.total_tickets} tickets</span>
                  <span>•</span>
                  <span>{data.projects.active_projects} active projects</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Sales & Pipeline Flow */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Pipeline Progression & Institutional Funnel
                </h2>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Opportunities stage-by-stage distribution and weighted risk projections.
                </p>
              </div>
              <span className="text-2xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full">
                Conv Rate: {data.crm.lead_conversion_rate}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.pipeline_stages.map((stg) => (
                <div
                  key={stg.stage_id}
                  className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                      <span>#{stg.stage_order}</span>
                      <span>{stg.probability}%</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                      {stg.stage_name}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(stg.stage_value)}
                    </div>
                    <div className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {stg.opportunity_count} {stg.opportunity_count === 1 ? "deal" : "deals"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Two Column Split - Projects & QA + Service & Comms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Projects & QA Health */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <FolderGit2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Projects & Engineering QA</h2>
                </div>
                <span className="text-2xs font-mono text-slate-400">
                  Avg Progress: {data.projects.average_project_progress}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {data.projects.on_track_projects}
                  </div>
                  <div className="text-3xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase mt-0.5">
                    On Track
                  </div>
                </div>
                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {data.projects.at_risk_projects}
                  </div>
                  <div className="text-3xs font-semibold text-amber-800 dark:text-amber-300 uppercase mt-0.5">
                    At Risk
                  </div>
                </div>
                <div className="bg-red-50/60 dark:bg-rose-950/30 p-3 rounded-xl border border-red-100 dark:border-rose-900/50">
                  <div className="text-xl font-bold text-red-700 dark:text-rose-400">
                    {data.projects.delayed_projects}
                  </div>
                  <div className="text-3xs font-semibold text-red-800 dark:text-rose-300 uppercase mt-0.5">
                    Delayed
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <Bug className="w-4 h-4 text-rose-500" />
                  <span>Open Bugs: <strong>{data.qa.open_bugs}</strong></span>
                  <span className="text-2xs text-rose-600 dark:text-rose-400">
                    ({data.qa.critical_bugs} Critical, {data.qa.high_bugs} High)
                  </span>
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Test Pass Rate: {data.qa.test_pass_rate}%
                </span>
              </div>
            </div>

            {/* Service & Touchpoints */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <LifeBuoy className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Service Desk & Touchpoints</h2>
                </div>
                <span className="text-2xs font-mono text-slate-400">
                  Avg Res: {data.service.average_resolution_hours} hrs
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    {data.service.open_tickets + data.service.in_progress_tickets}
                  </div>
                  <div className="text-3xs font-semibold text-slate-600 dark:text-slate-400 uppercase mt-0.5">
                    Active Tickets
                  </div>
                </div>
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {data.service.resolved_tickets + data.service.closed_tickets}
                  </div>
                  <div className="text-3xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase mt-0.5">
                    Resolved
                  </div>
                </div>
                <div className="bg-rose-50/60 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-100 dark:border-rose-900/50">
                  <div className="text-xl font-bold text-rose-700 dark:text-rose-400">
                    {data.service.sla_resolution_breached_count}
                  </div>
                  <div className="text-3xs font-semibold text-rose-800 dark:text-rose-300 uppercase mt-0.5">
                    SLA Breaches
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <Headphones className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Total Touchpoints: <strong>{data.communications.total_touchpoints}</strong></span>
                </div>
                <div className="flex items-center space-x-3 text-2xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>{data.communications.total_emails_sent} Emails</span>
                  <span>•</span>
                  <span>{data.communications.total_whatsapp_messages} WA</span>
                  <span>•</span>
                  <span>{data.communications.total_calls_logged} Calls</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Financial Cashflow & AR/AP Snapshot */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Financial Working Capital Snapshot</h2>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                Operating Cashflow:{" "}
                <strong
                  className={
                    data.finance.net_operating_cashflow >= 0
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : "text-rose-600 dark:text-rose-400 font-bold"
                  }
                >
                  {formatCurrency(data.finance.net_operating_cashflow)}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Invoiced</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {formatCurrency(data.finance.total_invoiced)}
                </div>
                <div className="text-3xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  Collected: {formatCurrency(data.finance.total_collected)}
                </div>
              </div>
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/50">
                <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">Outstanding AR</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">
                  {formatCurrency(data.finance.outstanding_ar)}
                </div>
                <div className="text-3xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                  Overdue: {formatCurrency(data.finance.overdue_ar)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Billed (AP)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {formatCurrency(data.finance.total_billed)}
                </div>
                <div className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Paid: {formatCurrency(data.finance.total_paid)}
                </div>
              </div>
              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/50">
                <div className="text-xs text-rose-800 dark:text-rose-300 font-medium">Outstanding AP</div>
                <div className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">
                  {formatCurrency(data.finance.outstanding_ap)}
                </div>
                <div className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Expenses: {formatCurrency(data.finance.total_expenses)}
                </div>
              </div>
            </div>
          </div>

          <div className="text-right text-3xs text-slate-400 font-mono">
            Report snapshot generated: {data.generated_at}
          </div>
        </div>
      )}

      <SaveReportModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        reportType="EXECUTIVE"
        currentFilters={filters}
      />
    </div>
  );
}
