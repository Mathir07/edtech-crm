"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";

interface SLAPolicyItem {
  id: string;
  name: string;
  description: string | null;
  priority: string | null;
  severity: string | null;
  first_response_target_minutes: number;
  resolution_target_minutes: number;
  business_hours_only: boolean;
  business_hour_start: string;
  business_hour_end: string;
  timezone: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export default function SLAPoliciesPage() {
  const { hasPermission } = useAuth();
  const [policies, setPolicies] = useState<SLAPolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    priority: "HIGH",
    severity: "HIGH",
    first_response_target_minutes: 120,
    resolution_target_minutes: 1440,
    business_hours_only: true,
    business_hour_start: "09:00",
    business_hour_end: "18:00",
    timezone: "Asia/Kolkata",
    is_default: false,
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await api.get<SLAPolicyItem[]>("/service/sla-policies");
      setPolicies(data);
    } catch (err) {
      console.error("Failed to load SLA policies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMessage("Policy name is required.");
      return;
    }

    try {
      setCreateLoading(true);
      setErrorMessage(null);
      await api.post("/service/sla-policies", form);
      setIsCreateOpen(false);
      setForm({
        name: "",
        description: "",
        priority: "HIGH",
        severity: "HIGH",
        first_response_target_minutes: 120,
        resolution_target_minutes: 1440,
        business_hours_only: true,
        business_hour_start: "09:00",
        business_hour_end: "18:00",
        timezone: "Asia/Kolkata",
        is_default: false,
      });
      loadPolicies();
    } catch (err: any) {
      setErrorMessage(err?.detail || "Failed to create SLA policy.");
    } finally {
      setCreateLoading(false);
    }
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = mins / 60;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = (hours / 9).toFixed(1); // 9h working day
    return `${hours}h (~${days} business days)`;
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">SLA Policies & Guarantees</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional Service Level Agreements, turnaround response times, and business hours.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/service"
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Service Operations</span>
          </Link>

          {hasPermission("service.sla.manage") && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>New SLA Policy</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Calculated on Standard Indian Business Hours</div>
            <div className="text-2xs text-slate-500 dark:text-slate-400">
              Monday through Friday • 09:00 to 18:00 IST (Asia/Kolkata) • Clocks freeze outside business hours & when waiting on customer.
            </div>
          </div>
        </div>

        <div className="text-2xs font-mono px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          Target Timezone: <strong>Asia/Kolkata (+05:30)</strong>
        </div>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 dark:text-slate-500">Loading SLA policies...</div>
        ) : policies.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">No SLA policies defined yet.</div>
        ) : (
          policies.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h2>
                    {p.is_default && (
                      <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">{p.description || "Institutional SLA Policy"}</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Active Policy" />
              </div>

              {/* Match Criteria */}
              <div className="flex items-center space-x-2 text-2xs">
                <span className="text-slate-400 dark:text-slate-500">Matches:</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                  {p.priority ? `${p.priority} Priority` : "Any Priority"}
                </span>
                {p.severity && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 font-semibold text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                    {p.severity} Severity
                  </span>
                )}
              </div>

              {/* Turnaround Targets */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                  <div className="text-3xs font-semibold uppercase text-slate-400 dark:text-slate-500">First Response</div>
                  <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {formatMinutes(p.first_response_target_minutes)}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                  <div className="text-3xs font-semibold uppercase text-slate-400 dark:text-slate-500">Resolution</div>
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatMinutes(p.resolution_target_minutes)}
                  </div>
                </div>
              </div>

              {/* Hours details */}
              <div className="text-3xs text-slate-400 dark:text-slate-500 flex items-center justify-between pt-1 font-mono">
                <span>{p.business_hours_only ? "Business Hours Only" : "24x7 Continuous"}</span>
                <span>
                  {p.business_hour_start} - {p.business_hour_end}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New SLA Policy Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New SLA Policy">
        <form onSubmit={handleCreate} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Policy Name</label>
            <input
              type="text"
              placeholder="e.g. Critical Institutional SLA"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <input
              type="text"
              placeholder="Applies to Tier-1 campus outages and exam-day critical tickets"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Response (Minutes)
              </label>
              <input
                type="number"
                value={form.first_response_target_minutes}
                onChange={(e) => setForm({ ...form, first_response_target_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                min={15}
                required
              />
              <span className="text-3xs text-slate-400 dark:text-slate-500">e.g. 120 = 2 hours</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Resolution (Minutes)
              </label>
              <input
                type="number"
                value={form.resolution_target_minutes}
                onChange={(e) => setForm({ ...form, resolution_target_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                min={60}
                required
              />
              <span className="text-3xs text-slate-400 dark:text-slate-500">e.g. 1440 = 24 hours</span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              {createLoading ? "Creating..." : "Create Policy"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
