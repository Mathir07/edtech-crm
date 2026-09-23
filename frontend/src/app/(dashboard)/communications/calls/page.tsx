"use client";

import React, { useEffect, useState } from "react";
import {
  PhoneCall,
  Plus,
  Building2,
  User,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface CallLog {
  id: string;
  channel: string;
  direction: string;
  status: string;
  sender: string;
  recipient: string;
  call_duration_seconds: number;
  call_disposition?: string;
  body_text?: string;
  created_at: string;
  company_id?: string;
  college_name?: string;
  contact_id?: string;
  contact_name?: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

interface ContactOption {
  id: string;
  name: string;
  phone?: string;
}

export default function CallLogsPage() {
  const toast = useToast();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [showLogModal, setShowLogModal] = useState(false);

  // Form state
  const [phone, setPhone] = useState("");
  const [direction, setDirection] = useState("OUTBOUND");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [disposition, setDisposition] = useState("FOLLOW_UP_REQUIRED");
  const [notes, setNotes] = useState("");
  const [collegeId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [saving, setSaving] = useState(false);

  // Dropdown options
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const url = directionFilter !== "ALL" ? `/communications/calls?direction=${directionFilter}` : "/communications/calls";
      const data = await api.get<CallLog[]>(url);
      setCalls(data || []);
    } catch (err) {
      console.error("Failed to load calls", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
    api.get<CompanyOption[]>("/companies").then(setCompanies).catch(console.error);
    api.get<ContactOption[]>("/contacts").then(setContacts).catch(console.error);
  }, [directionFilter]);

  const handleContactSelect = (cId: string) => {
    setContactId(cId);
    const con = contacts.find((c) => c.id === cId);
    if (con && con.phone) {
      setPhone(con.phone);
    }
  };

  const handleCreateCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    try {
      setSaving(true);
      await api.post("/communications/calls", {
        phone_number: phone,
        direction: direction,
        duration_seconds: durationMinutes * 60,
        disposition: disposition,
        notes: notes,
        company_id: collegeId || undefined,
        contact_id: contactId || undefined,
      });
      toast.success("Call log recorded successfully");
      setShowLogModal(false);
      // Reset form
      setPhone("");
      setNotes("");
      setCompanyId("");
      setContactId("");
      await fetchCalls();
    } catch (err: any) {
      toast.error(err.detail || "Failed to log call");
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  const getDispositionBadge = (disp?: string) => {
    if (!disp) return <Badge variant="neutral">UNKNOWN</Badge>;
    switch (disp.toUpperCase()) {
      case "PROPOSAL_REQUESTED":
      case "RESOLVED":
      case "INTERESTED":
        return <Badge variant="success">{disp.replace("_", " ")}</Badge>;
      case "FOLLOW_UP_REQUIRED":
        return <Badge variant="warning">{disp.replace("_", " ")}</Badge>;
      case "BUSY":
      case "NO_ANSWER":
      case "MISSED":
        return <Badge variant="danger">{disp.replace("_", " ")}</Badge>;
      default:
        return <Badge variant="neutral">{disp.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Phone & Call Logs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track client voice interactions, duration, follow-ups, and institutional dispositions
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCalls}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Refresh
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Log Call
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {["ALL", "INBOUND", "OUTBOUND"].map((dir) => (
          <button
            key={dir}
            onClick={() => setDirectionFilter(dir)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              directionFilter === dir ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {dir === "ALL" ? "All Directions" : dir}
          </button>
        ))}
      </div>

      {/* Calls Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Counterparty / Phone</th>
                <th className="py-3 px-4">Company / Organization</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Disposition</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Loading call records...
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No phone calls logged yet. Click "+ Log Call" to record a client conversation.
                  </td>
                </tr>
              ) : (
                calls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {c.direction === "INBOUND" ? (
                          <>
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Inbound
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Outbound
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-slate-100 font-medium">
                      {c.direction === "OUTBOUND" ? c.recipient : c.sender}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {c.college_name ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {c.college_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {c.contact_name ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {c.contact_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {formatDuration(c.call_duration_seconds)}
                    </td>
                    <td className="py-3 px-4">{getDispositionBadge(c.call_disposition)}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate" title={c.body_text}>
                      {c.body_text || "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-2xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {formatDateTime(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Call Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Log Phone Conversation
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCallLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Company</label>
                  <select
                    value={collegeId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Company...</option>
                    {companies.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.organization_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Contact</label>
                  <select
                    value={contactId}
                    onChange={(e) => handleContactSelect(e.target.value)}
                    disabled={!collegeId || contacts.length === 0}
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">Select Contact...</option>
                    {contacts.map((con) => (
                      <option key={con.id} value={con.id}>
                        {con.name} ({con.phone || "No phone"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9988776655"
                    required
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="OUTBOUND">Outbound Call</option>
                    <option value="INBOUND">Inbound Call</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Disposition</label>
                  <select
                    value={disposition}
                    onChange={(e) => setDisposition(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="PROPOSAL_REQUESTED">Proposal Requested</option>
                    <option value="FOLLOW_UP_REQUIRED">Follow Up Required</option>
                    <option value="INTERESTED">Interested</option>
                    <option value="RESOLVED">Issue Resolved</option>
                    <option value="BUSY">Busy</option>
                    <option value="NO_ANSWER">No Answer</option>
                    <option value="NOT_INTERESTED">Not Interested</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">Discussion Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key discussion points, requirements, next steps..."
                  className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !phone}
                  className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 rounded-lg disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Call Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
