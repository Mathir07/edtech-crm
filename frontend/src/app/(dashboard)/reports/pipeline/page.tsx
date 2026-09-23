"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Kanban,
  TrendingUp,
  Percent,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  PipelineReportData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";
import { formatCurrency } from "@/lib/utils";

export default function PipelineReportPage() {
  const [data, setData] = useState<PipelineReportData | null>(null);
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
      const res = await reportsApi.getPipelineReport(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load pipeline report.");
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
          Sales Pipeline & Funnel Progression
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Institutional deal velocity, stage weighting, and conversion probability analytics.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="PIPELINE"
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
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Analyzing pipeline progression...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Unweighted Pipeline Value
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatCurrency(data.pipeline_summary.pipeline_value)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.pipeline_summary.open_opportunities} active deals
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Probability-Weighted Value
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                {formatCurrency(data.pipeline_summary.weighted_pipeline_value)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Risk-adjusted expected realization
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Average Deal Size
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatCurrency(data.pipeline_summary.average_deal_value)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Won Rate: {data.pipeline_summary.opportunity_win_rate}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Realized Closed Revenue
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatCurrency(data.pipeline_summary.won_revenue)}
              </div>
              <div className="text-2xs text-emerald-700 dark:text-emerald-400 mt-1">
                {data.pipeline_summary.won_opportunities} deals closed won
              </div>
            </div>
          </div>

          {/* Visual Funnel Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Stage Velocity & Value Distribution</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.pipeline_stages.map((stg, idx) => {
                const isLast = idx === data.pipeline_stages.length - 1;
                return (
                  <div
                    key={stg.stage_id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-2xs font-mono text-slate-400 dark:text-slate-500">
                        <span>Stage {stg.stage_order}</span>
                        <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                          {stg.probability}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                        {stg.stage_name}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(stg.stage_value)}
                      </div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Weighted: {formatCurrency(stg.weighted_value)}
                      </div>
                      <div className="text-3xs text-slate-400 dark:text-slate-500 mt-1">
                        {stg.opportunity_count} {stg.opportunity_count === 1 ? "deal" : "deals"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Pipeline Breakdown Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pipeline Stages Breakdown</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Exact deal count, total value, and weighted value per stage.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Stage Order</th>
                    <th className="py-3 px-4">Stage Name</th>
                    <th className="py-3 px-4 text-right">Probability</th>
                    <th className="py-3 px-4 text-right">Active Deals</th>
                    <th className="py-3 px-4 text-right">Stage Total Value</th>
                    <th className="py-3 px-4 text-right">Weighted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.pipeline_stages.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No pipeline stages defined.
                      </td>
                    </tr>
                  ) : (
                    data.pipeline_stages.map((stg) => (
                      <tr key={stg.stage_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-mono text-slate-400 dark:text-slate-500">
                          #{stg.stage_order}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {stg.stage_name}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-indigo-600 dark:text-indigo-400">
                          {stg.probability}%
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                          {stg.opportunity_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(stg.stage_value)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(stg.weighted_value)}
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
        reportType="PIPELINE"
        currentFilters={filters}
      />
    </div>
  );
}
