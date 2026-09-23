"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Building,
  Briefcase,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Lock,
  UserX,
  UserCheck,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";

interface RoleOption {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
  description?: string;
}

interface TeamOption {
  id: string;
  department_id: string;
  name: string;
  leader_id?: string;
}

interface UserItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string | null;
  department_id?: string | null;
  team_id?: string | null;
  department?: DepartmentOption | null;
  team?: TeamOption | null;
  is_active: boolean;
  is_superuser: boolean;
  roles: RoleOption[];
  created_at: string;
  updated_at: string;
}

export default function UsersManagementPage() {
  const { user: currentUser, hasPermission } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Add Employee Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    department_id: "",
    team_id: "",
    role_ids: [] as string[],
    password: "",
    is_active: true,
  });

  // Edit Employee Modal
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    department_id: "",
    team_id: "",
    role_ids: [] as string[],
    is_active: true,
  });

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Superuser Toggle Modal
  const [superTarget, setSuperTarget] = useState<UserItem | null>(null);
  const [superLoading, setSuperLoading] = useState(false);
  const [superError, setSuperError] = useState<string | null>(null);

  // Deactivate/Activate Modal
  const [statusTarget, setStatusTarget] = useState<UserItem | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Global notification message
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uData, rData, dData, tData] = await Promise.all([
        api.get<UserItem[]>("/users"),
        api.get<RoleOption[]>("/roles").catch(() => []),
        api.get<DepartmentOption[]>("/departments").catch(() => []),
        api.get<TeamOption[]>("/teams").catch(() => []),
      ]);
      setUsers(uData);
      setRoles(rData);
      setDepartments(dData);
      setTeams(tData);
    } catch (err: any) {
      console.error("Failed to load user management data", err);
      setNotification({ type: "error", text: err?.detail || "Failed to load employee directory." });
    } finally {
      setLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = u.full_name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchPhone = u.phone?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }

      // Role
      if (roleFilter !== "ALL") {
        const hasRole = u.roles.some((r) => r.id === roleFilter || r.name === roleFilter);
        if (!hasRole) return false;
      }

      // Department
      if (deptFilter !== "ALL") {
        if (u.department_id !== deptFilter) return false;
      }

      // Team
      if (teamFilter !== "ALL") {
        if (u.team_id !== teamFilter) return false;
      }

      // Status
      if (statusFilter === "ACTIVE" && !u.is_active) return false;
      if (statusFilter === "INACTIVE" && u.is_active) return false;

      return true;
    });
  }, [users, search, roleFilter, deptFilter, teamFilter, statusFilter]);

  // Summary counts
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;
  const superCount = users.filter((u) => u.is_superuser).length;

  // Handle Add Employee Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!addForm.email.trim() || !addForm.first_name.trim() || !addForm.last_name.trim()) {
      setAddError("First name, last name, and corporate email are required.");
      return;
    }
    if (addForm.password.length < 6) {
      setAddError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setAddLoading(true);
      await api.post("/users", {
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        first_name: addForm.first_name.trim(),
        last_name: addForm.last_name.trim(),
        phone: addForm.phone.trim() || null,
        department_id: addForm.department_id || null,
        team_id: addForm.team_id || null,
        is_active: addForm.is_active,
        role_ids: addForm.role_ids,
      });

      setIsAddOpen(false);
      setAddForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        department_id: "",
        team_id: "",
        role_ids: [],
        password: "",
        is_active: true,
      });
      setNotification({ type: "success", text: "New employee account created successfully." });
      loadData();
    } catch (err: any) {
      console.error("Failed to create user", err);
      setAddError(err?.detail || "Failed to create user account.");
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (target: UserItem) => {
    setEditTarget(target);
    setEditError(null);
    setEditForm({
      first_name: target.first_name || "",
      last_name: target.last_name || "",
      email: target.email || "",
      phone: target.phone || "",
      department_id: target.department_id || "",
      team_id: target.team_id || "",
      role_ids: target.roles.map((r) => r.id),
      is_active: target.is_active,
    });
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);

    if (!editForm.email.trim() || !editForm.first_name.trim() || !editForm.last_name.trim()) {
      setEditError("First name, last name, and corporate email are required.");
      return;
    }

    try {
      setEditLoading(true);
      await api.put(`/users/${editTarget.id}`, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim() || null,
        department_id: editForm.department_id || null,
        team_id: editForm.team_id || null,
        role_ids: editForm.role_ids,
        is_active: editForm.is_active,
      });

      setEditTarget(null);
      setNotification({ type: "success", text: `Employee profile updated for ${editForm.first_name} ${editForm.last_name}.` });
      loadData();
    } catch (err: any) {
      console.error("Failed to update user", err);
      setEditError(err?.detail || "Failed to update employee details.");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);

    if (resetPassword.length < 6) {
      setResetError("New temporary password must be at least 6 characters long.");
      return;
    }
    if (resetPassword !== confirmPassword) {
      setResetError("Passwords do not match. Please verify.");
      return;
    }

    try {
      setResetLoading(true);
      await api.post(`/users/${resetTarget.id}/reset-password`, {
        new_password: resetPassword,
      });

      setResetSuccess(`Password reset successfully for ${resetTarget.email}`);
      setTimeout(() => {
        setResetTarget(null);
        setResetPassword("");
        setConfirmPassword("");
        setResetSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Failed to reset password", err);
      setResetError(err?.detail || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  // Handle Superuser Toggle Submit
  const handleSuperuserSubmit = async () => {
    if (!superTarget) return;
    setSuperError(null);

    try {
      setSuperLoading(true);
      const nextVal = !superTarget.is_superuser;
      await api.put(`/users/${superTarget.id}/superuser`, {
        is_superuser: nextVal,
      });

      setNotification({
        type: "success",
        text: nextVal
          ? `Super Administrator privileges granted to ${superTarget.full_name}.`
          : `Super Administrator privileges revoked for ${superTarget.full_name}.`,
      });
      setSuperTarget(null);
      loadData();
    } catch (err: any) {
      console.error("Failed to update superuser status", err);
      setSuperError(err?.detail || "Failed to update Super Administrator status.");
    } finally {
      setSuperLoading(false);
    }
  };

  // Handle Deactivate / Reactivate Submit
  const handleStatusToggleSubmit = async () => {
    if (!statusTarget) return;
    setStatusError(null);

    try {
      setStatusLoading(true);
      const nextActive = !statusTarget.is_active;
      await api.put(`/users/${statusTarget.id}`, {
        is_active: nextActive,
      });

      setNotification({
        type: "success",
        text: nextActive
          ? `Employee account reactivated for ${statusTarget.full_name}.`
          : `Employee account deactivated for ${statusTarget.full_name}.`,
      });
      setStatusTarget(null);
      loadData();
    } catch (err: any) {
      console.error("Failed to update user active status", err);
      setStatusError(err?.detail || "Failed to update employee account status.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Teams filtered by selected department in Add/Edit forms
  const filteredTeamsForAdd = useMemo(() => {
    if (!addForm.department_id) return teams;
    return teams.filter((t) => t.department_id === addForm.department_id);
  }, [teams, addForm.department_id]);

  const filteredTeamsForEdit = useMemo(() => {
    if (!editForm.department_id) return teams;
    return teams.filter((t) => t.department_id === editForm.department_id);
  }, [teams, editForm.department_id]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Staff & User Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional directory, employee credentials, role assignments, and organizational governance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {(hasPermission("users.manage") || currentUser?.is_superuser) && (
            <button
              onClick={() => {
                setAddError(null);
                setIsAddOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Total Staff</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{totalCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Active Accounts</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Deactivated</div>
            <div className="text-2xl font-bold text-slate-500 dark:text-slate-400 mt-0.5">{inactiveCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
            <UserX className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500">Super Admins</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{superCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, corporate email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 dark:text-slate-500">Loading staff directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">No employees found.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No staff members match the selected criteria. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-3xs">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Corporate Email</th>
                  <th className="py-3 px-4">Assigned Role(s)</th>
                  <th className="py-3 px-4">Department & Team</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const deptObj = departments.find((d) => d.id === u.department_id);
                  const teamObj = teams.find((t) => t.id === u.team_id);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group">
                      {/* Employee Name & Superadmin Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              u.is_superuser
                                ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900"
                            }`}
                          >
                            {u.first_name.charAt(0)}
                            {u.last_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                              <span>{u.full_name}</span>
                              {u.is_superuser && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                                  Super Admin
                                </span>
                              )}
                            </div>
                            {u.phone && (
                              <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono mt-0.5 flex items-center space-x-1">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{u.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Corporate Email */}
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{u.email}</span>
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length > 0 ? (
                            u.roles.map((r) => (
                              <span
                                key={r.id}
                                className="px-2 py-0.5 rounded-md text-3xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                {r.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-2xs">No role assigned</span>
                          )}
                        </div>
                      </td>

                      {/* Department & Team */}
                      <td className="py-3 px-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {deptObj?.name || u.department?.name || (
                            <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                          )}
                        </div>
                        {(teamObj?.name || u.team?.name) && (
                          <div className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-1">
                            <Briefcase className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                            <span>{teamObj?.name || u.team?.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Edit Employee */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                            title="Edit Employee Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setResetTarget(u);
                              setResetPassword("");
                              setConfirmPassword("");
                              setResetError(null);
                              setResetSuccess(null);
                            }}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition"
                            title="Reset Temporary Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Super Admin Toggle (Super Admins only) */}
                          {currentUser?.is_superuser && (
                            <button
                              onClick={() => {
                                setSuperTarget(u);
                                setSuperError(null);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                u.is_superuser
                                  ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                              title={u.is_superuser ? "Revoke Super Admin Status" : "Grant Super Admin Status"}
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Deactivate / Activate */}
                          <button
                            onClick={() => {
                              setStatusTarget(u);
                              setStatusError(null);
                            }}
                            className={`p-1.5 rounded-lg transition ${
                              u.is_active
                                ? "text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            }`}
                            title={u.is_active ? "Deactivate Employee" : "Reactivate Employee"}
                          >
                            {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
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

      {/* ========================================================================= */}
      {/* MODAL 1: ADD EMPLOYEE                                                     */}
      {/* ========================================================================= */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Employee">
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          {addError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.first_name}
                onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                placeholder="e.g. Ramesh"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.last_name}
                onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                placeholder="e.g. Sundaram"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Corporate Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="e.g. ramesh@kct.ac.in"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select
                value={addForm.department_id}
                onChange={(e) => setAddForm({ ...addForm, department_id: e.target.value, team_id: "" })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">No Department Assigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Team</label>
              <select
                value={addForm.team_id}
                onChange={(e) => setAddForm({ ...addForm, team_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">No Team Assigned</option>
                {filteredTeamsForAdd.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Primary Role</label>
            <select
              value={addForm.role_ids[0] || ""}
              onChange={(e) => setAddForm({ ...addForm, role_ids: e.target.value ? [e.target.value] : [] })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select Role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
            />
            <p className="text-3xs text-slate-400 dark:text-slate-500 mt-1">
              The employee can update this temporary password upon first login under My Settings.
            </p>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="add_active"
              checked={addForm.is_active}
              onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="add_active" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Account Active immediately
            </label>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {addLoading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EMPLOYEE                                                    */}
      {/* ========================================================================= */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Employee Profile">
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {editError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-2xs space-y-1">
            <div className="font-semibold flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Identity & Audit Integrity</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Editing an employee's email updates their login identity while keeping their permanent database ID (
              <span className="font-mono text-3xs">{editTarget?.id.substring(0, 8)}...</span>) and all activity history intact.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Corporate Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select
                value={editForm.department_id}
                onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value, team_id: "" })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Team</label>
              <select
                value={editForm.team_id}
                onChange={(e) => setEditForm({ ...editForm, team_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">No Team</option>
                {filteredTeamsForEdit.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Role</label>
            <select
              value={editForm.role_ids[0] || ""}
              onChange={(e) => setEditForm({ ...editForm, role_ids: e.target.value ? [e.target.value] : [] })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select Role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="edit_active"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="edit_active" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Active Account
            </label>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: RESET PASSWORD                                                   */}
      {/* ========================================================================= */}
      <Modal isOpen={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Employee Password">
        <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
          {resetSuccess ? (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resetSuccess}</span>
            </div>
          ) : (
            <>
              {resetError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{resetTarget?.full_name}</div>
                <div className="text-3xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{resetTarget?.email}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Temporary Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  {resetLoading ? "Updating..." : "Reset Password"}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: TOGGLE SUPER ADMIN                                               */}
      {/* ========================================================================= */}
      <Modal isOpen={!!superTarget} onClose={() => setSuperTarget(null)} title="Super Administrator Authorization">
        <div className="space-y-4 text-xs">
          {superError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{superError}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
            <div className="font-bold flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span>
                {superTarget?.is_superuser
                  ? `Revoke Super Admin privileges for ${superTarget?.full_name}?`
                  : `Grant Super Admin privileges to ${superTarget?.full_name}?`}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-2xs">
              {superTarget?.is_superuser
                ? "This user will revert to the standard permissions defined by their assigned role."
                : "Super Administrators have unrestricted access across all CRM features, finance modules, audit records, and user management."}
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSuperTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={superLoading}
              onClick={handleSuperuserSubmit}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition disabled:opacity-50 ${
                superTarget?.is_superuser ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {superLoading
                ? "Updating..."
                : superTarget?.is_superuser
                ? "Revoke Super Admin"
                : "Confirm Super Admin"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: DEACTIVATE / ACTIVATE USER                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.is_active ? "Deactivate Employee Account" : "Reactivate Employee Account"}
      >
        <div className="space-y-4 text-xs">
          {statusError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          <div
            className={`p-3 rounded-lg border space-y-2 ${
              statusTarget?.is_active
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="font-bold flex items-center space-x-1.5">
              {statusTarget?.is_active ? (
                <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>
                {statusTarget?.is_active
                  ? `Confirm deactivation for ${statusTarget?.full_name}?`
                  : `Reactivate account for ${statusTarget?.full_name}?`}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-2xs">
              {statusTarget?.is_active
                ? "Deactivating blocks this user from logging into the CRM. Their account is NOT deleted; all historical activity, lead assignments, tickets, and audit history remain intact."
                : "Reactivating this employee will restore their login access immediately."}
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStatusTarget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={statusLoading}
              onClick={handleStatusToggleSubmit}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition disabled:opacity-50 ${
                statusTarget?.is_active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {statusLoading
                ? "Processing..."
                : statusTarget?.is_active
                ? "Deactivate Account"
                : "Reactivate Account"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
