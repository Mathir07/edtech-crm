"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Mail,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Clock,
  Calendar,
  DollarSign,
  Briefcase,
  Bug,
  LifeBuoy,
  UserCheck,
} from "lucide-react";
import { notificationsApi, NotificationPreference } from "@/lib/notificationsApi";

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await notificationsApi.getPreferences();
        setPrefs(data);
      } catch (err) {
        setStatusMsg({ type: "error", text: "Failed to load notification preferences." });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = (field: keyof NotificationPreference) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [field]: !prefs[field] });
  };

  const handleSave = async () => {
    if (!prefs) return;
    try {
      setSaving(true);
      setStatusMsg(null);
      const updated = await notificationsApi.updatePreferences(prefs);
      setPrefs(updated);
      setStatusMsg({ type: "success", text: "Notification preferences saved successfully!" });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Failed to save preferences. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center text-slate-500 dark:text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <Link
            href="/notifications"
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Back to notifications"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Notification Preferences</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control delivery channels and notification categories for your account.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition-colors shadow-xs disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Preferences"}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${
            statusMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Global Channel Master Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Global Channels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">In-App Notifications</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Live alerts in the navigation bar.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.in_app_enabled}
                onChange={() => handleToggle("in_app_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 rounded-lg">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Hostinger Email Delivery</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Important notices sent to your email.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.email_enabled}
                onChange={() => handleToggle("email_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Category Preferences Matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Category Preferences</h2>
          <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">Toggle channels per business domain</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Tasks */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tasks & Activities</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Reminders for tasks due soon or overdue.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.tasks_in_app}
                  onChange={() => handleToggle("tasks_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.tasks_email}
                  onChange={() => handleToggle("tasks_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>

          {/* Meetings */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Scheduled Meetings</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">24-hour and 1-hour advance reminders for client demos.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.meetings_in_app}
                  onChange={() => handleToggle("meetings_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.meetings_email}
                  onChange={() => handleToggle("meetings_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>

          {/* Sales Follow-ups */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sales Follow-ups</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Stale leads and inactive high-value opportunity warnings.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.sales_in_app}
                  onChange={() => handleToggle("sales_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.sales_email}
                  onChange={() => handleToggle("sales_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>

          {/* Finance & Invoicing */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Finance & Invoicing</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Overdue invoices, due dates, and client payments received.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.finance_in_app}
                  onChange={() => handleToggle("finance_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.finance_email}
                  onChange={() => handleToggle("finance_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>

          {/* Service & SLA */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Support Tickets & SLA</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Approaching SLA breaches and critical ticket escalations.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.service_in_app}
                  onChange={() => handleToggle("service_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.service_email}
                  onChange={() => handleToggle("service_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>

          {/* Projects */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Projects & Delivery</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Overdue deployment milestones and delivery delay alerts.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.projects_in_app}
                  onChange={() => handleToggle("projects_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.projects_email}
                  onChange={() => handleToggle("projects_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>

          {/* QA & Critical Bugs */}
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Quality Assurance & Critical Bugs</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400">Immediate escalation for CRITICAL severity blockers.</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.qa_in_app}
                  onChange={() => handleToggle("qa_in_app")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">In-App</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.qa_email}
                  onChange={() => handleToggle("qa_email")}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">Email</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Disclaimer */}
      <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-2xs text-slate-500 dark:text-slate-400 flex items-start space-x-3">
        <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-300">Enterprise Escalation Policy:</p>
          <p className="mt-0.5 leading-relaxed">
            Critical security, deployment readiness, and SLA breach notices will always be delivered to authorized leads and project managers in accordance with organizational compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
