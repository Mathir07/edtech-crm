"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, Search, Filter, RefreshCw, Terminal, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";

interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let query = "/audit-logs?";
      if (actionFilter) query += `action=${encodeURIComponent(actionFilter)}&`;
      if (entityFilter) query += `entity_type=${encodeURIComponent(entityFilter)}&`;
      const data = await api.get<AuditLog[]>(query);
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter, entityFilter]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CREATE</span>;
      case "UPDATE":
      case "STAGE_CHANGE":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">{action}</span>;
      case "DELETE":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">DELETE</span>;
      case "CONVERT":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">CONVERT</span>;
      case "LOGIN":
      case "LOGOUT":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{action}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Enterprise Audit Trail</h1>
            <span className="text-3xs font-mono font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
              IMMUTABLE
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete security and operational audit record of every critical system change.
          </p>
        </div>
        <button
          onClick={() => loadLogs()}
          className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors self-start"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Trail
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-hidden"
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="STAGE_CHANGE">STAGE_CHANGE</option>
            <option value="CONVERT">CONVERT</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Entity:</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-hidden"
          >
            <option value="">All Entities</option>
            <option value="COMPANY">COMPANY</option>
            <option value="CONTACT">CONTACT</option>
            <option value="LEAD">LEAD</option>
            <option value="OPPORTUNITY">OPPORTUNITY</option>
            <option value="ACTIVITY">ACTIVITY</option>
            <option value="USER">USER</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading audit log entries...</div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit records"
            description="Operational actions performed by users will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors font-mono text-xs">
                    <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      {l.user_email || "System"}
                    </td>
                    <td className="py-3 px-4">{getActionBadge(l.action)}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-semibold">{l.entity_type}</td>
                    <td className="py-3 px-4 text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                      {l.entity_id || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="inline-flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Diff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit Record: ${selectedLog?.action} on ${selectedLog?.entity_type}`}
        maxWidth="xl"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <div><strong>User:</strong> {selectedLog.user_email || "System"}</div>
              <div><strong>Timestamp:</strong> {formatDateTime(selectedLog.created_at)}</div>
              <div><strong>IP Address:</strong> {selectedLog.ip_address || "Internal / Local"}</div>
              <div><strong>Entity ID:</strong> {selectedLog.entity_id || "N/A"}</div>
            </div>

            {selectedLog.old_values && (
              <div>
                <div className="text-2xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1 font-sans">
                  Previous Values (Before Change):
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-2xs border border-slate-800">
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && (
              <div>
                <div className="text-2xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1 font-sans">
                  New Values (After Change):
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg overflow-x-auto text-2xs border border-slate-800">
                  {JSON.stringify(selectedLog.new_values, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-sans text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
