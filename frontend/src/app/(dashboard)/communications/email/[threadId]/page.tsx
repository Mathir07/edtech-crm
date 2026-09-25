"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Send,
  Building2,
  User,
  Paperclip,
  Download,
  CheckCircle2,
  Clock,
  Reply,
  ReplyAll,
  Forward,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Attachment {
  id: string;
  filename: string;
  file_size: number;
  content_type: string;
}

interface Message {
  id: string;
  channel: string;
  direction: string;
  status: string;
  sender: string;
  recipient: string;
  cc?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  sent_at?: string;
  attachments?: Attachment[];
}

interface ThreadDetail {
  id: string;
  subject: string;
  company_id?: string;
  college_name?: string;
  contact_id?: string;
  contact_name?: string;
  messages: Message[];
}

export default function EmailThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.threadId as string;
  const toast = useToast();

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [replyAll, setReplyAll] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const fetchThread = async () => {
    try {
      setLoading(true);
      const data = await api.get<ThreadDetail>(`/communications/email/threads/${threadId}`);
      setThread(data);
    } catch (err) {
      console.error("Failed to load email thread", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (threadId) {
      fetchThread();
    }
  }, [threadId]);

  const lastMessage = thread?.messages && thread.messages.length > 0
    ? thread.messages[thread.messages.length - 1]
    : null;
  const lastMessageId = lastMessage?.id;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !lastMessageId) return;

    try {
      setSendingReply(true);
      await api.post(`/communications/email/messages/${lastMessageId}/reply`, {
        body_text: replyText,
        reply_all: replyAll,
      });
      toast.success("Reply dispatched successfully via Hostinger SMTP");
      setReplyText("");
      await fetchThread();
    } catch (err: any) {
      toast.error(err.detail || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 max-w-4xl mx-auto">
        Loading conversation thread...
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 max-w-4xl mx-auto">
        Thread not found.{" "}
        <Link href="/communications/email" className="text-sky-600 underline">
          Return to mailbox
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/communications/email"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{thread.subject || "(No Subject)"}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {thread.college_name && (
                <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  {thread.college_name}
                </span>
              )}
              {thread.contact_name && (
                <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  {thread.contact_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {thread.messages.map((m, idx) => (
          <div key={m.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.sender}</span>
                  <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {m.direction}
                  </span>
                  <Badge variant={m.status === "SENT" || m.status === "RECEIVED" ? "success" : "neutral"}>
                    {m.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">To: {m.recipient}</div>
                {m.cc && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Cc: {m.cc}</div>}
              </div>
              <div className="text-2xs text-slate-400 dark:text-slate-500 shrink-0">
                {m.sent_at ? formatDateTime(m.sent_at) : ""}
              </div>
            </div>

            {/* Email Body */}
            {m.body_html ? (
              <div
                className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: m.body_html }}
              />
            ) : (
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans">{m.body_text}</div>
            )}

            {/* Attachments */}
            {m.attachments && m.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Attachments ({m.attachments.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/v1/communications/attachments/${att.id}/download`}
                      download
                      className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>{att.filename}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Inline Reply Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Reply className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            Send Reply
          </h3>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={replyAll}
              onChange={(e) => setReplyAll(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
            />
            <span>Reply All</span>
          </label>
        </div>

        <form onSubmit={handleSendReply} className="space-y-3">
          <textarea
            rows={4}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write your email reply..."
            className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-sans"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sendingReply || !replyText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-lg transition-colors disabled:opacity-50 shadow-xs"
            >
              <Send className="w-4 h-4" />
              {sendingReply ? "Sending..." : "Send Reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
