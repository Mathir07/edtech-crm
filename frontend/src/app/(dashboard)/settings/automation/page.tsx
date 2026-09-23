"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  AlertCircle,
  Activity,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Layers,
} from "lucide-react";
import {
  notificationsApi,
  AutomationRule,
  AutomationJobLog,
  AutomationRunResponse,
} from "@/lib/notificationsApi";

export default function AutomationAdminPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationJobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<AutomationRunResponse | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesData, logsData] = await Promise.all([
        notificationsApi.getAutomationRules(),
        notificationsApi.getAutomationLogs(25),
      ]);
      setRules(rulesData);
      setLogs(logsData);
    } catch (err) {
      console.error("Failed to load automation data", err);
      setStatusMsg({ type: "error", text: "Failed to load automation rules or execution history." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      const nextState = !rule.is_enabled;
      const updated = await notificationsApi.toggleAutomationRule(rule.id, nextState);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      setStatusMsg({
        type: "success",
        text: `Automation '${rule.name}' is now ${nextState ? "ENABLED" : "DISABLED"}.`,
      });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("Failed to toggle automation rule", err);
      setStatusMsg({ type: "error", text: "Error toggling automation rule." });
    }
  };

  const handleRunAll = async () => {
    try {
      setRunning(true);
      setRunResult(null);
      setStatusMsg(null);
      const res = await notificationsApi.triggerAutomations();
      setRunResult(res);
      setStatusMsg({
        type: "success",
        text: `Automations completed! Created ${res.total_notifications_created} notifications across ${res.jobs_executed} scans.`,
      });
      fetchData();
    } catch (err) {
      console.error("Failed to execute automations", err);
      setStatusMsg({ type: "error", text: "Failed to execute automations. Check server logs." });
    } finally {
      setRunning(false);
    }
  };

  const handleRunSingle = async (ruleKey: string) => {
    try {
      setRunning(true);
      const res = await notificationsApi.triggerAutomations(ruleKey);
      setStatusMsg({
        type: "success",
        text: `Scan finished: ${res.total_notifications_created} new alert(s) generated.`,
      });
      fetchData();
    } catch (err) {
      console.error("Failed to execute rule scan", err);
      setStatusMsg({ type: "error", text: "Failed to execute scan." });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 max-w-6xl mx-auto text-center text-slate-500 dark:text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading automation engine...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex items-center space-x-3">
          <Link
            href="/settings/notifications"
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Back to Preferences"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Automation Engine</h1>
              <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                ACTIVE
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Automated reminders, activity scans, aging alerts, and SLA monitors across Kiwi CRM.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRunAll}
            disabled={running}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-colors shadow-xs disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
            <span>{running ? "Executing Scans..." : "Run All Scans Now"}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${
            statusMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Rules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">Configured Automations ({rules.length})</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Idempotent execution with automated duplicate suppression</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 rounded-xl border transition-all duration-150 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between ${
                rule.is_enabled ? "border-slate-200 dark:border-slate-800" : "border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50 dark:bg-slate-800/30"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {rule.rule_key}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.is_enabled}
                      onChange={() => handleToggleRule(rule)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-3">{rule.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {rule.description || "Automated scan job."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-400 dark:text-slate-500">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {rule.last_run_at
                      ? `Last run: ${new Date(rule.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : "Never run"}
                  </span>
                </div>
                <button
                  onClick={() => handleRunSingle(rule.rule_key)}
                  disabled={running || !rule.is_enabled}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center space-x-1 disabled:opacity-40"
                  title="Run this scan now"
                >
                  <Play className="w-3 h-3" />
                  <span>Scan</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recent Automation Job Runs</h2>
          </div>
          <span className="text-2xs text-slate-500 dark:text-slate-400">Showing last 25 executions</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">
            No execution logs recorded yet. Click "Run All Scans Now" above to trigger jobs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800 text-3xs">
                <tr>
                  <th className="py-3 px-4">Job Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Processed</th>
                  <th className="py-3 px-4">Alerts Created</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {logs.map((log) => {
                  const durationMs = log.finished_at
                    ? new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()
                    : 0;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {log.job_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-3xs font-semibold ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : log.status === "RUNNING"
                              ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          {log.status === "SUCCESS" ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">{log.items_processed} items</td>
                      <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                        +{log.notifications_created}
                      </td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500">
                        {new Date(log.started_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500">{durationMs}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
