"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  PhoneCall,
  Radio,
  FileCode,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Send,
  Building2,
  User,
  Inbox,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

interface DashboardData {
  total_emails: number;
  unread_emails: number;
  draft_emails: number;
  total_whatsapp: number;
  total_calls: number;
  integrations: {
    hostinger: string;
    whatsapp: string;
    phone: string;
  };
}

interface TimelineItem {
  id: string;
  channel: string;
  direction: string;
  status: string;
  timestamp: string;
  sender: string;
  recipient: string;
  subject?: string;
  preview: string;
  company_id?: string;
  company_name?: string;
  contact_id?: string;
  contact_name?: string;
}

export default function CommunicationsDashboardPage() {
  const [overview, setOverview] = useState<DashboardData | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [ovData, tlData] = await Promise.all([
        api.get<DashboardData>("/communications/overview"),
        api.get<TimelineItem[]>(`/communications/timeline?limit=15${channelFilter !== "ALL" ? `&channel=${channelFilter}` : ""}`),
      ]);
      setOverview(ovData);
      setTimeline(tlData);
    } catch (err) {
      console.error("Failed to load communications dashboard", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [channelFilter]);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "CONNECTED" || s === "SENT" || s === "DELIVERED" || s === "COMPLETED") {
      return <Badge variant="success">{s}</Badge>;
    }
    if (s === "NOT_CONFIGURED" || s === "DISCONNECTED") {
      return <Badge variant="neutral">NOT CONFIGURED</Badge>;
    }
    if (s === "DRAFT") {
      return <Badge variant="warning">DRAFT</Badge>;
    }
    return <Badge variant="danger">{s}</Badge>;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toUpperCase()) {
      case "EMAIL":
        return <Mail className="w-4 h-4 text-sky-500" />;
      case "WHATSAPP":
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case "PHONE":
        return <PhoneCall className="w-4 h-4 text-purple-500" />;
      default:
        return <Radio className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            Communications & External Integrations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unified multi-channel outreach hub: Hostinger Webmail (SMTP/IMAP), WhatsApp Business Platform & Telephony
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/communications/email/compose"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
            Compose Email
          </Link>
          <Link
            href="/communications/calls"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <PhoneCall className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Log Call
          </Link>
        </div>
      </div>

      {/* Integration Providers Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hostinger Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hostinger Mail</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">kiwicloudtech.co.in (SMTP/IMAP)</div>
            </div>
          </div>
          <div>{getStatusBadge(overview?.integrations.hostinger || "NOT_CONFIGURED")}</div>
        </div>

        {/* WhatsApp Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">WhatsApp Business API</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Official Cloud Platform</div>
            </div>
          </div>
          <div>{getStatusBadge(overview?.integrations.whatsapp || "NOT_CONFIGURED")}</div>
        </div>

        {/* Phone Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Telephony Gateway</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Call Logging & SIP</div>
            </div>
          </div>
          <div>{getStatusBadge(overview?.integrations.phone || "NOT_CONFIGURED")}</div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Outgoing/Incoming</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{overview?.total_emails || 0}</div>
          <div className="text-2xs text-sky-600 dark:text-sky-400 mt-0.5">Hostinger Email</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Unread Mailbox Threads</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{overview?.unread_emails || 0}</div>
          <div className="text-2xs text-amber-600 dark:text-amber-400 mt-0.5">Awaiting attention</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Email Drafts</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{overview?.draft_emails || 0}</div>
          <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">Ready to review/send</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">WhatsApp Messages</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{overview?.total_whatsapp || 0}</div>
          <div className="text-2xs text-emerald-600 dark:text-emerald-400 mt-0.5">Conversations</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Logged Phone Calls</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{overview?.total_calls || 0}</div>
          <div className="text-2xs text-purple-600 dark:text-purple-400 mt-0.5">Inbound & Outbound</div>
        </div>
      </div>

      {/* Main Grid: Channels Quick Navigation & Unified Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Cards */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Channel Modules
          </h2>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
            <Link
              href="/communications/email"
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    Hostinger Mailbox
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Inbox, Sent, Drafts, Thread viewer</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
            </Link>

            <Link
              href="/communications/whatsapp"
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    WhatsApp Messenger
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Live conversations & templates</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
            </Link>

            <Link
              href="/communications/calls"
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Phone & Call Logging
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Duration, dispositions, outcomes</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
            </Link>

            <Link
              href="/communications/templates"
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Message Templates
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Variable tags for Email & WhatsApp</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
            </Link>

            <Link
              href="/communications/integrations"
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                    Integrations Setup
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">SMTP, IMAP, WhatsApp Webhook, SIP</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300" />
            </Link>
          </div>
        </div>

        {/* Unified Timeline Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Unified Communication Timeline
            </h2>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              {["ALL", "EMAIL", "WHATSAPP", "PHONE"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    channelFilter === ch ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading communication timeline...</div>
            ) : timeline.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No recent communication events found in this channel filter.
              </div>
            ) : (
              timeline.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                        {getChannelIcon(item.channel)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">{item.channel}</span>
                          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {item.direction}
                          </span>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {item.direction === "OUTBOUND" ? `To: ${item.recipient}` : `From: ${item.sender}`}
                          </span>
                        </div>
                        {item.subject && (
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">{item.subject}</div>
                        )}
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{item.preview}</div>

                        {/* CRM Association badges */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {item.company_name && (
                            <span className="inline-flex items-center gap-1 text-2xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {item.company_name}
                            </span>
                          )}
                          {item.contact_name && (
                            <span className="inline-flex items-center gap-1 text-2xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              <User className="w-3 h-3 text-slate-400" />
                              {item.contact_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xs text-slate-400">{formatDateTime(item.timestamp)}</div>
                      <div className="mt-1">{getStatusBadge(item.status)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
