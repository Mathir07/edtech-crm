"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Headphones,
  Mail,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { ReportNavTabs } from "@/components/reports/ReportNavTabs";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { SaveReportModal } from "@/components/reports/SaveReportModal";
import {
  CommunicationsReportData,
  ReportFilterParams,
  reportsApi,
} from "@/lib/reportsApi";

export default function CommunicationsReportPage() {
  const [data, setData] = useState<CommunicationsReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilterParams>({
    date_preset: "THIS_MONTH",
  });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  const fetchData = useCallback(async (activeFilters: ReportFilterParams) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getCommunicationsReport(activeFilters);
      setData(res);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load communications report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Omnichannel Communications & Engagement Volume
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hostinger SMTP/IMAP email threads, WhatsApp conversational touchpoints, and telephony call logs.
        </p>
      </div>

      <ReportNavTabs />

      <ReportFilterBar
        reportType="COMMUNICATIONS"
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          fetchData(newFilters);
        }}
        onRefresh={() => fetchData(filters)}
        isLoading={loading}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
        currentFilters={filters}
      />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aggregating communication touchpoints...</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Total Touchpoints
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                {data.kpis.total_touchpoints}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Across email, WhatsApp, calls, & meetings
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Hostinger Email Messages
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {data.kpis.total_emails_sent + data.kpis.total_emails_received}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                {data.kpis.total_emails_sent} sent / {data.kpis.total_emails_received} received
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                WhatsApp Messages
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                {data.kpis.total_whatsapp_messages}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Direct conversational engagements
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Telephony Call Logs
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {data.kpis.total_calls_logged}
              </div>
              <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                Manual & automated call records
              </div>
            </div>
          </div>

          {/* Channel Metrics & Call Dispositions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Channel Metrics Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Communication Volume by Channel</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4 text-right">Inbound</th>
                      <th className="py-3 px-4 text-right">Outbound</th>
                      <th className="py-3 px-4 text-right">Total Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.channel_metrics.map((cm) => (
                      <tr key={cm.channel} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{cm.channel}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{cm.inbound_count}</td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{cm.outbound_count}</td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{cm.total_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Call Dispositions Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Telephony Call Dispositions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Disposition Status</th>
                      <th className="py-3 px-4 text-right">Logged Calls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.call_dispositions.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                          No calls logged for this period.
                        </td>
                      </tr>
                    ) : (
                      data.call_dispositions.map((cd) => (
                        <tr key={cd.disposition} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{cd.disposition}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{cd.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="text-right text-3xs text-slate-400 dark:text-slate-500 font-mono">
            Generated: {data.generated_at}
          </div>
        </div>
      )}

      <SaveReportModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        reportType="COMMUNICATIONS"
        currentFilters={filters}
      />
    </div>
  );
}
