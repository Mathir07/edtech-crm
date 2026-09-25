"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Ban,
  FileText,
  DollarSign,
  Briefcase,
  ExternalLink,
  Eye,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BrandedInvoiceDocument } from "@/components/documents/BrandedInvoiceDocument";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
}

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  company_id: string;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  sales_order_id: string | null;
  sales_order_number: string | null;
  contract_id: string | null;
  contract_number: string | null;
  project_id: string | null;
  project_number: string | null;
  journal_entry_id: string | null;
  invoice_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
  notes: string | null;
  terms: string | null;
  items: InvoiceItem[];
  created_at: string;
}

interface PaymentAccount {
  id: string;
  account_code: string;
  account_name: string;
  is_bank_or_cash: boolean;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;
  const { hasPermission } = useAuth();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [bankAccounts, setBankAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [payMethod, setPayMethod] = useState("NEFT");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Action states
  const [issuing, setIssuing] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invData, accountsData] = await Promise.all([
        api.get<InvoiceDetail>(`/accounting/invoices/${invoiceId}`),
        api.get<PaymentAccount[]>("/accounting/accounts"),
      ]);
      setInvoice(invData);
      setPayAmount(Number(invData.amount_due));
      const banks = (accountsData || []).filter((a) => a.is_bank_or_cash);
      setBankAccounts(banks);
      if (banks.length > 0 && !selectedBankId) {
        setSelectedBankId(banks[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load invoice:", err);
      setError(err?.detail || "Could not load invoice details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  const handleIssue = async () => {
    if (!invoice) return;
    if (!confirm(`Are you sure you want to issue Invoice ${invoice.invoice_number}? This will generate a General Ledger journal entry.`)) return;
    try {
      setIssuing(true);
      setError(null);
      await api.post(`/accounting/invoices/${invoice.id}/issue`);
      setActionSuccess("Invoice successfully issued and posted to General Ledger.");
      await fetchInvoice();
    } catch (err: any) {
      setError(err?.detail || "Failed to issue invoice.");
    } finally {
      setIssuing(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice) return;
    if (!confirm(`Are you sure you want to VOID Invoice ${invoice.invoice_number}? This action is irreversible.`)) return;
    try {
      setVoiding(true);
      setError(null);
      await api.post(`/accounting/invoices/${invoice.id}/void`);
      setActionSuccess("Invoice voided and reversal journal created.");
      await fetchInvoice();
    } catch (err: any) {
      setError(err?.detail || "Failed to void invoice.");
    } finally {
      setVoiding(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !selectedBankId) return;
    try {
      setSubmittingPayment(true);
      setError(null);

      // Create customer payment with allocation to this invoice
      await api.post("/accounting/payments", {
        company_id: invoice.company_id,
        payment_date: payDate,
        amount: Number(payAmount),
        payment_method: payMethod,
        bank_account_id: selectedBankId,
        reference: payRef || `Payment for ${invoice.invoice_number}`,
        notes: payNotes,
        allocations: [
          {
            invoice_id: invoice.id,
            amount: Number(payAmount),
          },
        ],
      });

      setIsPayModalOpen(false);
      setActionSuccess(`Payment of ${formatCurrency(payAmount)} successfully recorded!`);
      await fetchInvoice();
    } catch (err: any) {
      setError(err?.detail || "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading Invoice 360 view...</p>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-6 text-rose-800 dark:text-rose-300 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 mt-0.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-base font-semibold">Error Loading Invoice</h3>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => router.push("/accounting/invoices")}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 underline"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Invoices List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const isOverdue =
    (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
    new Date(invoice.due_date) < new Date();

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-16 screen-only">
        {/* Back Button & Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/accounting/invoices"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customer Invoices
        </Link>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDocPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-xs transition-colors"
          >
            <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Preview Branded PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Banner Feedback */}
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

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
              <Receipt className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {invoice.invoice_number}
                </h1>
                <Badge variant={invoice.status.toLowerCase() as any}>
                  {invoice.status}
                </Badge>
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                    <Clock className="w-3.5 h-3.5" /> Overdue
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                <Link
                  href={`/companies/${invoice.company_id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                >
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {invoice.company_name || "Unknown Company"}
                </Link>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Date: {formatDate(invoice.invoice_date)}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Due: {formatDate(invoice.due_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {invoice.status === "DRAFT" && (
              <button
                onClick={handleIssue}
                disabled={issuing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {issuing ? "Issuing..." : "Issue & Post to GL"}
              </button>
            )}

            {(invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && (
              <button
                onClick={() => {
                  setPayAmount(Number(invoice.amount_due));
                  setIsPayModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-all"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
            )}

            {(invoice.status === "DRAFT" || invoice.status === "ISSUED") && invoice.amount_paid === 0 && (
              <button
                onClick={handleVoid}
                disabled={voiding}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                {voiding ? "Voiding..." : "Void"}
              </button>
            )}
          </div>
        </div>

        {/* Commercial Links & Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Amount</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(invoice.total_amount)}</p>
          </div>
          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Amount Paid</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(invoice.amount_paid)}</p>
          </div>
          <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/40">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Balance Due</p>
            <p className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(invoice.amount_due)}</p>
          </div>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Origin</p>
            <div className="mt-1">
              {invoice.sales_order_number ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                  <Briefcase className="w-3 h-3" /> SO #{invoice.sales_order_number}
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Manual Direct Billing</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Line Items & Commercial Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Line Items ({invoice.items?.length || 0})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-6">Description</th>
                    <th className="py-3.5 px-4 text-right">Qty</th>
                    <th className="py-3.5 px-4 text-right">Unit Price</th>
                    <th className="py-3.5 px-4 text-right">Tax (GST)</th>
                    <th className="py-3.5 px-6 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoice.items?.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">{item.description}</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-700 dark:text-slate-300">{item.quantity}</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(item.unit_price)}</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                        {item.tax_rate}% ({formatCurrency(item.tax_amount)})
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotals & Taxes Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Amounts listed in {invoice.currency || "INR"}. Standard Indian GST applied.
              </div>
              <div className="w-full sm:w-72 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount:</span>
                    <span className="font-mono font-medium">-{formatCurrency(invoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Tax Amount:</span>
                  <span className="font-mono font-medium">{formatCurrency(invoice.tax_amount)}</span>
                </div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-base">
                  <span>Total Amount:</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
              {invoice.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Internal Notes</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Terms & Instructions</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Accounting Audit & Integration */}
        <div className="space-y-6">
          {/* General Ledger Link */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Double-Entry GL Journal
            </h3>
            {invoice.journal_entry_id ? (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-900 dark:text-indigo-200">Posted Journal Entry</span>
                  <span className="px-2 py-0.5 text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded">POSTED</span>
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-400">
                  AR Debit: Accounts Receivable (1200) <br />
                  Operating Revenue Credit: (4000) <br />
                  GST Output Liability: (2200)
                </p>
                <Link
                  href="/accounting/journal-entries"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 pt-1"
                >
                  View in Journal Entries <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                Draft status: No journal entry posted yet. Click <strong>Issue & Post to GL</strong> to record debit to AR and credit to Sales.
              </div>
            )}
          </div>

          {/* Company Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Billed Customer</h3>
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{invoice.company_name || "N/A"}</p>
                {invoice.contact_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Attn: {invoice.contact_name}</p>
                )}
                <Link
                  href={`/companies/${invoice.company_id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline mt-2"
                >
                  Open Company 360 Profile <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Record Customer Receipt
              </h2>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-sm">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Invoice Balance Due:</span>
                <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">{formatCurrency(invoice.amount_due)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount (INR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={Number(invoice.amount_due)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deposit To Bank/Cash Account <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  required
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Reference / UTR / Cheque Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR193847291"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {submittingPayment ? "Recording..." : "Record & Post Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* Print-Only Container (Rendered exclusively during window.print()) */}
      <div className="print-only">
        <BrandedInvoiceDocument data={invoice} forPrint={true} />
      </div>

      {/* Document Preview Modal */}
      {showDocPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150 screen-only"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden my-auto">
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold">Print Preview — Tax Invoice #{invoice.invoice_number}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocPreview(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Document Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/60 dark:bg-slate-950">
              <BrandedInvoiceDocument data={invoice} forPrint={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
