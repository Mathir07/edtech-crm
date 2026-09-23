"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bug,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  ArrowRight,
  FolderGit2,
  Users,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";

interface BugItem {
  id: string;
  bug_number: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  severity: string;
  priority: string;
  status: string;
  assigned_to_name: string | null;
  reported_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectOption {
  id: string;
  name: string;
  project_number: string;
}

interface UserOption {
  id: string;
  first_name: string;
  last_name: string;
}

export default function BugsListPage() {
  const { hasPermission } = useAuth();
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");

  // Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    project_id: "",
    title: "",
    description: "",
    severity: "HIGH",
    priority: "HIGH",
    environment: "Staging",
    steps_to_reproduce: "",
    expected_result: "",
    actual_result: "",
    assigned_to_id: "",
  });

  useEffect(() => {
    loadProjectsAndUsers();
  }, []);

  useEffect(() => {
    loadBugs();
  }, [search, statusFilter, severityFilter, projectFilter]);

  const loadProjectsAndUsers = async () => {
    try {
      const [projData, userData] = await Promise.all([
        api.get<ProjectOption[]>("/projects"),
        api.get<UserOption[]>("/users"),
      ]);
      setProjects(projData);
      setUsers(userData);
      if (projData.length > 0 && !createForm.project_id) {
        setCreateForm((prev) => ({ ...prev, project_id: projData[0].id }));
      }
    } catch (err) {
      console.error("Failed to load options", err);
    }
  };

  const loadBugs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (severityFilter !== "ALL") params.append("severity", severityFilter);
      if (projectFilter !== "ALL") params.append("project_id", projectFilter);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await api.get<BugItem[]>(`/bugs${qs}`);
      setBugs(data);
    } catch (err) {
      console.error("Failed to load bugs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setErrorMessage(null);
    try {
      await api.post(`/projects/${createForm.project_id}/bugs`, {
        title: createForm.title,
        description: createForm.description || null,
        severity: createForm.severity,
        priority: createForm.priority,
        environment: createForm.environment || null,
        steps_to_reproduce: createForm.steps_to_reproduce || null,
        expected_result: createForm.expected_result || null,
        actual_result: createForm.actual_result || null,
        assigned_to_id: createForm.assigned_to_id || null,
      });
      setIsCreateOpen(false);
      setCreateForm({
        project_id: projects[0]?.id || "",
        title: "",
        description: "",
        severity: "HIGH",
        priority: "HIGH",
        environment: "Staging",
        steps_to_reproduce: "",
        expected_result: "",
        actual_result: "",
        assigned_to_id: "",
      });
      loadBugs();
    } catch (err: any) {
      setErrorMessage(err.detail || "Failed to create bug");
    } finally {
      setCreateLoading(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      CRITICAL: { bg: "bg-red-100 text-red-800 border-red-200", text: "CRITICAL" },
      HIGH: { bg: "bg-orange-100 text-orange-800 border-orange-200", text: "HIGH" },
      MEDIUM: { bg: "bg-yellow-100 text-yellow-800 border-yellow-200", text: "MEDIUM" },
      LOW: { bg: "bg-slate-100 text-slate-700 border-slate-200", text: "LOW" },
    };
    const c = config[sev] || { bg: "bg-slate-100 text-slate-700 border-slate-200", text: sev };
    return <span className={`px-2 py-0.5 rounded text-3xs font-extrabold border ${c.bg}`}>{c.text}</span>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      OPEN: { bg: "bg-rose-50 text-rose-700 border-rose-200", text: "OPEN" },
      ASSIGNED: { bg: "bg-blue-50 text-blue-700 border-blue-200", text: "ASSIGNED" },
      IN_PROGRESS: { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "IN PROGRESS" },
      RESOLVED: { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", text: "RESOLVED" },
      RETEST: { bg: "bg-purple-50 text-purple-700 border-purple-200", text: "RETEST" },
      CLOSED: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "CLOSED" },
      REOPENED: { bg: "bg-red-50 text-red-700 border-red-200", text: "REOPENED" },
      WONT_FIX: { bg: "bg-slate-50 text-slate-600 border-slate-200", text: "WONT FIX" },
    };
    const c = config[status] || { bg: "bg-slate-50 text-slate-600 border-slate-200", text: status };
    return <span className={`px-2.5 py-1 rounded-full text-2xs font-bold border ${c.bg}`}>{c.text}</span>;
  };

  // Stats
  const totalBugs = bugs.length;
  const criticalBugs = bugs.filter((b) => b.severity === "CRITICAL" && b.status !== "CLOSED").length;
  const openBugs = bugs.filter((b) => b.status === "OPEN" || b.status === "ASSIGNED").length;
  const inProgressBugs = bugs.filter((b) => b.status === "IN_PROGRESS").length;
  const retestBugs = bugs.filter((b) => b.status === "RESOLVED" || b.status === "RETEST").length;
  const closedBugs = bugs.filter((b) => b.status === "CLOSED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Defect & Bug Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Bug Tracker
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track defects across institutional deployments with strict QA verification gating.
          </p>
        </div>

        <div>
          {hasPermission("bugs.create") && (
            <button
              onClick={() => setIsCreateOpen(true)}
              disabled={projects.length === 0}
              className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Report New Bug
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Bugs</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalBugs}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20 shadow-2xs">
          <span className="text-xs font-medium text-red-700 dark:text-red-400">Critical / Blocker</span>
          <div className="mt-2 text-2xl font-bold text-red-900 dark:text-red-300">{criticalBugs}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/20 shadow-2xs">
          <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Open / Assigned</span>
          <div className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-300">{openBugs}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/20 shadow-2xs">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">In Development</span>
          <div className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-300">{inProgressBugs}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 shadow-2xs">
          <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Pending Retest</span>
          <div className="mt-2 text-2xl font-bold text-purple-900 dark:text-purple-300">{retestBugs}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-2xs">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Closed / Verified</span>
          <div className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-300">{closedBugs}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search bugs by title or BUG- number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-none"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_number} — {p.name}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 font-semibold focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
          {[
            { id: "ALL", label: "All Statuses" },
            { id: "OPEN", label: "Open" },
            { id: "IN_PROGRESS", label: "In Progress" },
            { id: "RESOLVED", label: "Resolved" },
            { id: "RETEST", label: "Retest" },
            { id: "CLOSED", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bugs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading bugs...</div>
        ) : bugs.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Defects Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Zero open issues matching your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-2xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Bug Ref</th>
                  <th className="px-5 py-3">Title & Project</th>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assignee</th>
                  <th className="px-5 py-3">Reported By</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bugs.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                      <Link href={`/bugs/${b.id}`} className="hover:underline">
                        {b.bug_number}
                      </Link>
                    </td>

                    <td className="px-5 py-4">
                      <Link href={`/bugs/${b.id}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 line-clamp-1">
                        {b.title}
                      </Link>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        <FolderGit2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <Link href={`/projects/${b.project_id}`} className="hover:underline text-slate-600 dark:text-slate-300">
                          {b.project_name || "Project"}
                        </Link>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {getSeverityBadge(b.severity)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(b.status)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                      {b.assigned_to_name || "Unassigned"}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {b.reported_by_name || "QA Engineer"}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
                      <Link
                        href={`/bugs/${b.id}`}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-xs inline-flex items-center space-x-1 transition-colors"
                      >
                        <span>View Bug</span>
                        <ArrowRight className="w-3 h-3 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Bug Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Report New Bug / Issue" maxWidth="lg">
        <form onSubmit={handleCreateBug} className="space-y-4 text-sm">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Project *</label>
            <select
              required
              value={createForm.project_id}
              onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:border-rose-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_number} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bug Summary / Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. 500 error when uploading student roster with duplicate roll numbers"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Severity *</label>
              <select
                value={createForm.severity}
                onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-bold focus:outline-none focus:border-rose-500"
              >
                <option value="CRITICAL">CRITICAL (Blocks Delivery)</option>
                <option value="HIGH">HIGH (Blocks Delivery)</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:border-rose-500"
              >
                <option value="URGENT">URGENT</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Environment</label>
              <input
                type="text"
                placeholder="e.g. Staging, Lab 04"
                value={createForm.environment}
                onChange={(e) => setCreateForm({ ...createForm, environment: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign to Developer</label>
            <select
              value={createForm.assigned_to_id}
              onChange={(e) => setCreateForm({ ...createForm, assigned_to_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:border-rose-500"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Steps to Reproduce</label>
            <textarea
              rows={3}
              placeholder="1. Navigate to Roster&#10;2. Upload CSV&#10;3. Observe crash"
              value={createForm.steps_to_reproduce}
              onChange={(e) => setCreateForm({ ...createForm, steps_to_reproduce: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Result</label>
              <input
                type="text"
                placeholder="Clear validation error"
                value={createForm.expected_result}
                onChange={(e) => setCreateForm({ ...createForm, expected_result: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Actual Result</label>
              <input
                type="text"
                placeholder="500 Internal Server Error"
                value={createForm.actual_result}
                onChange={(e) => setCreateForm({ ...createForm, actual_result: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {createLoading ? "Filing Bug..." : "File Bug"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
