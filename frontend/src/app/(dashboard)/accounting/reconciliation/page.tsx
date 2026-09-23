"use client";

import React, { useEffect, useState } from "react";
import {
  Scale,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  DollarSign,
  Building2,
  CheckSquare,
  Square,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReconciliationItem {
  id: string;
  reconciliation_id: string;
  journal_line_id: string;
  transaction_date: string;
  reference: string | null;
  description: string | null;
  amount: number;
  matched: boolean;
  matched_at: string | null;
}

interface ReconciliationSession {
  id: string;
  account_id: string;
  statement_date: string;
  statement_balance: number;
  gl_balance: number;
  difference: number;
  status: "DRAFT" | "RECONCILED";
  notes: string | null;
  items: ReconciliationItem[];
  created_at: string;
  reconciled_at: string | null;
}

interface BankAccount {
  id: string;
  account_code: string;
  account_name: string;
  current_balance: number;
  is_bank_or_cash: boolean;
}

export default function BankReconciliationPage() {
  const { hasPermission } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [activeSession, setActiveSession] = useState<ReconciliationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Session Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split("T")[0]);
  const [statementBalance, setStatementBalance] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Matching selections
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [matching, setMatching] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [accRes, reconRes] = await Promise.all([
        api.get<BankAccount[]>("/accounting/accounts"),
        api.get<ReconciliationSession[]>("/accounting/reconciliation"),
      ]);

      const banks = (accRes || []).filter((a) => a.is_bank_or_cash);
      setBankAccounts(banks);
      if (banks.length > 0 && !selectedAccountId) {
        setSelectedAccountId(banks[0].id);
      }

      setSessions(reconRes || []);
      if (reconRes && reconRes.length > 0 && !activeSession) {
        // Open the most recent session by default
        setActiveSession(reconRes[0]);
        setSelectedItemIds(
          reconRes[0].items.filter((it) => it.matched).map((it) => it.id)
        );
      }
    } catch (err: any) {
      console.error("Failed to load reconciliations:", err);
      setError(err?.detail || "Could not load bank reconciliation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setError("Please select a bank account.");
      return;
    }

    try {
      setStartingSession(true);
      setError(null);
      const res = await api.post<ReconciliationSession>("/accounting/reconciliation", {
        account_id: selectedAccountId,
        statement_date: statementDate,
        statement_balance: Number(statementBalance),
        notes,
      });

      setIsModalOpen(false);
      setActiveSession(res);
      setSelectedItemIds(res.items.filter((it) => it.matched).map((it) => it.id));
      setActionSuccess("Bank reconciliation session created! Match items below to reconcile.");
      await fetchData();
    } catch (err: any) {
      console.error("Error starting reconciliation:", err);
      setError(err?.detail || "Failed to start bank reconciliation.");
    } finally {
      setStartingSession(false);
    }
  };

  const toggleItem = (itemId: string) => {
    if (selectedItemIds.includes(itemId)) {
      setSelectedItemIds(selectedItemIds.filter((id) => id !== itemId));
    } else {
      setSelectedItemIds([...selectedItemIds, itemId]);
    }
  };

  const toggleAllItems = () => {
    if (!activeSession) return;
    if (selectedItemIds.length === activeSession.items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(activeSession.items.map((it) => it.id));
    }
  };

  const handleSaveMatching = async () => {
    if (!activeSession) return;
    try {
      setMatching(true);
      setError(null);
      const updated = await api.post<ReconciliationSession>(
        `/accounting/reconciliation/${activeSession.id}/match`,
        {
          matched_item_ids: selectedItemIds,
        }
      );

      setActiveSession(updated);
      if (updated.status === "RECONCILED") {
        setActionSuccess("Success! Bank account successfully reconciled with Zero Difference.");
      } else {
        setActionSuccess("Matched transactions updated.");
      }
      await fetchData();
    } catch (err: any) {
      console.error("Error matching items:", err);
      setError(err?.detail || "Failed to update matched items.");
    } finally {
      setMatching(false);
    }
  };

  // Live calculation of selected matched sum
  const activeItems = activeSession?.items || [];
  const matchedSum = activeItems
    .filter((it) => selectedItemIds.includes(it.id))
    .reduce((acc, it) => acc + Number(it.amount), 0);
  const liveDiff = activeSession ? Number(activeSession.statement_balance) - matchedSum : 0;

  const currentAcc = bankAccounts.find((a) => a.id === activeSession?.account_id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Scale className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Bank & Cash Reconciliation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Match General Ledger transactions against external bank statements to detect discrepancies.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Reconciliation Session
        </button>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-900 dark:text-emerald-300 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {actionSuccess}
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-900 dark:text-rose-300 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workbench Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Col: Sessions History List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
            Past Statements & Sessions ({sessions.length})
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 p-4 text-center">No reconciliation sessions yet.</p>
            ) : (
              sessions.map((s) => {
                const acc = bankAccounts.find((a) => a.id === s.account_id);
                const isActive = activeSession?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSession(s);
                      setSelectedItemIds(s.items.filter((it) => it.matched).map((it) => it.id));
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {acc?.account_name || "Bank Account"}
                      </span>
                      <Badge variant={s.status.toLowerCase() as any}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{formatDate(s.statement_date)}</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(s.statement_balance)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right 3 Cols: Active Session Workbench */}
        <div className="lg:col-span-3 space-y-6">
          {activeSession ? (
            <>
              {/* Active Session Summary Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {currentAcc ? `${currentAcc.account_code} - ${currentAcc.account_name}` : "Bank Account"}
                      </h2>
                      <Badge variant={activeSession.status.toLowerCase() as any}>
                        {activeSession.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Statement Date: <strong>{formatDate(activeSession.statement_date)}</strong>
                    </p>
                  </div>

                  {activeSession.status === "DRAFT" && (
                    <button
                      onClick={handleSaveMatching}
                      disabled={matching}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition-all ${
                        liveDiff === 0
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900"
                      } disabled:opacity-50`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {matching
                        ? "Saving..."
                        : liveDiff === 0
                        ? "Complete Reconciliation (0.00 Diff)"
                        : "Save Matched Items"}
                    </button>
                  )}
                </div>

                {/* KPI Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Statement Ending</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(activeSession.statement_balance)}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GL Book Balance</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(activeSession.gl_balance)}
                    </p>
                  </div>

                  <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800/60">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Matched Total</p>
                    <p className="text-lg font-bold text-indigo-900 dark:text-indigo-300 mt-1">
                      {formatCurrency(matchedSum)}
                    </p>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      liveDiff === 0
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
                        : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        liveDiff === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      Difference
                    </p>
                    <p
                      className={`text-lg font-bold mt-1 font-mono ${
                        liveDiff === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {formatCurrency(liveDiff)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transactions Checklist Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleAllItems}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    >
                      {selectedItemIds.length === activeItems.length ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      )}
                      Select All ({selectedItemIds.length}/{activeItems.length})
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Tick all items appearing on your bank statement.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">Match</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-6">Description</th>
                        <th className="py-3 px-6 text-right">Amount (Net)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                            No posted GL transactions found for this account up to the statement date.
                          </td>
                        </tr>
                      ) : (
                        activeItems.map((item) => {
                          const isChecked = selectedItemIds.includes(item.id);
                          return (
                            <tr
                              key={item.id}
                              onClick={() => {
                                if (activeSession.status === "DRAFT") toggleItem(item.id);
                              }}
                              className={`cursor-pointer transition-colors ${
                                isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                                {formatDate(item.transaction_date)}
                              </td>
                              <td className="py-3.5 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">
                                {item.reference || "—"}
                              </td>
                              <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-white text-xs">
                                {item.description}
                              </td>
                              <td className="py-3.5 px-6 text-right font-mono font-semibold text-slate-900 dark:text-white text-xs">
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-12 text-center">
              <Scale className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white">No Reconciliation Session Selected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Select an existing session from the left or create a new reconciliation session to begin matching.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Start Reconciliation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Start Bank Reconciliation Session
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartSession} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank / Cash Account <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  required
                >
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} - {a.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Statement Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={statementDate}
                    onChange={(e) => setStatementDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Statement Ending Balance <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={statementBalance}
                    onChange={(e) => setStatementBalance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Monthly reconciliation for HDFC Operating Account"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingSession}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
                >
                  {startingSession ? "Starting..." : "Start Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
