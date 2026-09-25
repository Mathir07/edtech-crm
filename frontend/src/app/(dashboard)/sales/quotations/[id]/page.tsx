"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  XCircle,
  Copy,
  Briefcase,
  CheckSquare,
  Building2,
  Calendar,
  AlertTriangle,
  FileText,
  Mail,
  Printer,
  Eye,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BrandedQuotationDocument } from "@/components/documents/BrandedQuotationDocument";

interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  product_name: string | null;
  product_code: string | null;
}

interface QuotationDetail {
  id: string;
  quotation_number: string;
  company_id: string;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  created_by_id?: string | null;
  creator_name: string | null;
  approved_by_id?: string | null;
  approver_name: string | null;
  approved_at: string | null;
  created_at: string;
  items: QuotationItem[];
}

export default function QuotationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [quote, setQuote] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDocPreview, setShowDocPreview] = useState(false);

  useEffect(() => {
    loadQuotation();
  }, [id]);

  const loadQuotation = async () => {
    try {
      setLoading(true);
      const data = await api.get<QuotationDetail>(`/quotations/${id}`);
      setQuote(data);
    } catch (err: any) {
      setErrorMsg(err.detail || "Failed to load quotation");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionPath: string, successMsg?: string) => {
    try {
      setActionLoading(true);
      setErrorMsg("");
      setNotice("");
      const res = await api.post<any>(`/quotations/${id}/${actionPath}`);
      if (res && res.message) {
        setNotice(res.message);
      } else if (successMsg) {
        setNotice(successMsg);
      }
      loadQuotation();
    } catch (err: any) {
      setErrorMsg(err.detail || `Action failed`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setActionLoading(true);
      const res = await api.post<any>(`/quotations/${id}/duplicate`);
      router.push(`/sales/quotations/${res.id}`);
    } catch (err: any) {
      setErrorMsg(err.detail || "Failed to duplicate quotation");
      setActionLoading(false);
    }
  };

  const handleCreateContract = async () => {
    if (!quote) return;
    try {
      setActionLoading(true);
      const payload = {
        company_id: quote.company_id,
        contact_id: quote.contact_id,
        opportunity_id: quote.opportunity_id,
        quotation_id: quote.id,
        title: `${quote.company_name || "Institution"} - Master Agreement (${quote.quotation_number})`,
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        contract_value: quote.total_amount,
        terms: quote.terms,
      };
      await api.post("/contracts", payload);
      router.push("/sales/contracts");
    } catch (err: any) {
      setErrorMsg(err.detail || "Failed to create contract");
      setActionLoading(false);
    }
  };

  const handleCreateSalesOrder = async () => {
    if (!quote) return;
    try {
      setActionLoading(true);
      const payload = {
        company_id: quote.company_id,
        contact_id: quote.contact_id,
        opportunity_id: quote.opportunity_id,
        quotation_id: quote.id,
        order_date: new Date().toISOString().split("T")[0],
        notes: `Order created from quotation ${quote.quotation_number}`,
      };
      await api.post("/sales-orders", payload);
      router.push("/sales/sales-orders");
    } catch (err: any) {
      setErrorMsg(err.detail || "Failed to create sales order");
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 dark:text-slate-500">
        Loading quotation document...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-12 text-center text-slate-400 dark:text-slate-500">
        Quotation not found. <Link href="/sales/quotations" className="text-indigo-600 dark:text-indigo-400 underline">Go back</Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-5xl mx-auto screen-only">
        {/* Top Nav & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/sales/quotations"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {quote.quotation_number}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  quote.status === "Approved"
                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                    : quote.status === "Accepted"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                    : quote.status === "Sent"
                    ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300"
                    : quote.status === "Pending Approval"
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {quote.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Created on {quote.quotation_date} by {quote.creator_name || "Sales Team"}
            </p>
          </div>
        </div>

        {/* Quick Duplicate & Print */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDocPreview(true)}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
            Preview Proposal
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-lg text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-600" />
            Print / Save PDF
          </button>
          {hasPermission("sales.quotations.create") && (
            <button
              onClick={handleDuplicate}
              disabled={actionLoading}
              className="inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
              Duplicate
            </button>
          )}
        </div>
      </div>

      {/* Notices & Alerts */}
      {notice && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-sm rounded-xl flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Workflow Action Bar */}
      <div className="bg-slate-900 dark:bg-slate-850 border border-transparent dark:border-slate-800 text-white rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available Actions:</span>
          {quote.status === "Draft" && (
            <span className="text-xs text-slate-300">Submit this proposal for management review</span>
          )}
          {quote.status === "Pending Approval" && (
            <span className="text-xs text-amber-300 font-medium">Awaiting Manager or Management signoff</span>
          )}
          {quote.status === "Approved" && (
            <span className="text-xs text-blue-300">Ready to be sent or accepted by institution</span>
          )}
          {quote.status === "Accepted" && (
            <span className="text-xs text-emerald-300 font-medium">Deal won! Ready for Contract & Order generation</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Submit */}
          {quote.status === "Draft" && (
            <button
              onClick={() => handleAction("submit", "Quotation submitted for approval")}
              disabled={actionLoading}
              className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Submit for Approval
            </button>
          )}

          {/* Approve / Reject (Requires permission) */}
          {(quote.status === "Draft" || quote.status === "Pending Approval") &&
            hasPermission("sales.quotations.approve") && (
              <>
                <button
                  onClick={() => handleAction("approve", "Quotation approved by management")}
                  disabled={actionLoading}
                  className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Approve Quotation
                </button>
                <button
                  onClick={() => handleAction("reject", "Quotation rejected")}
                  disabled={actionLoading}
                  className="inline-flex items-center px-3.5 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject
                </button>
              </>
            )}

          {/* Send to Client */}
          {(quote.status === "Approved" || quote.status === "Sent") && (
            <button
              onClick={() => handleAction("send")}
              disabled={actionLoading}
              className="inline-flex items-center px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5 mr-1" />
              Send to Client
            </button>
          )}

          {/* Accept */}
          {(quote.status === "Approved" || quote.status === "Sent") && (
            <button
              onClick={() => handleAction("accept", "Quotation marked as Accepted by client")}
              disabled={actionLoading}
              className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Mark Accepted
            </button>
          )}

          {/* Convert to Contract & Sales Order */}
          {quote.status === "Accepted" && (
            <>
              <button
                onClick={handleCreateContract}
                disabled={actionLoading}
                className="inline-flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Briefcase className="w-3.5 h-3.5 mr-1" />
                Generate Contract
              </button>
              <button
                onClick={handleCreateSalesOrder}
                disabled={actionLoading}
                className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                Generate Sales Order
              </button>
            </>
          )}

          {/* Cancel */}
          {quote.status !== "Cancelled" && quote.status !== "Accepted" && (
            <button
              onClick={() => handleAction("cancel", "Quotation cancelled")}
              disabled={actionLoading}
              className="inline-flex items-center px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Main Quotation Document Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-8 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">Commercial Proposal & Quotation</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kiwi CRM Enterprise Institutional Sales</div>
          </div>
          <div className="text-right sm:text-right font-mono text-sm space-y-1">
            <div>
              <span className="text-slate-400 dark:text-slate-500 text-xs">Reference: </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{quote.quotation_number}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 text-xs">Date: </span>
              <span className="text-slate-700 dark:text-slate-300">{quote.quotation_date}</span>
            </div>
            {quote.valid_until && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-xs">Valid Until: </span>
                <span className="text-slate-700 dark:text-slate-300">{quote.valid_until}</span>
              </div>
            )}
          </div>
        </div>

        {/* Client & Institution Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Prepared For
            </div>
            <div className="font-bold text-base text-slate-900 dark:text-slate-100">
              {quote.company_name || "Autonomous Institution"}
            </div>
            {quote.contact_name && (
              <div className="text-sm text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                Attn: {quote.contact_name}
              </div>
            )}
            {quote.opportunity_title && (
              <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                Project Deal: {quote.opportunity_title}
              </div>
            )}
          </div>
          <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Issuer & Approval Status
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Account Executive: </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{quote.creator_name || "Assigned Representative"}</span>
            </div>
            {quote.approved_by_id && (
              <div>
                <span className="text-slate-400 dark:text-slate-500">Authorized Signatory: </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{quote.approver_name || "Sales Management"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Itemized Commercial Breakdown
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3 text-right">Unit Price</th>
                  <th className="px-5 py-3 text-right">Discount</th>
                  <th className="px-5 py-3 text-right">Tax Rate</th>
                  <th className="px-5 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quote.items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{it.description}</div>
                      {it.product_code && (
                        <div className="text-2xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{it.product_code}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono">{it.quantity}</td>
                    <td className="px-5 py-3.5 text-right font-mono">{formatCurrency(it.unit_price)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {it.discount > 0 ? `- ${formatCurrency(it.discount)}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs">{it.tax_rate}% GST</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(it.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Rollup Summary */}
        <div className="flex justify-end pt-2">
          <div className="w-full sm:w-80 space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Total Discount:</span>
              <span className="font-mono font-medium">- {formatCurrency(quote.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>GST Tax Amount (18%):</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">+ {formatCurrency(quote.tax_amount)}</span>
            </div>
            <div className="border-t-2 border-slate-900 dark:border-slate-700 pt-3 flex justify-between text-base font-extrabold text-slate-900 dark:text-slate-100">
              <span>Quotation Total:</span>
              <span className="font-mono text-indigo-700 dark:text-indigo-400 text-lg">{formatCurrency(quote.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Commercial Terms & Notes */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 dark:text-slate-300">
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Terms & Payment Schedule</span>
            <p className="whitespace-pre-line leading-relaxed">{quote.terms || "Standard enterprise payment terms apply."}</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Notes & Assumptions</span>
            <p className="whitespace-pre-line leading-relaxed">{quote.notes || "No special conditions noted."}</p>
          </div>
        </div>
      </div>
      </div>

      {/* Print-Only Container (Rendered exclusively during window.print()) */}
      <div className="print-only">
        <BrandedQuotationDocument data={quote} forPrint={true} />
      </div>

      {/* Commercial Proposal PDF Preview Modal */}
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
                <FileText className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold">Print Preview — Commercial Proposal #{quote.quotation_number}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
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
              <BrandedQuotationDocument data={quote} forPrint={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
