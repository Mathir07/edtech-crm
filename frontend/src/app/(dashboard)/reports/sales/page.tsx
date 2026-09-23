"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Target,
  FileCheck2,
  DollarSign,
  Users,
  ShieldAlert,
  PieChart,
  UserCheck,
  CalendarCheck,
  Clock,
  AlertTriangle,
  Briefcase,
  Layers,
  ArrowRightLeft,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  SalesReportData,
  LeadsReportResponse,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";
import { formatCurrency } from "@/lib/utils";

export default function SalesReportPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "leads">("sales");
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [leadsData, setLeadsData] = useState<LeadsReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilterParams>({
    date_preset: "THIS_MONTH",
  });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  const fetchData = useCallback(async (activeFilters: ReportFilterParams, tab: "sales" | "leads") => {
    try {
      setLoading(true);
      setError(null);
      if (tab === "sales") {
        const res = await reportsApi.getSalesReport(activeFilters);
        setSalesData(res);
      } else {
        const res = await reportsApi.getLeadsReport(activeFilters);
        setLeadsData(res);
      }
    } catch (err: any) {
      setError(err.detail || err.message || `Failed to load ${tab} report.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters, activeTab);
  }, [fetchData, filters, activeTab]);

  const handleTabSwitch = (tab: "sales" | "leads") => {
    setActiveTab(tab);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Sales & Lead Generation Intelligence
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Founder MVP operational analytics for pipeline deal progression, lead conversion, rep productivity, and channel ROI.
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => handleTabSwitch("sales")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "sales"
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Sales & Deals</span>
          </button>
          <button
            onClick={() => handleTabSwitch("leads")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "leads"
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Lead Operational Report</span>
          </button>
        </div>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType={activeTab === "sales" ? "SALES" : "LEADS"}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          fetchData(newFilters, activeTab);
        }}
        onRefresh={() => fetchData(filters, activeTab)}
        isLoading={loading}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        currentFilters={filters}
      />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Loading {activeTab === "sales" ? "sales & deal" : "lead operational"} report...
          </p>
        </div>
      )}

      {/* SALES & DEALS TAB */}
      {!loading && activeTab === "sales" && salesData && (
        <div className="space-y-6">
          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Open Pipeline Value
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatCurrency(salesData.crm_summary?.pipeline_value || 0)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                <span>{salesData.crm_summary?.open_opportunities || 0} open deals</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Weighted: {formatCurrency(salesData.crm_summary?.weighted_pipeline_value || 0)}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Won Revenue & Closed Deals
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatCurrency(salesData.crm_summary?.won_revenue || 0)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {salesData.crm_summary?.won_opportunities || 0} won deals • Win rate: {salesData.crm_summary?.opportunity_win_rate || 0}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Average Deal Size
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {formatCurrency(salesData.crm_summary?.average_deal_value || 0)}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {salesData.crm_summary?.lost_opportunities || 0} lost deals recorded
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Lead-to-Deal Conversion
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                {salesData.crm_summary?.lead_conversion_rate || 0}%
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {salesData.crm_summary?.total_opportunities || 0} opps from {salesData.crm_summary?.total_leads || 0} leads
              </div>
            </div>
          </div>

          {/* Quotations & Sales Orders Highlights */}
          {salesData.sales_summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quotations Formulated</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {salesData.sales_summary.quotations_count}
                </div>
                <div className="text-2xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                  Value: {formatCurrency(salesData.sales_summary.quotations_value)}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sales Orders Confirmed</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {salesData.sales_summary.sales_orders_count}
                </div>
                <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  Value: {formatCurrency(salesData.sales_summary.sales_orders_value)}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">In Negotiations & Proposals</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {formatCurrency(salesData.sales_summary.negotiation_value)}
                </div>
                <div className="text-2xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                  Pending Proposals: {formatCurrency(salesData.sales_summary.pending_proposals_value)}
                </div>
              </div>
            </div>
          )}

          {/* Deals by Pipeline & Stages */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pipeline Stage Distribution</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Active deal volume, pipeline value, probability, and weighted forecast across all 4 pipelines.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {salesData.pipeline_stages?.length || 0} stages tracked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Stage Name</th>
                    <th className="py-3 px-4 text-right">Deals Count</th>
                    <th className="py-3 px-4 text-right">Stage Value</th>
                    <th className="py-3 px-4 text-right">Probability</th>
                    <th className="py-3 px-4 text-right">Expected (Weighted)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!salesData.pipeline_stages || salesData.pipeline_stages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No active pipeline stages found.
                      </td>
                    </tr>
                  ) : (
                    salesData.pipeline_stages.map((st) => (
                      <tr key={st.stage_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span>{st.stage_name}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                          {st.opportunity_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(st.stage_value)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {st.probability}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-indigo-700 dark:text-indigo-400">
                          {formatCurrency(st.weighted_value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Representatives Productivity */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Sales Representatives Productivity</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Quota progression, opportunities handled, quotation turnaround, and revenue closed by owner.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {salesData.sales_owners?.length || 0} active reps
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Sales Representative</th>
                    <th className="py-3 px-4 text-right">Assigned Leads</th>
                    <th className="py-3 px-4 text-right">Opps Handled</th>
                    <th className="py-3 px-4 text-right">Pipeline Value</th>
                    <th className="py-3 px-4 text-right">Deals Won</th>
                    <th className="py-3 px-4 text-right">Won Revenue</th>
                    <th className="py-3 px-4 text-right">Quotes</th>
                    <th className="py-3 px-4 text-right">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!salesData.sales_owners || salesData.sales_owners.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No rep activity logged for the selected period.
                      </td>
                    </tr>
                  ) : (
                    salesData.sales_owners.map((so) => (
                      <tr key={so.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {so.user_name}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                          {so.leads_assigned}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                          {so.opportunities_count}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-medium">
                          {formatCurrency(so.opportunities_value)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {so.won_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(so.won_value)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 font-mono">
                          {so.quotations_count}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 font-mono">
                          {so.sales_orders_count}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-right text-3xs text-slate-400 font-mono">
            Generated: {salesData.generated_at}
          </div>
        </div>
      )}

      {/* LEAD OPERATIONAL REPORT TAB */}
      {!loading && activeTab === "leads" && leadsData && (
        <div className="space-y-6">
          {/* Key Lead KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Leads
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {leadsData.total_leads}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {leadsData.new_leads} new / uncontacted
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Qualified & Converted
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {leadsData.converted_leads}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {leadsData.qualified_leads} qualified in qualification
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Lost / Unqualified
              </div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">
                {leadsData.lost_unqualified_leads}
              </div>
              <div className="text-2xs text-rose-500 dark:text-rose-400 mt-1">
                Unviable or disqualified leads
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Operational Follow-Ups
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {leadsData.follow_ups_due_today} Due Today
              </div>
              <div className="text-2xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
                {leadsData.overdue_follow_ups} overdue follow-ups
              </div>
            </div>
          </div>

          {/* Leads by Actual Business Segment */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Leads by Business Segment</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Volume breakdown across actual stored business segments (EdTech, IT Services, Talent).
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {leadsData.leads_by_segment.length} segments tracked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Business Segment</th>
                    <th className="py-3 px-4 text-right">Total Leads</th>
                    <th className="py-3 px-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leadsData.leads_by_segment.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">
                        No leads recorded for selected filters.
                      </td>
                    </tr>
                  ) : (
                    leadsData.leads_by_segment.map((seg) => {
                      const share =
                        leadsData.total_leads > 0
                           ? ((seg.count / leadsData.total_leads) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr key={seg.segment} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                              {seg.segment}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {seg.count}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {share}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lead Source Acquisition Performance */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lead Source Channel ROI</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Performance breakdown by acquisition source: volume, conversions, and closed revenue.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {leadsData.leads_by_source.length} sources tracked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Lead Source</th>
                    <th className="py-3 px-4 text-right">Leads Ingested</th>
                    <th className="py-3 px-4 text-right">Qualified</th>
                    <th className="py-3 px-4 text-right">Converted</th>
                    <th className="py-3 px-4 text-right">Conv. Rate</th>
                    <th className="py-3 px-4 text-right">Opp Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leadsData.leads_by_source.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No lead sources registered.
                      </td>
                    </tr>
                  ) : (
                    leadsData.leads_by_source.map((ls) => (
                      <tr key={ls.source_name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {ls.source_name}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                          {ls.lead_count}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                          {ls.qualified_count}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {ls.converted_count}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                            {ls.conversion_rate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(ls.total_opportunity_value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leads by Owner Allocation */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Leads by Owner Assignment</h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Operational allocation and individual conversion throughput per rep.
                </p>
              </div>
              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                {leadsData.leads_by_owner.length} owners active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Owner Name</th>
                    <th className="py-3 px-4 text-right">Assigned Leads</th>
                    <th className="py-3 px-4 text-right">Converted</th>
                    <th className="py-3 px-4 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leadsData.leads_by_owner.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                        No assigned leads found.
                      </td>
                    </tr>
                  ) : (
                    leadsData.leads_by_owner.map((bo, idx) => {
                      const rate =
                        bo.total > 0 ? ((bo.converted / bo.total) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={bo.owner_id || `unassigned-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {bo.owner_name}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {bo.total}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {bo.converted}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-right text-3xs text-slate-400 font-mono">
            Generated: {leadsData.generated_at}
          </div>
        </div>
      )}

      <SaveReportModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        reportType={activeTab === "sales" ? "SALES" : "LEADS"}
        currentFilters={filters}
      />
    </div>
  );
}

