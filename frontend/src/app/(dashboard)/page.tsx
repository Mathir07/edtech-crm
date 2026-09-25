"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Target,
  TrendingUp,
  Award,
  AlertOctagon,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  FolderGit2,
  Headphones,
  Receipt,
  CheckSquare,
  AlertTriangle,
  Kanban,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  CalendarCheck2,
  Briefcase,
  Users,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { reportsApi, ExecutiveDashboardData } from "@/lib/reportsApi";

interface PipelineBreakdown {
  pipeline_id: string;
  pipeline_name: string;
  open_deals_count: number;
  total_value: number;
}

interface DashboardStats {
  total_colleges: number;
  active_leads: number;
  new_leads_today?: number;
  new_leads_month?: number;
  leads_missing_next_action?: number;
  open_opportunities: number;
  open_deals?: number;
  pipeline_value: number;
  open_pipeline_value?: number;
  pipeline_breakdown?: PipelineBreakdown[];
  won_opportunities: number;
  lost_opportunities: number;
  follow_ups_today: number;
  overdue_follow_ups?: number;
  overdue_actions?: number;
  tasks_due_today?: number;
  overdue_tasks: number;
  open_tasks?: number;
  upcoming_meetings: number;
}

interface DealStageStats {
  stage_id: string;
  stage_name: string;
  pipeline_id: string;
  pipeline_name: string;
  order: number;
  color: string;
  count: number;
  value: number;
}

interface DashboardCharts {
  leads_by_status: { status: string; count: number }[];
  leads_by_segment?: { segment: string; count: number }[];
  opportunities_by_stage: { stage_id: string; stage_name: string; color: string; count: number; value: number }[];
  deals_by_pipeline_stage?: DealStageStats[];
  lead_source_performance: { source: string; count: number }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [period, setPeriod] = useState<string>("THIS_MONTH");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [execData, setExecData] = useState<ExecutiveDashboardData | null>(null);

  // Operational items
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [overdueActivities, setOverdueActivities] = useState<any[]>([]);
  const [openTasks, setOpenTasks] = useState<any[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"today_followups" | "overdue" | "tasks">("today_followups");

  // Secondary module items (Preserved)
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [breachedTickets, setBreachedTickets] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [statsRes, chartsRes, execRes, todayActRes, overdueActRes, tasksRes, invRes, ticketsRes] =
        await Promise.all([
          api.get<DashboardStats>("/dashboard/stats").catch(() => null),
          api.get<DashboardCharts>("/dashboard/charts").catch(() => null),
          reportsApi.getExecutiveDashboard({ date_preset: period }).catch(() => null),
          api.get<any[]>("/activities?scope=today").catch(() => []),
          api.get<any[]>("/activities?scope=overdue").catch(() => []),
          api.get<any[]>("/tasks?scope=open").catch(() => []),
          api.get<any[]>("/accounting/invoices?status=OVERDUE").catch(() => []),
          api.get<any>("/service/tickets?sla_status=BREACHED&page_size=5").catch(() => null),
        ]);

      setStats(statsRes);
      setCharts(chartsRes);
      setExecData(execRes);
      setTodayActivities(todayActRes || []);
      setOverdueActivities(overdueActRes || []);
      setOpenTasks(tasksRes || []);
      setOverdueInvoices(Array.isArray(invRes) ? invRes : []);
      setBreachedTickets(ticketsRes?.items || []);
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const handleCompleteActivity = async (id: string) => {
    try {
      await api.patch(`/activities/${id}/complete`);
      success("Follow-up marked as completed.");
      setTodayActivities((prev) => prev.filter((a) => a.id !== id));
      setOverdueActivities((prev) => prev.filter((a) => a.id !== id));
      loadDashboardData();
    } catch (err: any) {
      toastError(err?.detail || "Failed to update activity.");
    }
  };

  const periodOptions = [
    { label: "Today", value: "TODAY" },
    { label: "This Week", value: "THIS_WEEK" },
    { label: "This Month", value: "THIS_MONTH" },
    { label: "This Quarter", value: "THIS_QUARTER" },
  ];

  // Primary CRM KPI Calculations
  const newLeadsCount = stats?.new_leads_month ?? stats?.active_leads ?? 0;
  const newLeadsToday = stats?.new_leads_today ?? 0;
  const openDealsCount = stats?.open_deals ?? stats?.open_opportunities ?? 0;
  const totalPipelineVal = stats?.open_pipeline_value ?? stats?.pipeline_value ?? 0;
  const followUpsTodayCount = stats?.follow_ups_today ?? todayActivities.length;
  const overdueActionsCount = stats?.overdue_actions ?? overdueActivities.length;
  const missingActionCount = stats?.leads_missing_next_action ?? 0;
  const tasksDueToday = stats?.tasks_due_today ?? 0;
  const overdueTasksCount = stats?.overdue_tasks ?? 0;

  // Secondary Operations Values
  const receivables = execData?.finance?.outstanding_ar ?? 0;
  const activeProjects = execData?.projects?.active_projects ?? 0;
  const openTickets = execData?.service?.open_tickets ?? 0;

  // Filter deals by pipeline stage
  const dealsByStage = (charts?.deals_by_pipeline_stage || charts?.opportunities_by_stage || []) as DealStageStats[];
  const displayedStages = selectedPipelineId === "all"
    ? dealsByStage
    : dealsByStage.filter((s) => s.pipeline_id === selectedPipelineId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              OPERATIONAL CRM
            </span>
            <span className="text-2xs text-slate-400 dark:text-slate-500 font-medium">KCT Multi-Segment Workspace</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            {getGreeting()}, {user?.first_name || user?.full_name || "Founder"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Real-time pipeline metrics, pending follow-ups, and active CRM deal progress.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Period Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                  period === opt.value
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadDashboardData}
            title="Refresh dashboard metrics"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Top 4 Founder CRM Priority Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: New Leads */}
        <Link
          href="/leads"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-md transition-all group block relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">New Leads</span>
            <div className="p-2 rounded-xl border text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-100 dark:border-cyan-800">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {loading ? <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /> : newLeadsCount}
            </div>
            <div className="text-2xs text-cyan-600 dark:text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              <span>View Leads</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
          <div className="mt-1 flex items-center space-x-2 text-2xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{newLeadsToday} today</span>
            <span>•</span>
            <span>{stats?.active_leads || 0} active total</span>
          </div>
        </Link>

        {/* Card 2: Open Deals */}
        <Link
          href="/opportunities"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group block relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Open Deals</span>
            <div className="p-2 rounded-xl border text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-800">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {loading ? <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /> : openDealsCount}
            </div>
            <div className="text-2xs text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              <span>View Deals</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
          <div className="mt-1 flex items-center space-x-2 text-2xs text-slate-500 dark:text-slate-400">
            <span>Across 4 founder pipelines</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats?.won_opportunities || 0} won</span>
          </div>
        </Link>

        {/* Card 3: Pipeline Value */}
        <Link
          href="/pipeline"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all group block relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pipeline Value</span>
            <div className="p-2 rounded-xl border text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-100 dark:border-purple-800">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono truncate">
              {loading ? <div className="h-7 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /> : formatCurrency(totalPipelineVal)}
            </div>
            <div className="text-2xs text-purple-600 dark:text-purple-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center shrink-0">
              <span>Kanban</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
          <div className="mt-1 text-2xs text-slate-500 dark:text-slate-400 truncate">
            EdTech, IT Services, Talent & Higher Ed
          </div>
        </Link>

        {/* Card 4: Follow-ups Due Today */}
        <Link
          href="/activities?scope=today"
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-md transition-all group block relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Follow-ups Today</span>
            <div className="p-2 rounded-xl border text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-800">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {loading ? <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /> : followUpsTodayCount}
            </div>
            <div className="text-2xs text-amber-600 dark:text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              <span>Execute</span>
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
          <div className="mt-1 flex items-center space-x-2 text-2xs">
            {overdueActionsCount > 0 ? (
              <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                {overdueActionsCount} Overdue
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">All actions on track</span>
            )}
          </div>
        </Link>
      </div>

      {/* 3. Secondary Operational Quick Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-2xs tracking-wider">Operational Health:</span>

          {missingActionCount > 0 && (
            <Link
              href="/leads"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {missingActionCount} Leads Missing Next Action
            </Link>
          )}

          {overdueTasksCount > 0 && (
            <Link
              href="/activities"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors"
            >
              <Clock className="w-3 h-3 mr-1" />
              {overdueTasksCount} Overdue Tasks
            </Link>
          )}

          {tasksDueToday > 0 && (
            <Link
              href="/activities"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <CheckSquare className="w-3 h-3 mr-1" />
              {tasksDueToday} Tasks Due Today
            </Link>
          )}

          <Link
            href="/contacts"
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Users className="w-3 h-3 mr-1 text-slate-500 dark:text-slate-400" />
            {stats?.total_colleges || 0} Accounts / Companies
          </Link>
        </div>

        {/* Preserved Secondary Modules Quick Links */}
        <div className="flex items-center gap-3 text-2xs text-slate-500 dark:text-slate-400 font-medium">
          <Link href="/accounting/invoices" className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center space-x-1">
            <Receipt className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>AR: {formatCurrency(receivables)}</span>
          </Link>
          <span>•</span>
          <Link href="/projects" className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center space-x-1">
            <FolderGit2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span>{activeProjects} Projects</span>
          </Link>
          <span>•</span>
          <Link href="/service/tickets" className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center space-x-1">
            <Headphones className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            <span>{openTickets} Tickets</span>
          </Link>
        </div>
      </div>

      {/* 4. Multi-Pipeline Breakdown Summary Row */}
      {stats?.pipeline_breakdown && stats.pipeline_breakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Kanban className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                Founder Pipelines Breakdown
              </h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Live opportunity distribution across active business lines.</p>
            </div>
            <Link
              href="/pipeline"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>Multi-Pipeline Board</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.pipeline_breakdown.map((pipe) => {
              const isSelected = selectedPipelineId === pipe.pipeline_id;
              return (
                <button
                  key={pipe.pipeline_id}
                  type="button"
                  onClick={() => setSelectedPipelineId(isSelected ? "all" : pipe.pipeline_id)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-indigo-500 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <span className="truncate">{pipe.pipeline_name}</span>
                    <span className="px-1.5 py-0.2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">
                      {pipe.open_deals_count} deals
                    </span>
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {formatCurrency(pipe.total_value)}
                  </div>
                  <div className="text-2xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                    {isSelected ? "Filtering stage view ✓" : "Click to view stages"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Main Operations Grid: Follow-ups & Deals by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Operational Work & Follow-ups */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400 shrink-0" />
                Operational CRM Work Center
              </h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">Scheduled follow-ups, overdue items, and task queues.</p>
            </div>

            {/* Scope Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-2xs font-semibold overflow-x-auto scrollbar-thin w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("today_followups")}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === "today_followups" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Today's ({todayActivities.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("overdue")}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === "overdue" ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs font-bold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Overdue ({overdueActivities.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tasks")}
                className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === "tasks" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Tasks ({openTasks.length})
              </button>
            </div>
          </div>

          <div className="p-5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
            {/* 1. Today's Follow-ups Tab */}
            {activeTab === "today_followups" && (
              <>
                {todayActivities.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                    <CalendarCheck2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    No follow-ups scheduled for today. Great job staying ahead!
                  </div>
                ) : (
                  todayActivities.slice(0, 6).map((act) => (
                    <div key={act.id} className="py-3 flex items-center justify-between group">
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{act.subject}</div>
                          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-2">
                            <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">{act.type}</span>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Target: {act.related_entity_name || act.related_entity_type}</span>
                            <span>•</span>
                            <span>{act.due_at ? formatDateTime(act.due_at) : "Today"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => handleCompleteActivity(act.id)}
                          className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          Complete ✓
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* 2. Overdue Actions Tab */}
            {activeTab === "overdue" && (
              <>
                {overdueActivities.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mx-auto mb-2" />
                    Zero overdue CRM actions. All prospect communications are on track.
                  </div>
                ) : (
                  overdueActivities.slice(0, 6).map((act) => (
                    <div key={act.id} className="py-3 flex items-center justify-between group">
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-rose-700 dark:text-rose-400 truncate">{act.subject}</div>
                          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-2">
                            <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 px-1.5 py-0.2 rounded">
                              Overdue
                            </span>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-400">Target: {act.related_entity_name || act.related_entity_type}</span>
                            <span>•</span>
                            <span>Due: {act.due_at ? formatDate(act.due_at) : "Overdue"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => handleCompleteActivity(act.id)}
                          className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          Complete ✓
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* 3. Open Tasks Tab */}
            {activeTab === "tasks" && (
              <>
                {openTasks.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                    No open internal tasks found.
                  </div>
                ) : (
                  openTasks.slice(0, 6).map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between group">
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.title}</div>
                          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-2">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Priority: {t.priority}</span>
                            <span>•</span>
                            <span className="capitalize">{t.status}</span>
                            {t.due_date && (
                              <>
                                <span>•</span>
                                <span>Due: {formatDate(t.due_date)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Link
                        href="/activities"
                        className="text-2xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 shrink-0 ml-3"
                      >
                        Manage →
                      </Link>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>

        {/* Right 1 Col: Pipeline Stages View */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Deals by Stage</h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                {selectedPipelineId === "all" ? "All active pipelines" : "Selected pipeline filter"}
              </p>
            </div>
            {selectedPipelineId !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedPipelineId("all")}
                className="text-2xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {displayedStages.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No active stages for this selection.
              </div>
            ) : (
              displayedStages.map((stg) => {
                const pct = totalPipelineVal > 0 ? Math.round((stg.value / totalPipelineVal) * 100) : 0;
                return (
                  <div key={stg.stage_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: stg.color || "#4f46e5" }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-2xs">{stg.stage_name}</span>
                        {selectedPipelineId === "all" && stg.pipeline_name && (
                          <span className="text-3xs text-slate-400 dark:text-slate-500 truncate">({stg.pipeline_name})</span>
                        )}
                      </div>
                      <div className="font-mono text-slate-700 dark:text-slate-300 font-bold text-2xs shrink-0 ml-2">
                        {stg.count} deals • {formatCurrency(stg.value)}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, stg.count > 0 ? 5 : 0)}%`,
                          backgroundColor: stg.color || "#4f46e5",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
            <Link
              href="/pipeline"
              className="w-full py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-transparent dark:border-indigo-800/50 text-2xs font-bold rounded-xl flex items-center justify-center space-x-1 transition-colors"
            >
              <span>Open Full Pipeline Board</span>
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Bottom Analytics & Secondary Modules (Preserved) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Lead Acquisition by Segment & Source */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lead Acquisition Distribution</h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Breakdown by business segment and lead channel.</p>
            </div>
            <Link
              href="/leads"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>All Leads</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {/* By Segment */}
            <div>
              <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                By Business Segment
              </div>
              <div className="grid grid-cols-3 gap-2">
                {charts?.leads_by_segment?.map((seg) => (
                  <div
                    key={seg.segment}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-center"
                  >
                    <div className="text-2xs font-semibold text-slate-600 dark:text-slate-300 truncate">{seg.segment}</div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">{seg.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Sources */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Top Standardized Sources
              </div>
              <div className="space-y-1.5">
                {charts?.lead_source_performance?.slice(0, 5).map((src) => (
                  <div key={src.source} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 py-1">
                    <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{src.source || "Direct / Inbound"}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-2xs">
                      {src.count} leads
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preserved Secondary Operational Alerts (Accounting & Support) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <AlertOctagon className="w-4 h-4 mr-2 text-rose-600 dark:text-rose-400" />
                Cross-Department Alerts (Finance & Support)
              </h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400">Overdue customer invoices and SLA breached tickets.</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Overdue Invoices */}
            {overdueInvoices.slice(0, 2).map((inv) => (
              <Link
                key={inv.id}
                href={`/accounting/invoices/${inv.id}`}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500 bg-white dark:bg-slate-900 block transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Invoice {inv.invoice_number}</span>
                  <span className="text-2xs font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(inv.amount_due)} Overdue
                  </span>
                </div>
                <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {inv.college_name || "Account"} • Due: {formatDate(inv.due_date)}
                </div>
              </Link>
            ))}

            {/* SLA Breached Tickets */}
            {breachedTickets.slice(0, 2).map((t) => (
              <Link
                key={t.id}
                href={`/service/tickets/${t.id}`}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500 bg-white dark:bg-slate-900 block transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    #{t.ticket_number} - {t.subject}
                  </span>
                  <span className="text-2xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 px-1.5 py-0.5 rounded">
                    SLA Breached
                  </span>
                </div>
                <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {t.college_name || "Account"} • Priority: {t.priority}
                </div>
              </Link>
            ))}

            {overdueInvoices.length === 0 && breachedTickets.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mx-auto mb-2" />
                All invoices collected and zero SLA tickets breached.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
