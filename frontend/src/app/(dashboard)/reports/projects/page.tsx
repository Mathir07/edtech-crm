"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  ProjectsReportData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";

export default function ProjectsReportPage() {
  const [data, setData] = useState<ProjectsReportData | null>(null);
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
      const res = await reportsApi.getProjectsReport(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load projects report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  const getHealthBadge = (health: string) => {
    switch (health.toUpperCase()) {
      case "ON_TRACK":
        return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50";
      case "AT_RISK":
        return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50";
      case "DELAYED":
        return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50";
      default:
        return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Project Delivery Progress & Health Analytics
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Milestone completion, task bottlenecks, delivery gating, and health status per institution.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="PROJECTS"
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
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Computing project progress...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Projects
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {data.kpis.total_projects}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                {data.kpis.active_projects} active / {data.kpis.completed_projects} completed
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                On Track
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {data.kpis.on_track_projects}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                Meeting schedule & milestones
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                At Risk
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {data.kpis.at_risk_projects}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                Impending delays / blocker flags
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                Delayed
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {data.kpis.delayed_projects}
              </div>
              <div className="text-2xs text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                {data.kpis.overdue_tasks_count} overdue tasks
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                Avg Progress
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {data.kpis.average_project_progress}%
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                Across all active initiatives
              </div>
            </div>
          </div>

          {/* Project Health Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Project Delivery Ledger</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Granular task progression, milestone delivery rate, and designated project manager.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {data.health_breakdown.length} projects listed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Project & Company</th>
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Health</th>
                    <th className="py-3 px-4 w-44">Progress</th>
                    <th className="py-3 px-4 text-right">Tasks (Done/Overdue)</th>
                    <th className="py-3 px-4 text-right">Milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.health_breakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No projects found for selected filters.
                      </td>
                    </tr>
                  ) : (
                    data.health_breakdown.map((p) => (
                      <tr key={p.project_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{p.project_name}</div>
                          {p.company_name && (
                            <div className="text-2xs text-slate-500 dark:text-slate-400">{p.company_name}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {p.project_manager_name || "Unassigned"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-3xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-3xs font-semibold border ${getHealthBadge(
                              p.health_status
                            )}`}
                          >
                            {p.health_status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${
                                  p.progress_percentage === 100
                                    ? "bg-emerald-500"
                                    : p.progress_percentage > 50
                                    ? "bg-indigo-600"
                                    : "bg-amber-500"
                                }`}
                                style={{ width: `${Math.min(100, p.progress_percentage)}%` }}
                              />
                            </div>
                            <span className="text-2xs font-mono font-bold text-slate-700 dark:text-slate-300 w-9 text-right">
                              {p.progress_percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {p.completed_tasks}/{p.total_tasks}
                          </span>
                          {p.overdue_tasks > 0 && (
                            <span className="ml-1.5 text-2xs text-rose-600 dark:text-rose-400 font-bold">
                              ({p.overdue_tasks} late)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300 font-mono">
                          {p.achieved_milestones}/{p.total_milestones}
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
        reportType="PROJECTS"
        currentFilters={filters}
      />
    </div>
  );
}
