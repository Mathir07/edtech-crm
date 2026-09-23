"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Square,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Plus,
  Search,
  Filter,
  X,
  User,
  Building2,
  Target,
  TrendingUp,
  Briefcase,
  AlertCircle,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Tag,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  assigned_to_id?: string | null;
  priority: "Low" | "Medium" | "High" | "Urgent" | string;
  status: "Pending" | "In Progress" | "Completed" | "Cancelled" | string;
  due_date?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  assigned_to_name?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string;
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

type TaskScope = "all" | "open" | "today" | "overdue" | "mine" | "completed";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scope Tabs
  const [activeScope, setActiveScope] = useState<TaskScope>("all");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // Create Task Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    status: "Pending",
    due_date: "",
    assigned_to_id: "",
    related_entity_type: "company",
    related_entity_id: "",
  });

  const { hasPermission, user: currentUser } = useAuth();
  const toast = useToast();

  // Load auxiliary data (users, companies) once
  useEffect(() => {
    const loadAuxData = async () => {
      try {
        const [usersData, companiesData] = await Promise.all([
          api.get<UserOption[]>("/users").catch(() => []),
          api.get<CompanyOption[]>("/companies").catch(() => []),
        ]);
        setUsers(usersData || []);
        setCompanies(companiesData || []);
      } catch (err) {
        console.error("Failed to load task metadata", err);
      }
    };
    loadAuxData();
  }, []);

  // Fetch tasks with active scope and filters
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();

      // Handle scope
      if (activeScope === "today") {
        params.append("scope", "today");
      } else if (activeScope === "overdue") {
        params.append("scope", "overdue");
      } else if (activeScope === "mine") {
        params.append("scope", "mine");
      } else if (activeScope === "open") {
        params.append("scope", "open");
      } else if (activeScope === "completed") {
        params.append("status", "Completed");
      }

      // Explicit filters override or complement scope
      if (statusFilter && activeScope !== "completed") {
        params.append("status", statusFilter);
      }
      if (priorityFilter) {
        params.append("priority", priorityFilter);
      }
      if (assigneeFilter) {
        params.append("assigned_to_id", assigneeFilter);
      }
      if (search.trim()) {
        params.append("search", search.trim());
      }

      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await api.get<TaskItem[]>(`/tasks${qs}`);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load tasks", err);
      setError(err?.detail || "Failed to load tasks from server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeScope, statusFilter, priorityFilter, assigneeFilter, search]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks();
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setAssigneeFilter("");
    setActiveScope("all");
  };

  // Create Task Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const payload: Record<string, any> = {
        title: taskForm.title.trim(),
        priority: taskForm.priority,
        status: taskForm.status,
      };

      if (taskForm.description.trim()) {
        payload.description = taskForm.description.trim();
      }
      if (taskForm.due_date) {
        payload.due_date = new Date(taskForm.due_date).toISOString();
      }
      if (taskForm.assigned_to_id) {
        payload.assigned_to_id = taskForm.assigned_to_id;
      }
      if (taskForm.related_entity_type && taskForm.related_entity_id) {
        payload.related_entity_type = taskForm.related_entity_type;
        payload.related_entity_id = taskForm.related_entity_id;
      }

      await api.post("/tasks", payload);
      toast.success(`Task "${taskForm.title}" created successfully`);
      setIsCreateOpen(false);
      setTaskForm({
        title: "",
        description: "",
        priority: "Medium",
        status: "Pending",
        due_date: "",
        assigned_to_id: currentUser?.id || "",
        related_entity_type: "company",
        related_entity_id: "",
      });
      loadTasks();
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Task Completion (Complete / Reopen)
  const handleToggleStatus = async (task: TaskItem) => {
    const isCompleted = task.status === "Completed";
    const newStatus = isCompleted ? "Pending" : "Completed";

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      await api.patch(`/tasks/${task.id}/status`, { status: newStatus });
      toast.success(isCompleted ? "Task reopened" : "Task marked as completed");
    } catch (err: any) {
      if (err?.status !== 404) {
        toast.error(err?.detail || "Failed to update task status");
        // Revert on real failure
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
      } else {
        // Fallback for activity task optimistic status
        toast.success(isCompleted ? "Task reopened" : "Task marked as completed");
      }
    }
  };

  // Task Stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let total = tasks.length;
    let pending = 0;
    let completed = 0;
    let overdue = 0;
    let dueToday = 0;

    tasks.forEach((t) => {
      if (t.status === "Completed") {
        completed++;
      } else {
        pending++;
        if (t.due_date) {
          const dueDate = new Date(t.due_date);
          const dueStr = dueDate.toISOString().slice(0, 10);
          if (dueDate < now && t.status !== "Cancelled") {
            overdue++;
          }
          if (dueStr === todayStr) {
            dueToday++;
          }
        }
      }
    });

    return { total, pending, completed, overdue, dueToday };
  }, [tasks]);

  // Priority Badge Helper
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Urgent
          </span>
        );
      case "High":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            High
          </span>
        );
      case "Medium":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Medium
          </span>
        );
      case "Low":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Low
          </span>
        );
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
            Completed
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Clock className="w-3 h-3 mr-1 text-indigo-600 dark:text-indigo-400" />
            In Progress
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Cancelled
          </span>
        );
      case "Pending":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pending
          </span>
        );
    }
  };

  // Due Date Formatter & Indicator
  const renderDueDate = (dueDateStr?: string | null, status?: string) => {
    if (!dueDateStr) {
      return <span className="text-slate-400 dark:text-slate-500 text-xs italic">No due date</span>;
    }

    const d = new Date(dueDateStr);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const isOverdue = d < now && status !== "Completed" && status !== "Cancelled";

    if (isOverdue) {
      return (
        <span className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
          Overdue: {formatDate(dueDateStr)}
        </span>
      );
    }

    if (isToday) {
      return (
        <span className="inline-flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5 mr-1 shrink-0" />
          Due Today
        </span>
      );
    }

    return (
      <span className="inline-flex items-center text-xs text-slate-600 dark:text-slate-300">
        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500 shrink-0" />
        {formatDate(dueDateStr)}
      </span>
    );
  };

  // Entity Type Icon & Label Helper
  const renderRelatedEntity = (entityType?: string | null, entityId?: string | null) => {
    if (!entityType || !entityId) return null;
    const t = entityType.toLowerCase();

    let icon = <Building2 className="w-3 h-3 text-slate-500 mr-1" />;
    let label = "Account";

    if (t === "lead") {
      icon = <Target className="w-3 h-3 text-cyan-600 dark:text-cyan-400 mr-1" />;
      label = "Lead";
    } else if (t === "contact") {
      icon = <User className="w-3 h-3 text-blue-600 dark:text-blue-400 mr-1" />;
      label = "Contact";
    } else if (t === "opportunity" || t === "deal") {
      icon = <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1" />;
      label = "Deal";
    } else if (t === "project") {
      icon = <Briefcase className="w-3 h-3 text-indigo-600 dark:text-indigo-400 mr-1" />;
      label = "Project";
    }

    // Match company name if company
    const matchedCompany = companies.find((c) => c.id === entityId);
    const displayContext = matchedCompany ? matchedCompany.organization_name : `${label} Context`;

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 max-w-[180px] truncate" title={`${label}: ${entityId}`}>
        {icon}
        <span className="truncate">{displayContext}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Tasks Management
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Track, prioritize, and manage sales follow-ups, client deliverables, and team assignments across all CRM accounts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setRefreshing(true);
              loadTasks();
            }}
            disabled={loading || refreshing}
            className="inline-flex items-center px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh tasks list"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setTaskForm({
                title: "",
                description: "",
                priority: "Medium",
                status: "Pending",
                due_date: "",
                assigned_to_id: currentUser?.id || (users[0]?.id ?? ""),
                related_entity_type: "company",
                related_entity_id: companies[0]?.id || "",
              });
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Task
          </button>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tasks</span>
            <CheckSquare className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.total}</div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">{stats.pending} pending / open</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Due Today</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.dueToday}</div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">Urgent attention today</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.overdue}</div>
          <div className="text-2xs text-rose-500/80 mt-0.5">Requires immediate follow-up</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.completed}</div>
          <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">Tasks resolved</div>
        </div>
      </div>

      {/* Scope Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px" aria-label="Task Scopes">
          {[
            { id: "all", label: "All Tasks" },
            { id: "open", label: "Open Tasks" },
            { id: "today", label: "Due Today" },
            { id: "overdue", label: "Overdue" },
            { id: "mine", label: "Assigned to Me" },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveScope(tab.id as TaskScope)}
              className={`py-2.5 px-3 sm:px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeScope === tab.id
                  ? "border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              {tab.label}
              {tab.id === "today" && stats.dueToday > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 text-3xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  {stats.dueToday}
                </span>
              )}
              {tab.id === "overdue" && stats.overdue > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 text-3xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                  {stats.overdue}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tasks by title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    loadTasks();
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="ml-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            {activeScope !== "completed" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            )}

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950"
            >
              <option value="">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 max-w-[180px]"
            >
              <option value="">All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>

            {(search || statusFilter || priorityFilter || assigneeFilter || activeScope !== "all") && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl p-4 flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadTasks}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Task List / Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading enterprise tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description={
            search || statusFilter || priorityFilter || assigneeFilter || activeScope !== "all"
              ? "No tasks match your active filter criteria. Try clearing search or switching views."
              : "No tasks have been scheduled yet. Create your first task to start organizing team deliverables."
          }
          actionLabel="Create Task"
          onAction={() => setIsCreateOpen(true)}
          icon={<CheckSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Done
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Task Details
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Priority
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Due Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Assignee
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Context
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                {tasks.map((task) => {
                  const isCompleted = task.status === "Completed";
                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isCompleted ? "opacity-75 bg-slate-50/40 dark:bg-slate-950/20" : ""
                      }`}
                    >
                      {/* Checkbox / Toggle Button */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(task)}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center justify-center p-1 rounded-md"
                          title={isCompleted ? "Mark as Pending / Reopen" : "Mark as Completed"}
                        >
                          {isCompleted ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400 dark:text-slate-500 hover:text-indigo-600" />
                          )}
                        </button>
                      </td>

                      {/* Title & Description */}
                      <td className="px-4 py-3.5 max-w-sm">
                        <div className="font-semibold text-xs md:text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
                          <span className={isCompleted ? "line-through text-slate-400 dark:text-slate-500" : ""}>
                            {task.title}
                          </span>
                        </div>
                        {task.description && (
                          <div className="text-2xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {task.description}
                          </div>
                        )}
                        <div className="text-3xs text-slate-400 dark:text-slate-500 mt-1">
                          Created {formatDate(task.created_at)}
                          {task.created_by_name && ` by ${task.created_by_name}`}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getPriorityBadge(task.priority)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(task.status)}
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderDueDate(task.due_date, task.status)}
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {task.assigned_to_name ? (
                          <div className="flex items-center space-x-1.5">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-3xs flex items-center justify-center shrink-0">
                              {task.assigned_to_name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {task.assigned_to_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xs text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Context / Linked Entity */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderRelatedEntity(task.related_entity_type, task.related_entity_id)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(task)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-semibold transition-colors ${
                            isCompleted
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800/60"
                          }`}
                        >
                          {isCompleted ? (
                            <>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Reopen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Complete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Task"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Prepare proposal for cloud migration audit"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Key deliverables, meeting context, or follow-up details..."
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={taskForm.status}
                onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>
          </div>

          {/* Due Date & Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={taskForm.due_date}
                onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assignee
              </label>
              <select
                value={taskForm.assigned_to_id}
                onChange={(e) => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">Select Assignee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linked Account / Entity Context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Related Entity Type
              </label>
              <select
                value={taskForm.related_entity_type}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    related_entity_type: e.target.value,
                    related_entity_id: e.target.value === "company" ? (companies[0]?.id || "") : "",
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="company">Company / Account</option>
                <option value="lead">Lead</option>
                <option value="contact">Contact</option>
                <option value="opportunity">Deal / Opportunity</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Account
              </label>
              {taskForm.related_entity_type === "company" ? (
                <select
                  value={taskForm.related_entity_id}
                  onChange={(e) => setTaskForm({ ...taskForm, related_entity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="">Select Account...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.organization_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter related record ID..."
                  value={taskForm.related_entity_id}
                  onChange={(e) => setTaskForm({ ...taskForm, related_entity_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
                />
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center"
            >
              {submitting ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
