"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Send,
  FileEdit,
  RefreshCw,
  Search,
  Building2,
  User,
  Clock,
  Inbox,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface EmailThread {
  id: string;
  provider_thread_id: string;
  subject: string;
  snippet: string;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  company_id?: string;
  company_name?: string;
  contact_id?: string;
  contact_name?: string;
}

interface EmailDraft {
  id: string;
  subject: string;
  body_text: string;
  recipient: string;
  created_at: string;
  company_name?: string;
  contact_name?: string;
}

export default function EmailMailboxPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"ALL" | "UNREAD" | "DRAFTS">("ALL");
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      if (activeTab === "DRAFTS") {
        const data = await api.get<EmailDraft[]>("/communications/email/drafts");
        setDrafts(data || []);
      } else {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (activeTab === "UNREAD") params.append("is_read", "false");
        const data = await api.get<EmailThread[]>(`/communications/email/threads?${params.toString()}`);
        setThreads(data || []);
      }
    } catch (err) {
      console.error("Failed to load threads", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [activeTab]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await api.post<{ synced_count: number }>("/communications/email/sync");
      toast.success(`Mailbox synchronized: ${res.synced_count} emails checked`);
      fetchThreads();
    } catch (err: any) {
      toast.error(err.detail || "IMAP sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchThreads();
  };

  const discardDraft = async (draftId: string) => {
    if (!confirm("Are you sure you want to discard this draft?")) return;
    try {
      await api.delete(`/communications/email/drafts/${draftId}`);
      toast.success("Draft discarded");
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (err: any) {
      toast.error(err.detail || "Failed to discard draft");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            Hostinger Email Mailbox
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise mail integration: kiwicloudtech.co.in via SMTP & IMAP
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 dark:text-slate-400 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing IMAP..." : "Sync Mailbox"}
          </button>
          <Link
            href="/communications/email/compose"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-lg transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
            Compose
          </Link>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-lg border border-transparent dark:border-slate-800">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "ALL"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            All Threads
          </button>
          <button
            onClick={() => setActiveTab("UNREAD")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "UNREAD"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setActiveTab("DRAFTS")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "DRAFTS"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Drafts
          </button>
        </div>

        {activeTab !== "DRAFTS" && (
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email subjects & content..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </form>
        )}
      </div>

      {/* Mailbox List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading messages...</div>
        ) : activeTab === "DRAFTS" ? (
          drafts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No email drafts found.</div>
          ) : (
            drafts.map((d) => (
              <div key={d.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mt-0.5">
                    <FileEdit className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Draft</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{d.subject || "(No Subject)"}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{d.body_text || "Empty draft body"}</div>
                    <div className="text-2xs text-slate-400 dark:text-slate-500 mt-1">To: {d.recipient}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => discardDraft(d.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    title="Discard draft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    href={`/communications/email/compose?draft_id=${d.id}`}
                    className="px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-md transition-colors"
                  >
                    Edit & Send
                  </Link>
                </div>
              </div>
            ))
          )
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No email conversations found.</div>
        ) : (
          threads.map((t) => (
            <Link
              key={t.id}
              href={`/communications/email/${t.id}`}
              className={`p-4 flex items-start justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors block ${
                !t.is_read ? "bg-sky-50/30 dark:bg-sky-950/20" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {!t.is_read ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 dark:bg-sky-400 block" title="Unread message" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 block" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${!t.is_read ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-800 dark:text-slate-200"}`}>
                      {t.subject || "(No Subject)"}
                    </span>
                    {t.message_count > 1 && (
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        {t.message_count}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{t.snippet}</div>

                  {/* CRM Association badges */}
                  <div className="flex items-center gap-2 mt-2">
                    {t.company_name && (
                      <span className="inline-flex items-center gap-1 text-2xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <Building2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {t.company_name}
                      </span>
                    )}
                    {t.contact_name && (
                      <span className="inline-flex items-center gap-1 text-2xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {t.contact_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xs text-slate-400 dark:text-slate-500">{formatDateTime(t.last_message_at)}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
