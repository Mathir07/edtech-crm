"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Bug,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderGit2,
  Paperclip,
  Send,
  Download,
  FileText,
  User,
  ShieldCheck,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface BugComment {
  id: string;
  bug_id: string;
  user_id: string;
  user_name: string | null;
  comment: string;
  created_at: string;
}

interface BugAttachment {
  id: string;
  bug_id: string;
  filename: string;
  file_size: number;
  content_type: string;
  uploaded_by_id: string;
  uploaded_by_name: string | null;
  created_at: string;
}

interface BugDetail {
  id: string;
  bug_number: string;
  project_id: string;
  project_name: string | null;
  test_case_id: string | null;
  test_case_number: string | null;
  title: string;
  description: string | null;
  severity: string;
  priority: string;
  status: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  reported_by_id: string | null;
  reported_by_name: string | null;
  environment: string | null;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  comments: BugComment[];
  attachments: BugAttachment[];
  created_at: string;
  updated_at: string;
}

export default function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const bugId = resolvedParams.id;
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [bug, setBug] = useState<BugDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Transition state
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    loadBug();
  }, [bugId]);

  const loadBug = async () => {
    try {
      setLoading(true);
      const data = await api.get<BugDetail>(`/bugs/${bugId}`);
      setBug(data);
    } catch (err) {
      console.error("Failed to load bug", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (newStatus: string, comment?: string) => {
    setTransitionLoading(true);
    setTransitionError(null);
    try {
      await api.patch(`/bugs/${bugId}/status`, { status: newStatus, comment: comment || undefined });
      toast.success(`Defect status moved to ${newStatus}`);
      loadBug();
    } catch (err: any) {
      const msg = err.detail || `Failed to update status to ${newStatus}`;
      setTransitionError(msg);
      toast.error(msg);
    } finally {
      setTransitionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      await api.post(`/bugs/${bugId}/comments`, { comment: commentText.trim() });
      toast.success("Comment added");
      setCommentText("");
      loadBug();
    } catch (err: any) {
      toast.error(err.detail || "Failed to post comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadLoading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      await api.upload(`/bugs/${bugId}/attachments`, formData);
      toast.success("Attachment uploaded successfully");
      setSelectedFile(null);
      loadBug();
    } catch (err: any) {
      setUploadError(err.detail || "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = async (attachmentId: string, filename: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("crm_access_token") : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const resp = await fetch(`${apiBase}/bugs/${bugId}/attachments/${attachmentId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("Download failed");

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(err.message || "Failed to download attachment");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Loading Defect Details...</div>;
  }

  if (!bug) {
    return (
      <div className="p-12 text-center">
        <Bug className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Defect Not Found</h3>
        <Link href="/bugs" className="text-rose-600 text-xs font-semibold hover:underline mt-2 inline-block">
          Return to Bug Tracker
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/bugs" className="hover:text-rose-600 dark:hover:text-rose-400 flex items-center space-x-1">
              <ArrowLeft className="w-3 h-3 mr-1" />
              <span>Bug Tracker</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{bug.bug_number}</span>
          </div>

          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{bug.title}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              bug.severity === "CRITICAL"
                ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-300 dark:border-red-800"
                : bug.severity === "HIGH"
                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-300 dark:border-orange-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}>
              {bug.severity}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {bug.status}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center space-x-1">
              <FolderGit2 className="w-3.5 h-3.5" />
              <Link href={`/projects/${bug.project_id}`} className="hover:underline text-indigo-600 dark:text-indigo-400 font-semibold">
                {bug.project_name || "Project"}
              </Link>
            </span>
            {bug.assigned_to_name && <span>Assignee: {bug.assigned_to_name}</span>}
            {bug.reported_by_name && <span>Reported by: {bug.reported_by_name}</span>}
          </div>
        </div>
      </div>

      {/* Workflow Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Controlled Workflow State Transitions
        </div>

        {transitionError && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium">
            {transitionError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {(bug.status === "OPEN" || bug.status === "ASSIGNED") && (
            <>
              <button
                onClick={() => handleTransition("IN_PROGRESS", "Starting investigation")}
                disabled={transitionLoading}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Progress (IN_PROGRESS)</span>
              </button>
              <button
                onClick={() => handleTransition("RESOLVED", "Fixed in codebase")}
                disabled={transitionLoading}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved (RESOLVED)</span>
              </button>
            </>
          )}

          {bug.status === "IN_PROGRESS" && (
            <button
              onClick={() => handleTransition("RESOLVED", "Fixed code and pushed build")}
              disabled={transitionLoading}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Resolved (RESOLVED)</span>
            </button>
          )}

          {bug.status === "RESOLVED" && (
            <button
              onClick={() => handleTransition("RETEST", "Deploying fix to test environment for QA verification")}
              disabled={transitionLoading}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify Fix (RETEST)</span>
            </button>
          )}

          {bug.status === "RETEST" && (
            <>
              <button
                onClick={() => handleTransition("CLOSED", "Fix verified on Staging build")}
                disabled={transitionLoading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Accept & Close (CLOSED)</span>
              </button>
              <button
                onClick={() => handleTransition("REOPENED", "Defect reproduced after fix attempt")}
                disabled={transitionLoading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reject & Reopen (REOPENED)</span>
              </button>
            </>
          )}

          {bug.status === "CLOSED" && (
            <button
              onClick={() => handleTransition("REOPENED", "Reopened due to regression")}
              disabled={transitionLoading}
              className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen Bug (REOPENED)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Details + Comments & Attachments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Bug SOW & Reproduction Steps */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Description</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {bug.description || "No extensive description provided."}
            </p>

            {bug.steps_to_reproduce && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Steps to Reproduce
                </h4>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {bug.steps_to_reproduce}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-3xs">Expected Result:</span>
                <p className="text-slate-800 dark:text-slate-200 mt-1">{bug.expected_result || "Not specified"}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-3xs">Actual Result:</span>
                <p className="text-rose-700 dark:text-rose-400 font-semibold mt-1">{bug.actual_result || "Not specified"}</p>
              </div>
            </div>
          </div>

          {/* Comments Thread */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Audit Comments & Developer Notes ({bug.comments?.length || 0})
            </h3>

            <div className="space-y-3">
              {bug.comments?.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No comments posted yet.</div>
              ) : (
                bug.comments.map((comm) => (
                  <div key={comm.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{comm.user_name || "Team Member"}</span>
                      <span className="font-mono">{new Date(comm.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{comm.comment}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Add comment, debug notes, or stack trace link..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={commentLoading || !commentText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right 1 Col: Meta & Attachments */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Defect Specifications</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Environment:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{bug.environment || "Not set"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Priority:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{bug.priority}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Test Case Ref:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{bug.test_case_number || "Ad-hoc bug"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Created At:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{new Date(bug.created_at).toLocaleDateString()}</span>
              </div>
              {bug.resolved_at && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Resolved At:</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">{new Date(bug.resolved_at).toLocaleDateString()}</span>
                </div>
              )}
              {bug.closed_at && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">Closed At:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{new Date(bug.closed_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Secure File Attachments Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Attachments ({bug.attachments?.length || 0})</h3>
              <Paperclip className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>

            {uploadError && (
              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-2xs font-semibold">
                {uploadError}
              </div>
            )}

            <div className="space-y-2">
              {bug.attachments?.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-2 text-center">No logs or screenshots attached.</div>
              ) : (
                bug.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{att.filename}</div>
                        <div className="text-3xs text-slate-400 dark:text-slate-500 font-mono">
                          {formatFileSize(att.file_size)} &bull; {att.uploaded_by_name || "QA"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownload(att.id, att.filename)}
                      className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg shrink-0 transition-colors"
                      title="Download attachment"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Upload form */}
            <form onSubmit={handleUploadAttachment} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-slate-700"
              />
              <button
                type="submit"
                disabled={uploadLoading || !selectedFile}
                className="w-full py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {uploadLoading ? "Uploading..." : "Attach File (Max 10MB)"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
