"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Plus,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Layers,
  Play,
  History,
  Bug,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";

interface QADashboardStats {
  total_test_cases: number;
  passed_cases: number;
  failed_cases: number;
  blocked_cases: number;
  not_executed_cases: number;
  pass_rate: number;
  total_bugs: number;
  open_bugs: number;
  critical_bugs: number;
  resolved_bugs: number;
  retest_required_bugs: number;
  closed_bugs: number;
  qa_progress: number;
}

interface TestSuite {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  module: string | null;
  status: string;
  test_cases_count: number;
}

interface TestExecution {
  id: string;
  result: string;
  actual_result: string | null;
  comments: string | null;
  environment: string | null;
  build_version: string | null;
  executed_by_name: string | null;
  execution_date: string;
}

interface TestCase {
  id: string;
  test_case_number: string;
  test_suite_id: string;
  test_suite_name: string | null;
  title: string;
  description: string | null;
  preconditions: string | null;
  test_steps: string | null;
  expected_result: string | null;
  priority: string;
  status: string;
  latest_result: string | null;
  executions: TestExecution[];
}

export default function ProjectQAPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { hasPermission } = useAuth();

  const [stats, setStats] = useState<QADashboardStats | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Modals
  const [isSuiteModalOpen, setIsSuiteModalOpen] = useState(false);
  const [suiteForm, setSuiteForm] = useState({ name: "", description: "", module: "Core Module" });

  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseForm, setCaseForm] = useState({
    title: "",
    test_suite_id: "",
    description: "",
    preconditions: "",
    test_steps: "",
    expected_result: "",
    priority: "HIGH",
  });

  const [selectedCaseForExec, setSelectedCaseForExec] = useState<TestCase | null>(null);
  const [execForm, setExecForm] = useState({
    result: "PASS",
    actual_result: "",
    comments: "",
    environment: "Staging",
    build_version: "v2.0.0",
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadAllQA();
  }, [projectId, selectedSuiteId]);

  const loadAllQA = async () => {
    try {
      setLoading(true);
      const [statsData, suitesData, casesData] = await Promise.all([
        api.get<QADashboardStats>(`/projects/${projectId}/qa/dashboard`),
        api.get<TestSuite[]>(`/projects/${projectId}/test-suites`),
        api.get<TestCase[]>(
          `/projects/${projectId}/test-cases${selectedSuiteId !== "ALL" ? `?test_suite_id=${selectedSuiteId}` : ""}`
        ),
      ]);
      setStats(statsData);
      setSuites(suitesData);
      setCases(casesData);

      if (suitesData.length > 0 && !caseForm.test_suite_id) {
        setCaseForm((prev) => ({ ...prev, test_suite_id: suitesData[0].id }));
      }
    } catch (err) {
      console.error("Failed to load QA data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/projects/${projectId}/test-suites`, suiteForm);
      setIsSuiteModalOpen(false);
      setSuiteForm({ name: "", description: "", module: "Core Module" });
      loadAllQA();
    } catch (err: any) {
      setActionError(err.detail || "Failed to create test suite");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/test-suites/${caseForm.test_suite_id}/test-cases`, caseForm);
      setIsCaseModalOpen(false);
      setCaseForm({
        title: "",
        test_suite_id: suites[0]?.id || "",
        description: "",
        preconditions: "",
        test_steps: "",
        expected_result: "",
        priority: "HIGH",
      });
      loadAllQA();
    } catch (err: any) {
      setActionError(err.detail || "Failed to create test case");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForExec) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post(`/test-cases/${selectedCaseForExec.id}/execute`, execForm);
      setSelectedCaseForExec(null);
      setExecForm({
        result: "PASS",
        actual_result: "",
        comments: "",
        environment: "Staging",
        build_version: "v2.0.0",
      });
      loadAllQA();
    } catch (err: any) {
      setActionError(err.detail || "Failed to record execution");
    } finally {
      setActionLoading(false);
    }
  };

  const getResultBadge = (result: string | null) => {
    if (!result) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <Clock className="w-3 h-3 mr-1" />
          NOT EXECUTED
        </span>
      );
    }
    const config: Record<string, { bg: string; text: string; icon: any }> = {
      PASS: { bg: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300", text: "PASSED", icon: CheckCircle2 },
      FAIL: { bg: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300", text: "FAILED", icon: XCircle },
      BLOCKED: { bg: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300", text: "BLOCKED", icon: AlertCircle },
      SKIPPED: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300", text: "SKIPPED", icon: Clock },
    };
    const c = config[result] || { bg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400", text: result, icon: Clock };
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold ${c.bg}`}>
        <Icon className="w-3 h-3 mr-1" />
        {c.text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href={`/projects/${projectId}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center space-x-1">
              <ArrowLeft className="w-3 h-3 mr-1" />
              <span>Back to Project 360</span>
            </Link>
          </div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">QA Testing & Verification Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Quality Assurance
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage institutional test suites, run execution verification, and track quality gating metrics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {hasPermission("qa.create") && (
            <>
              <button
                onClick={() => setIsSuiteModalOpen(true)}
                className="inline-flex items-center px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold shadow-2xs transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Suite
              </button>
              <button
                onClick={() => setIsCaseModalOpen(true)}
                disabled={suites.length === 0}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Test Case
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Test Cases</span>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total_test_cases}</div>
            <div className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">{suites.length} Active Suites</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-2xs">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Pass Rate</span>
            <div className="mt-2 text-2xl font-bold text-indigo-900 dark:text-indigo-200">{stats.pass_rate.toFixed(1)}%</div>
            <div className="text-3xs text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.passed_cases} of {stats.total_test_cases} passed</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-2xs">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Passed</span>
            <div className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">{stats.passed_cases}</div>
            <div className="text-3xs text-emerald-600 dark:text-emerald-400 mt-0.5">Verified clean</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20 shadow-2xs">
            <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Failed</span>
            <div className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-200">{stats.failed_cases}</div>
            <div className="text-3xs text-rose-600 dark:text-rose-400 mt-0.5">Needs defect fix</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 shadow-2xs">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Blocked</span>
            <div className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">{stats.blocked_cases}</div>
            <div className="text-3xs text-amber-600 dark:text-amber-400 mt-0.5">Environment / deps</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/20 shadow-2xs">
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Open Bugs</span>
            <div className="mt-2 text-2xl font-bold text-red-900 dark:text-red-200">{stats.open_bugs}</div>
            <div className="text-3xs text-red-600 dark:text-red-400 mt-0.5">{stats.critical_bugs} Critical / Blocker</div>
          </div>
        </div>
      )}

      {/* Test Suites Filter Chips */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center space-x-2 overflow-x-auto">
        <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-2 mr-1 shrink-0" />
        <button
          onClick={() => setSelectedSuiteId("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            selectedSuiteId === "ALL" ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Test Suites
        </button>
        {suites.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSuiteId(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedSuiteId === s.id ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {s.name} ({s.test_cases_count})
          </button>
        ))}
      </div>

      {/* Test Cases Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading test cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center">
            <FlaskConical className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Test Cases in Suite</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Create test suites and test cases to start recording execution runs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-2xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Case Ref</th>
                  <th className="px-5 py-3">Suite & Title</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Latest Status</th>
                  <th className="px-5 py-3">Run History</th>
                  <th className="px-5 py-3 text-right">Execute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                      {c.test_case_number}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{c.title}</div>
                      {c.test_suite_name && (
                        <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">{c.test_suite_name}</div>
                      )}
                      {c.expected_result && (
                        <div className="text-3xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic">
                          Expects: {c.expected_result}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-2xs font-semibold">
                      <span className={`px-2 py-0.5 rounded ${
                        c.priority === "CRITICAL" || c.priority === "HIGH" ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}>
                        {c.priority}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {getResultBadge(c.latest_result)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <div className="flex items-center space-x-1">
                        <History className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{c.executions?.length || 0} runs</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      {hasPermission("qa.execute") && (
                        <button
                          onClick={() => setSelectedCaseForExec(c)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          <span>Run Test</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Suite Modal */}
      <Modal isOpen={isSuiteModalOpen} onClose={() => setIsSuiteModalOpen(false)} title="Create New Test Suite">
        <form onSubmit={handleCreateSuite} className="space-y-4 text-sm">
          {actionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs">
              {actionError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Test Suite Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Identity & Access Management Suite"
              value={suiteForm.name}
              onChange={(e) => setSuiteForm({ ...suiteForm, name: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Module</label>
            <input
              type="text"
              placeholder="e.g. Authentication, Billing, LMS"
              value={suiteForm.module}
              onChange={(e) => setSuiteForm({ ...suiteForm, module: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={suiteForm.description}
              onChange={(e) => setSuiteForm({ ...suiteForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSuiteModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Creating..." : "Create Suite"}
            </button>
          </div>
        </form>
      </Modal>

      {/* New Test Case Modal */}
      <Modal isOpen={isCaseModalOpen} onClose={() => setIsCaseModalOpen(false)} title="Create New Test Case" maxWidth="lg">
        <form onSubmit={handleCreateCase} className="space-y-4 text-sm">
          {actionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs">
              {actionError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Test Suite *</label>
            <select
              required
              value={caseForm.test_suite_id}
              onChange={(e) => setCaseForm({ ...caseForm, test_suite_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {suites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Test Case Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Verify Login with Valid Credentials"
                value={caseForm.title}
                onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={caseForm.priority}
                onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Preconditions</label>
            <input
              type="text"
              placeholder="e.g. Admin user exists and is active"
              value={caseForm.preconditions}
              onChange={(e) => setCaseForm({ ...caseForm, preconditions: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Test Steps</label>
            <textarea
              rows={3}
              placeholder="1. Navigate to login&#10;2. Input valid credentials&#10;3. Click submit"
              value={caseForm.test_steps}
              onChange={(e) => setCaseForm({ ...caseForm, test_steps: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Result</label>
            <input
              type="text"
              placeholder="e.g. 200 OK returned and JWT token issued"
              value={caseForm.expected_result}
              onChange={(e) => setCaseForm({ ...caseForm, expected_result: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCaseModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Create Test Case"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Execute Test Case Modal */}
      {selectedCaseForExec && (
        <Modal
          isOpen={!!selectedCaseForExec}
          onClose={() => setSelectedCaseForExec(null)}
          title={`Execute: ${selectedCaseForExec.test_case_number}`}
          maxWidth="md"
        >
          <form onSubmit={handleExecuteTest} className="space-y-4 text-sm">
            {actionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs">
                {actionError}
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100">{selectedCaseForExec.title}</div>
              {selectedCaseForExec.expected_result && (
                <div className="text-slate-600 dark:text-slate-400 italic">Expected: {selectedCaseForExec.expected_result}</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Execution Result *</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "PASS", label: "PASS", bg: "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:bg-emerald-100 dark:active:bg-emerald-900/50", active: "bg-emerald-600 text-white" },
                  { id: "FAIL", label: "FAIL", bg: "hover:bg-rose-50 dark:hover:bg-rose-950/40 active:bg-rose-100 dark:active:bg-rose-900/50", active: "bg-rose-600 text-white" },
                  { id: "BLOCKED", label: "BLOCKED", bg: "hover:bg-amber-50 dark:hover:bg-amber-950/40 active:bg-amber-100 dark:active:bg-amber-900/50", active: "bg-amber-600 text-white" },
                  { id: "SKIPPED", label: "SKIPPED", bg: "hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700", active: "bg-slate-700 dark:bg-slate-600 text-white" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setExecForm({ ...execForm, result: btn.id })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      execForm.result === btn.id
                        ? `${btn.active} border-transparent shadow-xs`
                        : `border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 ${btn.bg}`
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Environment</label>
                <input
                  type="text"
                  placeholder="e.g. Staging, Lab 01"
                  value={execForm.environment}
                  onChange={(e) => setExecForm({ ...execForm, environment: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Build / Release Version</label>
                <input
                  type="text"
                  placeholder="e.g. v2.1.0-rc2"
                  value={execForm.build_version}
                  onChange={(e) => setExecForm({ ...execForm, build_version: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Actual Result Observed</label>
              <textarea
                rows={2}
                placeholder="What actually occurred during the run..."
                value={execForm.actual_result}
                onChange={(e) => setExecForm({ ...execForm, actual_result: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Execution Comments</label>
              <input
                type="text"
                placeholder="Notes or logs reference..."
                value={execForm.comments}
                onChange={(e) => setExecForm({ ...execForm, comments: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCaseForExec(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Record Execution"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
