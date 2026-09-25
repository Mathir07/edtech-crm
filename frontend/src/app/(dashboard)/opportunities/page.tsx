"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, Plus, Search, Filter, Building2, Kanban, ArrowRight, Layers, Download } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToCsv } from "@/lib/exportCsv";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  color: string;
}

interface Pipeline {
  id: string;
  name: string;
  is_default?: boolean;
  stages: PipelineStage[];
}

interface Opportunity {
  id: string;
  title: string;
  company_id: string;
  college_name?: string;
  pipeline_id?: string;
  pipeline_name?: string;
  stage_id: string;
  stage_name?: string;
  stage_color?: string;
  value: number;
  probability: number;
  expected_close_date?: string;
  status: string;
  owner_name?: string;
  created_at: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  // Create Opportunity Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    company_id: "",
    pipeline_id: "",
    stage_id: "",
    value: 500000,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      let query = "/opportunities?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (pipelineFilter) query += `pipeline_id=${encodeURIComponent(pipelineFilter)}&`;
      if (stageFilter) query += `stage_id=${encodeURIComponent(stageFilter)}&`;
      if (statusFilter) query += `status=${encodeURIComponent(statusFilter)}&`;

      const [opps, pipes, cols] = await Promise.all([
        api.get<Opportunity[]>(query),
        api.get<Pipeline[]>("/pipelines").catch(() => []),
        api.get<CompanyOption[]>("/companies").catch(() => []),
      ]);

      setOpportunities(opps);
      setPipelines(pipes);
      setCompanies(cols);

      if (pipes.length > 0 && !createForm.pipeline_id) {
        setCreateForm((prev) => ({
          ...prev,
          pipeline_id: pipes[0].id,
          stage_id: pipes[0].stages?.[0]?.id || "",
        }));
      }
    } catch (err) {
      console.error("Failed to load opportunities", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pipelineFilter, stageFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handlePipelineFilterChange = (newPipeId: string) => {
    setPipelineFilter(newPipeId);
    setStageFilter(""); // Reset stage filter when pipeline changes
  };

  const handleModalPipelineChange = (newPipeId: string) => {
    const targetPipe = pipelines.find((p) => p.id === newPipeId);
    setCreateForm((prev) => ({
      ...prev,
      pipeline_id: newPipeId,
      stage_id: targetPipe?.stages?.[0]?.id || "",
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.company_id || !createForm.stage_id) {
      toastError("Title, Company, and Stage are required.");
      return;
    }
    try {
      await api.post("/opportunities", createForm);
      success(`Opportunity "${createForm.title}" created successfully.`);
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toastError(err.detail || "Failed to create opportunity.");
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const query = new URLSearchParams();
      if (pipelineFilter) query.append("pipeline_id", pipelineFilter);
      if (stageFilter) query.append("stage_id", stageFilter);
      if (statusFilter) query.append("status", statusFilter);
      if (search) query.append("search", search);

      try {
        await api.downloadAndSave(
          `/opportunities/export?${query.toString()}`,
          `opportunities_export_${new Date().toISOString().slice(0, 10)}.csv`
        );
        success("Export complete", "Opportunities exported to CSV successfully.");
      } catch {
        // Instant client-side CSV export fallback
        const headers = [
          "Opportunity Title",
          "Company / College",
          "Pipeline",
          "Stage",
          "Value (INR)",
          "Probability (%)",
          "Expected Close Date",
          "Status",
          "Owner",
          "Created At",
        ];
        const rows = opportunities.map((o) => [
          o.title,
          o.college_name || "Enterprise Client",
          o.pipeline_name || "Sales",
          o.stage_name || "",
          o.value,
          o.probability,
          o.expected_close_date ? formatDate(o.expected_close_date) : "",
          o.status,
          o.owner_name || "",
          formatDate(o.created_at),
        ]);
        exportToCsv(`opportunities_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
        success("Export complete", "Opportunities exported to CSV successfully.");
      }
    } catch (err: any) {
      toastError("Export failed", err?.message || "Could not generate CSV file.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalValue = opportunities.reduce((acc, o) => acc + (Number(o.value) || 0), 0);

  // Determine stage options for filtering
  const selectedFilterPipe = pipelines.find((p) => p.id === pipelineFilter);
  const filterStages = selectedFilterPipe ? selectedFilterPipe.stages : [];

  // Stages available for the modal's selected pipeline
  const modalPipeline = pipelines.find((p) => p.id === createForm.pipeline_id) || pipelines[0];
  const modalStages = [...(modalPipeline?.stages || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Sales Opportunities</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Commercial deal tracking and contract negotiations across business lines.
          </p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors disabled:opacity-50"
            title="Export filtered opportunities to CSV / Excel"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500 dark:text-slate-400" />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>
          <a
            href="/pipeline"
            className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors"
          >
            <Kanban className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
            Switch to Kanban
          </a>
          {hasPermission("crm.opportunities.create") && (
            <button
              type="button"
              onClick={() => {
                if (pipelines.length > 0) {
                  const defaultP = pipelines.find((p) => p.is_default) || pipelines[0];
                  setCreateForm({
                    title: "",
                    company_id: companies[0]?.id || "",
                    pipeline_id: defaultP.id,
                    stage_id: defaultP.stages?.[0]?.id || "",
                    value: 500000,
                  });
                }
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Opportunity
            </button>
          )}
        </div>
      </div>

      {/* Filter and summary bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row items-center gap-4 justify-between">
        <form onSubmit={handleSearch} className="w-full lg:max-w-xs flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search deal, company, or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="ml-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Business Pipeline Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-2xs uppercase font-semibold text-slate-400 dark:text-slate-500">Pipeline:</span>
            <select
              value={pipelineFilter}
              onChange={(e) => handlePipelineFilterChange(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950"
            >
              <option value="">All Business Pipelines</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stage Filter (Conditional on Pipeline) */}
          {filterStages.length > 0 && (
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-2xs uppercase font-semibold text-slate-400 dark:text-slate-500">Stage:</span>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950"
              >
                <option value="">All Stages</option>
                {filterStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-2xs uppercase font-semibold text-slate-400 dark:text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-800">
            <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold">Total Value</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(totalValue)}</div>
          </div>
        </div>
      </div>

      {/* Active Filter Indicator & Result Counter */}
      {(search || pipelineFilter || stageFilter || statusFilter) && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase">Active Filters:</span>
            {search && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Search: "{search}"
              </span>
            )}
            {pipelineFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-indigo-700 dark:text-indigo-300">
                Pipeline: {pipelines.find((p) => p.id === pipelineFilter)?.name}
              </span>
            )}
            {stageFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Stage: {filterStages.find((s) => s.id === stageFilter)?.name}
              </span>
            )}
            {statusFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Status: {statusFilter}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">
              Showing {opportunities.length} {opportunities.length === 1 ? "deal" : "deals"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPipelineFilter("");
                setStageFilter("");
                setStatusFilter("");
              }}
              className="text-2xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading opportunities...</div>
        ) : opportunities.length === 0 ? (
          <EmptyState
            title="No opportunities found"
            description="Opportunities represent qualified institutional deals moving through your pipeline."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Deal Title</th>
                  <th className="py-3 px-4">Company / Account</th>
                  <th className="py-3 px-4">Business Pipeline</th>
                  <th className="py-3 px-4">Pipeline Stage</th>
                  <th className="py-3 px-4">Contract Value</th>
                  <th className="py-3 px-4">Close Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      <a href={`/opportunities/${opp.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                        {opp.title}
                      </a>
                    </td>
                    <td className="py-3.5 px-4">
                      <a
                        href={`/companies/${opp.company_id}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                      >
                        <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                        {opp.college_name || "Institution"}
                      </a>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {opp.pipeline_name || "Sales Pipeline"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold"
                        style={{
                          backgroundColor: `${opp.stage_color || "#6366f1"}15`,
                          color: opp.stage_color || "#6366f1",
                        }}
                      >
                        {opp.stage_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {formatCurrency(opp.value)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-2xs">
                      {formatDate(opp.expected_close_date)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="status" status={opp.status}>
                        {opp.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/opportunities/${opp.id}`}
                        className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        View Deal <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Opportunity Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Opportunity"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Opportunity Title *
            </label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g. IT Infrastructure Managed Services"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Company / Account *
            </label>
            <select
              required
              value={createForm.company_id}
              onChange={(e) => setCreateForm({ ...createForm, company_id: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
            >
              <option value="">Select Account...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Business Pipeline *
              </label>
              <select
                required
                value={createForm.pipeline_id}
                onChange={(e) => handleModalPipelineChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Stage *
              </label>
              <select
                required
                value={createForm.stage_id}
                onChange={(e) => setCreateForm({ ...createForm, stage_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                {modalStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Deal Value (₹) *
            </label>
            <input
              type="number"
              required
              value={createForm.value}
              onChange={(e) => setCreateForm({ ...createForm, value: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Save Opportunity
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
