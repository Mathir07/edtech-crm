"use client";

import React, { useEffect, useState } from "react";
import {
  FileCode,
  Plus,
  Mail,
  MessageSquare,
  Trash2,
  Edit2,
  CheckCircle2,
  RefreshCw,
  Copy,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body_text: string;
  variables?: string[];
  is_active: boolean;
  created_at: string;
}

const COMMON_VARIABLES = [
  "{{contact_name}}",
  "{{college_name}}",
  "{{company_name}}",
  "{{project_name}}",
  "{{ticket_number}}",
  "{{invoice_number}}",
];

export default function CommunicationTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New template form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const url = channelFilter !== "ALL" ? `/communications/templates?channel=${channelFilter}` : "/communications/templates";
      const data = await api.get<Template[]>(url);
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load templates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [channelFilter]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    try {
      setSaving(true);
      await api.post("/communications/templates", {
        name: name.trim(),
        channel: channel,
        subject: channel === "EMAIL" ? subject : undefined,
        body_text: bodyText,
        is_active: true,
      });
      toast.success("Template created successfully");
      setShowModal(false);
      setName("");
      setSubject("");
      setBodyText("");
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.detail || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.delete(`/communications/templates/${id}`);
      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      toast.error(err.detail || "Failed to delete template");
    }
  };

  const insertVariable = (variableStr: string) => {
    setBodyText((prev) => prev + " " + variableStr);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <FileCode className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            Communication Templates
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pre-approved message templates for Hostinger Email outreach and WhatsApp Business API
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTemplates}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-lg border border-transparent dark:border-slate-800 w-fit">
        {["ALL", "EMAIL", "WHATSAPP"].map((ch) => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              channelFilter === ch
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {ch === "ALL" ? "All Channels" : ch}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full p-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            No templates configured for this channel. Click "+ New Template" to create one.
          </div>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-md ${
                        t.channel === "EMAIL"
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400"
                          : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {t.channel === "EMAIL" ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.channel}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2.5">{t.name}</div>
                {t.subject && (
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1">
                    <span className="text-slate-400 dark:text-slate-500">Subject:</span> {t.subject}
                  </div>
                )}
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap font-sans line-clamp-4">
                  {t.body_text}
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-2xs text-slate-400 dark:text-slate-500">
                <span>Created {formatDateTime(t.created_at).split(" ")[0]}</span>
                <Badge variant={t.is_active ? "success" : "neutral"}>{t.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Template Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-600 dark:text-amber-500" /> Create Communication Template
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Template Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Higher-Ed Proposal Intro"
                  required
                  className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="EMAIL">Email Template</option>
                  <option value="WHATSAPP">WhatsApp Template</option>
                </select>
              </div>

              {channel === "EMAIL" && (
                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line with {{variables}}..."
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Insert Common Variable Chips:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 text-2xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Type template message content with {{variables}}..."
                  required
                  className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim() || !bodyText.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
