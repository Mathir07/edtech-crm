"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Tag,
  Building2,
  Briefcase,
  CreditCard,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ExpenseItem {
  id: string;
  expense_number: string;
  expense_date: string;
  category: string;
  expense_account_id: string;
  expense_account_name: string | null;
  payment_account_id: string;
  payment_account_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  project_id: string | null;
  project_number: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  reference: string | null;
  description: string;
  status: "DRAFT" | "POSTED" | "VOID";
}

interface VendorSimple {
  id: string;
  name: string;
}

interface AccountSimple {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_bank_or_cash: boolean;
}

const CATEGORIES = [
  "SALARIES",
  "OFFICE_RENT",
  "CLOUD_HOSTING",
  "SOFTWARE_LICENSES",
  "TRAVEL",
  "MARKETING",
  "UTILITIES",
  "LEGAL_PROFESSIONAL",
  "OTHER",
];

export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [vendors, setVendors] = useState<VendorSimple[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountSimple[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<AccountSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Record Expense Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("CLOUD_HOSTING");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("NEFT");
  const [reference, setReference] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = "/accounting/expenses";
      if (categoryFilter !== "ALL") url += `?category=${categoryFilter}`;

      const [expRes, venRes, accRes] = await Promise.all([
        api.get<ExpenseItem[]>(url),
        api.get<VendorSimple[]>("/accounting/vendors"),
        api.get<AccountSimple[]>("/accounting/accounts"),
      ]);

      setExpenses(expRes || []);
      setVendors(venRes || []);
      const expensesAcc = (accRes || []).filter((a) => a.account_type === "EXPENSE");
      const bankAcc = (accRes || []).filter((a) => a.is_bank_or_cash);
      setExpenseAccounts(expensesAcc);
      setPaymentAccounts(bankAcc);

      if (expensesAcc.length > 0 && !expenseAccountId) {
        setExpenseAccountId(expensesAcc[0].id);
      }
      if (bankAcc.length > 0 && !paymentAccountId) {
        setPaymentAccountId(bankAcc[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load expenses:", err);
      setError(err?.detail || "Could not load expenses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryFilter]);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || Number(amount) <= 0 || !expenseAccountId || !paymentAccountId) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post("/accounting/expenses", {
        expense_date: expenseDate,
        category,
        expense_account_id: expenseAccountId,
        payment_account_id: paymentAccountId,
        vendor_id: vendorId || undefined,
        amount: Number(amount),
        tax_amount: Number(taxAmount),
        payment_method: paymentMethod,
        reference: reference || undefined,
        description: description.trim(),
      });

      setIsModalOpen(false);
      resetForm();
      setActionSuccess("Operating expense recorded and posted to General Ledger.");
      await fetchData();
    } catch (err: any) {
      console.error("Error creating expense:", err);
      setError(err?.detail || "Failed to record expense.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setAmount(0);
    setTaxAmount(0);
    setReference("");
    setVendorId("");
  };

  // KPIs
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.total_amount), 0);
  const totalTaxInput = expenses.reduce((acc, e) => acc + Number(e.tax_amount), 0);

  const filteredExpenses = expenses.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.expense_number.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      (e.vendor_name && e.vendor_name.toLowerCase().includes(q)) ||
      (e.reference && e.reference.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <PieChart className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Operating Expenses
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track day-to-day business disbursements, category allocations, and tax input credits.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      {/* Feedback Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-900 dark:text-emerald-300 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {actionSuccess}
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-900 dark:text-rose-300 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Operating Outflow</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{expenses.length} expense postings recorded</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GST Input Tax Credit</p>
            <p className="text-xl font-bold text-indigo-900 dark:text-indigo-200 mt-0.5">{formatCurrency(totalTaxInput)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Eligible input tax offset</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Categories</p>
            <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
              {new Set(expenses.map((e) => e.category)).size} Categories
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cloud, Salaries, Travel, Utilities</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search description, expense #, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-6">Expense #</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-6">Description</th>
                <th className="py-3.5 px-4">Vendor</th>
                <th className="py-3.5 px-4">Payment Account</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">GST</th>
                <th className="py-3.5 px-6 text-right">Total Outflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <PieChart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">No Expenses Recorded</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Record company operational disbursements to track overhead.</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-slate-100">
                      {e.expense_number}
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-400">
                      {formatDate(e.expense_date)}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {e.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      {e.description}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {e.vendor_name || "—"}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {e.payment_account_name || "Bank Account"}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-500 dark:text-slate-400 text-xs">
                      {formatCurrency(e.tax_amount)}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(e.total_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Record Operating Expense
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. AWS Production EC2 & RDS Hosting Charges for September"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Net Amount (INR) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setAmount(val);
                      // Auto calculate 18% GST estimate
                      setTaxAmount(Math.round(val * 0.18 * 100) / 100);
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GST / Tax Amount (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxAmount || ""}
                    onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Account (CoA) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={expenseAccountId}
                    onChange={(e) => setExpenseAccountId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  >
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paid From Account <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  >
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vendor (Optional)</label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="">None / Direct</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference / UTR #</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR819238"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total Outflow Debit:</span>
                <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(Number(amount) + Number(taxAmount))}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? "Posting..." : "Record & Post Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
