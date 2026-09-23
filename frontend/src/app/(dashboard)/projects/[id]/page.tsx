"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  FlaskConical,
  Bug,
  Users,
  Plus,
  ArrowLeft,
  FileText,
  Briefcase,
  ListTodo,
  CheckSquare,
  Sparkles,
  ExternalLink,
  Lock,
  Unlock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface ProjectDetail {
  id: string;
  project_number: string;
  name: string;
  code: string | null;
  description: string | null;
  company_id: string;
  company_name: string | null;
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
  milestones: Milestone[];
  tasks: ProjectTask[];
  members: ProjectMember[];
  delivery_readiness: {
    ready_for_delivery: boolean;
    reasons: string[];
    blocking_bugs_count: number;
    failed_tests_count: number;
    incomplete_tasks_count: number;
  };
  created_at: string;
  updated_at: string;
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  sequence: number;
  status: string;
  start_date: string | null;
  due_date: string | null;
  completion_percentage: number;
}

interface ProjectTask {
  id: string;
  task_number: string;
  project_id: string;
  title: string;
  description: string | null;
  milestone_id: string | null;
  milestone_name: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  status: string;
  priority: string;
  estimated_hours: number;
  actual_hours: number;
  start_date: string | null;
  due_date: string | null;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  role: string;
  assigned_at: string;
  active: boolean;
}

interface UserOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface BugItem {
  id: string;
  bug_number: string;
  title: string;
  severity: string;
  status: string;
  assigned_to_name: string | null;
  created_at: string;
}

export default function ProjectDetail360Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "milestones" | "tasks" | "bugs" | "team" | "delivery">("overview");

  // Modals
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: "", description: "", sequence: 1, due_date: "" });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    milestone_id: "",
    assigned_to_id: "",
    priority: "MEDIUM",
    estimated_hours: 0,
    due_date: "",
  });

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "DEVELOPER" });

  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    status: "DELIVERED",
    override_qa: false,
    override_reason: "",
    completion_notes: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
    loadUsers();
    loadBugs();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await api.get<ProjectDetail>(`/projects/${projectId}`);
      setProject(data);
    } catch (err) {
      console.error("Failed to load project", err);
    } finally {
      setLoading(false);
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

  const loadBugs = async () => {
    try {
      const data = await api.get<BugItem[]>(`/bugs?project_id=${projectId}`);
      setBugs(data);
    } catch (err) {
      console.error("Failed to load bugs", err);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/projects/${projectId}/milestones`, {
        name: milestoneForm.name,
        description: milestoneForm.description || null,
        sequence: Number(milestoneForm.sequence) || 1,
        due_date: milestoneForm.due_date || null,
      });
      toast.success("Milestone created successfully");
      setIsMilestoneModalOpen(false);
      setMilestoneForm({ name: "", description: "", sequence: (project?.milestones.length || 0) + 1, due_date: "" });
      loadProject();
    } catch (err: any) {
      setActionError(err.detail || "Failed to create milestone");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMilestoneStatus = async (milestoneId: string, status: string) => {
    try {
      await api.put(`/milestones/${milestoneId}`, { status });
      toast.success(`Milestone updated to ${status}`);
      loadProject();
    } catch (err: any) {
      toast.error(err.detail || "Failed to update milestone status");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: taskForm.title,
        description: taskForm.description || null,
        milestone_id: taskForm.milestone_id || null,
        assigned_to_id: taskForm.assigned_to_id || null,
        priority: taskForm.priority,
        estimated_hours: Number(taskForm.estimated_hours) || 0,
        due_date: taskForm.due_date || null,
      });
      toast.success("Task created successfully");
      setIsTaskModalOpen(false);
      setTaskForm({
        title: "",
        description: "",
        milestone_id: "",
        assigned_to_id: "",
        priority: "MEDIUM",
        estimated_hours: 0,
        due_date: "",
      });
      loadProject();
    } catch (err: any) {
      setActionError(err.detail || "Failed to create task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(`Task status updated to ${newStatus}`);
      loadProject();
    } catch (err: any) {
      toast.error(err.detail || "Failed to update task status");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/projects/${projectId}/members`, {
        user_id: memberForm.user_id,
        role: memberForm.role,
      });
      setIsMemberModalOpen(false);
      loadProject();
    } catch (err: any) {
      setActionError(err.detail || "Failed to assign member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliveryTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/projects/${projectId}/delivery`, {
        status: deliveryForm.status,
        override_qa: deliveryForm.override_qa,
        override_reason: deliveryForm.override_qa ? deliveryForm.override_reason : null,
        completion_notes: deliveryForm.completion_notes || null,
      });
      setIsDeliveryModalOpen(false);
      loadProject();
    } catch (err: any) {
      setActionError(err.detail || "Failed to execute delivery transition");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading Project 360 View...</div>;
  }

  if (!project) {
    return (
      <div className="p-12 text-center">
        <FolderGit2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Project Not Found</h3>
        <Link href="/projects" className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:underline mt-2 inline-block">
          Return to Projects
        </Link>
      </div>
    );
  }

  const completedTasksCount = project.tasks.filter((t) => t.status === "COMPLETED").length;
  const totalTasksCount = project.tasks.length;
  const completedMilestonesCount = project.milestones.filter((m) => m.status === "COMPLETED").length;
  const totalMilestonesCount = project.milestones.length;
  const isGatingPassed = project.delivery_readiness?.ready_for_delivery ?? false;

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/projects" className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center space-x-1">
              <ArrowLeft className="w-3 h-3 mr-1" />
              <span>Projects</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{project.project_number}</span>
          </div>

          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{project.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {project.status}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>{project.company_name || "Unassigned Company"}</span>
            </span>
            {project.project_manager_name && (
              <span className="flex items-center space-x-1">
                <Users className="w-3.5 h-3.5" />
                <span>PM: {project.project_manager_name}</span>
              </span>
            )}
            {project.target_delivery_date && (
              <span className="flex items-center space-x-1 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                <span>Target: {project.target_delivery_date}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Link
            href={`/projects/${project.id}/qa`}
            className="inline-flex items-center px-3.5 py-2 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-semibold shadow-2xs transition-colors"
          >
            <FlaskConical className="w-4 h-4 mr-1.5" />
            QA Testing Hub
          </Link>

          {hasPermission("delivery.manage") && (
            <button
              onClick={() => setIsDeliveryModalOpen(true)}
              className={`inline-flex items-center px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors ${
                isGatingPassed
                  ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  : "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              }`}
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Delivery & Sign-off
            </button>
          )}
        </div>
      </div>

      {/* Progress & Health Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-3">
          <div>
            <div className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Project Execution Progress
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {Number(project.progress_percentage).toFixed(1)}%
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500">Milestones: </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {completedMilestonesCount} / {totalMilestonesCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Tasks: </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {completedTasksCount} / {totalTasksCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">Open Bugs: </span>
              <span className={`font-bold ${bugs.filter(b => b.status !== "CLOSED").length > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {bugs.filter(b => b.status !== "CLOSED").length}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500">QA Gate: </span>
              <span className={`font-bold inline-flex items-center space-x-1 ${isGatingPassed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {isGatingPassed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{isGatingPassed ? "Verified" : "Blocked"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              project.progress_percentage >= 100
                ? "bg-emerald-500"
                : project.progress_percentage >= 50
                ? "bg-indigo-600"
                : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, project.progress_percentage))}%` }}
          />
        </div>
      </div>

      {/* Tabs Header */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 text-sm">
          {[
            { id: "overview", label: "Overview", icon: FolderGit2 },
            { id: "milestones", label: `Milestones (${project.milestones.length})`, icon: Clock },
            { id: "tasks", label: `Tasks (${project.tasks.length})`, icon: ListTodo },
            { id: "bugs", label: `Bugs (${bugs.length})`, icon: Bug },
            { id: "team", label: `Team (${project.members.length})`, icon: Users },
            { id: "delivery", label: "Delivery Gating", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 flex items-center space-x-2 font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Statement of Work & Description</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                {project.description || "No project statement of work documented yet."}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Milestone Roadmap</h3>
                <button
                  onClick={() => setActiveTab("milestones")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Manage Milestones
                </button>
              </div>

              {project.milestones.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No milestones created yet.</div>
              ) : (
                <div className="space-y-3">
                  {project.milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Phase {m.sequence}: {m.name}
                        </span>
                        {m.due_date && <span className="text-slate-400 dark:text-slate-500 ml-2 font-mono">Due: {m.due_date}</span>}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                        m.status === "COMPLETED" ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Commercial & Contractual Origin</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Company:</span>
                  <Link href={`/companies/${project.company_id}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                    {project.company_name}
                  </Link>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Sales Order:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{project.sales_order_number || "Direct"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Contract:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{project.contract_number || "Direct"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Budget:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(project.budget)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">Planned Start:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{project.planned_start_date || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestones Tab */}
      {activeTab === "milestones" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Deployment Milestones & Phases</h3>
            {hasPermission("projects.manage") && (
              <button
                onClick={() => setIsMilestoneModalOpen(true)}
                className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Milestone
              </button>
            )}
          </div>

          <div className="space-y-3">
            {project.milestones.map((m) => (
              <div key={m.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">Phase {m.sequence}</span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.name}</h4>
                  </div>
                  {m.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.description}</p>}
                  {m.due_date && <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono mt-1">Due date: {m.due_date}</div>}
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={m.status}
                    onChange={(e) => handleUpdateMilestoneStatus(m.id, e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Engineering & Delivery Tasks</h3>
            {hasPermission("tasks.create") && (
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create Task
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-2xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Task Ref</th>
                  <th className="px-4 py-3">Title & Milestone</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {project.tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">{t.task_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</div>
                      {t.milestone_name && <div className="text-2xs text-slate-400 dark:text-slate-500">{t.milestone_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">{t.assigned_to_name || "Unassigned"}</td>
                    <td className="px-4 py-3 text-2xs font-semibold">
                      <span className={`px-2 py-0.5 rounded ${
                        t.priority === "HIGH" || t.priority === "URGENT" ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {t.actual_hours} / {t.estimated_hours}h
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                        className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="TODO">TODO</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="BLOCKED">BLOCKED</option>
                        <option value="READY_FOR_QA">READY FOR QA</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bugs Tab */}
      {activeTab === "bugs" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Project Bugs & Defects</h3>
            <Link
              href="/bugs"
              className="inline-flex items-center px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Report New Bug
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-2xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Bug Ref</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bugs.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-rose-600 dark:text-rose-400 font-bold">{b.bug_number}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{b.title}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                        b.severity === "CRITICAL" ? "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300" : b.severity === "HIGH" ? "bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}>
                        {b.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">{b.assigned_to_name || "Unassigned"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/bugs/${b.id}`} className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                        Details &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Project Team Members</h3>
            {hasPermission("projects.assign") && (
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Member
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {project.members.map((m) => (
              <div key={m.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0">
                  {m.user_name ? m.user_name.charAt(0) : "U"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.user_name || "Team Member"}</h4>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{m.role}</div>
                  <div className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">{m.user_email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Gating Tab */}
      {activeTab === "delivery" && (
        <div className="space-y-6">
          <div className={`p-5 rounded-xl border ${
            isGatingPassed ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50" : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50"
          }`}>
            <div className="flex items-start space-x-3">
              {isGatingPassed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className={`text-base font-bold ${isGatingPassed ? "text-emerald-900 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"}`}>
                  {isGatingPassed ? "QA Delivery Gate: PASSED" : "QA Delivery Gate: RESTRICTED"}
                </h4>
                <p className={`text-xs mt-1 ${isGatingPassed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {isGatingPassed
                    ? "All developer tasks are complete, no critical or high severity defects remain open, and QA test executions have verified release integrity."
                    : "Delivery is currently restricted to protect institutional service level agreements."}
                </p>

                {project.delivery_readiness?.reasons && project.delivery_readiness.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1 list-disc list-inside text-xs text-amber-800 dark:text-amber-300 font-medium">
                    {project.delivery_readiness.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Execute Delivery Transition</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only authorized Project Managers and Administrators may sign off on campus delivery.
            </p>

            <button
              onClick={() => setIsDeliveryModalOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              Open Delivery Sign-off Workflow
            </button>
          </div>
        </div>
      )}

      {/* Create Milestone Modal */}
      <Modal isOpen={isMilestoneModalOpen} onClose={() => setIsMilestoneModalOpen(false)} title="Add Milestone">
        <form onSubmit={handleCreateMilestone} className="space-y-4 text-sm">
          {actionError && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">{actionError}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Milestone Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Infrastructure Deployment"
              value={milestoneForm.name}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sequence Order</label>
              <input
                type="number"
                min={1}
                value={milestoneForm.sequence}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, sequence: parseInt(e.target.value) || 1 })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
              <input
                type="date"
                value={milestoneForm.due_date}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={milestoneForm.description}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsMilestoneModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Create Milestone"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Task Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Create Developer / Project Task">
        <form onSubmit={handleCreateTask} className="space-y-4 text-sm">
          {actionError && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">{actionError}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Set up SAML Single Sign-On for campus"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Milestone</label>
              <select
                value={taskForm.milestone_id}
                onChange={(e) => setTaskForm({ ...taskForm, milestone_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No Milestone</option>
                {project.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    Phase {m.sequence}: {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
              <select
                value={taskForm.assigned_to_id}
                onChange={(e) => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estimated Hours</label>
              <input
                type="number"
                min={0}
                value={taskForm.estimated_hours}
                onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Create Task"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal isOpen={isMemberModalOpen} onClose={() => setIsMemberModalOpen(false)} title="Add Team Member">
        <form onSubmit={handleAddMember} className="space-y-4 text-sm">
          {actionError && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">{actionError}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select User *</label>
            <select
              required
              value={memberForm.user_id}
              onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select User</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Project Role *</label>
            <select
              value={memberForm.role}
              onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Developer">Developer</option>
              <option value="Project Manager">Project Manager</option>
              <option value="QA Engineer">QA Engineer</option>
              <option value="Support Engineer">Support Engineer</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsMemberModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Assigning..." : "Assign Member"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delivery Sign-off Modal */}
      <Modal isOpen={isDeliveryModalOpen} onClose={() => setIsDeliveryModalOpen(false)} title="Project Delivery Sign-off">
        <form onSubmit={handleDeliveryTransition} className="space-y-4 text-sm">
          {actionError && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs">{actionError}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Stage *</label>
            <select
              value={deliveryForm.status}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, status: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="READY_FOR_DELIVERY">READY FOR DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>

          {!isGatingPassed && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>QA Delivery Gate is Active</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Unresolved defects or incomplete tasks exist. To proceed, check authorized override and provide justification.
              </p>
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={deliveryForm.override_qa}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, override_qa: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600"
                />
                <span>Authorize Executive QA Override</span>
              </label>

              {deliveryForm.override_qa && (
                <input
                  type="text"
                  required
                  placeholder="Justification for executive override..."
                  value={deliveryForm.override_reason}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, override_reason: e.target.value })}
                  className="w-full border border-amber-300 dark:border-amber-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 mt-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sign-off Notes & Acceptance</label>
            <textarea
              rows={3}
              placeholder="Campus principal acceptance, signoff memorandum ref..."
              value={deliveryForm.completion_notes}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, completion_notes: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDeliveryModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Signing off..." : "Confirm Delivery Sign-off"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
