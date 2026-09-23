"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  TrendingUp,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface OpportunityDetail {
  id: string;
  title: string;
  description?: string;
  company_id: string;
  company_name?: string;
  contact_id?: string;
  contact_name?: string;
  pipeline_id: string;
  stage_id: string;
  stage_name?: string;
  stage_color?: string;
  value: number;
  probability: number;
  expected_close_date?: string;
  status: string;
  lost_reason?: string;
  won_at?: string;
  lost_at?: string;
  owner_name?: string;
  created_at: string;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  color: string;
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const oppId = params.id as string;
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [opp, setOpp] = useState<OpportunityDetail | null>(null);
  const [currentPipeline, setCurrentPipeline] = useState<any | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [oppData, pipelines, quotesData] = await Promise.all([
        api.get<OpportunityDetail>(`/opportunities/${oppId}`),
        api.get<any[]>("/pipelines"),
        api.get<any[]>(`/quotations?opportunity_id=${oppId}`),
      ]);
      setOpp(oppData);
      setQuotations(quotesData || []);
      const pipe = pipelines.find((p) => p.id === oppData.pipeline_id) || pipelines[0];
      setCurrentPipeline(pipe || null);
      if (pipe) {
        setStages(pipe.stages.sort((a: any, b: any) => a.order - b.order));
      }
    } catch (err) {
      console.error("Failed to load opportunity", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (oppId) loadData();
  }, [oppId]);

  const handleStageChange = async (targetStageId: string) => {
    try {
      setUpdating(true);
      await api.patch(`/opportunities/${oppId}/stage`, { stage_id: targetStageId });
      toast.success("Pipeline stage updated successfully");
      loadData();
    } catch (err: any) {
      toast.error(err.detail || "Failed to update stage");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading opportunity details...</div>;
  }

  if (!opp) {
    return (
      <EmptyState
        title="Opportunity not found"
        description="The deal record could not be found."
        actionLabel="Back to Opportunities"
        onAction={() => router.push("/opportunities")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/opportunities")}
          className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Opportunities
        </button>
        <div className="flex items-center space-x-2">
          {currentPipeline && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Pipeline: {currentPipeline.name}
            </span>
          )}
          <Badge variant="status" status={opp.status}>
            Status: {opp.status}
          </Badge>
        </div>
      </div>

      {/* Main Deal Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {currentPipeline?.name ? `${currentPipeline.name} Deal` : "Institutional Opportunity"}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{opp.title}</h1>
            <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <a
                href={`/companies/${opp.company_id}`}
                className="flex items-center text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                {opp.company_name || "Company 360 Profile"}
              </a>
              <span>•</span>
              <span>Owner: {opp.owner_name || "Sales Team"}</span>
              <span>•</span>
              <span>Created: {formatDate(opp.created_at)}</span>
            </div>
          </div>

          <div className="text-right bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Deal Contract Value</div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatCurrency(opp.value)}
            </div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              {opp.probability}% Probability
            </div>
          </div>
        </div>

        {/* Stage Progression Stepper */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            {currentPipeline?.name || "Pipeline"} Stage Progression (Click to advance)
          </div>
          <div className="flex flex-wrap gap-2">
            {stages.map((stg) => {
              const isCurrent = opp.stage_id === stg.id;
              return (
                <button
                  key={stg.id}
                  disabled={updating || !hasPermission("crm.opportunities.edit")}
                  onClick={() => handleStageChange(stg.id)}
                  className={`flex-1 min-w-[105px] p-2.5 rounded-xl border text-xs font-semibold text-center transition-all flex flex-col items-center justify-center ${
                    isCurrent
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full mb-1"
                    style={{ backgroundColor: stg.color }}
                  />
                  <span className="truncate w-full">{stg.name}</span>
                  <span className="text-3xs text-slate-400 dark:text-slate-500 font-normal mt-0.5">{stg.probability}%</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scope Details & Follow-up */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Commercial Requirements & Scope</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            {opp.description || "No description provided for this opportunity."}
          </p>

          {opp.lost_reason && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-1">
              <div className="font-bold flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1 text-rose-600 dark:text-rose-400" />
                Lost Reason Documented:
              </div>
              <p>{opp.lost_reason}</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Key Dates</h3>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-slate-400 dark:text-slate-500 font-semibold uppercase">Target Close Date</dt>
              <dd className="text-slate-800 dark:text-slate-200 font-bold text-sm mt-0.5">
                {formatDate(opp.expected_close_date)}
              </dd>
            </div>
            {opp.won_at && (
              <div>
                <dt className="text-slate-400 dark:text-slate-500 font-semibold uppercase">Closed Won Date</dt>
                <dd className="text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">{formatDateTime(opp.won_at)}</dd>
              </div>
            )}
            {opp.lost_at && (
              <div>
                <dt className="text-slate-400 dark:text-slate-500 font-semibold uppercase">Closed Lost Date</dt>
                <dd className="text-rose-700 dark:text-rose-400 font-bold mt-0.5">{formatDateTime(opp.lost_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Commercial Quotations Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center">
              <FileText className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
              Commercial Proposals & Quotations ({quotations.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Formal price quotes and discount approval requests associated with this opportunity.
            </p>
          </div>
          {hasPermission("sales.quotations.create") && (
            <Link
              href="/sales/quotations/new"
              className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create Quotation
            </Link>
          )}
        </div>

        {quotations.length === 0 ? (
          <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No formal quotations have been generated for this opportunity yet.
            </p>
            {hasPermission("sales.quotations.create") && (
              <Link
                href="/sales/quotations/new"
                className="inline-flex items-center mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Draft first quotation now →
              </Link>
            )}
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-3xs">
                <tr>
                  <th className="p-3.5">Quotation #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Subtotal</th>
                  <th className="p-3.5">GST (18%)</th>
                  <th className="p-3.5 font-bold text-slate-900 dark:text-slate-100">Total Amount</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotations.map((q: any) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      <Link href={`/sales/quotations/${q.id}`} className="hover:underline">
                        {q.quotation_number}
                      </Link>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{q.quotation_date}</td>
                    <td className="p-3.5">
                      <Badge variant="status" status={q.status}>
                        {q.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono">{formatCurrency(q.subtotal)}</td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{formatCurrency(q.tax_amount)}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(q.total_amount)}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/sales/quotations/${q.id}`}
                        className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        View & Act →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
