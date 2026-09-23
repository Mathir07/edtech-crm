"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Building2,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  FlaskConical,
  Bug,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";

interface Project {
  id: string;
  project_number: string;
  name: string;
  code: string | null;
  description: string | null;
  company_id: string;
  college_name: string | null;
  sales_order_id: string | null;
  sales_order_number: string | null;
  contract_id: string | null;
  contract_number: string | null;
  project_manager_id: string | null;
  project_manager_name: string | null;
  status: string;
  budget: number;
  planned_start_date: string | null;
  target_delivery_date: string | null;
  actual_delivery_date: string | null;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

interface UserOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function ProjectsListPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [companyFilter, setCollegeFilter] = useState("ALL");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    company_id: "",
    name: "",
    code: "",
    description: "",
    budget: 0,
    planned_start_date: "",
    target_delivery_date: "",
    project_manager_id: "",
  });

  useEffect(() => {
    loadColleges();
    loadUsers();
  }, []);

  useEffect(() => {
    loadProjects();
  }, [search, statusFilter, companyFilter]);

  const loadColleges = async () => {
    try {
      const data = await api.get<CompanyOption[]>("/companies");
      setCompanies(data);
      if (data.length > 0 && !createForm.company_id) {
        setCreateForm((prev) => ({ ...prev, company_id: data[0].id }));
      }
    } catch (err) {
      console.error("Failed to load companies", err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.get<UserOption[]>("/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (companyFilter !== "ALL") params.append("company_id", companyFilter);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await api.get<Project[]>(`/projects${qs}`);
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setErrorMessage(null);
    try {
      const payload = {
        company_id: createForm.company_id,
        name: createForm.name,
        code: createForm.code || null,
        description: createForm.description || null,
        budget: Number(createForm.budget) || 0,
        planned_start_date: createForm.planned_start_date || null,
        target_delivery_date: createForm.target_delivery_date || null,
        project_manager_id: createForm.project_manager_id || null,
      };
      await api.post("/projects", payload);
      setIsCreateOpen(false);
      setCreateForm({
        company_id: companies[0]?.id || "",
        name: "",
        code: "",
        description: "",
        budget: 0,
        planned_start_date: "",
        target_delivery_date: "",
        project_manager_id: "",
      });
      loadProjects();
    } catch (err: any) {
      setErrorMessage(err.detail || "Failed to create project");
    } finally {
      setCreateLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      PLANNED: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700", text: "Planned", icon: Clock },
      ACTIVE: { bg: "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800", text: "Active", icon: TrendingUp },
      IN_QA: { bg: "bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800", text: "In QA", icon: FlaskConical },
      READY_FOR_DELIVERY: {
        bg: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        text: "Ready for Delivery",
        icon: ShieldCheck,
      },
      DELIVERED: { bg: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800", text: "Delivered", icon: CheckCircle2 },
      COMPLETED: { bg: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800", text: "Completed", icon: CheckCircle2 },
      ON_HOLD: { bg: "bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800", text: "On Hold", icon: AlertCircle },
      CANCELLED: { bg: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800", text: "Cancelled", icon: AlertCircle },
    };
    const c = config[status] || {
      bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
      text: status,
      icon: Clock,
    };
    const Icon = c.icon;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold border ${c.bg}`}
      >
        <Icon className="w-3 h-3 mr-1" />
        {c.text}
      </span>
    );
  };

  // Quick stats
  const totalCount = projects.length;
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const inQaCount = projects.filter((p) => p.status === "IN_QA").length;
  const readyCount = projects.filter((p) => p.status === "READY_FOR_DELIVERY").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED" || p.status === "DELIVERED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Deployment Projects & Operations</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Delivery 360
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track campus onboardings, milestones, developer tasks, QA gating, and delivery sign-offs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/bugs"
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium shadow-2xs transition-colors"
          >
            <Bug className="w-4 h-4 mr-2 text-rose-500" />
            Global Bug Tracker
          </Link>
          {hasPermission("projects.create") && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Projects</span>
            <FolderGit2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</div>
          <div className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">Campus Implementations</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Active Build</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">{activeCount}</div>
          <div className="text-3xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">Development in progress</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/20 dark:bg-purple-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">In QA / UAT</span>
            <FlaskConical className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-900 dark:text-purple-200">{inQaCount}</div>
          <div className="text-3xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">Test suites executing</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Ready for Delivery</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">{readyCount}</div>
          <div className="text-3xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">QA Gating passed</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Delivered & Live</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">{completedCount}</div>
          <div className="text-3xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Onboarded successfully</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search projects by name, PRJ- number, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={companyFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Institutions</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
          {[
            { id: "ALL", label: "All Statuses" },
            { id: "PLANNED", label: "Planned" },
            { id: "ACTIVE", label: "Active" },
            { id: "IN_QA", label: "In QA" },
            { id: "READY_FOR_DELIVERY", label: "Ready for Delivery" },
            { id: "DELIVERED", label: "Delivered" },
            { id: "COMPLETED", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <FolderGit2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Projects Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No deployment projects match your active search filters. Start a project directly or confirm a Sales Order to trigger handoff.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-2xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Project Ref</th>
                  <th className="px-5 py-3">Institution & Title</th>
                  <th className="px-5 py-3">Project Manager</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Delivery Target</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <Link href={`/projects/${p.id}`} className="hover:underline">
                        {p.project_number}
                      </Link>
                      {p.code && <div className="text-3xs text-slate-400 dark:text-slate-500 font-normal">{p.code}</div>}
                    </td>

                    <td className="px-5 py-4">
                      <Link href={`/projects/${p.id}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-1">
                        {p.name}
                      </Link>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{p.college_name || "Unassigned Company"}</span>
                        {p.sales_order_number && (
                          <span className="font-mono text-3xs text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {p.sales_order_number}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{p.project_manager_name || "Unassigned PM"}</span>
                      </div>
                      {p.budget > 0 && (
                        <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          Budget: {formatCurrency(p.budget)}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(p.status)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 font-mono">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{p.target_delivery_date || "No date set"}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="w-36">
                        <div className="flex justify-between text-2xs mb-1 font-semibold">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono">{Number(p.progress_percentage).toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              p.progress_percentage >= 100
                                ? "bg-emerald-500"
                                : p.progress_percentage >= 50
                                ? "bg-indigo-600"
                                : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, p.progress_percentage))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/projects/${p.id}/qa`}
                          className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 rounded-lg text-2xs font-semibold flex items-center space-x-1 transition-colors"
                        >
                          <FlaskConical className="w-3 h-3" />
                          <span>QA Hub</span>
                        </Link>
                        <Link
                          href={`/projects/${p.id}`}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs flex items-center space-x-1 transition-colors"
                        >
                          <span>View 360</span>
                          <ArrowRight className="w-3 h-3 ml-0.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Deployment Project"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-sm">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Institution / Company *
            </label>
            <select
              required
              value={createForm.company_id}
              onChange={(e) => setCreateForm({ ...createForm, company_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ERP Implementation & LMS Cloud Sync"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Code
              </label>
              <input
                type="text"
                placeholder="e.g. PRJ-KCT-01"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Project Manager
            </label>
            <select
              value={createForm.project_manager_id}
              onChange={(e) => setCreateForm({ ...createForm, project_manager_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Project Manager (Optional)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Allocated Budget (₹)
              </label>
              <input
                type="number"
                min={0}
                value={createForm.budget}
                onChange={(e) => setCreateForm({ ...createForm, budget: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Planned Start Date
              </label>
              <input
                type="date"
                value={createForm.planned_start_date}
                onChange={(e) => setCreateForm({ ...createForm, planned_start_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Delivery Date
              </label>
              <input
                type="date"
                value={createForm.target_delivery_date}
                onChange={(e) => setCreateForm({ ...createForm, target_delivery_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Statement of Work
            </label>
            <textarea
              rows={3}
              placeholder="Scope, deployment deliverables, campus constraints..."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {createLoading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
