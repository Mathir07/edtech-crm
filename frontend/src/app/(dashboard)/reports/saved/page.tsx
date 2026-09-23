"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookmarkCheck,
  Download,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Lock,
  Globe,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { SavedReport, reportsApi } from "@/lib/reportsApi";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function SavedReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReports = useCallback(async (type?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getSavedReports(type && type !== "ALL" ? type : undefined);
      setReports(res || []);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load saved reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(typeFilter);
  }, [fetchReports, typeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this saved report configuration?")) {
      return;
    }
    try {
      setDeletingId(id);
      await reportsApi.deleteSavedReport(id);
      toast.success("Saved report deleted");
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(err.detail || err.message || "Failed to delete saved report.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async (r: SavedReport) => {
    try {
      await reportsApi.exportCsv(r.report_type, r.filters);
      toast.success("Export initiated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to export report CSV.");
    }
  };

  const getReportUrl = (r: SavedReport) => {
    const q = new URLSearchParams();
    if (r.filters?.date_preset) q.append("date_preset", r.filters.date_preset);
    if (r.filters?.date_from) q.append("date_from", r.filters.date_from);
    if (r.filters?.date_to) q.append("date_to", r.filters.date_to);
    if (r.filters?.company_id) q.append("company_id", r.filters.company_id);

    const base =
      r.report_type === "EXECUTIVE"
        ? "/reports"
        : `/reports/${r.report_type.toLowerCase()}`;
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Saved Custom Reports & Configurations
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Catalog of institutional configurations, recurring audit presets, and team shared reports.
        </p>
      </div>

      <ReportNavTabs />

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <BookmarkCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
          >
            <option value="">All Report Types</option>
            <option value="EXECUTIVE">Executive Dashboard</option>
            <option value="SALES">Sales & Leads</option>
            <option value="PIPELINE">Pipeline</option>
            <option value="PROJECTS">Projects</option>
            <option value="QA">QA & Testing</option>
            <option value="SERVICE">Service & SLA</option>
            <option value="FINANCE">Finance</option>
            <option value="COMMUNICATIONS">Communications</option>
            <option value="TEAM">Team Workload</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {reports.length} {reports.length === 1 ? "saved report" : "saved reports"}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading saved reports...</p>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs">
          <BookmarkCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Saved Reports Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            Navigate to any report module and click &quot;Save Preset&quot; in the filter bar to create reusable customized reports.
          </p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono">
                    {r.report_type}
                  </span>
                  <div className="flex items-center space-x-1 text-2xs text-slate-400 dark:text-slate-500">
                    {r.is_shared || r.is_public ? (
                      <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400" title="Public / Shared">
                        <Globe className="w-3 h-3" />
                        <span className="text-3xs font-medium">Shared</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-slate-500 dark:text-slate-400" title="Private">
                        <Lock className="w-3 h-3" />
                        <span className="text-3xs font-medium">Private</span>
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2">{r.name}</h3>
                {r.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.description}</p>
                )}

                {(() => {
                  const f = r.filters_json || r.filters || {};
                  return (
                    <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 text-3xs text-slate-600 dark:text-slate-300 font-mono space-y-0.5">
                      {f.date_preset && <div>Preset: {f.date_preset}</div>}
                      {f.date_from && <div>From: {f.date_from}</div>}
                      {f.date_to && <div>To: {f.date_to}</div>}
                      {f.company_id && <div>Company ID: {String(f.company_id).slice(0, 8)}...</div>}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-3xs text-slate-400 dark:text-slate-500">
                  {formatDate(r.created_at)}
                </span>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleExport(r)}
                    className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Delete Preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <Link
                    href={getReportUrl(r)}
                    className="flex items-center space-x-1 text-2xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                  >
                    <span>Run</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
