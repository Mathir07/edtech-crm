"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileCheck2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
  Building2,
  Calendar,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Contract {
  id: string;
  contract_number: string;
  company_id: string;
  college_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  quotation_id: string | null;
  quotation_number: string | null;
  title: string;
  start_date: string;
  end_date: string;
  contract_value: number;
  currency: string;
  status: string;
  description: string | null;
  terms: string | null;
  signed_date: string | null;
  created_by_id: string | null;
  creator_name: string | null;
  approved_by_id: string | null;
  approver_name: string | null;
  created_at: string;
  updated_at: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

export default function ContractsListPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Detail Modal
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    company_id: "",
    contract_value: 0,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
    signed_date: "",
    description: "",
    terms: "Payment terms: 50% advance upon contract signing, 50% upon deployment sign-off. Net 30 days. Standard SLA guarantees 99.9% platform availability.",
  });

  useEffect(() => {
    loadContracts();
  }, [search, statusFilter]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const [contractsData, companiesData] = await Promise.all([
        api.get<Contract[]>(`/contracts?${params.toString()}`),
        api.get<CompanyOption[]>("/companies"),
      ]);
      setContracts(contractsData || []);
      setCompanies(companiesData || []);
      if (companiesData && companiesData.length > 0 && !form.company_id) {
        setForm((prev) => ({ ...prev, company_id: companiesData[0].id }));
      }
    } catch (err) {
      console.error("Failed to load contracts", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_id) {
      toast.error("Please select a company");
      return;
    }
    try {
      setCreateLoading(true);
      await api.post("/contracts", {
        ...form,
        contract_value: Number(form.contract_value),
        signed_date: form.signed_date || null,
      });
      toast.success("Contract created successfully");
      setIsCreateOpen(false);
      setForm({
        title: "",
        company_id: companies[0]?.id || "",
        contract_value: 0,
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
        signed_date: "",
        description: "",
        terms: "Payment terms: 50% advance upon contract signing, 50% upon deployment sign-off.",
      });
      loadContracts();
    } catch (err: any) {
      toast.error(err.detail || "Failed to create contract");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleActivate = async (contractId: string) => {
    if (!confirm("Are you sure you want to mark this contract as Signed & Active?")) return;
    try {
      await api.post(`/contracts/${contractId}/activate`, {});
      toast.success("Contract marked as Signed & Active");
      loadContracts();
      if (selectedContract && selectedContract.id === contractId) {
        setSelectedContract(null);
      }
    } catch (err: any) {
      toast.error(err.detail || "Failed to activate contract");
    }
  };

  const handleCancel = async (contractId: string) => {
    if (!confirm("Are you sure you want to cancel this contract?")) return;
    try {
      await api.post(`/contracts/${contractId}/cancel`, {});
      toast.success("Contract cancelled");
      loadContracts();
      if (selectedContract && selectedContract.id === contractId) {
        setSelectedContract(null);
      }
    } catch (err: any) {
      toast.error(err.detail || "Failed to cancel contract");
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const statusBadges: Record<string, { bg: string; text: string; icon: any }> = {
    Draft: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", icon: Clock },
    Active: { bg: "bg-emerald-100 dark:bg-emerald-950/50", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
    Expired: { bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-800 dark:text-amber-300", icon: AlertTriangle },
    Terminated: { bg: "bg-rose-100 dark:bg-rose-950/50", text: "text-rose-800 dark:text-rose-300", icon: XCircle },
    Cancelled: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500 dark:text-slate-400", icon: XCircle },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Institutional Contracts & MSAs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Master service agreements, commercial terms, digital signatures, and multi-year institution commitments.
          </p>
        </div>
        {hasPermission("sales.contracts.create") && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Contract
          </button>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          {["ALL", "Draft", "Active", "Expired", "Terminated", "Cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {st === "ALL" ? "All Contracts" : st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search contract # or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Contract Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Contract #</th>
                <th className="px-6 py-3.5">Title & Agreement</th>
                <th className="px-6 py-3.5">Company / Client</th>
                <th className="px-6 py-3.5">Period</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Annual Value</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500">
                    Loading contracts...
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 dark:text-slate-500">
                    No contracts found matching your criteria.
                  </td>
                </tr>
              ) : (
                contracts.map((c) => {
                  const badge = statusBadges[c.status] || {
                    bg: "bg-slate-100 dark:bg-slate-800",
                    text: "text-slate-600 dark:text-slate-400",
                    icon: Clock,
                  };
                  const Icon = badge.icon;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        <button
                          onClick={() => setSelectedContract(c)}
                          className="hover:underline text-left"
                        >
                          {c.contract_number}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate">{c.title}</div>
                        {c.quotation_number && (
                          <div className="text-2xs text-slate-400 dark:text-slate-500 font-mono">
                            Ref Quote: {c.quotation_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{c.college_name || "Independent"}</div>
                        {c.contact_name && <div className="text-xs text-slate-400 dark:text-slate-500">{c.contact_name}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        {c.start_date} <span className="text-slate-400 dark:text-slate-600">→</span> {c.end_date}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(c.contract_value)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedContract(c)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Details
                        </button>
                        {c.status === "Draft" && hasPermission("sales.contracts.approve") && (
                          <button
                            onClick={() => handleActivate(c.id)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Sign & Activate
                          </button>
                        )}
                        {c.status !== "Cancelled" && hasPermission("sales.contracts.edit") && (
                          <button
                            onClick={() => handleCancel(c.id)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Detail Modal */}
      {selectedContract && (
        <Modal
          isOpen={!!selectedContract}
          onClose={() => setSelectedContract(null)}
          title={`Contract: ${selectedContract.contract_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedContract.title}</h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Client: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedContract.college_name}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold">Total Contract Value</div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedContract.contract_value)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-3xs">Status</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-1 inline-block">{selectedContract.status}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-3xs">Start Date</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-1 inline-block">{selectedContract.start_date}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-3xs">End Date</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-1 inline-block">{selectedContract.end_date}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block uppercase font-semibold text-3xs">Signed Date</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 mt-1 inline-block">
                  {selectedContract.signed_date || "Pending Signature"}
                </span>
              </div>
            </div>

            {selectedContract.description && (
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">
                  Scope & Overview
                </h5>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  {selectedContract.description}
                </p>
              </div>
            )}

            {selectedContract.terms && (
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">
                  Commercial Terms & SLA
                </h5>
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed font-mono">
                  {selectedContract.terms}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
              <div>Created by: {selectedContract.creator_name || "System"}</div>
              {selectedContract.approver_name && <div>Approved by: {selectedContract.approver_name}</div>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {selectedContract.status === "Draft" && hasPermission("sales.contracts.approve") && (
                <button
                  onClick={() => handleActivate(selectedContract.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Sign & Activate Contract
                </button>
              )}
              <button
                onClick={() => setSelectedContract(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Contract Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Institutional Contract" maxWidth="xl">
        <form onSubmit={handleCreate} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contract Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Master Services Agreement - 3 Year ERP Cloud"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Institution / Company *</label>
              <select
                required
                value={form.company_id}
                onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.organization_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contract Value (INR) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.contract_value}
                onChange={(e) => setForm({ ...form, contract_value: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Signed Date (Optional)</label>
              <input
                type="date"
                value={form.signed_date}
                onChange={(e) => setForm({ ...form, signed_date: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Scope of work, campus software licensing details..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Commercial Terms & Conditions</label>
            <textarea
              rows={3}
              placeholder="Payment milestones, warranties, SLA penalties..."
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {createLoading ? "Creating..." : "Create Contract"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
