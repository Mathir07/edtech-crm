"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Briefcase,
  CheckSquare,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface DashboardStats {
  total_quotations: number;
  draft_quotations: number;
  pending_approval_quotations: number;
  approved_quotations: number;
  accepted_quotations: number;
  quotation_pipeline_value: number;
  accepted_quotation_value: number;
  total_contracts: number;
  active_contracts: number;
  active_contract_value: number;
  total_orders: number;
  confirmed_orders: number;
  confirmed_order_value: number;
  top_products: Array<{
    name: string;
    code: string;
    quotation_count: number;
    total_value: number;
  }>;
  recent_quotations: Array<{
    id: string;
    quotation_number: string;
    college_name: string;
    total_amount: number;
    status: string;
    created_at: string;
  }>;
}

export default function SalesDashboardPage() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.get<DashboardStats>("/sales/dashboard/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load sales stats", err);
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

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Commercials & Sales Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Institutional deal proposals, approval status, active company contracts, and verified order pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sales/products"
            className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <Layers className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
            Catalog
          </Link>
          {hasPermission("sales.quotations.create") && (
            <Link
              href="/sales/quotations/new"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Quotation
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pipeline Value */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quotation Pipeline</span>
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {stats ? formatCurrency(stats.quotation_pipeline_value) : "₹0"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Across {stats ? stats.total_quotations : 0} institutional proposals
            </div>
          </div>
        </div>

        {/* Accepted Proposals */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accepted Deals</span>
            <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {stats ? formatCurrency(stats.accepted_quotation_value) : "₹0"}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              {stats ? stats.accepted_quotations : 0} proposals accepted by institutions
            </div>
          </div>
        </div>

        {/* Active Contracts */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Contracts</span>
            <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Briefcase className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {stats ? formatCurrency(stats.active_contract_value) : "₹0"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {stats ? stats.active_contracts : 0} signed & executed MSAs
            </div>
          </div>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Confirmed Orders</span>
            <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <CheckSquare className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {stats ? formatCurrency(stats.confirmed_order_value) : "₹0"}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
              {stats ? stats.confirmed_orders : 0} orders handed off to Deployment
            </div>
          </div>
        </div>
      </div>

      {/* Stage Breakdown & Quick Nav */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Draft Quotations</div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{stats?.draft_quotations || 0}</div>
          </div>
          <div className="text-xs font-medium text-slate-400 dark:text-slate-500">In Composer</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending Approval</div>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-0.5">{stats?.pending_approval_quotations || 0}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">Approved Proposals</div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">{stats?.approved_quotations || 0}</div>
          </div>
          <ShieldCheck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Accepted by Companies</div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-0.5">{stats?.accepted_quotations || 0}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Quotations */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Recent Institutional Quotations
            </h2>
            <Link href="/sales/quotations" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats && stats.recent_quotations && stats.recent_quotations.length > 0 ? (
              stats.recent_quotations.map((q) => (
                <div key={q.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex flex-col">
                    <Link href={`/sales/quotations/${q.id}`} className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                      {q.quotation_number}
                    </Link>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{q.college_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
                      {formatCurrency(q.total_amount)}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        q.status === "Approved"
                          ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                          : q.status === "Accepted"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          : q.status === "Pending Approval"
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No recent quotations created.</div>
            )}
          </div>
        </div>

        {/* Top Products in Demand */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Top Products in Demand
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats && stats.top_products && stats.top_products.length > 0 ? (
              stats.top_products.map((p, idx) => (
                <div key={p.code} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{p.name}</div>
                    <div className="text-2xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{p.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{p.quotation_count} quotes</div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400 font-mono">{formatCurrency(p.total_value)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No quotation item data yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
