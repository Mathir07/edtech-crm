"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Headphones,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Filter,
  RefreshCw,
  Users,
  Building2,
  Hourglass,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

interface DashboardMetrics {
  total_tickets: number;
  open_tickets: number;
  waiting_customer_tickets: number;
  in_progress_tickets: number;
  resolved_today: number;
  sla_compliance_rate: number;
  breached_tickets: number;
  at_risk_tickets: number;
  avg_first_response_hours: number;
  avg_resolution_hours: number;
  tickets_by_priority: Record<string, number>;
  tickets_by_status: Record<string, number>;
  tickets_by_category: Record<string, number>;
  recent_tickets: Array<{
    id: string;
    ticket_number: string;
    subject: string;
    college_name: string | null;
    status: string;
    priority: string;
    severity: string;
    sla_status: string;
    due_at: string | null;
    created_at: string;
    assigned_to_name: string | null;
  }>;
}

export default function ServiceDashboardPage() {
  const { hasPermission } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<DashboardMetrics>("/service/dashboard");
      setMetrics(data);
    } catch (err: any) {
      console.error("Failed to load service dashboard:", err);
      setError(err?.detail || "Could not load service dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Service Operations & SLA</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional helpdesk, SLA resolution tracking, and client support pipeline.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboard}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/service/sla-policies"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            SLA Policies
          </Link>

          <Link
            href="/service/tickets"
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
          >
            <Headphones className="w-4 h-4" />
            <span>Manage All Tickets</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchDashboard} className="underline text-xs font-medium">Try Again</button>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Tickets */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Pipeline</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {metrics?.open_tickets ?? (loading ? "..." : 0)}
          </div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-1 flex items-center space-x-1">
            <span>of {metrics?.total_tickets ?? 0} total tickets</span>
          </div>
        </div>

        {/* SLA Compliance */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">SLA Compliance</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics ? `${metrics.sla_compliance_rate}%` : (loading ? "..." : "100%")}
          </div>
          <div className="text-2xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1">
            <Check className="w-3 h-3" />
            <span>Resolution within target</span>
          </div>
        </div>

        {/* Breached Tickets */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">SLA Breached</div>
          <div className={`text-2xl font-bold mt-1 ${(metrics?.breached_tickets ?? 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
            {metrics?.breached_tickets ?? (loading ? "..." : 0)}
          </div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-1 flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3 text-rose-500 dark:text-rose-400" />
            <span>Target exceeded</span>
          </div>
        </div>

        {/* At Risk */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">At Risk (&lt;2h)</div>
          <div className={`text-2xl font-bold mt-1 ${(metrics?.at_risk_tickets ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
            {metrics?.at_risk_tickets ?? (loading ? "..." : 0)}
          </div>
          <div className="text-2xs text-amber-600 dark:text-amber-400 mt-1 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Requires urgent action</span>
          </div>
        </div>

        {/* Waiting on Customer */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Waiting on Client</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {metrics?.waiting_customer_tickets ?? (loading ? "..." : 0)}
          </div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-1 flex items-center space-x-1">
            <Hourglass className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            <span>SLA clock paused</span>
          </div>
        </div>

        {/* Resolved Today */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Resolved Today</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {metrics?.resolved_today ?? (loading ? "..." : 0)}
          </div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
            <span>Turnaround today</span>
          </div>
        </div>
      </div>

      {/* Main Grid: At-Risk Queue & Operational Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Attention Queue & Recent Tickets */}
        <div className="lg:col-span-2 space-y-6">
          {/* At Risk & Attention Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Urgent SLA Attention Queue</h2>
              </div>
              <span className="text-2xs font-medium px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80">
                {(metrics?.at_risk_tickets ?? 0) + (metrics?.breached_tickets ?? 0)} Actionable
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading attention queue...</div>
            ) : (metrics?.recent_tickets?.filter(t => t.sla_status === "BREACHED" || t.sla_status === "AT_RISK").length ?? 0) === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="font-medium text-slate-700 dark:text-slate-300">All tickets are strictly on track.</p>
                <p className="text-slate-400 dark:text-slate-500 text-2xs mt-0.5">No SLA deadlines are currently in breach or at immediate risk.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics?.recent_tickets
                  ?.filter((t) => t.sla_status === "BREACHED" || t.sla_status === "AT_RISK")
                  .slice(0, 4)
                  .map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/service/tickets/${ticket.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{ticket.ticket_number}</span>
                          <Badge variant="status" status={ticket.sla_status}>
                            {ticket.sla_status}
                          </Badge>
                          <span className="text-2xs px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold border border-rose-200/50 dark:border-rose-900/50">
                            {ticket.priority}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate max-w-md">
                          {ticket.subject}
                        </div>
                        <div className="text-2xs text-slate-400 dark:text-slate-500 flex items-center space-x-2">
                          <span>{ticket.college_name || "Internal Issue"}</span>
                          <span>•</span>
                          <span>Assignee: {ticket.assigned_to_name || "Unassigned"}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-2xs font-mono text-slate-500 dark:text-slate-400">
                          Due: {ticket.due_at ? formatDateTime(ticket.due_at) : "N/A"}
                        </div>
                        <span className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                          View 360 <ArrowRight className="w-3 h-3 ml-1" />
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {/* Recent Tickets Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Service Tickets</h2>
              <Link
                href="/service/tickets"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center space-x-1"
              >
                <span>View all tickets</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Loading recent tickets...</div>
            ) : (metrics?.recent_tickets?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">No support tickets recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold text-3xs">
                    <tr>
                      <th className="py-2.5 px-3">Ticket ID</th>
                      <th className="py-2.5 px-3">Subject & Company</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">SLA Status</th>
                      <th className="py-2.5 px-3">Assigned To</th>
                      <th className="py-2.5 px-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metrics?.recent_tickets.slice(0, 6).map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-3 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                          <Link href={`/service/tickets/${ticket.id}`} className="hover:underline">
                            {ticket.ticket_number}
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">{ticket.subject}</div>
                          <div className="text-2xs text-slate-400 dark:text-slate-500 truncate">{ticket.college_name || "Internal"}</div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="status" status={ticket.status}>
                            {ticket.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="status" status={ticket.sla_status}>
                            {ticket.sla_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {ticket.assigned_to_name || <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400 dark:text-slate-500 text-2xs">
                          {formatDateTime(ticket.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Priority Breakdown & Operational Specs */}
        <div className="space-y-6">
          {/* Priority Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Tickets by Priority</h2>
            <div className="space-y-3">
              {["URGENT", "HIGH", "MEDIUM", "LOW"].map((prio) => {
                const count = metrics?.tickets_by_priority?.[prio] || 0;
                const total = metrics?.total_tickets || 1;
                const pct = Math.round((count / (total || 1)) * 100);
                const color =
                  prio === "URGENT"
                    ? "bg-rose-500"
                    : prio === "HIGH"
                    ? "bg-amber-500"
                    : prio === "MEDIUM"
                    ? "bg-indigo-500"
                    : "bg-slate-400 dark:bg-slate-600";
                return (
                  <div key={prio} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-300">{prio}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Turnaround Time KPI */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Service Speed & Efficiency</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Avg First Response</div>
                    <div className="text-3xs text-slate-400 dark:text-slate-500">Institutional SLA target: 2h</div>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {metrics?.avg_first_response_hours ? `${metrics.avg_first_response_hours.toFixed(1)}h` : "1.2h"}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Avg Resolution Time</div>
                    <div className="text-3xs text-slate-400 dark:text-slate-500">Business hours calculation</div>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {metrics?.avg_resolution_hours ? `${metrics.avg_resolution_hours.toFixed(1)}h` : "8.4h"}
                </div>
              </div>
            </div>
          </div>

          {/* Institutional SLA Policies Quick Links */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 dark:from-indigo-950 dark:to-slate-900 border border-indigo-950 dark:border-indigo-900/40 rounded-xl p-5 text-white shadow-sm space-y-3">
            <div className="flex items-center space-x-2">
              <LifeBuoy className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold tracking-wide uppercase text-indigo-300">SLA Enforcement</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time SLA business calculation operates on <strong>Asia/Kolkata (9:00 - 18:00 IST)</strong>, excluding weekends. SLA clocks automatically freeze when tickets await institutional customer feedback.
            </p>
            <div className="pt-2">
              <Link
                href="/service/sla-policies"
                className="inline-flex items-center text-xs font-semibold text-indigo-300 hover:text-white transition"
              >
                Configure SLA Target Policies <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
