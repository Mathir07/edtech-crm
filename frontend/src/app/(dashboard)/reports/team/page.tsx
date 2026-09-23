"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Briefcase,
  FolderGit2,
  LifeBuoy,
  Target,
  ShieldAlert,
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  Activity,
  PhoneCall,
  UserCheck,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  TeamWorkloadReportData,
  ActivitiesReportResponse,
  TasksReportResponse,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";

export default function TeamWorkloadReportPage() {
  const [activeTab, setActiveTab] = useState<"workload" | "activities" | "tasks">("workload");
  const [workloadData, setWorkloadData] = useState<TeamWorkloadReportData | null>(null);
  const [activitiesData, setActivitiesData] = useState<ActivitiesReportResponse | null>(null);
  const [tasksData, setTasksData] = useState<TasksReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilterParams>({
    date_preset: "THIS_MONTH",
  });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  const fetchData = useCallback(
    async (activeFilters: ReportFilterParams, tab: "workload" | "activities" | "tasks") => {
      try {
        setLoading(true);
        setError(null);
        if (tab === "workload") {
          const res = await reportsApi.getTeamWorkloadReport(activeFilters);
          setWorkloadData(res);
        } else if (tab === "activities") {
          const res = await reportsApi.getActivitiesReport(activeFilters);
          setActivitiesData(res);
        } else {
          const res = await reportsApi.getTasksReport(activeFilters);
          setTasksData(res);
        }
      } catch (err: any) {
        setError(err.detail || err.message || `Failed to load ${tab} report.`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(filters, activeTab);
  }, [fetchData, filters, activeTab]);

  const getReportType = (): string => {
    if (activeTab === "activities") return "ACTIVITIES";
    if (activeTab === "tasks") return "TASKS";
    return "TEAM";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Team Productivity & Operational Execution
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Audit individual rep workloads, client engagement touchpoints, follow-up cadence, and task execution throughput.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("workload")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "workload"
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workload Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "activities"
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activities & Follow-Ups</span>
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "tasks"
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Tasks Operational</span>
          </button>
        </div>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType={getReportType()}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          fetchData(newFilters, activeTab);
        }}
        onRefresh={() => fetchData(filters, activeTab)}
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

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading {activeTab} analytics...</p>
        </div>
      )}

      {/* 1. WORKLOAD MATRIX VIEW */}
      {!loading && activeTab === "workload" && workloadData && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Personnel Workload Matrix</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Total allocations per team member to diagnose bottlenecks and balance bandwidth.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {workloadData.total_members} team members active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Member & Role</th>
                    <th className="py-3 px-4 text-right">Leads</th>
                    <th className="py-3 px-4 text-right">Opps</th>
                    <th className="py-3 px-4 text-right">Projects</th>
                    <th className="py-3 px-4 text-right">Tasks (Done/Late)</th>
                    <th className="py-3 px-4 text-right">Tickets</th>
                    <th className="py-3 px-4 text-right">Activities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {workloadData.members.map((m) => (
                    <tr key={m.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{m.user_name}</div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-3xs text-slate-400 font-mono">{m.email}</span>
                          <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {m.role_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {m.assigned_leads}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {m.active_opportunities}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {m.assigned_projects}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {m.assigned_tasks} ({m.completed_tasks} done)
                        </span>
                        {m.overdue_tasks > 0 && (
                          <span className="ml-1 text-2xs text-rose-600 dark:text-rose-400 font-bold">
                            • {m.overdue_tasks} late
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {m.assigned_tickets}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        {m.logged_activities}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-right text-3xs text-slate-400 font-mono">
            Generated: {workloadData.generated_at}
          </div>
        </div>
      )}

      {/* 2. ACTIVITIES & FOLLOW-UPS VIEW */}
      {!loading && activeTab === "activities" && activitiesData && (
        <div className="space-y-6">
          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Activities Logged
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {activitiesData.total_activities}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {activitiesData.completed_activities} completed ({activitiesData.pending_activities} pending)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Completion Throughput
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {activitiesData.total_activities > 0
                  ? ((activitiesData.completed_activities / activitiesData.total_activities) * 100).toFixed(1)
                  : "0.0"}%
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {activitiesData.completed_activities} finished touchpoints
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Follow-Ups Due Today
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {activitiesData.follow_ups_due_today}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Scheduled client follow-ups due today
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Overdue Follow-Ups
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {activitiesData.overdue_follow_ups}
              </div>
              <div className="text-2xs text-rose-500 dark:text-rose-400 mt-1">
                Immediate rep attention required
              </div>
            </div>
          </div>

          {/* Activities by Type Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Activities by Channel Type</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Engagement channel distribution across meetings, calls, emails, demos, and follow-ups.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {activitiesData.activities_by_type.length} interaction types
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Activity Type</th>
                    <th className="py-3 px-4 text-right">Logged Count</th>
                    <th className="py-3 px-4 text-right">Share of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activitiesData.activities_by_type.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">
                        No activities logged for selected filters.
                      </td>
                    </tr>
                  ) : (
                    activitiesData.activities_by_type.map((t) => {
                      const share =
                        activitiesData.total_activities > 0
                          ? ((t.count / activitiesData.total_activities) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={t.type} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span className="capitalize">{t.type.toLowerCase()}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                            {t.count}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {share}%
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

          {/* Activities by Owner Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Activities by Representative</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Rep touchpoint velocity and activity completion throughput.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {activitiesData.activities_by_owner.length} representatives active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Representative</th>
                    <th className="py-3 px-4 text-right">Total Activities</th>
                    <th className="py-3 px-4 text-right">Completed</th>
                    <th className="py-3 px-4 text-right">Pending</th>
                    <th className="py-3 px-4 text-right">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activitiesData.activities_by_owner.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No rep activities found.
                      </td>
                    </tr>
                  ) : (
                    activitiesData.activities_by_owner.map((o, idx) => {
                      const total = o.completed + o.pending;
                      const rate =
                        total > 0 ? ((o.completed / total) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={o.user_id || `rep-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {o.user_name}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {total}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {o.completed}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                            {o.pending}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              {rate}%
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

          <div className="text-right text-3xs text-slate-400 font-mono">
            Generated: {activitiesData.generated_at}
          </div>
        </div>
      )}

      {/* 3. TASKS OPERATIONAL REPORT VIEW */}
      {!loading && activeTab === "tasks" && tasksData && (
        <div className="space-y-6">
          {/* Key Task KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Tasks
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {tasksData.total_tasks}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {tasksData.open_tasks} open / in-progress
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Completed Tasks
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {tasksData.completed_tasks}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {tasksData.total_tasks > 0
                  ? ((tasksData.completed_tasks / tasksData.total_tasks) * 100).toFixed(1)
                  : "0.0"}% resolution rate
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Tasks Due Today
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {tasksData.tasks_due_today}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Due before close of business
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Overdue Tasks
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {tasksData.overdue_tasks}
              </div>
              <div className="text-2xs text-rose-500 dark:text-rose-400 mt-1">
                Past deadline tasks pending action
              </div>
            </div>
          </div>

          {/* Tasks by Priority Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tasks by Priority Tier</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Workload segmentation by urgency level (URGENT, HIGH, MEDIUM, LOW).
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {tasksData.tasks_by_priority.length} priority tiers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Priority Tier</th>
                    <th className="py-3 px-4 text-right">Task Count</th>
                    <th className="py-3 px-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tasksData.tasks_by_priority.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">
                        No tasks recorded.
                      </td>
                    </tr>
                  ) : (
                    tasksData.tasks_by_priority.map((p) => {
                      const share =
                        tasksData.total_tasks > 0
                          ? ((p.count / tasksData.total_tasks) * 100).toFixed(1)
                          : "0.0";
                      const isHighOrUrgent =
                        p.priority.toUpperCase() === "URGENT" || p.priority.toUpperCase() === "HIGH";
                      return (
                        <tr key={p.priority} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isHighOrUrgent ? "bg-rose-500" : "bg-indigo-500"
                              }`}
                            ></span>
                            <span className="uppercase tracking-wider text-2xs">{p.priority}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                            {p.count}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {share}%
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

          {/* Tasks by Assignee Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tasks by Assigned Owner</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Task queue size, resolution counts, and overdue delinquency per rep.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {tasksData.tasks_by_owner.length} assignees tracked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Owner Name</th>
                    <th className="py-3 px-4 text-right">Total Tasks</th>
                    <th className="py-3 px-4 text-right">Open</th>
                    <th className="py-3 px-4 text-right">Completed</th>
                    <th className="py-3 px-4 text-right">Overdue</th>
                    <th className="py-3 px-4 text-right">Resolution Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tasksData.tasks_by_owner.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No assigned tasks found.
                      </td>
                    </tr>
                  ) : (
                    tasksData.tasks_by_owner.map((o, idx) => {
                      const total = o.open + o.completed;
                      const rate =
                        total > 0
                          ? ((o.completed / total) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={o.user_id || `owner-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {o.user_name}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {total}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-indigo-600 dark:text-indigo-400">
                            {o.open}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {o.completed}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {o.overdue > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">{o.overdue}</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {rate}%
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

          <div className="text-right text-3xs text-slate-400 font-mono">
            Generated: {tasksData.generated_at}
          </div>
        </div>
      )}

      <SaveReportModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        reportType={getReportType()}
        currentFilters={filters}
      />
    </div>
  );
}

