"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Headphones,
  Plus,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Hourglass,
  Building2,
  Users,
  Download,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

interface TicketItem {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  severity: string;
  source: string;
  company_id: string | null;
  college_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  sla_status: string;
  first_response_due_at: string | null;
  first_responded_at: string | null;
  due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: T[];
}

interface CompanyOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  company_id: string;
}

interface CategoryOption {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
}

interface UserOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

export default function TicketsListPage() {
  const { hasPermission } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [slaFilter, setSlaFilter] = useState("ALL");
  const [companyFilter, setCollegeFilter] = useState("ALL");

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    subject: "",
    description: "",
    company_id: "",
    contact_id: "",
    category_id: "",
    subcategory_id: "",
    priority: "MEDIUM",
    severity: "MEDIUM",
    source: "PORTAL",
    project_id: "",
    assigned_to_id: "",
  });

  useEffect(() => {
    loadPrerequisites();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [search, statusFilter, priorityFilter, slaFilter, companyFilter]);

  const loadPrerequisites = async () => {
    try {
      const [colData, catData, userData, projData] = await Promise.all([
        api.get<CompanyOption[]>("/companies").catch(() => []),
        api.get<CategoryOption[]>("/service/categories").catch(() => []),
        api.get<UserOption[]>("/users").catch(() => []),
        api.get<ProjectOption[]>("/projects").catch(() => []),
      ]);
      setCompanies(colData);
      setCategories(catData);
      setUsers(userData);
      setProjects(projData);

      if (colData.length > 0) {
        // fetch contacts
        const contData = await api.get<ContactOption[]>("/contacts").catch(() => []);
        setContacts(contData);
      }
    } catch (err) {
      console.error("Failed to load prerequisites:", err);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (slaFilter !== "ALL") params.append("sla_status", slaFilter);
      if (companyFilter !== "ALL") params.append("company_id", companyFilter);

      const qs = params.toString();
      const endpoint = qs ? `/service/tickets?${qs}` : "/service/tickets";
      const data = await api.get<TicketItem[] | PaginatedResponse<TicketItem>>(endpoint);
      setTickets(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCollegeChange = (colId: string) => {
    setForm((prev) => ({
      ...prev,
      company_id: colId,
      contact_id: "", // reset contact
    }));
  };

  const handleCategoryChange = (catId: string) => {
    setForm((prev) => ({
      ...prev,
      category_id: catId,
      subcategory_id: "",
    }));
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) {
      setErrorMessage("Subject is required.");
      return;
    }
    if (!form.description.trim()) {
      setErrorMessage("Description is required.");
      return;
    }

    try {
      setCreateLoading(true);
      setErrorMessage(null);

      const payload: any = {
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        severity: form.severity,
        source: form.source,
      };

      if (form.company_id) payload.company_id = form.company_id;
      if (form.contact_id) payload.contact_id = form.contact_id;
      if (form.category_id) payload.category_id = form.category_id;
      if (form.subcategory_id) payload.subcategory_id = form.subcategory_id;
      if (form.project_id) payload.project_id = form.project_id;
      if (form.assigned_to_id) payload.assigned_to_id = form.assigned_to_id;

      await api.post("/service/tickets", payload);
      setIsCreateOpen(false);
      // Reset form
      setForm({
        subject: "",
        description: "",
        company_id: "",
        contact_id: "",
        category_id: "",
        subcategory_id: "",
        priority: "MEDIUM",
        severity: "MEDIUM",
        source: "PORTAL",
        project_id: "",
        assigned_to_id: "",
      });
      loadTickets();
    } catch (err: any) {
      console.error("Failed to create ticket:", err);
      setErrorMessage(err?.detail || "Failed to create support ticket.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExportCSV = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("crm_access_token") : "";
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const url = `${apiBase}/service/export?token=${token}`;
    window.open(url, "_blank");
  };

  const activeCount = tickets.filter((t) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status)).length;
  const breachedCount = tickets.filter((t) => t.sla_status === "BREACHED").length;
  const waitingCount = tickets.filter((t) => t.status === "WAITING_FOR_CUSTOMER").length;

  const currentCategory = categories.find((c) => c.id === form.category_id);
  const companyContacts = form.company_id
    ? contacts.filter((c) => c.company_id === form.company_id)
    : contacts;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Support Tickets</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional client inquiries, SLA compliance, response tracking, and resolutions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {hasPermission("service.reports.export") && (
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              title="Download CSV export"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}

          {hasPermission("service.tickets.create") && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Mini Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Open Tickets</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{activeCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Headphones className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Waiting on Client</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{waitingCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Hourglass className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">SLA Breached</div>
            <div className={`text-xl font-bold mt-0.5 ${breachedCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
              {breachedCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Total Shown</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{tickets.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center space-x-1 border-b border-slate-100 dark:border-slate-800 pb-3 overflow-x-auto">
          {[
            { key: "ALL", label: "All Tickets" },
            { key: "NEW", label: "New" },
            { key: "OPEN", label: "Open" },
            { key: "IN_PROGRESS", label: "In Progress" },
            { key: "WAITING_FOR_CUSTOMER", label: "Waiting Customer" },
            { key: "RESOLVED", label: "Resolved" },
            { key: "CLOSED", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.key
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search ticket #, subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* SLA Status */}
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All SLA Statuses</option>
            <option value="ON_TRACK">On Track</option>
            <option value="AT_RISK">At Risk</option>
            <option value="BREACHED">Breached</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Institutions</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-500">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <Headphones className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No tickets found.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No tickets match your filters. Try clearing your search or create a new ticket.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-3xs">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Subject & Details</th>
                  <th className="py-3 px-4">Institution / Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority & Severity</th>
                  <th className="py-3 px-4">SLA Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group">
                    {/* Ticket # */}
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      <Link href={`/service/tickets/${t.id}`} className="hover:underline">
                        {t.ticket_number}
                      </Link>
                      <div className="text-3xs text-slate-400 dark:text-slate-500 font-sans font-normal mt-0.5">
                        {formatDateTime(t.created_at)}
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="py-3 px-4 max-w-xs">
                      <Link
                        href={`/service/tickets/${t.id}`}
                        className="font-medium text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 block truncate"
                      >
                        {t.subject}
                      </Link>
                      <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center space-x-1">
                        <span>{t.category_name || "General Support"}</span>
                        <span>•</span>
                        <span className="font-mono text-3xs uppercase">{t.source}</span>
                      </div>
                    </td>

                    {/* Institution */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">
                        {t.college_name ? (
                          <Link href={`/companies/${t.company_id}`} className="hover:underline flex items-center space-x-1">
                            <Building2 className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span>{t.college_name}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Internal</span>
                        )}
                      </div>
                      {t.contact_name && (
                        <div className="text-2xs text-slate-400 dark:text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Users className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                          <span>{t.contact_name}</span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <Badge variant="status" status={t.status}>
                        {t.status.replace(/_/g, " ")}
                      </Badge>
                    </td>

                    {/* Priority & Severity */}
                    <td className="py-3 px-4 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-2xs font-semibold px-1.5 py-0.5 rounded ${
                            t.priority === "URGENT"
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold border border-rose-200/50 dark:border-rose-900/50"
                              : t.priority === "HIGH"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {t.priority}
                        </span>
                        <span className="text-3xs text-slate-400 dark:text-slate-500 uppercase font-mono">
                          {t.severity}
                        </span>
                      </div>
                    </td>

                    {/* SLA Status */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <Badge variant="status" status={t.sla_status}>
                          {t.sla_status}
                        </Badge>
                        {t.due_at && (
                          <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono">
                            Due: {formatDateTime(t.due_at)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Assignee */}
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {t.assigned_to_name ? (
                        <div className="flex items-center space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-3xs flex items-center justify-center">
                            {t.assigned_to_name.charAt(0)}
                          </div>
                          <span className="truncate max-w-[110px]">{t.assigned_to_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-2xs">Unassigned</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/service/tickets/${t.id}`}
                        className="inline-flex items-center px-2.5 py-1 text-2xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-800/60 rounded-md transition"
                      >
                        <span>View 360</span>
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Support Ticket">
        <form onSubmit={handleCreateTicket} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SIS Integration endpoint failing with 500 error"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Detailed description of the issue, symptoms, steps observed..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Account</label>
              <select
                value={form.company_id}
                onChange={(e) => handleCollegeChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Internal Issue (No Company)</option>
                {companies.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Contact */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Client Contact</label>
              <select
                value={form.contact_id}
                onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                disabled={!form.company_id}
              >
                <option value="">Select Contact...</option>
                {companyContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Category</label>
              <select
                value={form.category_id}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select Category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subcategory</label>
              <select
                value={form.subcategory_id}
                onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                disabled={!currentCategory?.subcategories?.length}
              >
                <option value="">Select Subcategory...</option>
                {currentCategory?.subcategories?.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="PORTAL">Portal</option>
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INTERNAL">Internal</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Project Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Link to Project (Optional)</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Assignee</label>
              <select
                value={form.assigned_to_id}
                onChange={(e) => setForm({ ...form, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {createLoading ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
