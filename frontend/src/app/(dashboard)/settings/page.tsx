"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Shield,
  KeyRound,
  Building,
  CheckCircle2,
  AlertCircle,
  Users,
  ArrowRight,
  UserCheck,
  Globe,
  Calendar,
  Save,
  Laptop,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function SettingsPage() {
  const { user, refreshUser, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Profile Edit State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Password State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [loadingPw, setLoadingPw] = useState(false);

  // Preferences State (Stored in localStorage)
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [prefSaved, setPrefSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const [rData, dData] = await Promise.all([
          api.get<any[]>("/roles").catch(() => []),
          api.get<any[]>("/departments").catch(() => []),
        ]);
        setRoles(rData);
        setDepartments(dData);
      } catch (err) {
        console.error("Failed to load settings config", err);
      }
    }
    loadConfig();

    // Load preferences
    if (typeof window !== "undefined") {
      setTimezone(localStorage.getItem("crm_pref_timezone") || "Asia/Kolkata");
      setDateFormat(localStorage.getItem("crm_pref_date_format") || "DD/MM/YYYY");
    }
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);

    if (!firstName.trim() || !lastName.trim()) {
      setProfileErr("First name and last name are required.");
      return;
    }

    try {
      setSavingProfile(true);
      await api.put("/auth/me", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });
      await refreshUser();
      setProfileMsg("Your personal profile details have been saved.");
    } catch (err: any) {
      console.error("Failed to update profile", err);
      setProfileErr(err?.detail || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    setPwError(null);

    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation password do not match.");
      return;
    }

    setLoadingPw(true);
    try {
      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwMessage("Password updated successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(err?.detail || "Failed to change password.");
    } finally {
      setLoadingPw(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("crm_pref_theme", theme);
      localStorage.setItem("crm_pref_timezone", timezone);
      localStorage.setItem("crm_pref_date_format", dateFormat);
    }
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System & Account Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review your employee account credentials, assigned roles, personal preferences, and security settings.
        </p>
      </div>

      {/* Admin Quick Link Banner */}
      {/* Admin Quick Link Banners */}
      {(hasPermission("users.manage") || user?.is_superuser) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900 to-indigo-800 text-white shadow-sm flex flex-col justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">Employee & User Management</div>
                <div className="text-xs text-indigo-200 mt-0.5">
                  Manage staff credentials, role assignments, and system governance.
                </div>
              </div>
            </div>
            <Link
              href="/settings/users"
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 rounded-xl text-xs font-bold transition shadow-xs self-start"
            >
              <span>Manage Users</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900 to-purple-800 text-white shadow-sm flex flex-col justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold shrink-0">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">Telephony & Voice Architecture</div>
                <div className="text-xs text-purple-200 mt-0.5">
                  Provider-neutral telephony configuration, carrier status, and caller ID settings.
                </div>
              </div>
            </div>
            <Link
              href="/settings/telephony"
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-xs font-bold transition shadow-xs self-start"
            >
              <span>Telephony Settings</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>
      )}

      {/* Editable My Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            My Employee Profile & Authorization
          </h2>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <UserCheck className="w-3 h-3 mr-1" />
            Active Account
          </span>
        </div>

        {profileMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs rounded-lg flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{profileMsg}</span>
          </div>
        )}
        {profileErr && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{profileErr}</span>
          </div>
        )}

        {/* Read-Only Organizational Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">Corporate Email</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono truncate">{user?.email}</div>
            <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5 block">Managed by Administrator</span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">Assigned Roles</div>
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
              {user?.roles?.join(", ") || (user?.is_superuser ? "Super Admin" : "User")}
            </div>
            <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5 block">Role-Based Access</span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">Department</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {(user as any)?.department_name || "Management & Strategy"}
            </div>
            <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5 block">Institutional Unit</span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">System Privilege</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
              {user?.is_superuser ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">Super Administrator</span>
              ) : (
                <span className="text-slate-700 dark:text-slate-300">Standard Staff</span>
              )}
            </div>
            <span className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5 block">
              {user?.is_superuser ? "Unrestricted Global Access" : "Standard RBAC"}
            </span>
          </div>
        </div>

        {/* Editable Personal Fields */}
        <form onSubmit={handleProfileUpdate} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Edit Personal Information</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Direct Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProfile ? "Saving Profile..." : "Save Profile Details"}</span>
            </button>
          </div>
        </form>

        {/* Granted Permissions List */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Granted Enterprise Permissions ({user?.permissions?.length || 0}):
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 font-mono text-3xs">
            {user?.permissions?.map((p) => (
              <span key={p} className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Password Change Card & Preferences Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Change Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <KeyRound className="w-5 h-5 mr-2 text-slate-700 dark:text-slate-300" />
            Update Password
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ensure your account uses a strong, unique password of at least 6 characters.
          </p>

          {pwMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pwMessage}</span>
            </div>
          )}

          {pwError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Password *</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">New Password (Min 6 chars) *</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loadingPw}
              className="w-full py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-xs"
            >
              {loadingPw ? "Updating Password..." : "Change Password"}
            </button>
          </form>
        </div>

        {/* Personal Preferences Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            Regional & Display Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure local date format, time standard, and client application preferences.
          </p>

          {prefSaved && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Preferences saved for your browser session.</span>
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Interface Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="system">System Default (Automatic)</option>
                <option value="light">Light Mode</option>
                <option value="dark">Dark Slate</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Standard Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST — UTC+05:30)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="America/New_York">America/New York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST — UTC+04:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT — UTC+08:00)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Date Display Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard — e.g. 21/09/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard — e.g. 2026-09-21)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US format — e.g. 09/21/2026)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition shadow-2xs"
            >
              Save Preferences
            </button>
          </form>
        </div>
      </div>

      {/* Roles & Departments Directory Reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <Building className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-400" />
            Company Departments ({departments.length})
          </h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {departments.map((d) => (
              <li key={d.id} className="py-2 flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{d.name}</span>
                <span className="text-slate-400 dark:text-slate-500 truncate max-w-xs">{d.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <Shield className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-400" />
            System Roles Directory ({roles.length})
          </h3>
          <div className="flex flex-wrap gap-1.5 text-2xs font-medium">
            {roles.map((r) => (
              <span key={r.id} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                {r.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
