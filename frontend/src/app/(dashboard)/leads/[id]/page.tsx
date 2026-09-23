"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Target,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CheckCircle,
  Sparkles,
  Edit3,
  Plus,
  MessageSquare,
  PhoneCall,
  Video,
  FileText,
  HelpCircle,
  Briefcase,
  Layers,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Lead, getFollowUpStatus } from "../page";

interface ActivityItem {
  id: string;
  type: string;
  subject: string;
  description?: string;
  due_at?: string;
  is_completed: boolean;
  completed_at?: string;
  assigned_to_name?: string;
  created_by_name?: string;
  created_at: string;
}

interface NoteItem {
  id: string;
  content: string;
  author_name?: string;
  created_at: string;
}

interface PipelineOption {
  id: string;
  name: string;
  is_default: boolean;
  stages?: { id: string; name: string; order: number }[];
}

interface UserOption {
  id: string;
  full_name?: string;
  email: string;
}

interface LeadSource {
  id: string;
  name: string;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const { hasPermission, user: currentUser } = useAuth();
  const toast = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    next_action: "",
    next_follow_up_date: "",
  });

  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    type: "Call",
    subject: "",
    description: "",
    due_at: "",
  });

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({
    opportunity_title: "",
    value: 0,
    pipeline_id: "",
    expected_close_date: "",
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const [noteContent, setNoteContent] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Load Lead & related data
  const loadLeadData = useCallback(async () => {
    try {
      setLoading(true);
      const [leadData, actsData, notesData, pipesData, usrsData, srcsData] = await Promise.all([
        api.get<Lead>(`/leads/${leadId}`),
        api.get<ActivityItem[]>(`/activities?related_entity_type=lead&related_entity_id=${leadId}`).catch(() => []),
        api.get<NoteItem[]>(`/notes?related_entity_type=lead&related_entity_id=${leadId}`).catch(() => []),
        api.get<PipelineOption[]>("/pipelines").catch(() => []),
        api.get<UserOption[]>("/users").catch(() => []),
        api.get<LeadSource[]>("/lead-sources").catch(() => []),
      ]);

      setLead(leadData);
      setActivities(actsData || []);
      setNotes(notesData || []);
      setPipelines(pipesData || []);
      setUsers(usrsData || []);
      setSources(srcsData || []);
    } catch (err) {
      console.error("Failed to load lead details", err);
      toast.error("Failed to load lead details");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) loadLeadData();
  }, [leadId, loadLeadData]);

  // Quick Follow-Up Update
  const handleOpenFollowUp = () => {
    if (!lead) return;
    setFollowUpForm({
      next_action: lead.next_action || "",
      next_follow_up_date: lead.next_follow_up_date
        ? new Date(lead.next_follow_up_date).toISOString().slice(0, 16)
        : "",
    });
    setIsFollowUpOpen(true);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    try {
      await api.put(`/leads/${lead.id}`, {
        next_action: followUpForm.next_action.trim() || null,
        next_follow_up_date: followUpForm.next_follow_up_date
          ? new Date(followUpForm.next_follow_up_date).toISOString()
          : null,
      });
      toast.success("Follow-up action updated");
      setIsFollowUpOpen(false);
      loadLeadData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to update follow-up");
    }
  };

  // Log Activity
  const handleOpenActivity = () => {
    setActivityForm({
      type: "Call",
      subject: "",
      description: "",
      due_at: new Date().toISOString().slice(0, 16),
    });
    setIsActivityOpen(true);
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !activityForm.subject.trim()) {
      toast.error("Activity subject is required");
      return;
    }

    try {
      await api.post("/activities", {
        type: activityForm.type,
        subject: activityForm.subject.trim(),
        description: activityForm.description.trim() || undefined,
        due_at: activityForm.due_at ? new Date(activityForm.due_at).toISOString() : new Date().toISOString(),
        related_entity_type: "lead",
        related_entity_id: lead.id,
      });
      toast.success("Activity logged successfully");
      setIsActivityOpen(false);
      loadLeadData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to log activity");
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      await api.patch(`/activities/${activityId}/complete`);
      toast.success("Activity marked complete");
      loadLeadData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to complete activity");
    }
  };

  const handleInitiateCall = async () => {
    if (!lead?.contact_phone) {
      toast.error("Lead does not have a contact phone number.");
      return;
    }
    try {
      await api.post("/telephony/initiate", {
        to_phone: lead.contact_phone,
        lead_id: lead.id,
      });
      toast.success(`Calling ${lead.contact_phone}...`);
    } catch (err: any) {
      toast.error(
        err?.detail || "Telephony is not configured. Log the call manually via 'Log Activity'."
      );
    }
  };

  // Add Internal Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !lead) return;

    try {
      setSubmittingNote(true);
      await api.post("/notes", {
        content: noteContent.trim(),
        related_entity_type: "lead",
        related_entity_id: lead.id,
      });
      toast.success("Note saved");
      setNoteContent("");
      loadLeadData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save note");
    } finally {
      setSubmittingNote(false);
    }
  };

  // Convert to Deal
  const handleOpenConvert = () => {
    if (!lead) return;
    setConvertForm({
      opportunity_title: `${lead.title} - Deal`,
      value: lead.expected_value || 0,
      pipeline_id: "",
      expected_close_date: lead.expected_close_date || "",
    });
    setIsConvertOpen(true);
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    try {
      const payload: Record<string, any> = {
        opportunity_title: convertForm.opportunity_title.trim(),
        value: Number(convertForm.value) || 0,
      };
      if (convertForm.pipeline_id) {
        payload.pipeline_id = convertForm.pipeline_id;
      }
      if (convertForm.expected_close_date) {
        payload.expected_close_date = convertForm.expected_close_date;
      }

      const res = await api.post<any>(`/leads/${lead.id}/convert`, payload);
      toast.success("Lead converted to Opportunity deal!");
      setIsConvertOpen(false);
      loadLeadData();
    } catch (err: any) {
      toast.error(err?.detail || "Lead conversion failed");
    }
  };

  // Edit Lead Modal
  const handleOpenEdit = () => {
    if (!lead) return;
    setEditForm({
      title: lead.title || "",
      contact_name: lead.contact_name || "",
      contact_email: lead.contact_email || "",
      contact_phone: lead.contact_phone || "",
      company_name: lead.company_name || "",
      business_segment: lead.business_segment || "",
      source_id: lead.source_id || "",
      owner_id: lead.owner_id || "",
      status: lead.status || "New",
      priority: lead.priority || "Medium",
      expected_value: lead.expected_value || 0,
      expected_close_date: lead.expected_close_date || "",
      description: lead.description || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    try {
      await api.put(`/leads/${lead.id}`, {
        title: editForm.title.trim(),
        contact_name: editForm.contact_name?.trim() || null,
        contact_email: editForm.contact_email?.trim() || null,
        contact_phone: editForm.contact_phone?.trim() || null,
        company_name: editForm.company_name?.trim() || null,
        business_segment: editForm.business_segment || null,
        source_id: editForm.source_id || null,
        owner_id: editForm.owner_id || null,
        status: editForm.status,
        priority: editForm.priority,
        expected_value: Number(editForm.expected_value) || 0,
        expected_close_date: editForm.expected_close_date || null,
        description: editForm.description?.trim() || null,
      });
      toast.success("Lead details updated");
      setIsEditOpen(false);
      loadLeadData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to update lead");
    }
  };

  // Determine automatic pipeline route info for display
  const getPipelineRoutingInfo = () => {
    if (!lead) return null;
    switch (lead.business_segment) {
      case "EdTech":
        return {
          pipelineName: "EdTech Pipeline",
          initialStage: "Counselling",
          description: "Targeted curriculum counseling and demo conversion pipeline.",
        };
      case "IT Services":
        return {
          pipelineName: "IT Services Pipeline",
          initialStage: "Discovery",
          description: "Corporate software delivery, discovery & retainer contract pipeline.",
        };
      case "Talent":
        return {
          pipelineName: "Talent / Outsourcing Pipeline",
          initialStage: "Requirement",
          description: "Institutional & corporate recruitment and talent placement pipeline.",
        };
      default:
        return {
          pipelineName: "Default Sales Pipeline",
          initialStage: "Lead In / Initial",
          description: "Standard sales pipeline routing.",
        };
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">Loading lead details...</div>
    );
  }

  if (!lead) {
    return (
      <EmptyState
        title="Lead not found"
        description="The requested prospect record could not be found or has been removed."
        actionLabel="Back to Leads"
        onAction={() => router.push("/leads")}
      />
    );
  }

  const followUp = getFollowUpStatus(
    lead.next_follow_up_date,
    lead.status === "Converted" || lead.status === "Lost"
  );
  const routeInfo = getPipelineRoutingInfo();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push("/leads")}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Back to Leads"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {lead.contact_name || lead.title}
              </h1>
              <Badge variant="status" status={lead.status}>
                {lead.status}
              </Badge>
              <Badge variant="status" status={lead.priority}>
                {lead.priority}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>{lead.title}</span>
              <span>•</span>
              <span>Created {formatDate(lead.created_at)}</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          {lead.contact_phone && (
            <button
              onClick={handleInitiateCall}
              className="inline-flex items-center px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
              title={`Call ${lead.contact_phone}`}
            >
              <Phone className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
              Call
            </button>
          )}
          {hasPermission("crm.leads.edit") && (
            <>
              <button
                onClick={handleOpenEdit}
                className="inline-flex items-center px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
                Edit Details
              </button>
              <button
                onClick={handleOpenActivity}
                className="inline-flex items-center px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                Log Activity
              </button>
              {lead.status !== "Converted" && (
                <button
                  onClick={handleOpenConvert}
                  className="inline-flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Convert to Deal
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Prominent Follow-Up Banner (Part 7.B & 7.F) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Next Action Required
              </span>
              <span className={followUp.className}>{followUp.label}</span>
            </div>
            <div className="text-lg font-semibold text-white tracking-tight">
              {lead.next_action ? lead.next_action : <span className="text-slate-400 italic font-normal">No next action recorded. Schedule one to ensure momentum.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-0.5">
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Scheduled: {formatDateTime(lead.next_follow_up_date) || "Not set"}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Last Activity: {lead.last_activity_at ? formatDateTime(lead.last_activity_at) : "No activities yet"}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Owner: {lead.owner_name || "Unassigned"}
              </span>
            </div>
          </div>

          {hasPermission("crm.leads.edit") && (
            <button
              onClick={handleOpenFollowUp}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Update Follow-Up
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Prospect Details, Pipeline, Activities, Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section A: Prospect Information */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Prospect & Account Details
              </h2>
              {hasPermission("crm.leads.edit") && (
                <button
                  onClick={handleOpenEdit}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Contact Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {lead.contact_name || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Company / Organization</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center">
                  <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  {lead.company_id ? (
                    <Link href={`/companies/${lead.company_id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                      {lead.company_name || lead.company_name}
                    </Link>
                  ) : (
                    lead.company_name || <span className="text-slate-400 dark:text-slate-500 italic font-normal">Direct Inbound</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Email</span>
                {lead.contact_email ? (
                  <a
                    href={`mailto:${lead.contact_email}`}
                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center"
                  >
                    <Mail className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                    {lead.contact_email}
                  </a>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">—</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Phone</span>
                {lead.contact_phone ? (
                  <a
                    href={`tel:${lead.contact_phone}`}
                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center"
                  >
                    <Phone className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                    {lead.contact_phone}
                  </a>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">—</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Business Segment</span>
                {lead.business_segment ? (
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800 inline-block">
                    {lead.business_segment}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">—</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Lead Source</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{lead.source_name || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Estimated Value</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(lead.expected_value)}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Target Close Date</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(lead.expected_close_date)}</span>
              </div>
            </div>

            {lead.description && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 dark:text-slate-500 block mb-1">Requirement / Notes</span>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  {lead.description}
                </p>
              </div>
            )}
          </div>

          {/* Section B: Pipeline & Conversion Routing (Part 7.C) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Pipeline & Conversion Status
            </h2>

            {lead.status === "Converted" ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Successfully Converted to Deal</h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Converted on {formatDate(lead.converted_at)}
                    </p>
                  </div>
                </div>
                {lead.converted_opportunity_id && (
                  <Link
                    href={`/opportunities/${lead.converted_opportunity_id}`}
                    className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                  >
                    <span>View Deal</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Designated Pipeline Route</div>
                    <div className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mt-0.5">
                      {routeInfo?.pipelineName}
                    </div>
                  </div>
                  <div className="text-xs sm:text-right">
                    <span className="text-slate-400 dark:text-slate-500 block text-2xs uppercase">Initial Stage</span>
                    <span className="inline-flex items-center font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {routeInfo?.initialStage}
                    </span>
                  </div>
                </div>
                <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {routeInfo?.description} When converted, this prospect will automatically transition to an active deal in this pipeline.
                </p>
                {hasPermission("crm.leads.edit") && (
                  <button
                    onClick={handleOpenConvert}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Convert to Deal Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section C: Activity History & Follow-ups (Part 7.D & 7.E) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Activities & Follow-Up History
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {activities.length}
                </span>
              </div>
              {hasPermission("crm.leads.edit") && (
                <button
                  onClick={handleOpenActivity}
                  className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Log Activity
                </button>
              )}
            </div>

            {activities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                No activities logged for this prospect yet. Use "Log Activity" to track calls, demos, or meetings.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className={`p-3.5 rounded-xl border text-xs transition-colors ${
                      act.is_completed
                        ? "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 opacity-80"
                        : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700/80 hover:border-indigo-200 dark:hover:border-indigo-800 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-2.5">
                        <button
                          onClick={() => !act.is_completed && handleCompleteActivity(act.id)}
                          disabled={act.is_completed || !hasPermission("crm.leads.edit")}
                          className={`mt-0.5 p-0.5 rounded transition-colors ${
                            act.is_completed
                              ? "text-emerald-600 dark:text-emerald-400 cursor-default"
                              : "text-slate-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400"
                          }`}
                          title={act.is_completed ? "Completed" : "Click to mark complete"}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                              {act.subject}
                            </span>
                            <span className="inline-block text-2xs font-semibold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                              {act.type}
                            </span>
                          </div>
                          {act.description && (
                            <p className="text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{act.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500 mt-2 text-2xs">
                            <span>Due: {formatDateTime(act.due_at)}</span>
                            {act.is_completed && act.completed_at && (
                              <span>• Completed: {formatDateTime(act.completed_at)}</span>
                            )}
                            {act.assigned_to_name && (
                              <span>• Assigned: {act.assigned_to_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!act.is_completed && hasPermission("crm.leads.edit") && (
                        <button
                          onClick={() => handleCompleteActivity(act.id)}
                          className="px-2.5 py-1 text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors shrink-0"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section D: Internal Notes */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Internal Notes
            </h2>

            {/* Note input form */}
            {hasPermission("crm.leads.edit") && (
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  placeholder="Record an internal note or context about this prospect..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!noteContent.trim() || submittingNote}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {submittingNote ? "Saving..." : "Add Note"}
                  </button>
                </div>
              </form>
            )}

            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No internal notes recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">{n.content}</p>
                    <div className="flex items-center gap-2 text-2xs text-slate-400 dark:text-slate-500 mt-2">
                      <span>{n.author_name || "Team Member"}</span>
                      <span>•</span>
                      <span>{formatDateTime(n.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Summary Cards */}
        <div className="space-y-6">
          {/* Quick Schedule Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Follow-Up Summary
            </h3>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-2xs uppercase">Next Action</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {lead.next_action || <span className="text-slate-400 dark:text-slate-500 font-normal italic">None</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-2xs uppercase">Scheduled Date</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatDateTime(lead.next_follow_up_date) || <span className="text-slate-400 dark:text-slate-500 font-normal italic">Unscheduled</span>}
                </span>
              </div>
            </div>
            {hasPermission("crm.leads.edit") && (
              <button
                onClick={handleOpenFollowUp}
                className="w-full py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
              >
                Reschedule Follow-Up
              </button>
            )}
          </div>

          {/* Key Dates & Meta Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Record Timestamps
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-400 dark:text-slate-500">Created At</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateTime(lead.created_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-400 dark:text-slate-500">Last Activity</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {lead.last_activity_at ? formatDateTime(lead.last_activity_at) : "None"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                <span className="text-slate-400 dark:text-slate-500">Assigned Owner</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{lead.owner_name || "Unassigned"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 dark:text-slate-500">Status</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{lead.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Follow-Up Modal */}
      <Modal
        isOpen={isFollowUpOpen}
        onClose={() => setIsFollowUpOpen(false)}
        title="Schedule Next Follow-Up"
      >
        <form onSubmit={handleFollowUpSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Next Action *</label>
            <input
              type="text"
              required
              placeholder="e.g. Call to discuss commercial proposal and discount"
              value={followUpForm.next_action}
              onChange={(e) => setFollowUpForm({ ...followUpForm, next_action: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Next Follow-Up Date & Time</label>
            <input
              type="datetime-local"
              value={followUpForm.next_follow_up_date}
              onChange={(e) => setFollowUpForm({ ...followUpForm, next_follow_up_date: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsFollowUpOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save Schedule
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Activity Modal */}
      <Modal
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        title="Log Activity for Lead"
      >
        <form onSubmit={handleActivitySubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Activity Type</label>
            <select
              value={activityForm.type}
              onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            >
              <option value="Call">Call</option>
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Meeting">Meeting</option>
              <option value="Demo">Demo</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Task">Task</option>
              <option value="Note">Note</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
            <input
              type="text"
              required
              placeholder="e.g. Discovery call with Academic Director"
              value={activityForm.subject}
              onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={activityForm.due_at}
              onChange={(e) => setActivityForm({ ...activityForm, due_at: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Outcome, discussion points, or next commitments..."
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsActivityOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save Activity
            </button>
          </div>
        </form>
      </Modal>

      {/* Convert to Deal Modal */}
      <Modal
        isOpen={isConvertOpen}
        onClose={() => setIsConvertOpen(false)}
        title="Convert Lead to Active Deal"
      >
        <form onSubmit={handleConvertSubmit} className="space-y-4 text-sm">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <p>
              Converting this lead will mark it as <strong>Qualified</strong> and generate an active deal in the
              sales pipeline.
            </p>
            {lead.business_segment && (
              <p className="text-2xs text-indigo-700 dark:text-indigo-300 font-semibold">
                Automatic routing: Business segment{" "}
                <span className="underline">{lead.business_segment}</span> will route to{" "}
                <strong>{routeInfo?.pipelineName}</strong> (Stage: {routeInfo?.initialStage}).
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Deal / Opportunity Title *</label>
            <input
              type="text"
              required
              value={convertForm.opportunity_title}
              onChange={(e) => setConvertForm({ ...convertForm, opportunity_title: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Deal Value (₹)</label>
              <input
                type="number"
                value={convertForm.value}
                onChange={(e) => setConvertForm({ ...convertForm, value: Number(e.target.value) })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Close Date</label>
              <input
                type="date"
                value={convertForm.expected_close_date}
                onChange={(e) => setConvertForm({ ...convertForm, expected_close_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pipeline Override (Optional)
            </label>
            <select
              value={convertForm.pipeline_id}
              onChange={(e) => setConvertForm({ ...convertForm, pipeline_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
            >
              <option value="">Auto-Route via Business Segment</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.is_default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsConvertOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Confirm & Convert
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Details Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Lead Information"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-sm max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lead Title *</label>
              <input
                type="text"
                required
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Name</label>
              <input
                type="text"
                value={editForm.contact_name}
                onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Org Name</label>
              <input
                type="text"
                value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={editForm.contact_email}
                onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="text"
                value={editForm.contact_phone}
                onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Segment</label>
              <select
                value={editForm.business_segment}
                onChange={(e) => setEditForm({ ...editForm, business_segment: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="">None</option>
                <option value="EdTech">EdTech</option>
                <option value="IT Services">IT Services</option>
                <option value="Talent">Talent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lead Source</label>
              <select
                value={editForm.source_id}
                onChange={(e) => setEditForm({ ...editForm, source_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="">None</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner</label>
              <select
                value={editForm.owner_id}
                onChange={(e) => setEditForm({ ...editForm, owner_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Unqualified">Unqualified</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Value (₹)</label>
              <input
                type="number"
                value={editForm.expected_value}
                onChange={(e) => setEditForm({ ...editForm, expected_value: Number(e.target.value) })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description / Notes</label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
