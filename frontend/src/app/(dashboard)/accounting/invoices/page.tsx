"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface InvoiceListItem {
  id: string;
  invoice_number: string;
  company_id: string;
  company_name: string | null;
  sales_order_number: string | null;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
}

interface CompanySimple {
  id: string;
  organization_name: string;
  code: string;
}

export default function InvoicesListPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [companies, setCompanies] = useState<CompanySimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create Invoice Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collegeId, setCollegeId] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unit_price: number; tax_rate: number; discount: number }>>([
    { description: "Higher Ed ERP Annual Platform License", quantity: 1, unit_price: 150000, tax_rate: 18, discount: 0 },
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = "/accounting/invoices";
      if (statusFilter !== "ALL") url += `?status=${statusFilter}`;
      const [invRes, colRes] = await Promise.all([
        api.get<InvoiceListItem[]>(url),
        api.get<any>("/companies"),
      ]);
      setInvoices(invRes);
      const cols = Array.isArray(colRes) ? colRes : colRes?.items || [];
      setCompanies(cols);
    } catch (err: any) {
      console.error("Failed to load invoices:", err);
      setError(err?.detail || "Could not load customer invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, tax_rate: 18, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const taxTotal = items.reduce((sum, it) => {
    const lineSub = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    return sum + lineSub * ((Number(it.tax_rate) || 0) / 100);
  }, 0);
  const grandTotal = subtotal + taxTotal;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeId) {
      setError("Please select an institution.");
      return;
    }
    try {
      setSaving(true);
      await api.post("/accounting/invoices", {
        company_id: collegeId,
        invoice_date: invDate,
        due_date: dueDate,
        notes: notes || undefined,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          tax_rate: Number(it.tax_rate) || 0,
          discount: Number(it.discount) || 0,
        })),
      });
      toast.success("Invoice created successfully");
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err?.detail || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handleIssue = async (id: string) => {
    try {
      await api.post(`/accounting/invoices/${id}/issue`);
      toast.success("Invoice issued successfully");
      fetchData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to issue invoice.");
    }
  };

  const filtered = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.company_name && inv.company_name.toLowerCase().includes(q))
    );
  });

  const totalOutstanding = filtered.reduce((s, inv) => s + (Number(inv.amount_due) || 0), 0);
  const totalBilled = filtered.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Customer Invoices (AR)</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accounts Receivable billing, automatic GST output computation, and payment tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {hasPermission("accounting.create") && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Billed</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalBilled)}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outstanding Due (AR)</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(totalOutstanding)}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Invoices</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{filtered.length}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search invoice or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-3xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer / Company</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">Loading customer invoices...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">No invoices match the selected filter.</td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/accounting/invoices/${inv.id}`} className="font-mono font-bold text-teal-600 dark:text-teal-400 hover:underline">
                        {inv.invoice_number}
                      </Link>
                      {inv.sales_order_number && (
                        <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">SO: {inv.sales_order_number}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{inv.company_name || "Institutional Client"}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-2xs">
                      <div>Issued: {formatDate(inv.invoice_date)}</div>
                      <div>Due: {formatDate(inv.due_date)}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {inv.amount_due > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">{formatCurrency(inv.amount_due)}</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="status" status={inv.status}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {inv.status === "DRAFT" && hasPermission("accounting.post") && (
                          <button
                            onClick={() => handleIssue(inv.id)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-2xs font-medium shadow-xs"
                          >
                            Issue
                          </button>
                        )}
                        <Link
                          href={`/accounting/invoices/${inv.id}`}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-2xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Customer Invoice */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Customer Invoice (AR)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Bill a client company for software subscriptions, implementation, or AMC renewals.
            </p>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Customer Company *
                </label>
                <select
                  required
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Company / Account...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.organization_name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Due Date (30 Days Default) *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Line Items & Services</span>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {items.map((it, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center space-x-2">
                      <input
                        type="text"
                        required
                        placeholder="Description of service or license"
                        value={it.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 1)}
                        className="w-16 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg text-right font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Unit Price"
                        value={it.unit_price || ""}
                        onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                        className="w-28 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg text-right font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                      <select
                        value={it.tax_rate}
                        onChange={(e) => updateItem(idx, "tax_rate", parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        <option value="18">GST 18%</option>
                        <option value="12">GST 12%</option>
                        <option value="5">GST 5%</option>
                        <option value="0">Exempt 0%</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>GST Output Tax:</span>
                  <span>{formatCurrency(taxTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Total Amount:</span>
                  <span className="text-teal-700 dark:text-teal-400">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Notes & Payment Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Payment bank details or institutional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                >
                  {saving ? "Creating..." : "Create Draft Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
