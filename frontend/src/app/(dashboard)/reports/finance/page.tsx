"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Landmark,
  CreditCard,
  Receipt,
  Wallet,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  FinanceReportData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";
import { formatCurrency } from "@/lib/utils";

export default function FinanceReportPage() {
  const [data, setData] = useState<FinanceReportData | null>(null);
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
      const res = await reportsApi.getFinanceReport(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load finance report.");
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Financial Management, Invoicing & Working Capital
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Accounts Receivable aging, Accounts Payable liabilities, cash collections, and net operating liquidity.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="FINANCE"
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
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Reconciling ledger accounts and aging schedules...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top Finance KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Invoiced (AR)
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatCurrency(data.kpis.total_invoiced)}
              </div>
              <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                Collected: {formatCurrency(data.kpis.total_collected)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Outstanding AR
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {formatCurrency(data.kpis.outstanding_ar)}
              </div>
              <div className="text-2xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                Overdue: {formatCurrency(data.kpis.overdue_ar)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Outstanding AP (Liabilities)
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                {formatCurrency(data.kpis.outstanding_ap)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Billed: {formatCurrency(data.kpis.total_billed)} / Paid: {formatCurrency(data.kpis.total_paid)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Net Operating Cashflow
              </div>
              <div
                className={`text-2xl font-bold mt-2 ${
                  data.kpis.net_operating_cashflow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatCurrency(data.kpis.net_operating_cashflow)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Collections minus Disbursements
              </div>
            </div>
          </div>

          {/* AR & AP Aging Buckets side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AR Aging */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Accounts Receivable (AR) Aging</h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">Uncollected customer invoices categorized by days past due.</p>
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {formatCurrency(data.ar_aging.total)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Current (0 - 30 Days)</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    {formatCurrency(data.ar_aging.current_0_30)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">31 - 60 Days Past Due</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {formatCurrency(data.ar_aging.days_31_60)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">61 - 90 Days Past Due</span>
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-400 font-mono">
                    {formatCurrency(data.ar_aging.days_61_90)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
                  <span className="text-xs font-medium text-rose-800 dark:text-rose-300">90+ Days (Severe Overdue)</span>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                    {formatCurrency(data.ar_aging.days_90_plus)}
                  </span>
                </div>
              </div>
            </div>

            {/* AP Aging */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Accounts Payable (AP) Aging</h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400">Unpaid vendor bills and obligations categorized by age.</p>
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {formatCurrency(data.ap_aging.total)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Current (0 - 30 Days)</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {formatCurrency(data.ap_aging.current_0_30)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">31 - 60 Days Aging</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {formatCurrency(data.ap_aging.days_31_60)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">61 - 90 Days Aging</span>
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-400 font-mono">
                    {formatCurrency(data.ap_aging.days_61_90)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
                  <span className="text-xs font-medium text-rose-800 dark:text-rose-300">90+ Days Liability</span>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 font-mono">
                    {formatCurrency(data.ap_aging.days_90_plus)}
                  </span>
                </div>
              </div>
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
        reportType="FINANCE"
        currentFilters={filters}
      />
    </div>
  );
}
