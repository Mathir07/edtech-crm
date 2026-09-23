"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Scale,
  Clock,
  ArrowRight,
  PieChart,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface TrialBalanceItem {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

interface TrialBalanceData {
  as_of_date: string;
  items: TrialBalanceItem[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

interface ProfitLossItem {
  account_code: string;
  account_name: string;
  amount: number;
}

interface ProfitLossData {
  start_date: string;
  end_date: string;
  revenue: {
    category: string;
    items: ProfitLossItem[];
    total: number;
  };
  expenses: {
    category: string;
    items: ProfitLossItem[];
    total: number;
  };
  net_income: number;
}

interface BalanceSheetData {
  as_of_date: string;
  assets: {
    category: string;
    items: ProfitLossItem[];
    total: number;
  };
  liabilities: {
    category: string;
    items: ProfitLossItem[];
    total: number;
  };
  equity: {
    category: string;
    items: ProfitLossItem[];
    total: number;
  };
  total_assets: number;
  total_liabilities_and_equity: number;
  is_balanced: boolean;
}

interface AgingBucket {
  entity_id: string;
  entity_name: string;
  current_0_30: number;
  past_31_60: number;
  past_61_90: number;
  past_90_plus: number;
  total_outstanding: number;
}

interface AgingReportData {
  as_of_date: string;
  report_type: string;
  buckets: AgingBucket[];
  total_0_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
  grand_total: number;
}

type TabType = "trial-balance" | "profit-loss" | "balance-sheet" | "ar-aging" | "ap-aging";

export default function FinancialReportsPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("trial-balance");

  // Date controls
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1); // Jan 1st of current year
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Report states
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLossData | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [arAging, setArAging] = useState<AgingReportData | null>(null);
  const [apAging, setApAging] = useState<AgingReportData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === "trial-balance") {
        const data = await api.get<TrialBalanceData>(`/accounting/reports/trial-balance?as_of_date=${asOfDate}`);
        setTrialBalance(data);
      } else if (activeTab === "profit-loss") {
        const data = await api.get<ProfitLossData>(
          `/accounting/reports/profit-loss?start_date=${startDate}&end_date=${endDate}`
        );
        setProfitLoss(data);
      } else if (activeTab === "balance-sheet") {
        const data = await api.get<BalanceSheetData>(`/accounting/reports/balance-sheet?as_of_date=${asOfDate}`);
        setBalanceSheet(data);
      } else if (activeTab === "ar-aging") {
        const data = await api.get<AgingReportData>(`/accounting/reports/ar-aging?as_of_date=${asOfDate}`);
        setArAging(data);
      } else if (activeTab === "ap-aging") {
        const data = await api.get<AgingReportData>(`/accounting/reports/ap-aging?as_of_date=${asOfDate}`);
        setApAging(data);
      }
    } catch (err: any) {
      console.error("Failed to load report:", err);
      setError(err?.detail || "Could not generate financial report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, asOfDate, startDate, endDate]);

  const handleExportCsv = () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    window.open(`${API_BASE}/accounting/export/trial-balance?as_of_date=${asOfDate}`, "_blank");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Financial Statements & Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            General ledger reports, verified trial balances, P&L, balance sheets, and aging matrices.
          </p>
        </div>

        {activeTab === "trial-balance" && (
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl shadow-sm transition-all self-start sm:self-auto"
          >
            <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Export CSV
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { id: "trial-balance", label: "Trial Balance", icon: Scale },
          { id: "profit-loss", label: "Profit & Loss (P&L)", icon: TrendingUp },
          { id: "balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet },
          { id: "ar-aging", label: "AR Aging", icon: Clock },
          { id: "ap-aging", label: "AP Aging", icon: PieChart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {activeTab === "profit-loss" ? (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">As of Date:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800"
            />
          </div>
        )}

        <button
          onClick={fetchReport}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ml-auto sm:ml-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-900 dark:text-rose-200 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab 1: Trial Balance */}
      {activeTab === "trial-balance" && trialBalance && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Trial Balance Statement</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">As of {formatDate(trialBalance.as_of_date)}</p>
            </div>
            {trialBalance.is_balanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Double-Entry Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Unbalanced Discrepancy
              </span>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Account Code</th>
                  <th className="py-3.5 px-6">Account Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-6 text-right">Debit Balance (INR)</th>
                  <th className="py-3.5 px-6 text-right">Credit Balance (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {trialBalance.items.map((it) => (
                  <tr key={it.account_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6 font-mono font-semibold text-slate-800 dark:text-slate-200">{it.account_code}</td>
                    <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-slate-100">{it.account_name}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {it.account_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-slate-800 dark:text-slate-200">
                      {Number(it.debit_balance) > 0 ? formatCurrency(it.debit_balance) : "—"}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-slate-800 dark:text-slate-200">
                      {Number(it.credit_balance) > 0 ? formatCurrency(it.credit_balance) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={3} className="py-4 px-6 uppercase tracking-wider text-xs">
                    Total
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-base text-emerald-800 dark:text-emerald-400">
                    {formatCurrency(trialBalance.total_debit)}
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-base text-emerald-800 dark:text-emerald-400">
                    {formatCurrency(trialBalance.total_credit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Profit & Loss Statement */}
      {activeTab === "profit-loss" && profitLoss && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Income Statement (Profit & Loss)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                For the period {formatDate(profitLoss.start_date)} to {formatDate(profitLoss.end_date)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Income:</span>
              <p
                className={`text-xl font-bold font-mono ${
                  Number(profitLoss.net_income) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {formatCurrency(profitLoss.net_income)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Column */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900 flex items-center justify-between">
                <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm uppercase tracking-wider">Operating Revenue</h3>
                <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300 text-base">
                  {formatCurrency(profitLoss.revenue.total)}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                {profitLoss.revenue.items.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 p-4 text-center">No revenue recorded in this period.</p>
                ) : (
                  profitLoss.revenue.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">{it.account_code}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{it.account_name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(it.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expenses Column */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-rose-50/50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900 flex items-center justify-between">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-sm uppercase tracking-wider">Operating Expenses</h3>
                <span className="font-bold font-mono text-rose-800 dark:text-rose-300 text-base">
                  {formatCurrency(profitLoss.expenses.total)}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                {profitLoss.expenses.items.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 p-4 text-center">No expenses recorded in this period.</p>
                ) : (
                  profitLoss.expenses.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">{it.account_code}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{it.account_name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(it.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Balance Sheet */}
      {activeTab === "balance-sheet" && balanceSheet && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Balance Sheet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">As of {formatDate(balanceSheet.as_of_date)}</p>
            </div>
            {balanceSheet.is_balanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Assets = Liabilities + Equity
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Discrepancy Detected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
                <h3 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm uppercase tracking-wider">Total Assets</h3>
                <span className="font-bold font-mono text-indigo-800 dark:text-indigo-300 text-base">
                  {formatCurrency(balanceSheet.total_assets)}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                {balanceSheet.assets.items.map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">{it.account_code}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{it.account_name}</span>
                    </div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(it.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 flex items-center justify-between">
                  <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm uppercase tracking-wider">Total Liabilities</h3>
                  <span className="font-bold font-mono text-amber-800 dark:text-amber-300 text-base">
                    {formatCurrency(balanceSheet.liabilities.total)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                  {balanceSheet.liabilities.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">{it.account_code}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{it.account_name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900 flex items-center justify-between">
                  <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm uppercase tracking-wider">Equity</h3>
                  <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300 text-base">
                    {formatCurrency(balanceSheet.equity.total)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                  {balanceSheet.equity.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2">{it.account_code}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{it.account_name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AR Aging */}
      {activeTab === "ar-aging" && arAging && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Accounts Receivable (AR) Aging Summary</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Unpaid customer invoices grouped by overdue aging brackets.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Current (0-30d)</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">{formatCurrency(arAging.total_0_30)}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">31-60 Days</p>
              <p className="text-base font-bold text-amber-900 dark:text-amber-300 mt-1 font-mono">{formatCurrency(arAging.total_31_60)}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase">61-90 Days</p>
              <p className="text-base font-bold text-orange-900 dark:text-orange-300 mt-1 font-mono">{formatCurrency(arAging.total_61_90)}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase">90+ Days</p>
              <p className="text-base font-bold text-rose-900 dark:text-rose-300 mt-1 font-mono">{formatCurrency(arAging.total_90_plus)}</p>
            </div>
            <div className="p-3 bg-slate-900 dark:bg-slate-950 border border-slate-900 dark:border-slate-800 rounded-xl text-white">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Total AR</p>
              <p className="text-base font-bold text-white mt-1 font-mono">{formatCurrency(arAging.grand_total)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Customer / Company</th>
                  <th className="py-3.5 px-4 text-right">0-30 Days</th>
                  <th className="py-3.5 px-4 text-right">31-60 Days</th>
                  <th className="py-3.5 px-4 text-right">61-90 Days</th>
                  <th className="py-3.5 px-4 text-right">90+ Days</th>
                  <th className="py-3.5 px-6 text-right font-bold text-slate-900 dark:text-slate-100">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {arAging.buckets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No outstanding receivables found.
                    </td>
                  </tr>
                ) : (
                  arAging.buckets.map((b) => (
                    <tr key={b.entity_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">{b.entity_name}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {Number(b.current_0_30) > 0 ? formatCurrency(b.current_0_30) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-700 dark:text-amber-400">
                        {Number(b.past_31_60) > 0 ? formatCurrency(b.past_31_60) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-orange-700 dark:text-orange-400">
                        {Number(b.past_61_90) > 0 ? formatCurrency(b.past_61_90) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-rose-700 dark:text-rose-400">
                        {Number(b.past_90_plus) > 0 ? formatCurrency(b.past_90_plus) : "—"}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(b.total_outstanding)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: AP Aging */}
      {activeTab === "ap-aging" && apAging && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Accounts Payable (AP) Aging Summary</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding vendor bills grouped by payment due brackets.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Current (0-30d)</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">{formatCurrency(apAging.total_0_30)}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">31-60 Days</p>
              <p className="text-base font-bold text-amber-900 dark:text-amber-300 mt-1 font-mono">{formatCurrency(apAging.total_31_60)}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase">61-90 Days</p>
              <p className="text-base font-bold text-orange-900 dark:text-orange-300 mt-1 font-mono">{formatCurrency(apAging.total_61_90)}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase">90+ Days</p>
              <p className="text-base font-bold text-rose-900 dark:text-rose-300 mt-1 font-mono">{formatCurrency(apAging.total_90_plus)}</p>
            </div>
            <div className="p-3 bg-slate-900 dark:bg-slate-950 border border-slate-900 dark:border-slate-800 rounded-xl text-white">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Total AP</p>
              <p className="text-base font-bold text-white mt-1 font-mono">{formatCurrency(apAging.grand_total)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Vendor / Supplier</th>
                  <th className="py-3.5 px-4 text-right">0-30 Days</th>
                  <th className="py-3.5 px-4 text-right">31-60 Days</th>
                  <th className="py-3.5 px-4 text-right">61-90 Days</th>
                  <th className="py-3.5 px-4 text-right">90+ Days</th>
                  <th className="py-3.5 px-6 text-right font-bold text-slate-900 dark:text-slate-100">Total Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {apAging.buckets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No outstanding payables found.
                    </td>
                  </tr>
                ) : (
                  apAging.buckets.map((b) => (
                    <tr key={b.entity_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">{b.entity_name}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {Number(b.current_0_30) > 0 ? formatCurrency(b.current_0_30) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-700 dark:text-amber-400">
                        {Number(b.past_31_60) > 0 ? formatCurrency(b.past_31_60) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-orange-700 dark:text-orange-400">
                        {Number(b.past_61_90) > 0 ? formatCurrency(b.past_61_90) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-rose-700 dark:text-rose-400">
                        {Number(b.past_90_plus) > 0 ? formatCurrency(b.past_90_plus) : "—"}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(b.total_outstanding)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
