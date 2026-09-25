"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  Search,
  Filter,
  ArrowRight,
  CheckCircle,
  Building2,
  User as UserIcon,
  Sparkles,
  Clock,
  AlertTriangle,
  Calendar,
  Phone,
  Mail,
  X,
  Briefcase,
  Layers,
  ChevronRight,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export interface Lead {
  id: string;
  company_id?: string | null;
  college_name?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  company_name?: string | null;
  business_segment?: string | null;
  next_action?: string | null;
  next_follow_up_date?: string | null;
  last_activity_at?: string | null;
  title: string;
  description?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  status: string;
  priority: string;
  expected_value?: number | null;
  expected_close_date?: string | null;
  qualification_status: string;
  converted_opportunity_id?: string | null;
  converted_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadSource {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name?: string;
  email: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

interface PipelineOption {
  id: string;
  name: string;
  is_default: boolean;
}

type ViewScope = "all" | "mine" | "today_follow_ups" | "overdue_follow_ups" | "unassigned";

export function getFollowUpStatus(dateString?: string | null, isClosed = false) {
  if (!dateString) {
    return {
      label: "No follow-up",
      status: "none" as const,
      className: "text-slate-400 dark:text-slate-500 text-xs italic",
    };
  }

  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      label: `Today, ${timeStr}`,
      status: "today" as const,
      className: "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800",
    };
  }

  if (date < now && !isClosed) {
    return {
      label: `Overdue: ${formatDate(dateString)}`,
      status: "overdue" as const,
      className: "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
    };
  }

  return {
    label: formatDate(dateString),
    status: "upcoming" as const,
    className: "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  };
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [loading, setLoading] = useState(true);

  // View tabs
  const [activeTab, setActiveTab] = useState<ViewScope>("all");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  const { hasPermission, user: currentUser } = useAuth();
  const toast = useToast();

  // Create Lead Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    company_name: "",
    company_id: "",
    business_segment: "",
    source_id: "",
    owner_id: "",
    next_action: "",
    next_follow_up_date: "",
    description: "",
    priority: "Medium",
    status: "New",
    expected_value: 0,
    expected_close_date: "",
  });

  // Quick Follow-Up Modal State
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpForm, setFollowUpForm] = useState({
    next_action: "",
    next_follow_up_date: "",
  });

  // Convert to Deal Modal State
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertForm, setConvertForm] = useState({
    opportunity_title: "",
    value: 0,
    pipeline_id: "",
    expected_close_date: "",
  });

  // CSV Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total_rows: number;
    imported: number;
    duplicates: number;
    validation_errors: number;
    row_errors: string[];
  } | null>(null);

  // Load auxiliary data once
  useEffect(() => {
    const loadAuxData = async () => {
      try {
        const [srcs, usrs, cols, pipes] = await Promise.all([
          api.get<LeadSource[]>("/lead-sources").catch(() => []),
          api.get<UserOption[]>("/users").catch(() => []),
          api.get<CompanyOption[]>("/companies").catch(() => []),
          api.get<PipelineOption[]>("/pipelines").catch(() => []),
        ]);
        setSources(srcs || []);
        setUsers(usrs || []);
        setCompanies(cols || []);
        setPipelines(pipes || []);
      } catch (err) {
        console.error("Failed to load filter metadata", err);
      }
    };
    loadAuxData();
  }, []);

  // Fetch leads with active scope and filters
  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      // View tab scope mapping
      if (activeTab === "mine") {
        params.append("scope", "mine");
      } else if (activeTab === "today_follow_ups") {
        params.append("scope", "today_follow_ups");
      } else if (activeTab === "overdue_follow_ups") {
        params.append("scope", "overdue_follow_ups");
      } else if (activeTab === "unassigned") {
        params.append("unassigned", "true");
      }

      if (search.trim()) params.append("search", search.trim());
      if (segmentFilter) params.append("segment", segmentFilter);
      if (sourceFilter) params.append("source_id", sourceFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (priorityFilter) params.append("priority", priorityFilter);
      if (ownerFilter) params.append("owner_id", ownerFilter);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await api.get<Lead[]>(`/leads${qs}`);
      setLeads(data || []);
    } catch (err) {
      console.error("Failed to load leads", err);
      toast.error("Failed to load leads list");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, segmentFilter, sourceFilter, statusFilter, priorityFilter, ownerFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  const handleResetFilters = () => {
    setSearch("");
    setSegmentFilter("");
    setSourceFilter("");
    setStatusFilter("");
    setPriorityFilter("");
    setOwnerFilter("");
  };

  // Open Create Lead Modal with defaults
  const handleOpenCreate = () => {
    setCreateForm({
      title: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      company_name: "",
      company_id: "",
      business_segment: "",
      source_id: sources[0]?.id || "",
      owner_id: currentUser?.id || "",
      next_action: "",
      next_follow_up_date: "",
      description: "",
      priority: "Medium",
      status: "New",
      expected_value: 0,
      expected_close_date: "",
    });
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error("Lead Title is required");
      return;
    }

    try {
      const payload: Record<string, any> = {
        title: createForm.title.trim(),
        priority: createForm.priority,
        status: createForm.status,
      };

      if (createForm.contact_name?.trim()) payload.contact_name = createForm.contact_name.trim();
      if (createForm.contact_email?.trim()) payload.contact_email = createForm.contact_email.trim();
      if (createForm.contact_phone?.trim()) payload.contact_phone = createForm.contact_phone.trim();
      if (createForm.company_name?.trim()) payload.company_name = createForm.company_name.trim();
      if (createForm.company_id) payload.company_id = createForm.company_id;
      if (createForm.business_segment) payload.business_segment = createForm.business_segment;
      if (createForm.source_id) payload.source_id = createForm.source_id;
      if (createForm.owner_id) payload.owner_id = createForm.owner_id;
      if (createForm.next_action?.trim()) payload.next_action = createForm.next_action.trim();
      if (createForm.next_follow_up_date) {
        payload.next_follow_up_date = new Date(createForm.next_follow_up_date).toISOString();
      }
      if (createForm.description?.trim()) payload.description = createForm.description.trim();
      if (createForm.expected_value) payload.expected_value = Number(createForm.expected_value);
      if (createForm.expected_close_date) payload.expected_close_date = createForm.expected_close_date;

      await api.post("/leads", payload);
      toast.success("Lead created successfully");
      setIsCreateOpen(false);
      loadLeads();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to create lead");
    }
  };

  // Open Quick Follow-up modal
  const handleOpenFollowUp = (lead: Lead) => {
    setFollowUpLead(lead);
    setFollowUpForm({
      next_action: lead.next_action || "",
      next_follow_up_date: lead.next_follow_up_date
        ? new Date(lead.next_follow_up_date).toISOString().slice(0, 16)
        : "",
    });
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpLead) return;

    try {
      await api.put(`/leads/${followUpLead.id}`, {
        next_action: followUpForm.next_action.trim() || null,
        next_follow_up_date: followUpForm.next_follow_up_date
          ? new Date(followUpForm.next_follow_up_date).toISOString()
          : null,
      });
      toast.success("Follow-up schedule updated");
      setFollowUpLead(null);
      loadLeads();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to update follow-up");
    }
  };

  // Open Convert to Deal modal
  const handleOpenConvert = (lead: Lead) => {
    setConvertingLead(lead);
    setConvertForm({
      opportunity_title: `${lead.title} - Deal`,
      value: lead.expected_value || 0,
      pipeline_id: "",
      expected_close_date: lead.expected_close_date || "",
    });
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;

    try {
      const payload: Record<string, any> = {
        opportunity_title: convertForm.opportunity_title,
        value: convertForm.value,
      };
      if (convertForm.pipeline_id) {
        payload.pipeline_id = convertForm.pipeline_id;
      }
      if (convertForm.expected_close_date) {
        payload.expected_close_date = convertForm.expected_close_date;
      }

      const res = await api.post<any>(`/leads/${convertingLead.id}/convert`, payload);
      toast.success("Lead converted to active sales deal!");
      setConvertingLead(null);
      loadLeads();
    } catch (err: any) {
      toast.error(err?.detail || "Lead conversion failed");
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      loadLeads();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to update status");
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab === "mine") params.set("scope", "mine");
      else if (activeTab === "today_follow_ups") params.set("scope", "today_follow_ups");
      else if (activeTab === "overdue_follow_ups") params.set("scope", "overdue_follow_ups");
      else if (activeTab === "unassigned") params.set("unassigned", "true");

      if (segmentFilter) params.set("segment", segmentFilter);
      if (sourceFilter) params.set("source_id", sourceFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (ownerFilter) params.set("owner_id", ownerFilter);
      if (search.trim()) params.set("search", search.trim());

      const token = typeof window !== "undefined" ? (sessionStorage.getItem("crm_access_token") || localStorage.getItem("crm_access_token")) : null;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${API_BASE}/leads/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to export leads");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Leads exported successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export leads");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = typeof window !== "undefined" ? (sessionStorage.getItem("crm_access_token") || localStorage.getItem("crm_access_token")) : null;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${API_BASE}/leads/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leads_template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Failed to download template");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a valid CSV file");
      return;
    }
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || "";
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, 6);
      const parsed = lines.map((l) => l.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim()));
      setImportPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Please choose a CSV file to import");
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append("file", importFile);

      const token = typeof window !== "undefined" ? (sessionStorage.getItem("crm_access_token") || localStorage.getItem("crm_access_token")) : null;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${API_BASE}/leads/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to import leads");
      }

      setImportResult(data);
      if (data.imported > 0) {
        toast.success(`Import complete: ${data.imported} leads added successfully`);
        loadLeads();
      } else {
        toast.error("No new leads were imported. Check report below.");
      }
    } catch (err: any) {
      toast.error(err?.message || "CSV import failed");
    } finally {
      setIsImporting(false);
    }
  };

  // Segment badge color
  const getSegmentBadge = (segment?: string | null) => {
    if (!segment) return <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>;
    switch (segment) {
      case "EdTech":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            EdTech
          </span>
        );
      case "IT Services":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            IT Services
          </span>
        );
      case "Talent":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Talent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {segment}
          </span>
        );
    }
  };

  // Empty state title & description based on active tab
  const getEmptyStateContent = () => {
    if (search || segmentFilter || sourceFilter || statusFilter || priorityFilter || ownerFilter) {
      return {
        title: "No leads match your filter criteria",
        description: "Try adjusting or clearing your search and filters to view more leads.",
      };
    }
    switch (activeTab) {
      case "today_follow_ups":
        return {
          title: "No follow-ups due today",
          description: "All scheduled follow-ups for today are clear or none have been assigned for today.",
        };
      case "overdue_follow_ups":
        return {
          title: "No overdue follow-ups",
          description: "Great job! There are no pending follow-up actions past their scheduled time.",
        };
      case "mine":
        return {
          title: "You have no assigned leads",
          description: "Leads assigned directly to your account will appear here.",
        };
      case "unassigned":
        return {
          title: "No unassigned leads",
          description: "All current leads in the pipeline have an assigned owner.",
        };
      default:
        return {
          title: "No leads found",
          description: "Start by creating a lead or importing prospective clients into your CRM.",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Leads & Follow-Ups
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Capture prospective clients, enforce follow-up actions, and convert into active business deals.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
            title="Export filtered leads to CSV"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500 dark:text-slate-400" />
            Export CSV
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
            title="Download CSV template for import"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-slate-500 dark:text-slate-400" />
            Download Template
          </button>
          {hasPermission("crm.leads.create") && (
            <button
              onClick={() => {
                setIsImportOpen(true);
                setImportResult(null);
                setImportFile(null);
                setImportPreview([]);
              }}
              className="inline-flex items-center px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
              title="Import leads from CSV file"
            >
              <Upload className="w-4 h-4 mr-1.5 text-slate-500 dark:text-slate-400" />
              Import CSV
            </button>
          )}
          {hasPermission("crm.leads.create") && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Lead
            </button>
          )}
        </div>
      </div>

      {/* Primary Scope Tabs (Part 1) */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px" aria-label="Lead Scopes">
          {[
            { id: "all", label: "All Leads" },
            { id: "mine", label: "My Leads" },
            { id: "today_follow_ups", label: "Today's Follow-Ups" },
            { id: "overdue_follow_ups", label: "Overdue Follow-Ups" },
            { id: "unassigned", label: "Unassigned" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ViewScope)}
              className={`py-2.5 px-3 sm:px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              {tab.label}
              {tab.id === "today_follow_ups" && (
                <span className="ml-1.5 px-1.5 py-0.5 text-3xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  Due
                </span>
              )}
              {tab.id === "overdue_follow_ups" && (
                <span className="ml-1.5 px-1.5 py-0.5 text-3xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                  Alert
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters & Search Bar (Parts 3 & 4) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search leads by contact, company, title, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="ml-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Business Segment Filter */}
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
            >
              <option value="">All Segments</option>
              <option value="EdTech">EdTech</option>
              <option value="IT Services">IT Services</option>
              <option value="Talent">Talent</option>
            </select>

            {/* Lead Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Unqualified">Unqualified</option>
              <option value="Converted">Converted</option>
              <option value="Lost">Lost</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>

            {/* Owner Filter */}
            {users.length > 0 && (
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
              >
                <option value="">All Owners</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            )}

            {(segmentFilter || sourceFilter || statusFilter || priorityFilter || ownerFilter || search) && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table (Part 2) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading leads...</div>
        ) : leads.length === 0 ? (
          <EmptyState
            title={getEmptyStateContent().title}
            description={getEmptyStateContent().description}
            actionLabel={hasPermission("crm.leads.create") ? "Create Lead" : undefined}
            onAction={hasPermission("crm.leads.create") ? handleOpenCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contact / Prospect</th>
                  <th className="py-3 px-4">Company / Org</th>
                  <th className="py-3 px-4">Segment</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Next Action</th>
                  <th className="py-3 px-4">Next Follow-Up</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leads.map((lead) => {
                  const followUp = getFollowUpStatus(
                    lead.next_follow_up_date,
                    lead.status === "Converted" || lead.status === "Lost"
                  );
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Contact / Prospect */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center group"
                        >
                          <span>{lead.contact_name || lead.title}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ml-1" />
                        </Link>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 space-y-0.5">
                          {lead.contact_name && (
                            <div className="text-slate-400 dark:text-slate-500 truncate max-w-xs">{lead.title}</div>
                          )}
                          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                            {lead.contact_email && <span>{lead.contact_email}</span>}
                            {lead.contact_phone && <span>{lead.contact_phone}</span>}
                          </div>
                        </div>
                      </td>

                      {/* 2. Company / Account */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {lead.company_id ? (
                          <Link
                            href={`/companies/${lead.company_id}`}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                          >
                            <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                            {lead.company_name || lead.college_name || "View Organization"}
                          </Link>
                        ) : lead.company_name ? (
                          <div className="flex items-center text-slate-800 dark:text-slate-200">
                            <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                            {lead.company_name}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Direct / Individual</span>
                        )}
                      </td>

                      {/* 3. Business Segment */}
                      <td className="py-3.5 px-4">{getSegmentBadge(lead.business_segment)}</td>

                      {/* 4. Lead Source */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {lead.source_name || <span className="text-slate-400 dark:text-slate-500">—</span>}
                      </td>

                      {/* 5. Owner */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {lead.owner_name || <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>}
                      </td>

                      {/* 6. Next Action */}
                      <td className="py-3.5 px-4 text-xs text-slate-800 dark:text-slate-200 max-w-xs">
                        {lead.next_action ? (
                          <span className="line-clamp-2">{lead.next_action}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-2xs">No action set</span>
                        )}
                      </td>

                      {/* 7. Next Follow-Up */}
                      <td className="py-3.5 px-4 text-xs">
                        <span className={followUp.className}>{followUp.label}</span>
                      </td>

                      {/* 8. Status */}
                      <td className="py-3.5 px-4">
                        {lead.status === "Converted" ? (
                          <span className="inline-flex items-center text-2xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Converted
                          </span>
                        ) : (
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            disabled={!hasPermission("crm.leads.edit")}
                            className="text-2xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-300"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Unqualified">Unqualified</option>
                            <option value="Lost">Lost</option>
                          </select>
                        )}
                      </td>

                      {/* 9. Priority */}
                      <td className="py-3.5 px-4">
                        <Badge variant="status" status={lead.priority}>
                          {lead.priority}
                        </Badge>
                      </td>

                      {/* 10. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {hasPermission("crm.leads.edit") && (
                            <button
                              onClick={() => handleOpenFollowUp(lead)}
                              title="Update Follow-up"
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {lead.status !== "Converted" && hasPermission("crm.leads.edit") && (
                            <button
                              onClick={() => handleOpenConvert(lead)}
                              className="inline-flex items-center px-2 py-1 text-2xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md border border-indigo-200 dark:border-indigo-800 transition-colors"
                            >
                              <Sparkles className="w-3 h-3 mr-1 text-indigo-600 dark:text-indigo-400" />
                              Convert
                            </button>
                          )}
                          <Link
                            href={`/leads/${lead.id}`}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-md transition-colors"
                            title="View Lead Details"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Lead Modal (Part 5) */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Inbound / Outbound Lead">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm max-h-[80vh] overflow-y-auto pr-1">
          {/* Section 1: Prospect Information */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Prospect Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={createForm.contact_name}
                  onChange={(e) => setCreateForm({ ...createForm, contact_name: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={createForm.contact_email}
                  onChange={(e) => setCreateForm({ ...createForm, contact_email: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={createForm.contact_phone}
                  onChange={(e) => setCreateForm({ ...createForm, contact_phone: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Company / Account & Business Segment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Organization</label>
              <input
                type="text"
                placeholder="e.g. Apex Tech Corp"
                value={createForm.company_name}
                onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Segment</label>
              <select
                value={createForm.business_segment}
                onChange={(e) => setCreateForm({ ...createForm, business_segment: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="">Select Segment (or None)</option>
                <option value="EdTech">EdTech</option>
                <option value="IT Services">IT Services</option>
                <option value="Talent">Talent</option>
              </select>
            </div>
          </div>

          {/* Section 3: Lead Title & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lead Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Campus Cloud Suite & ERP Migration"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lead Source</label>
              <select
                value={createForm.source_id}
                onChange={(e) => setCreateForm({ ...createForm, source_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="">Select Source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 4: Follow-up Action & Date */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Initial Follow-Up Schedule
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-indigo-900 dark:text-indigo-300 mb-1">Next Action</label>
                <input
                  type="text"
                  placeholder="e.g. Send discovery questionnaire"
                  value={createForm.next_action}
                  onChange={(e) => setCreateForm({ ...createForm, next_action: e.target.value })}
                  className="w-full border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-indigo-900 dark:text-indigo-300 mb-1">Next Follow-Up Date & Time</label>
                <input
                  type="datetime-local"
                  value={createForm.next_follow_up_date}
                  onChange={(e) => setCreateForm({ ...createForm, next_follow_up_date: e.target.value })}
                  className="w-full border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Ownership, Priority, Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Owner</label>
              <select
                value={createForm.owner_id}
                onChange={(e) => setCreateForm({ ...createForm, owner_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="">Leave Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
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
                value={createForm.expected_value}
                onChange={(e) => setCreateForm({ ...createForm, expected_value: Number(e.target.value) })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              placeholder="Key prospect details, initial requirements, or referral notes..."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save Lead
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Follow-Up Modal (Part 8) */}
      <Modal
        isOpen={!!followUpLead}
        onClose={() => setFollowUpLead(null)}
        title={`Update Follow-Up: ${followUpLead?.contact_name || followUpLead?.title}`}
      >
        <form onSubmit={handleFollowUpSubmit} className="space-y-4 text-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Rapidly schedule next touchpoint and actionable step for this prospect.
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Next Action *</label>
            <input
              type="text"
              required
              placeholder="e.g. Call client to discuss proposal & pricing"
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
              onClick={() => setFollowUpLead(null)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Save Follow-Up
            </button>
          </div>
        </form>
      </Modal>

      {/* Convert to Deal Modal (Part 10) */}
      <Modal
        isOpen={!!convertingLead}
        onClose={() => setConvertingLead(null)}
        title="Convert Lead to Sales Deal"
      >
        <form onSubmit={handleConvertSubmit} className="space-y-4 text-sm">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <p>
              Converting this lead will mark it as <strong>Qualified</strong> and generate an active deal in the
              sales pipeline.
            </p>
            {convertingLead?.business_segment && (
              <p className="text-2xs text-indigo-700 dark:text-indigo-300 font-semibold">
                Automatic routing: Business segment{" "}
                <span className="underline">{convertingLead.business_segment}</span> will route to its dedicated
                founder pipeline and initial stage.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Opportunity / Deal Title *</label>
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
              onClick={() => setConvertingLead(null)}
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

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Leads from CSV"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Instructions & Template Download */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">CSV Template & Guidelines</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download Blank Template
              </button>
            </div>
            <p>
              Upload a UTF-8 encoded CSV file. Recognized business segments: <strong className="text-slate-800 dark:text-slate-100">EdTech</strong>, <strong className="text-slate-800 dark:text-slate-100">IT Services</strong>, <strong className="text-slate-800 dark:text-slate-100">Talent</strong>, or <strong className="text-slate-800 dark:text-slate-100">Higher Education</strong>.
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              * Duplicates matching existing emails or phone numbers are safely skipped without overwriting. Matching company names are linked to existing accounts; otherwise the company name text is preserved without creating clutter accounts.
            </p>
          </div>

          {/* File Selector */}
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900 cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg p-1"
              />
            </div>

            {/* Preview table (up to 5 rows) */}
            {importPreview.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-2xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  File Preview (First 5 Rows)
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-2xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr>
                        {importPreview[0].map((col, idx) => (
                          <th key={idx} className="px-2.5 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {importPreview.slice(1).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results Summary */}
            {importResult && (
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Import Results</span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400">Processed {importResult.total_rows} rows</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported}</div>
                    <div className="text-2xs font-semibold text-emerald-800 dark:text-emerald-300">Imported</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{importResult.duplicates}</div>
                    <div className="text-2xs font-semibold text-amber-800 dark:text-amber-300">Duplicates Skipped</div>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-rose-700 dark:text-rose-400">{importResult.validation_errors}</div>
                    <div className="text-2xs font-semibold text-rose-800 dark:text-rose-300">Validation Errors</div>
                  </div>
                </div>

                {importResult.row_errors && importResult.row_errors.length > 0 && (
                  <div className="mt-2 text-2xs space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">Detailed Messages:</div>
                    <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1 text-slate-600 dark:text-slate-300">
                      {importResult.row_errors.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {importResult ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={!importFile || isImporting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center"
              >
                {isImporting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Start Import
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
