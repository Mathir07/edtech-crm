"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Calendar,
  Building2,
  Users,
  Target,
  TrendingUp,
  Phone,
  Mail,
  Video,
  MessageSquare,
  FileText,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface Activity {
  id: string;
  type: string;
  subject: string;
  description?: string;
  due_at?: string;
  completed_at?: string;
  is_completed: boolean;
  assigned_to_name?: string;
  created_by_name?: string;
  related_entity_type: string;
  related_entity_id: string;
  related_entity_name?: string;
  created_at: string;
}

interface LookupOption {
  id: string;
  label: string;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const { hasPermission } = useAuth();
  const toast = useToast();

  // Modals & form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entityType, setEntityType] = useState<"lead" | "contact" | "company" | "opportunity">("lead");
  const [entityOptions, setEntityOptions] = useState<LookupOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const [form, setForm] = useState({
    type: "Follow-up",
    subject: "",
    description: "",
    due_at: "",
    related_entity_type: "lead",
    related_entity_id: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (scope !== "all") params.append("scope", scope);
      if (typeFilter) params.append("type", typeFilter);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const actData = await api.get<Activity[]>(`/activities${qs}`);
      setActivities(actData || []);
    } catch (err) {
      console.error("Failed to load activities", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [scope, typeFilter]);

  // Load lookup options when modal opens or entityType changes
  useEffect(() => {
    if (!isModalOpen) return;
    async function loadEntityOptions() {
      try {
        setLoadingLookups(true);
        let options: LookupOption[] = [];
        if (entityType === "lead") {
          const res = await api.get<any[]>("/leads");
          options = (res || []).map((l) => ({ id: l.id, label: `${l.title} (${l.business_segment || "Lead"})` }));
        } else if (entityType === "contact") {
          const res = await api.get<any[]>("/contacts");
          options = (res || []).map((c) => ({ id: c.id, label: `${c.name} ${c.company_name ? `• ${c.company_name}` : ""}` }));
        } else if (entityType === "company") {
          const res = await api.get<any[]>("/companies");
          options = (res || []).map((col) => ({ id: col.id, label: col.organization_name }));
        } else if (entityType === "opportunity") {
          const res = await api.get<any[]>("/opportunities");
          options = (res || []).map((o) => ({ id: o.id, label: `${o.title} (${o.pipeline_name || "Deal"})` }));
        }
        setEntityOptions(options);
        if (options.length > 0) {
          setForm((prev) => ({
            ...prev,
            related_entity_type: entityType,
            related_entity_id: options[0].id,
          }));
        }
      } catch (err) {
        console.error("Failed to load entity options", err);
      } finally {
        setLoadingLookups(false);
      }
    }
    loadEntityOptions();
  }, [isModalOpen, entityType]);

  const handleComplete = async (id: string) => {
    try {
      await api.patch(`/activities/${id}/complete`);
      toast.success("Activity marked complete.");
      loadData();
    } catch (err: any) {
      toast.error(err.detail || "Failed to mark complete.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.related_entity_id) {
      toast.error("Subject and Target Entity are required.");
      return;
    }
    try {
      await api.post("/activities", {
        ...form,
        related_entity_type: entityType,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : new Date().toISOString(),
      });
      toast.success("Activity logged successfully.");
      setIsModalOpen(false);
      setForm({
        type: "Follow-up",
        subject: "",
        description: "",
        due_at: "",
        related_entity_type: "lead",
        related_entity_id: "",
      });
      loadData();
    } catch (err: any) {
      toast.error(err.detail || "Failed to log activity.");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Call":
        return <Phone className="w-4 h-4 text-blue-600" />;
      case "Email":
        return <Mail className="w-4 h-4 text-purple-600" />;
      case "Meeting":
      case "Demo":
        return <Video className="w-4 h-4 text-emerald-600" />;
      case "WhatsApp":
        return <MessageSquare className="w-4 h-4 text-teal-600" />;
      default:
        return <CalendarCheck2 className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getEntityLink = (act: Activity) => {
    const t = act.related_entity_type?.toLowerCase();
    if (t === "lead") return `/leads/${act.related_entity_id}`;
    if (t === "contact") return `/contacts/${act.related_entity_id}`;
    if (t === "company" || t === "organization") return `/companies/${act.related_entity_id}`;
    if (t === "opportunity" || t === "deal") return `/opportunities/${act.related_entity_id}`;
    return "#";
  };

  const getEntityIcon = (type: string) => {
    const t = type?.toLowerCase();
    if (t === "lead") return <Target className="w-3 h-3 text-cyan-600 mr-1" />;
    if (t === "contact") return <Users className="w-3 h-3 text-blue-600 mr-1" />;
    if (t === "opportunity" || t === "deal") return <TrendingUp className="w-3 h-3 text-amber-600 mr-1" />;
    return <Building2 className="w-3 h-3 text-indigo-600 mr-1" />;
  };

  const filteredActivities = activities.filter((act) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      act.subject.toLowerCase().includes(s) ||
      (act.description && act.description.toLowerCase().includes(s)) ||
      (act.related_entity_name && act.related_entity_name.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Activities & Follow-ups</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {filteredActivities.length} Logged
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unified outreach history, client communications, and scheduled follow-ups across all accounts, contacts, and leads.
          </p>
        </div>
        {hasPermission("crm.companies.edit") && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Log Activity / Follow-up
          </button>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex space-x-1.5 overflow-x-auto text-xs font-semibold scrollbar-thin pb-1 lg:pb-0">
            {[
              { id: "all", label: "All Activities" },
              { id: "today", label: "Due Today" },
              { id: "overdue", label: "Overdue" },
              { id: "upcoming", label: "Upcoming" },
              { id: "completed", label: "Completed" },
              { id: "mine", label: "Assigned to Me" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScope(tab.id)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  scope === tab.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search activities or account..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-1.5 text-xs shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">All Types</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Call">Call</option>
                <option value="Email">Email</option>
                <option value="Meeting">Meeting</option>
                <option value="Demo">Demo</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Feedback */}
        {(search || typeFilter || scope !== "all") && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase">Active:</span>
              {scope !== "all" && (
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-2xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Scope: {scope}
                </span>
              )}
              {typeFilter && (
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  Type: {typeFilter}
                </span>
              )}
              {search && (
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-2xs font-semibold text-slate-700 dark:text-slate-300">
                  &quot;{search}&quot;
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">
                {filteredActivities.length} {filteredActivities.length === 1 ? "result" : "results"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("");
                  setScope("all");
                }}
                className="text-2xs font-bold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 hover:underline"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading activities...</div>
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          title="No activities found"
          description="Schedule follow-up calls or log client interaction history across your pipeline."
          actionLabel="Log Activity"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shrink-0">
                  {getTypeIcon(act.type)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{act.subject}</span>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {act.type}
                    </span>

                    {/* Related Entity Badge */}
                    <Link
                      href={getEntityLink(act)}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
                    >
                      {getEntityIcon(act.related_entity_type)}
                      <span className="capitalize font-semibold mr-1">{act.related_entity_type}:</span>
                      <span className="truncate max-w-[160px]">{act.related_entity_name || act.related_entity_id.slice(0, 8)}</span>
                    </Link>
                  </div>

                  {act.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{act.description}</p>
                  )}

                  <div className="flex items-center space-x-4 mt-2 text-2xs text-slate-400 dark:text-slate-500 font-medium">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {act.due_at ? `Scheduled: ${formatDateTime(act.due_at)}` : `Logged: ${formatDate(act.created_at)}`}
                    </span>
                    <span>•</span>
                    <span>Assigned: {act.assigned_to_name || "Team"}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                {act.is_completed ? (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-xl flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completed
                  </span>
                ) : (
                  <button
                    onClick={() => handleComplete(act.id)}
                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Mark Done
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Activity Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Activity / Schedule Follow-up">
        <form onSubmit={handleCreate} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Target Entity Type *
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:border-indigo-500 focus:outline-none"
              >
                <option value="lead">Sales Lead</option>
                <option value="contact">Contact Person</option>
                <option value="company">Company / Account</option>
                <option value="opportunity">Deal / Opportunity</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Select Target Record *
              </label>
              <select
                required
                value={form.related_entity_id}
                onChange={(e) => setForm({ ...form, related_entity_id: e.target.value })}
                disabled={loadingLookups}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:border-indigo-500 focus:outline-none"
              >
                {loadingLookups ? (
                  <option>Loading records...</option>
                ) : entityOptions.length === 0 ? (
                  <option value="">No records found</option>
                ) : (
                  entityOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Activity Type *
              </label>
              <select
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:border-indigo-500 focus:outline-none"
              >
                <option value="Follow-up">Follow-up</option>
                <option value="Call">Phone Call</option>
                <option value="Email">Email Outreach</option>
                <option value="Meeting">Meeting</option>
                <option value="Demo">Demonstration</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Note">Internal Note</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Subject / Next Action *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Call Rahul to review IT services agreement"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:border-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Details & Discussion Notes
            </label>
            <textarea
              rows={3}
              placeholder="Discussion notes, key requirements, follow-up commitments..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:border-indigo-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-xs transition-colors"
            >
              Log Activity
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
