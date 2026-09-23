"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bug,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  QAReportData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";

export default function QAReportPage() {
  const [data, setData] = useState<QAReportData | null>(null);
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
      const res = await reportsApi.getQAReport(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load QA report.");
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
          QA Execution, Bugs & Test Pass Rates
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Verification velocity, test suite execution stability, bug triage, and critical defect counts.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="QA"
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
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gathering QA metrics and bug reports...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top QA KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Overall Pass Rate
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {data.kpis.test_pass_rate}%
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.kpis.passed_cases} passed / {data.kpis.total_test_cases} cases
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Failed & Blocked Cases
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {data.kpis.failed_cases + data.kpis.blocked_cases}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.kpis.failed_cases} failed, {data.kpis.blocked_cases} blocked
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Open Defects / Bugs
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {data.kpis.open_bugs}
              </div>
              <div className="text-2xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
                {data.kpis.critical_bugs} critical, {data.kpis.high_bugs} high
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Resolved Defect Ratio
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                {data.kpis.resolved_bugs + data.kpis.closed_bugs}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Out of {data.kpis.total_bugs} lifetime logged bugs
              </div>
            </div>
          </div>

          {/* Bug Severity & Status Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Defects by Severity</h3>
              <div className="space-y-2">
                {data.bugs_by_severity.map((b) => (
                  <div key={b.severity} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{b.severity}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Defects by Triage Status</h3>
              <div className="space-y-2">
                {data.bugs_by_status.map((b) => (
                  <div key={b.status} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{b.status}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Test Suites Summary Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Test Suites Execution Breakdown</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Individual suite performance, executed test cases, and pass rates.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Test Suite</th>
                    <th className="py-3 px-4">Associated Project</th>
                    <th className="py-3 px-4 text-right">Total Cases</th>
                    <th className="py-3 px-4 text-right">Passed</th>
                    <th className="py-3 px-4 text-right">Failed</th>
                    <th className="py-3 px-4 text-right">Blocked</th>
                    <th className="py-3 px-4 text-right">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.test_suites_summary.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No test suites recorded.
                      </td>
                    </tr>
                  ) : (
                    data.test_suites_summary.map((s) => (
                      <tr key={s.suite_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{s.suite_name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{s.project_name || "General"}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{s.total_cases}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{s.passed}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">{s.failed}</td>
                        <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400 font-medium">{s.blocked}</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                              s.pass_rate >= 90
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : s.pass_rate >= 70
                                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                                : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {s.pass_rate}%
                          </span>
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
        reportType="QA"
        currentFilters={filters}
      />
    </div>
  );
}
