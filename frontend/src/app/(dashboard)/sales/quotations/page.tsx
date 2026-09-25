"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  XCircle,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Quotation {
  id: string;
  quotation_number: string;
  company_id: string;
  college_name: string | null;
  contact_name: string | null;
  opportunity_title: string | null;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  creator_name: string | null;
  created_at: string;
}

export default function QuotationsListPage() {
  const { hasPermission } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadQuotations();
  }, [search, statusFilter]);

  const loadQuotations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const data = await api.get<Quotation[]>(`/quotations?${params.toString()}`);
      setQuotations(data);
    } catch (err) {
      console.error("Failed to load quotations", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const statusBadges: Record<string, { bg: string; text: string; icon: any }> = {
    Draft: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", icon: Clock },
    "Pending Approval": { bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300", icon: Clock },
    Approved: { bg: "bg-blue-100 dark:bg-blue-950/60", text: "text-blue-800 dark:text-blue-300", icon: ShieldCheck },
    Sent: { bg: "bg-purple-100 dark:bg-purple-950/60", text: "text-purple-800 dark:text-purple-300", icon: Send },
    Accepted: { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
    Rejected: { bg: "bg-red-100 dark:bg-red-950/60", text: "text-red-800 dark:text-red-300", icon: XCircle },
    Cancelled: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500 dark:text-slate-400", icon: XCircle },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Institutional Quotations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Commercial proposals, formal price quotations, institutional discount approvals, and client acceptance.
          </p>
        </div>
        {hasPermission("sales.quotations.create") && (
          <Link
            href="/sales/quotations/new"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Quotation
          </Link>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          {["ALL", "Draft", "Pending Approval", "Approved", "Sent", "Accepted", "Rejected"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {st === "ALL" ? "All Quotations" : st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search quotation # or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Quotation Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Quotation #</th>
                <th className="px-6 py-3.5">Company / Client</th>
                <th className="px-6 py-3.5">Opportunity</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Total Amount</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 dark:text-slate-500">
                    No quotations found matching your criteria.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const badge = statusBadges[q.status] || {
                    bg: "bg-slate-100 dark:bg-slate-800",
                    text: "text-slate-600 dark:text-slate-400",
                    icon: Clock,
                  };
                  const Icon = badge.icon;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        <Link href={`/sales/quotations/${q.id}`} className="hover:underline">
                          {q.quotation_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{q.college_name || "Independent"}</div>
                        {q.contact_name && <div className="text-xs text-slate-400 dark:text-slate-500">{q.contact_name}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300">
                        {q.opportunity_title || "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {q.quotation_date}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {q.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(q.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/sales/quotations/${q.id}`}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                        >
                          View & Act →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
