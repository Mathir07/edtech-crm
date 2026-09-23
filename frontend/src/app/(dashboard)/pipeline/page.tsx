"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Kanban as KanbanIcon,
  Search,
  Plus,
  ArrowRight,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  LayoutGrid,
  List,
  CheckCircle2,
  Layers,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
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
  value: number;
  probability: number;
  expected_close_date?: string;
  status: string;
  owner_name?: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [movingOppId, setMovingOppId] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  // Create Opportunity Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    company_id: "",
    pipeline_id: "",
    stage_id: "",
    value: 500000,
  });

  const loadData = async (targetPipelineId?: string) => {
    try {
      setLoading(true);
      const [pipes, cols] = await Promise.all([
        api.get<Pipeline[]>("/pipelines"),
        api.get<CompanyOption[]>("/companies"),
      ]);
      setPipelines(pipes);
      setCompanies(cols);

      // Determine active pipeline: passed arg -> current state -> EdTech -> default -> first
      let activePipeId = targetPipelineId || selectedPipelineId;
      if (!activePipeId && pipes.length > 0) {
        const edTech = pipes.find((p) => p.name.toLowerCase().includes("edtech"));
        const defaultPipe = pipes.find((p) => p.is_default);
        activePipeId = (edTech || defaultPipe || pipes[0]).id;
      }
      setSelectedPipelineId(activePipeId);

      if (activePipeId) {
        const opps = await api.get<Opportunity[]>(`/opportunities?pipeline_id=${activePipeId}`);
        setOpportunities(opps);
        const activePipe = pipes.find((p) => p.id === activePipeId);
        if (activePipe && activePipe.stages.length > 0) {
          setCreateForm((prev) => ({
            ...prev,
            pipeline_id: activePipe.id,
            stage_id: activePipe.stages[0].id,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load pipeline data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPipeline = async (pipeId: string) => {
    setSelectedPipelineId(pipeId);
    try {
      const opps = await api.get<Opportunity[]>(`/opportunities?pipeline_id=${pipeId}`);
      setOpportunities(opps);
      const activePipe = pipelines.find((p) => p.id === pipeId);
      if (activePipe && activePipe.stages.length > 0) {
        setCreateForm((prev) => ({
          ...prev,
          pipeline_id: activePipe.id,
          stage_id: activePipe.stages[0].id,
        }));
      }
    } catch (err) {
      console.error("Failed to load opportunities for pipeline", err);
    }
  };

  const handleStageMove = async (oppId: string, targetStageId: string) => {
    try {
      setMovingOppId(oppId);
      await api.patch(`/opportunities/${oppId}/stage`, { stage_id: targetStageId });
      success("Pipeline stage updated successfully.");
      const updatedOpps = await api.get<Opportunity[]>(`/opportunities?pipeline_id=${selectedPipelineId}`);
      setOpportunities(updatedOpps);
    } catch (err: any) {
      toastError(err.detail || "Failed to update pipeline stage.");
    } finally {
      setMovingOppId(null);
    }
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
      // Switch view to the newly created opportunity's pipeline
      handleSelectPipeline(createForm.pipeline_id);
    } catch (err: any) {
      toastError(err.detail || "Failed to create opportunity.");
    }
  };

  const activePipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading sales pipelines...</div>;
  }

  if (!activePipeline || activePipeline.stages.length === 0) {
    return (
      <EmptyState
        title="No active pipeline found"
        description="Please check system configuration for sales pipelines."
      />
    );
  }

  // Filter opps by search
  const filteredOpps = opportunities.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.title.toLowerCase().includes(s) ||
      (o.college_name && o.college_name.toLowerCase().includes(s))
    );
  });

  const stages = [...activePipeline.stages].sort((a, b) => a.order - b.order);
  const totalPipelineVal = filteredOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
  const wonDealsCount = filteredOpps.filter((o) => o.status === "Won").length;
  const activeDealsCount = filteredOpps.filter((o) => o.status !== "Lost").length;

  // Stages available for the modal's selected pipeline
  const modalPipeline = pipelines.find((p) => p.id === createForm.pipeline_id) || activePipeline;
  const modalStages = [...(modalPipeline?.stages || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Sales Pipeline</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {activePipeline.name}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visual stage progression and deal tracking across business lines.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === "kanban" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Board / Kanban View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                viewMode === "table" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="List / Table View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          {hasPermission("crm.opportunities.create") && (
            <button
              type="button"
              onClick={() => {
                setCreateForm({
                  title: "",
                  company_id: companies[0]?.id || "",
                  pipeline_id: activePipeline.id,
                  stage_id: stages[0]?.id || "",
                  value: 500000,
                });
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

      {/* PART 1: Business Pipeline Selector */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 shrink-0 flex items-center">
              <Layers className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
              Business Pipeline:
            </span>
            {pipelines.map((pipe) => {
              const isActive = pipe.id === selectedPipelineId;
              return (
                <button
                  key={pipe.id}
                  type="button"
                  onClick={() => handleSelectPipeline(pipe.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{pipe.name}</span>
                  {pipe.is_default && (
                    <span
                      className={`text-3xs px-1.5 py-0.2 rounded font-bold uppercase ${
                        isActive ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center space-x-3 text-xs shrink-0 pl-2 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-2 sm:pt-0">
            <div>
              <span className="text-2xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Total Value: </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(totalPipelineVal)}</span>
            </div>
            <div className="text-slate-200 dark:text-slate-700">•</div>
            <div>
              <span className="text-2xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Deals: </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredOpps.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center max-w-md">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
        <input
          type="text"
          placeholder={`Filter ${activePipeline.name} deals by title or account...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-hidden bg-transparent"
        />
      </div>

      {/* 1. KANBAN BOARD VIEW */}
      {viewMode === "kanban" && (
        <div className="flex space-x-4 overflow-x-auto pb-6 min-h-[650px] scrollbar-thin">
          {stages.map((stg, stgIdx) => {
            const stageOpps = filteredOpps.filter((o) => o.stage_id === stg.id);
            const stageTotal = stageOpps.reduce((acc, o) => acc + (Number(o.value) || 0), 0);

            return (
              <div
                key={stg.id}
                className="w-80 shrink-0 bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col shadow-2xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800 mb-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: stg.color || "#4f46e5" }}
                    />
                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[170px] uppercase tracking-wide">
                      {stg.name}
                    </h3>
                    <span className="text-2xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                      {stageOpps.length}
                    </span>
                  </div>
                  <span className="text-2xs font-mono font-bold text-slate-600 dark:text-slate-300">
                    {formatCurrency(stageTotal)}
                  </span>
                </div>

                {/* Opportunity Cards List */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {stageOpps.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      No deals in stage
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <div
                        key={opp.id}
                        className={`bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-3 ${
                          movingOppId === opp.id ? "opacity-40 animate-pulse" : ""
                        }`}
                      >
                        <div>
                          <Link
                            href={`/opportunities/${opp.id}`}
                            className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2"
                          >
                            {opp.title}
                          </Link>
                          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <Building2 className="w-3 h-3 mr-1 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span className="truncate">{opp.college_name || "Institution"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono">
                            {formatCurrency(opp.value)}
                          </span>
                          <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                            {opp.probability}% Prob
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-2xs text-slate-400 dark:text-slate-500">
                          <span>Owner: {opp.owner_name?.split(" ")?.[0] || "Team"}</span>
                          {opp.expected_close_date && <span>Close: {formatDate(opp.expected_close_date)}</span>}
                        </div>

                        {/* Stage Movement Controls */}
                        {hasPermission("crm.opportunities.edit") && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <button
                              type="button"
                              disabled={stgIdx === 0}
                              onClick={() => handleStageMove(opp.id, stages[stgIdx - 1].id)}
                              className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                              title="Move back a stage"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>

                            <select
                              value={opp.stage_id}
                              onChange={(e) => handleStageMove(opp.id, e.target.value)}
                              className="text-2xs font-medium text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 max-w-[130px]"
                            >
                              {stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={stgIdx === stages.length - 1}
                              onClick={() => handleStageMove(opp.id, stages[stgIdx + 1].id)}
                              className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                              title="Move forward a stage"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. TABLE / LIST VIEW */}
      {viewMode === "table" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-2xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Opportunity</th>
                  <th className="py-3 px-4">Company / Account</th>
                  <th className="py-3 px-4">Business Pipeline</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Probability</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Close Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredOpps.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No opportunities match your filter in this pipeline.
                    </td>
                  </tr>
                ) : (
                  filteredOpps.map((opp) => {
                    const stg = stages.find((s) => s.id === opp.stage_id);
                    return (
                      <tr key={opp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                          <Link href={`/opportunities/${opp.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                            {opp.title}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {opp.college_name || "Associated Account"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {activePipeline.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
                            style={{
                              backgroundColor: `${stg?.color || "#4f46e5"}15`,
                              color: stg?.color || "#4f46e5",
                            }}
                          >
                            {stg?.name || "Stage"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                          {formatCurrency(opp.value)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{opp.probability}%</td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{opp.owner_name || "Unassigned"}</td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-2xs">
                          {opp.expected_close_date ? formatDate(opp.expected_close_date) : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/opportunities/${opp.id}`}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold"
                          >
                            Details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Opportunity Modal with Pipeline & Stage Selection */}
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
              placeholder="e.g. Campus LMS Rollout 2026"
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
