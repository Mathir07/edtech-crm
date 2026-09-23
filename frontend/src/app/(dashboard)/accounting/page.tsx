"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Receipt,
  CreditCard,
  FileSpreadsheet,
  Wallet,
  Scale,
  BookOpen,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Building2,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface AccountingDashboard {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  accounts_receivable: number;
  accounts_payable: number;
  cash_and_bank_balance: number;
  overdue_invoices_count: number;
  overdue_invoices_amount: number;
  overdue_bills_count: number;
  overdue_bills_amount: number;
  recent_invoices: Array<{
    id: string;
    invoice_number: string;
    college_name: string | null;
    invoice_date: string;
    total_amount: number;
    amount_due: number;
    status: string;
  }>;
  recent_bills: Array<{
    id: string;
    bill_number: string;
    vendor_name: string | null;
    bill_date: string;
    total_amount: number;
    amount_due: number;
    status: string;
  }>;
  recent_journal_entries: Array<{
    id: string;
    entry_number: string;
    transaction_date: string;
    description: string;
    total_debit: number;
    status: string;
  }>;
}

export default function AccountingDashboardPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<AccountingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<AccountingDashboard>("/accounting/dashboard");
      setData(res);
    } catch (err: any) {
      console.error("Failed to load accounting dashboard:", err);
      setError(err?.detail || "Could not load financial metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Finance & Accounting</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Double-entry General Ledger, Accounts Receivable, Accounts Payable, and Financial Statements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {hasPermission("accounting.create") && (
            <Link
              href="/accounting/invoices"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <Receipt className="w-4 h-4" />
              <span>Create Invoice</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Cash & Bank Balance</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(data?.cash_and_bank_balance ?? 0)}
          </div>
          <div className="mt-1 flex items-center text-3xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>Operating Accounts Available</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Accounts Receivable (AR)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(data?.accounts_receivable ?? 0)}
          </div>
          <div className="mt-1 flex items-center text-3xs text-slate-500 dark:text-slate-400">
            <span>Overdue: {formatCurrency(data?.overdue_invoices_amount ?? 0)}</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Accounts Payable (AP)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(data?.accounts_payable ?? 0)}
          </div>
          <div className="mt-1 flex items-center text-3xs text-slate-500 dark:text-slate-400">
            <span>Overdue: {formatCurrency(data?.overdue_bills_amount ?? 0)}</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Net Operating Income</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-bold ${(data?.net_income ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {formatCurrency(data?.net_income ?? 0)}
          </div>
          <div className="mt-1 flex items-center text-3xs text-slate-500 dark:text-slate-400">
            <span>Rev: {formatCurrency(data?.total_revenue ?? 0)} | Exp: {formatCurrency(data?.total_expenses ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          href="/accounting/invoices"
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs transition-all group flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Invoices</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">Company Billing</span>
        </Link>

        <Link
          href="/accounting/payments"
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs transition-all group flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <CreditCard className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Payments</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">Collections</span>
        </Link>

        <Link
          href="/accounting/bills"
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs transition-all group flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Vendor Bills</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">Payables</span>
        </Link>

        <Link
          href="/accounting/expenses"
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs transition-all group flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Expenses</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">Operations</span>
        </Link>

        <Link
          href="/accounting/journal-entries"
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs transition-all group flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Scale className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Journals</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">General Ledger</span>
        </Link>

        <Link
          href="/accounting/reports"
          className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-xs transition-all group flex flex-col items-center text-center"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Statements</span>
          <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">P&L, Balance Sheet</span>
        </Link>
      </div>

      {/* Dual Activity Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Customer Invoices</h2>
            </div>
            <Link href="/accounting/invoices" className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center">
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(!data?.recent_invoices || data.recent_invoices.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">No invoices recorded yet.</div>
            ) : (
              data.recent_invoices.map((inv) => (
                <div key={inv.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Link href={`/accounting/invoices/${inv.id}`} className="font-semibold text-xs text-teal-600 dark:text-teal-400 hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <Badge variant="status" status={inv.status}>
                        {inv.status}
                      </Badge>
                    </div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                      {inv.college_name || "Institutional Client"} • {formatDate(inv.invoice_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(inv.total_amount)}</div>
                    {inv.amount_due > 0 ? (
                      <div className="text-3xs text-rose-600 dark:text-rose-400 font-medium">Due: {formatCurrency(inv.amount_due)}</div>
                    ) : (
                      <div className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">Fully Paid</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Vendor Bills */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Vendor Bills</h2>
            </div>
            <Link href="/accounting/bills" className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center">
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(!data?.recent_bills || data.recent_bills.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">No vendor bills recorded yet.</div>
            ) : (
              data.recent_bills.map((b) => (
                <div key={b.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 flex items-center justify-between transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">{b.bill_number}</span>
                      <Badge variant="status" status={b.status}>
                        {b.status}
                      </Badge>
                    </div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                      {b.vendor_name || "Supplier"} • {formatDate(b.bill_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(b.total_amount)}</div>
                    {b.amount_due > 0 ? (
                      <div className="text-3xs text-amber-600 dark:text-amber-400 font-medium">Due: {formatCurrency(b.amount_due)}</div>
                    ) : (
                      <div className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium">Settled</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* General Ledger Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Double-Entry Journal Postings</h2>
          </div>
          <Link href="/accounting/journal-entries" className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center">
            View General Ledger <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-3xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Entry Number</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-right">Debit / Credit Balance</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {(!data?.recent_journal_entries || data.recent_journal_entries.length === 0) ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500">No journal postings recorded yet.</td>
                </tr>
              ) : (
                data.recent_journal_entries.map((je) => (
                  <tr key={je.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-4 font-semibold text-teal-600 dark:text-teal-400">{je.entry_number}</td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{formatDate(je.transaction_date)}</td>
                    <td className="py-2.5 px-4 max-w-xs truncate">{je.description}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium">{formatCurrency(je.total_debit)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant="status" status={je.status}>
                        {je.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
