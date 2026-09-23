"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LifeBuoy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Users,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  ServiceReportData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";

export default function ServiceReportPage() {
  const [data, setData] = useState<ServiceReportData | null>(null);
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
      const res = await reportsApi.getServiceReport(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load service report.");
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Support Desk SLA Compliance & Ticket Resolution
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Business hours SLA lifecycle, first response adherence, resolution timeliness, and support agent workload.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="SERVICE"
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
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Auditing SLA lifecycles and ticket volumes...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top SLA KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Resolution Compliance
              </div>
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-2">
                {data.kpis.sla_resolution_compliance_rate}%
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.kpis.sla_resolution_breached_count} SLA resolution breaches
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Response Compliance
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {data.kpis.sla_response_compliance_rate}%
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.kpis.sla_response_breached_count} initial response breaches
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Avg Resolution Time
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {data.kpis.average_resolution_hours} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">hours</span>
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Business hours computed
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Ingested Tickets
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {data.kpis.total_tickets}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.kpis.resolved_tickets + data.kpis.closed_tickets} resolved / {data.kpis.open_tickets + data.kpis.in_progress_tickets} active
              </div>
            </div>
          </div>

          {/* Ticket Categories Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tickets by Service Category</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Incident categorization, resolution rates, and SLA breaches per classification.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Service Category</th>
                    <th className="py-3 px-4 text-right">Total Tickets</th>
                    <th className="py-3 px-4 text-right">Resolved</th>
                    <th className="py-3 px-4 text-right">Breached</th>
                    <th className="py-3 px-4 text-right">Resolution Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.tickets_by_category.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No service tickets categorized.
                      </td>
                    </tr>
                  ) : (
                    data.tickets_by_category.map((cat) => {
                      const resRate =
                        cat.count > 0 ? Math.round((cat.resolved_count / cat.count) * 100) : 0;
                      return (
                        <tr key={cat.category} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {cat.category}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {cat.count}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {cat.resolved_count}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                            {cat.breached_count}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                              {resRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Support Agents Workload Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Support Agent Caseload & Resolution Velocity</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Agent assignments, active work items, resolution timeliness, and breach prevention.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Support Specialist</th>
                    <th className="py-3 px-4 text-right">Assigned Tickets</th>
                    <th className="py-3 px-4 text-right">In Progress</th>
                    <th className="py-3 px-4 text-right">Resolved</th>
                    <th className="py-3 px-4 text-right">SLA Breaches</th>
                    <th className="py-3 px-4 text-right">Avg Resolution (hrs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.agent_workloads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No agent activity logged.
                      </td>
                    </tr>
                  ) : (
                    data.agent_workloads.map((ag) => (
                      <tr key={ag.agent_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {ag.agent_name}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                          {ag.assigned_count}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400 font-medium">
                          {ag.in_progress_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {ag.resolved_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                          {ag.breached_count}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                          {ag.avg_resolution_hours}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-right text-3xs text-slate-400 dark:text-slate-500 font-mono">
            Generated: {data.generated_at}
          </div>
        </div>
      )}

      <SaveReportModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        reportType="SERVICE"
        currentFilters={filters}
      />
    </div>
  );
}
