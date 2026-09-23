"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Split,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  invoice_number: string | null;
  amount: number;
  allocated_at: string;
}

interface CustomerPaymentItem {
  id: string;
  payment_number: string;
  company_id: string;
  company_name: string | null;
  payment_date: string;
  amount: number;
  payment_method: string;
  bank_account_id: string;
  bank_account_name: string | null;
  reference: string | null;
  notes: string | null;
  status: "DRAFT" | "POSTED" | "VOID";
  allocated_amount: number;
  unallocated_amount: number;
  allocations: PaymentAllocation[];
  created_at: string;
}

interface CollegeSimple {
  id: string;
  organization_name: string;
  code: string;
}

interface AccountSimple {
  id: string;
  account_code: string;
  account_name: string;
  is_bank_or_cash: boolean;
}

interface OpenInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
}

export default function CustomerPaymentsPage() {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<CustomerPaymentItem[]>([]);
  const [companies, setCompanies] = useState<CollegeSimple[]>([]);
  const [bankAccounts, setBankAccounts] = useState<AccountSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyFilter, setCollegeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCompanyId, setSelectedCollegeId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("NEFT");
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Open invoices for selected company to allocate
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [allocations, setAllocations] = useState<{ [invId: string]: number }>({});
  const [fetchingInvoices, setFetchingInvoices] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = "/accounting/payments";
      if (companyFilter !== "ALL") url += `?company_id=${companyFilter}`;

      const [payRes, colRes, accRes] = await Promise.all([
        api.get<CustomerPaymentItem[]>(url),
        api.get<any>("/companies"),
        api.get<AccountSimple[]>("/accounting/accounts"),
      ]);

      setPayments(payRes);
      const cols = Array.isArray(colRes) ? colRes : colRes?.items || [];
      setCompanies(cols);
      const banks = (accRes || []).filter((a) => a.is_bank_or_cash);
      setBankAccounts(banks);
      if (banks.length > 0 && !bankAccountId) {
        setBankAccountId(banks[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load payments:", err);
      setError(err?.detail || "Could not load customer receipts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [companyFilter]);

  // When selected company changes in modal, load its open invoices
  useEffect(() => {
    if (!selectedCompanyId) {
      setOpenInvoices([]);
      setAllocations({});
      return;
    }
    const loadOpenInvoices = async () => {
      try {
        setFetchingInvoices(true);
        const invs = await api.get<any[]>(`/accounting/invoices?company_id=${selectedCompanyId}`);
        const open = (invs || []).filter(
          (inv) => (inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID") && Number(inv.amount_due) > 0
        );
        setOpenInvoices(open);
        setAllocations({});
      } catch (e) {
        console.error("Error loading open invoices:", e);
      } finally {
        setFetchingInvoices(false);
      }
    };
    loadOpenInvoices();
  }, [selectedCompanyId]);

  const handleAutoAllocate = () => {
    let remaining = Number(paymentAmount);
    const newAlloc: { [invId: string]: number } = {};

    for (const inv of openInvoices) {
      if (remaining <= 0) break;
      const due = Number(inv.amount_due);
      const toAlloc = Math.min(remaining, due);
      newAlloc[inv.id] = toAlloc;
      remaining -= toAlloc;
    }
    setAllocations(newAlloc);
  };

  const handleAllocationChange = (invId: string, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invId]: Math.max(0, value),
    }));
  };

  const totalAllocated = Object.values(allocations).reduce((acc, v) => acc + (v || 0), 0);
  const unallocatedAmount = Math.max(0, Number(paymentAmount) - totalAllocated);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !bankAccountId || Number(paymentAmount) <= 0) {
      setError("Please fill all required fields with a valid payment amount.");
      return;
    }

    if (totalAllocated > Number(paymentAmount)) {
      setError(`Allocated total (${formatCurrency(totalAllocated)}) exceeds receipt amount (${formatCurrency(paymentAmount)}).`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const allocList = Object.entries(allocations)
        .filter(([_, amt]) => amt > 0)
        .map(([invId, amt]) => ({
          invoice_id: invId,
          amount: amt,
        }));

      await api.post("/accounting/payments", {
        company_id: selectedCompanyId,
        payment_date: paymentDate,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        bank_account_id: bankAccountId,
        reference,
        notes,
        allocations: allocList,
      });

      setIsModalOpen(false);
      resetModal();
      await fetchData();
    } catch (err: any) {
      console.error("Error creating payment:", err);
      setError(err?.detail || "Failed to record customer payment.");
    } finally {
      setSaving(false);
    }
  };

  const resetModal = () => {
    setSelectedCollegeId("");
    setPaymentAmount(0);
    setReference("");
    setNotes("");
    setAllocations({});
    setOpenInvoices([]);
  };

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.payment_number.toLowerCase().includes(q) ||
      (p.company_name && p.company_name.toLowerCase().includes(q)) ||
      (p.reference && p.reference.toLowerCase().includes(q))
    );
  });

  // KPI Calculations
  const totalReceipts = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalAlloc = payments.reduce((acc, p) => acc + Number(p.allocated_amount), 0);
  const totalUnalloc = payments.reduce((acc, p) => acc + Number(p.unallocated_amount), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Customer Receipts & Payments
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Accounts Receivable settlement workbench, bank deposits, and invoice allocations.
          </p>
        </div>

        <button
          onClick={() => {
            resetModal();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Record Receipt
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Receipts</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(totalReceipts)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{payments.length} customer payments recorded</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Allocated to Invoices</p>
            <p className="text-xl font-bold text-indigo-900 dark:text-indigo-200 mt-0.5">{formatCurrency(totalAlloc)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Directly applied to AR receivables</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Split className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unallocated Advance</p>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-0.5">{formatCurrency(totalUnalloc)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Available customer credit balance</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search payment #, reference, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={companyFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
            className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Companies & Accounts</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.organization_name}
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

      {/* Error alert */}
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

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-6">Payment #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Method & Account</th>
                <th className="py-3.5 px-4">Reference</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4 text-right">Allocated</th>
                <th className="py-3.5 px-4 text-right">Unallocated</th>
                <th className="py-3.5 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">No Customer Payments Found</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Record a customer receipt to apply payments against invoices.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900 dark:text-slate-100">
                      {p.payment_number}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {p.company_name || "N/A"}
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-400">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {p.payment_method}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.bank_account_name || "Bank Account"}</p>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {p.reference || "—"}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                      {formatCurrency(p.allocated_amount)}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-amber-700 dark:text-amber-400 font-medium">
                      {formatCurrency(p.unallocated_amount)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Badge variant={p.status.toLowerCase() as any}>
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Record Customer Receipt
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Account <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCollegeId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  >
                    <option value="">Select a company...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Amount (INR) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 100000"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deposit Account <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  >
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Reference / UTR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR202609001928"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Invoice Allocation Section */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Allocate to Open Invoices
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Unallocated amount remains on customer account as credit.
                    </p>
                  </div>
                  {openInvoices.length > 0 && paymentAmount > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Auto-Allocate
                    </button>
                  )}
                </div>

                {fetchingInvoices ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">Loading customer invoices...</p>
                ) : openInvoices.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                    {selectedCompanyId
                      ? "No open or partially paid invoices for this customer. Total receipt will be recorded as unallocated advance."
                      : "Select a customer above to view open invoices."}
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {openInvoices.map((inv) => {
                      const allocated = allocations[inv.id] || 0;
                      return (
                        <div key={inv.id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 text-xs">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{inv.invoice_number}</span>
                            <span className="text-slate-400 dark:text-slate-500 ml-2">({formatDate(inv.invoice_date)})</span>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              Due: <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(inv.amount_due)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Allocate:</span>
                            <input
                              type="number"
                              step="0.01"
                              max={Number(inv.amount_due)}
                              value={allocated || ""}
                              onChange={(e) => handleAllocationChange(inv.id, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-32 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Allocation Balance Preview */}
                {paymentAmount > 0 && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      Total Allocated: <strong>{formatCurrency(totalAllocated)}</strong>
                    </span>
                    <span className={unallocatedAmount > 0 ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-emerald-700 dark:text-emerald-400 font-semibold"}>
                      Unallocated Advance: {formatCurrency(unallocatedAmount)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal payment notes..."
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
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
                  {saving ? "Posting..." : "Record & Post Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
