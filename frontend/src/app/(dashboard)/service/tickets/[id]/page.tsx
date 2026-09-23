"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Headphones,
  ArrowLeft,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Send,
  Lock,
  MessageSquare,
  Building2,
  Users,
  FolderGit2,
  Bug,
  AlertTriangle,
  History,
  FileText,
  Upload,
  RefreshCw,
  TrendingUp,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface TicketDetail {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  severity: string;
  source: string;
  company_id: string | null;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  sla_policy_id: string | null;
  sla_policy_name: string | null;
  project_id: string | null;
  project_name: string | null;
  bug_id: string | null;
  bug_number: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  sla_status: string;
  first_response_due_at: string | null;
  first_responded_at: string | null;
  due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_summary: string | null;
  resolution_category: string | null;
  reopen_count: number;
  sla_paused_at: string | null;
  sla_total_paused_minutes: number;
  created_at: string;
  updated_at: string;
  comments?: TicketCommentItem[];
  attachments?: TicketAttachmentItem[];
}

interface TicketCommentItem {
  id: string;
  comment_type: "INTERNAL_NOTE" | "CUSTOMER_REPLY" | "SYSTEM";
  body: string;
  is_customer_visible: boolean;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

interface TicketAttachmentItem {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  is_internal_only: boolean;
  uploaded_by_name: string | null;
  created_at: string;
}

interface TicketTimelineItem {
  id: string;
  action: string;
  details: string | null;
  from_status?: string | null;
  to_status?: string | null;
  user_name: string | null;
  created_at: string;
}

interface UserOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface BugOption {
  id: string;
  bug_number: string;
  title: string;
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = use(params);
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [timeline, setTimeline] = useState<TicketTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available metadata options
  const [users, setUsers] = useState<UserOption[]>([]);
  const [bugs, setBugs] = useState<BugOption[]>([]);

  // Comment Box State
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] = useState<"CUSTOMER_REPLY" | "INTERNAL_NOTE">("CUSTOMER_REPLY");
  const [commentFilter, setCommentFilter] = useState<string>("ALL");

  // Attachment upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadInternalOnly, setUploadInternalOnly] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Workflow Dialogs
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assignNote, setAssignNote] = useState("");

  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [resolveSummary, setResolveSummary] = useState("");
  const [resolveCategory, setResolveCategory] = useState("Configuration Fix");
  const [resolveBugId, setResolveBugId] = useState("");

  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [escalationLevel, setEscalationLevel] = useState("LEVEL_2");
  const [escalationReason, setEscalationReason] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTicket();
    loadUsers();
    loadBugs();
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<TicketDetail>(`/service/tickets/${ticketId}`);
      setTicket(data);
      if (data.assigned_to_id) {
        setSelectedAssignee(data.assigned_to_id);
      }

      // Fetch audit timeline
      try {
        const timeData = await api.get<TicketTimelineItem[]>(`/service/tickets/${ticketId}/timeline`);
        setTimeline(timeData);
      } catch (err) {
        console.error("Timeline load failed:", err);
      }
    } catch (err: any) {
      console.error("Failed to load ticket detail:", err);
      setError(err?.detail || "Failed to load ticket details.");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.get<UserOption[]>("/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const loadBugs = async () => {
    try {
      const data = await api.get<BugOption[]>("/qa/bugs");
      setBugs(data);
    } catch (err) {
      console.error("Failed to load QA bugs:", err);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setActionLoading(true);
      await api.post(`/service/tickets/${ticketId}/comments`, {
        body: commentText,
        comment_type: commentType,
        is_customer_visible: commentType === "CUSTOMER_REPLY",
      });
      toast.success(commentType === "INTERNAL_NOTE" ? "Internal note posted" : "Customer reply sent");
      setCommentText("");
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to post comment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Status Transitions
  const handleTransition = async (newStatus: string, reason?: string) => {
    try {
      setActionLoading(true);
      await api.post(`/service/tickets/${ticketId}/status`, {
        status: newStatus,
        reason: reason || undefined,
      });
      toast.success(`Ticket marked as ${newStatus.replace(/_/g, " ")}`);
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to update ticket status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Assign
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignee) return;

    try {
      setActionLoading(true);
      await api.post(`/service/tickets/${ticketId}/assign`, {
        assigned_to_id: selectedAssignee,
        assignment_note: assignNote || undefined,
      });
      toast.success("Ticket assignee updated");
      setIsAssignOpen(false);
      setAssignNote("");
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to assign ticket.");
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve
  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveSummary.trim()) {
      toast.error("Resolution summary is required.");
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/service/tickets/${ticketId}/resolve`, {
        resolution_summary: resolveSummary,
        resolution_category: resolveCategory,
        linked_bug_id: resolveBugId || undefined,
      });
      toast.success("Ticket marked as RESOLVED");
      setIsResolveOpen(false);
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to resolve ticket.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reopen
  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      toast.error("Reason is required to reopen.");
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/service/tickets/${ticketId}/reopen`, {
        reason: reopenReason,
      });
      toast.success("Ticket reopened");
      setIsReopenOpen(false);
      setReopenReason("");
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to reopen ticket.");
    } finally {
      setActionLoading(false);
    }
  };

  // Escalate
  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationReason.trim()) {
      toast.error("Reason is required for escalation.");
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/service/tickets/${ticketId}/escalate`, {
        escalation_level: escalationLevel,
        reason: escalationReason,
      });
      toast.success(`Ticket escalated to ${escalationLevel}`);
      setIsEscalateOpen(false);
      setEscalationReason("");
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to escalate ticket.");
    } finally {
      setActionLoading(false);
    }
  };

  // File Upload
  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("is_internal_only", String(uploadInternalOnly));

      await api.upload(`/service/tickets/${ticketId}/attachments`, formData);
      toast.success("Attachment uploaded");
      setUploadFile(null);
      loadTicket();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to upload attachment.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadAttachment = (attachmentId: string, fileName: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("crm_access_token") : "";
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const url = `${apiBase}/service/tickets/${ticketId}/attachments/${attachmentId}/download?token=${token}`;
    window.open(url, "_blank");
  };

  if (loading && !ticket) {
    return (
      <div className="py-24 text-center text-xs text-slate-400 dark:text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
        Loading Ticket 360...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4 p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-900 dark:text-slate-100">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ticket Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || "The requested support ticket could not be loaded."}</p>
        <Link
          href="/service/tickets"
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
        >
          Back to Tickets List
        </Link>
      </div>
    );
  }

  const isResolvedOrClosed = ["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status);
  const isWaiting = ticket.status === "WAITING_FOR_CUSTOMER";
  const filteredComments = (ticket.comments || []).filter((c) => {
    if (commentFilter === "ALL") return true;
    return c.comment_type === commentFilter;
  });

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500">
          <Link href="/service" className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
            Service
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/service/tickets" className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
            Tickets
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">{ticket.ticket_number}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadTicket}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Refresh details"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/service/tickets"
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tickets List</span>
          </Link>
        </div>
      </div>

      {/* Ticket Header & Workflow Action Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 px-2.5 py-0.5 rounded-md">
                {ticket.ticket_number}
              </span>
              <Badge variant="status" status={ticket.status}>
                {ticket.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="status" status={ticket.sla_status}>
                SLA: {ticket.sla_status}
              </Badge>
              <span
                className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                  ticket.priority === "URGENT"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50"
                    : ticket.priority === "HIGH"
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {ticket.priority} Priority
              </span>
              {ticket.reopen_count > 0 && (
                <span className="text-2xs px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold border border-rose-200 dark:border-rose-900/60">
                  Reopened {ticket.reopen_count}x
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{ticket.subject}</h1>
            <div className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Institution: <strong className="text-slate-700 dark:text-slate-300">{ticket.company_name || "Internal"}</strong></span>
              <span>•</span>
              <span>Assignee: <strong className="text-slate-700 dark:text-slate-300">{ticket.assigned_to_name || "Unassigned"}</strong></span>
              <span>•</span>
              <span>Created: {formatDateTime(ticket.created_at)}</span>
            </div>
          </div>

          {/* SLA Clock Countdown Box */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-right space-y-1 min-w-[200px]">
            <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-end space-x-1">
              <Clock className="w-3 h-3" />
              <span>Target SLA Deadline</span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              {ticket.due_at ? formatDateTime(ticket.due_at) : "No policy attached"}
            </div>
            <div className="text-3xs text-slate-500 dark:text-slate-400">
              {isWaiting ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center justify-end space-x-1">
                  <Pause className="w-2.5 h-2.5" />
                  <span>Clock Paused (Waiting)</span>
                </span>
              ) : ticket.sla_status === "BREACHED" ? (
                <span className="text-rose-600 dark:text-rose-400 font-bold">Target Time Breached</span>
              ) : ticket.resolved_at ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Resolved at {formatDateTime(ticket.resolved_at)}</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-mono">Asia/Kolkata (9-18 IST)</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Assign / Reassign */}
          {hasPermission("service.tickets.assign") && (
            <button
              onClick={() => setIsAssignOpen(true)}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{ticket.assigned_to_id ? "Reassign" : "Assign Ticket"}</span>
            </button>
          )}

          {/* Start Work (If OPEN or NEW) */}
          {(ticket.status === "OPEN" || ticket.status === "NEW") && (
            <button
              onClick={() => handleTransition("IN_PROGRESS")}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Work</span>
            </button>
          )}

          {/* Wait for Customer */}
          {ticket.status === "IN_PROGRESS" && (
            <button
              onClick={() => handleTransition("WAITING_FOR_CUSTOMER", "Awaiting institutional logs & confirmation")}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Wait for Customer (Pause SLA)</span>
            </button>
          )}

          {/* Resume from Waiting */}
          {ticket.status === "WAITING_FOR_CUSTOMER" && (
            <button
              onClick={() => handleTransition("IN_PROGRESS", "Customer responded with details")}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Work (Resume SLA)</span>
            </button>
          )}

          {/* Resolve Ticket */}
          {!["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status) && (
            <button
              onClick={() => setIsResolveOpen(true)}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resolve Ticket</span>
            </button>
          )}

          {/* Customer Confirmation (If RESOLVED) */}
          {ticket.status === "RESOLVED" && (
            <button
              onClick={() => handleTransition("CLOSED", "Client verified & approved")}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Confirm & Close Ticket</span>
            </button>
          )}

          {/* Reopen Ticket (If RESOLVED or CLOSED) */}
          {isResolvedOrClosed && (
            <button
              onClick={() => setIsReopenOpen(true)}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen Ticket</span>
            </button>
          )}

          {/* Escalate */}
          {!isResolvedOrClosed && (
            <button
              onClick={() => setIsEscalateOpen(true)}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Escalate</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left 70% (Description, Conversation, Attachments) & Right 30% (Context, SLA, Properties) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Issue Description</h2>
            <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800/80 font-mono">
              {ticket.description}
            </div>

            {ticket.resolution_summary && (
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resolution Summary ({ticket.resolution_category || "Standard Resolution"})</span>
                </div>
                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
                  {ticket.resolution_summary}
                </p>
                {ticket.resolved_at && (
                  <p className="text-3xs text-emerald-600 dark:text-emerald-400 font-mono">
                    Resolved at {formatDateTime(ticket.resolved_at)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Conversation & Feed Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Activity & Conversation</h2>
              </div>

              {/* Filter Comments */}
              <div className="flex items-center space-x-1 text-2xs">
                <button
                  onClick={() => setCommentFilter("ALL")}
                  className={`px-2 py-1 rounded transition ${
                    commentFilter === "ALL" ? "bg-slate-800 dark:bg-slate-700 text-white font-semibold" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  All ({ticket.comments?.length || 0})
                </button>
                <button
                  onClick={() => setCommentFilter("CUSTOMER_REPLY")}
                  className={`px-2 py-1 rounded transition ${
                    commentFilter === "CUSTOMER_REPLY" ? "bg-indigo-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Customer Replies
                </button>
                {hasPermission("service.notes.view_internal") && (
                  <button
                    onClick={() => setCommentFilter("INTERNAL_NOTE")}
                    className={`px-2 py-1 rounded transition ${
                      commentFilter === "INTERNAL_NOTE" ? "bg-amber-600 text-white font-semibold" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Internal Notes
                  </button>
                )}
              </div>
            </div>

            {/* Comments Feed */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredComments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  No comments recorded for this view.
                </div>
              ) : (
                filteredComments.map((comment) => {
                  const isInternal = comment.comment_type === "INTERNAL_NOTE";
                  const isSystem = comment.comment_type === "SYSTEM";

                  return (
                    <div
                      key={comment.id}
                      className={`p-3.5 rounded-lg border text-xs space-y-1.5 transition ${
                        isInternal
                          ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60"
                          : isSystem
                          ? "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 italic"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {comment.author_name || "System"}
                          </span>
                          {isInternal ? (
                            <span className="inline-flex items-center space-x-1 text-3xs font-semibold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Internal Team Note</span>
                            </span>
                          ) : isSystem ? (
                            <span className="text-3xs font-mono text-slate-400 dark:text-slate-500">System Log</span>
                          ) : (
                            <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                              Customer Reply
                            </span>
                          )}
                        </div>
                        <span className="text-3xs font-mono text-slate-400 dark:text-slate-500">
                          {formatDateTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* New Comment Input Box */}
            <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCommentType("CUSTOMER_REPLY")}
                    className={`px-3 py-1 text-2xs font-semibold rounded-lg transition ${
                      commentType === "CUSTOMER_REPLY"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Reply to Customer
                  </button>

                  {hasPermission("service.notes.create_internal") && (
                    <button
                      type="button"
                      onClick={() => setCommentType("INTERNAL_NOTE")}
                      className={`flex items-center space-x-1 px-3 py-1 text-2xs font-semibold rounded-lg transition ${
                        commentType === "INTERNAL_NOTE"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>Internal Note (Hidden from Client)</span>
                    </button>
                  )}
                </div>

                {commentType === "INTERNAL_NOTE" && (
                  <span className="text-3xs text-amber-700 dark:text-amber-400 font-semibold flex items-center space-x-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Visible only to internal support staff</span>
                  </span>
                )}
              </div>

              <textarea
                rows={3}
                placeholder={
                  commentType === "INTERNAL_NOTE"
                    ? "Add an internal note or diagnostic finding..."
                    : "Draft a response to the customer..."
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className={`w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 ${
                  commentType === "INTERNAL_NOTE"
                    ? "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/30 focus:ring-amber-500"
                    : "border-slate-200 dark:border-slate-800 focus:ring-indigo-500"
                }`}
              />

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={actionLoading || !commentText.trim()}
                  className={`flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white shadow-xs transition disabled:opacity-50 ${
                    commentType === "INTERNAL_NOTE"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{commentType === "INTERNAL_NOTE" ? "Post Internal Note" : "Send Customer Reply"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Attachments Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Attachments ({ticket.attachments?.length || 0})
                </h2>
              </div>
            </div>

            {/* List */}
            {(!ticket.attachments || ticket.attachments.length === 0) ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No attachments uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ticket.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 flex items-center justify-between transition bg-slate-50/50 dark:bg-slate-950/50"
                  >
                    <div className="space-y-0.5 truncate max-w-[200px]">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate flex items-center space-x-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span>{att.file_name}</span>
                      </div>
                      <div className="text-3xs text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                        <span>{(att.file_size / 1024).toFixed(0)} KB</span>
                        {att.is_internal_only && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">• Internal Only</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadAttachment(att.id, att.file_name)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            <form onSubmit={handleUploadAttachment} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/60"
                />

                <label className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadInternalOnly}
                    onChange={(e) => setUploadInternalOnly(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Internal Staff Only</span>
                </label>

                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 rounded-lg shadow-xs transition disabled:opacity-50 sm:ml-auto"
                >
                  {isUploading ? "Uploading..." : "Upload File"}
                </button>
              </div>
            </form>
          </div>

          {/* Audit Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <History className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Lifecycle Audit & Status History</h2>
            </div>

            <div className="space-y-3">
              {timeline.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">No lifecycle events recorded yet.</p>
              ) : (
                timeline.map((evt, idx) => (
                  <div key={idx} className="flex items-start space-x-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {evt.action.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-3xs text-slate-400 dark:text-slate-500">
                          {formatDateTime(evt.created_at)}
                        </span>
                      </div>
                      {evt.details && <p className="text-slate-600 dark:text-slate-400">{evt.details}</p>}
                      <div className="text-3xs text-slate-400 dark:text-slate-500">By: {evt.user_name || "System"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col: Context, SLA, Properties) */}
        <div className="space-y-6">
          {/* Institutional 360 Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Institutional Context</span>
            </h3>

            {ticket.company_id ? (
              <div className="space-y-3">
                <div>
                  <div className="text-3xs uppercase font-semibold text-slate-400 dark:text-slate-500">Company / Account</div>
                  <Link
                    href={`/companies/${ticket.company_id}`}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline block mt-0.5"
                  >
                    {ticket.company_name}
                  </Link>
                </div>

                {ticket.contact_name && (
                  <div>
                    <div className="text-3xs uppercase font-semibold text-slate-400 dark:text-slate-500">Primary Contact</div>
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{ticket.contact_name}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">Internal issue (No external company attached).</p>
            )}
          </div>

          {/* SLA Performance Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>SLA Target Details</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Active Policy</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{ticket.sla_policy_name || "Standard Institutional"}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">First Response Target</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {ticket.first_responded_at ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Responded</span>
                  ) : ticket.first_response_due_at ? (
                    formatDateTime(ticket.first_response_due_at)
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Resolution Target</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {ticket.due_at ? formatDateTime(ticket.due_at) : "N/A"}
                </span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">Total SLA Pause</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {ticket.sla_total_paused_minutes} mins
                </span>
              </div>
            </div>
          </div>

          {/* Linked Engineering & QA Entities */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <FolderGit2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Linked Engineering</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-3xs uppercase font-semibold text-slate-400 dark:text-slate-500">Project</div>
                {ticket.project_name ? (
                  <Link
                    href={`/projects/${ticket.project_id}`}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline block mt-0.5"
                  >
                    {ticket.project_name}
                  </Link>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">No project linked</span>
                )}
              </div>

              <div>
                <div className="text-3xs uppercase font-semibold text-slate-400 dark:text-slate-500">QA Bug Link</div>
                {ticket.bug_id ? (
                  <div className="mt-1 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60">
                    <Link
                      href={`/bugs/${ticket.bug_id}`}
                      className="font-mono font-bold text-rose-700 dark:text-rose-400 hover:underline flex items-center space-x-1"
                    >
                      <Bug className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>{ticket.bug_number || "BUG-LINKED"}</span>
                    </Link>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">No bug linked</span>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Classification Properties */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ticket Specifications</h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Category</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{ticket.category_name || "General"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Subcategory</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{ticket.subcategory_name || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Severity</span>
                <span className="font-mono uppercase font-semibold text-slate-800 dark:text-slate-200">{ticket.severity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Channel Source</span>
                <span className="font-mono uppercase font-semibold text-slate-800 dark:text-slate-200">{ticket.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last Updated</span>
                <span className="font-mono text-slate-400 dark:text-slate-500 text-3xs">{formatDateTime(ticket.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title="Assign Ticket">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              required
            >
              <option value="">Select Support Executive...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignment Note (Optional)</label>
            <textarea
              rows={2}
              placeholder="Instructions or context for the assignee..."
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              Confirm Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Modal */}
      <Modal isOpen={isResolveOpen} onClose={() => setIsResolveOpen(false)} title="Resolve Support Ticket">
        <form onSubmit={handleResolve} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Resolution Summary <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Explain how the issue was resolved, root cause discovered, configuration fixes applied..."
              value={resolveSummary}
              onChange={(e) => setResolveSummary(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Resolution Category</label>
            <select
              value={resolveCategory}
              onChange={(e) => setResolveCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Bug Fix">Bug Fix / Patch Deployed</option>
              <option value="Configuration Fix">Configuration Fix</option>
              <option value="User Guidance">User Guidance / Documentation</option>
              <option value="Network / Infrastructure">Infrastructure / Network Restored</option>
              <option value="Workaround Provided">Workaround Provided</option>
              <option value="Duplicate / Not Reproducible">Duplicate / Not Reproducible</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Link Fixed QA Bug (Optional)
            </label>
            <select
              value={resolveBugId}
              onChange={(e) => setResolveBugId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">None</option>
              {bugs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bug_number}: {b.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsResolveOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
            >
              Mark as Resolved
            </button>
          </div>
        </form>
      </Modal>

      {/* Reopen Modal */}
      <Modal isOpen={isReopenOpen} onClose={() => setIsReopenOpen(false)} title="Reopen Support Ticket">
        <form onSubmit={handleReopen} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reopen Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Why does this ticket need to be reopened? What symptom recurred?"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsReopenOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
            >
              Confirm Reopen
            </button>
          </div>
        </form>
      </Modal>

      {/* Escalate Modal */}
      <Modal isOpen={isEscalateOpen} onClose={() => setIsEscalateOpen(false)} title="Escalate Support Ticket">
        <form onSubmit={handleEscalate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Escalation Tier</label>
            <select
              value={escalationLevel}
              onChange={(e) => setEscalationLevel(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            >
              <option value="LEVEL_2">Tier 2 - Technical Support Specialists</option>
              <option value="LEVEL_3">Tier 3 - Engineering / Core DevOps</option>
              <option value="MANAGEMENT">Executive Management Review</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Escalation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Provide justification: critical deadline, recurring blocker, SLA breach risk..."
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEscalateOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
            >
              Submit Escalation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
