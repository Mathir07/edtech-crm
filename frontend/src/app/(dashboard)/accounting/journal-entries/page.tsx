"use client";

import React, { useEffect, useState } from "react";
import {
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  RotateCcw,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface JournalLine {
  id?: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit: number;
  credit: number;
  reference?: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  transaction_date: string;
  posting_date: string | null;
  description: string;
  reference: string | null;
  source_module: string;
  status: "DRAFT" | "POSTED" | "VOID" | "REVERSED";
  total_debit: number;
  total_credit: number;
  created_at: string;
  lines: JournalLine[];
}

interface AccountSimple {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

export default function JournalEntriesPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transDate, setTransDate] = useState(new Date().toISOString().split("T")[0]);
  const [desc, setDesc] = useState("");
  const [refStr, setRefStr] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: "", description: "", debit: 0, credit: 0 },
    { account_id: "", description: "", debit: 0, credit: 0 },
  ]);

  // Reversal Modal
  const [reversalModalId, setReversalModalId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = "/accounting/journal-entries";
      if (statusFilter !== "ALL") url += `?status=${statusFilter}`;
      const [res, accRes] = await Promise.all([
        api.get<JournalEntry[]>(url),
        api.get<AccountSimple[]>("/accounting/chart-of-accounts"),
      ]);
      setEntries(res);
      setAccounts(accRes);
    } catch (err: any) {
      console.error("Failed to load journal entries:", err);
      setError(err?.detail || "Could not load journal entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const addLine = () => {
    setLines([...lines, { account_id: "", description: "", debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01 && totalDebit > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setError("Total Debits must equal Total Credits and be greater than zero.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await api.post("/accounting/journal-entries", {
        transaction_date: transDate,
        description: desc.trim(),
        reference: refStr.trim() || undefined,
        lines: lines.map((l) => ({
          account_id: l.account_id,
          description: l.description?.trim() || undefined,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      });
      toast.success("Journal entry created successfully");
      setIsModalOpen(false);
      setDesc("");
      setRefStr("");
      setLines([
        { account_id: "", description: "", debit: 0, credit: 0 },
        { account_id: "", description: "", debit: 0, credit: 0 },
      ]);
      fetchData();
    } catch (err: any) {
      setError(err?.detail || "Failed to create journal entry.");
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    try {
      await api.post(`/accounting/journal-entries/${id}/post`);
      toast.success("Journal entry posted to General Ledger");
      fetchData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to post entry.");
    }
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalModalId) return;
    try {
      await api.post(`/accounting/journal-entries/${reversalModalId}/reverse`, {
        reason: reversalReason.trim(),
      });
      toast.success("Journal entry reversed");
      setReversalModalId(null);
      setReversalReason("");
      fetchData();
    } catch (err: any) {
      toast.error(err?.detail || "Failed to reverse entry.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Journal Entries (General Ledger)</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Strict double-entry bookkeeping transactions with immutable audit trails.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {hasPermission("accounting.create") && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Journal Entry</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-1.5">
          {["ALL", "POSTED", "DRAFT", "REVERSED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">Total Postings: {entries.length}</div>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 text-xs">
            Loading Journal Postings...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 text-xs">
            No journal entries match the current status.
          </div>
        ) : (
          entries.map((je) => {
            const isExpanded = expandedId === je.id;
            return (
              <div
                key={je.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                  onClick={() => setExpandedId(isExpanded ? null : je.id)}
                >
                  <div className="flex items-start sm:items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                      JE
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white font-mono">{je.entry_number}</span>
                        <Badge variant="status" status={je.status}>
                          {je.status}
                        </Badge>
                        <span className="text-3xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {je.source_module}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">{je.description}</div>
                      <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Date: {formatDate(je.transaction_date)} {je.reference ? `• Ref: ${je.reference}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4">
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                        {formatCurrency(je.total_debit)}
                      </div>
                      <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono">
                        {je.lines.length} general ledger lines
                      </div>
                    </div>

                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {je.status === "DRAFT" && hasPermission("accounting.post") && (
                        <button
                          onClick={() => handlePost(je.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors shadow-xs"
                        >
                          Post Entry
                        </button>
                      )}
                      {je.status === "POSTED" && hasPermission("accounting.reverse") && (
                        <button
                          onClick={() => setReversalModalId(je.id)}
                          className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1"
                          title="Reverse Entry"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Lines */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-4">
                    <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Transaction Breakdown (Double-Entry Ledger Lines)
                    </div>
                    <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-3xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="py-2 px-3">Account Code</th>
                            <th className="py-2 px-3">Account Title</th>
                            <th className="py-2 px-3">Line Memo</th>
                            <th className="py-2 px-3 text-right">Debit (Dr)</th>
                            <th className="py-2 px-3 text-right">Credit (Cr)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                          {je.lines.map((line, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-mono font-semibold text-teal-700 dark:text-teal-400">{line.account_code || "-"}</td>
                              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{line.account_name || "-"}</td>
                              <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-2xs">{line.description}</td>
                              <td className="py-2 px-3 text-right font-mono font-medium">
                                {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-medium">
                                {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50/75 dark:bg-slate-950/80 font-semibold text-xs border-t border-slate-200 dark:border-slate-800">
                            <td colSpan={3} className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">Total:</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-white">{formatCurrency(je.total_debit)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-900 dark:text-white">{formatCurrency(je.total_credit)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: New Journal Entry */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Double-Entry Journal Post</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              All journal entries must balance: Total Debits must strictly equal Total Credits.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transDate}
                    onChange={(e) => setTransDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Reference / Voucher #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JV-2026-09"
                    value={refStr}
                    onChange={(e) => setRefStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Journal Description / Memo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quarterly equipment depreciation adjustment"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Dynamic Lines */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Ledger Distribution Lines</span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {lines.map((line, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center space-x-2">
                      <select
                        required
                        value={line.account_id}
                        onChange={(e) => updateLine(idx, "account_id", e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_code} - {a.account_name} ({a.account_type})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Debit"
                        value={line.debit || ""}
                        onChange={(e) => updateLine(idx, "debit", parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg text-right font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Credit"
                        value={line.credit || ""}
                        onChange={(e) => updateLine(idx, "credit", parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-lg text-right font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />

                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 2}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance Summary Card */}
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between font-mono ${
                isBalanced
                  ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300"
                  : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-300"
              }`}>
                <div>
                  <span>Debits: <strong>{formatCurrency(totalDebit)}</strong></span>
                  <span className="mx-2">|</span>
                  <span>Credits: <strong>{formatCurrency(totalCredit)}</strong></span>
                </div>
                <div className="font-semibold flex items-center space-x-1">
                  {isBalanced ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Balanced</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Out by {formatCurrency(difference)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !isBalanced}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {saving ? "Saving..." : "Save Draft Journal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reversal Reason */}
      {reversalModalId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Journal Reversal</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              A compensating journal entry with inverted debits and credits will be generated and posted automatically.
            </p>

            <form onSubmit={handleReverse} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Reversal Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Duplicate voucher entry"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setReversalModalId(null)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
                >
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
