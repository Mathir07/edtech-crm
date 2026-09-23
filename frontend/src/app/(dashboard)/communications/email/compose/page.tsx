"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  FileEdit,
  Building2,
  User,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from "lucide-react";
import { api } from "@/lib/api";

interface CompanyOption {
  id: string;
  organization_name: string;
}

interface ContactOption {
  id: string;
  name: string;
  email: string;
}

interface TemplateOption {
  id: string;
  name: string;
  subject?: string;
  body_text: string;
  variables?: string[];
}

export default function EmailComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft_id");

  const [toEmail, setToEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [bccEmail, setBccEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Load options
    const loadOptions = async () => {
      try {
        const [cols, tpls] = await Promise.all([
          api.get<CompanyOption[]>("/companies"),
          api.get<TemplateOption[]>("/communications/templates?channel=EMAIL"),
        ]);
        setCompanies(cols);
        setTemplates(tpls);
      } catch (err) {
        console.error("Failed to load options", err);
      }
    };
    loadOptions();
  }, []);

  // When company changes, fetch contacts for that company
  useEffect(() => {
    if (selectedCompanyId) {
      api.get<ContactOption[]>(`/contacts?company_id=${selectedCompanyId}`).then((data) => {
        setContacts(data);
      }).catch(() => setContacts([]));
    } else {
      setContacts([]);
    }
  }, [selectedCompanyId]);

  // When contact selected, prefill email
  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    const con = contacts.find((c) => c.id === contactId);
    if (con && con.email) {
      setToEmail(con.email);
    }
  };

  // When template selected, populate subject and body
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      if (tpl.subject) setSubject(tpl.subject);
      setBodyText(tpl.body_text);
    }
  };

  // Load existing draft if draft_id provided
  useEffect(() => {
    if (draftId) {
      api.get<any>(`/communications/email/drafts/${draftId}`).then((d) => {
        if (d) {
          setToEmail(d.recipient || "");
          setSubject(d.subject || "");
          setBodyText(d.body_text || "");
          if (d.company_id) setSelectedCompanyId(d.company_id);
          if (d.contact_id) setSelectedContactId(d.contact_id);
          if (d.cc) {
            setCcEmail(d.cc);
            setShowCc(true);
          }
        }
      }).catch(console.error);
    }
  }, [draftId]);

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      setStatusMessage(null);
      await api.post("/communications/email/drafts", {
        to_email: toEmail,
        subject: subject,
        body_text: bodyText,
        cc: ccEmail ? ccEmail.split(",").map((c) => c.trim()) : undefined,
        bcc: bccEmail ? bccEmail.split(",").map((b) => b.trim()) : undefined,
        company_id: selectedCompanyId || undefined,
        contact_id: selectedContactId || undefined,
      });
      setStatusMessage({ type: "success", text: "Draft saved successfully!" });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.detail || "Failed to save draft" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail) {
      setStatusMessage({ type: "error", text: "Recipient email is required" });
      return;
    }

    try {
      setSending(true);
      setStatusMessage(null);
      await api.post("/communications/email/send", {
        to_email: toEmail,
        subject: subject,
        body_text: bodyText,
        cc: ccEmail ? ccEmail.split(",").map((c) => c.trim()) : undefined,
        bcc: bccEmail ? bccEmail.split(",").map((b) => b.trim()) : undefined,
        company_id: selectedCompanyId || undefined,
        contact_id: selectedContactId || undefined,
      });
      router.push("/communications/email");
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.detail || "Failed to send email via Hostinger" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/communications/email"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Compose Email</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Outbound dispatch via Hostinger SMTP (kiwicloudtech.co.in)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <FileEdit className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {savingDraft ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={sending || !toEmail}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
              : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSendEmail} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        {/* CRM Context Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-800">
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Associated Company
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full text-xs p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select Company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> Contact Person
            </label>
            <select
              value={selectedContactId}
              onChange={(e) => handleContactSelect(e.target.value)}
              disabled={!selectedCompanyId || contacts.length === 0}
              className="w-full text-xs p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select Contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email || "No email"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <FileCode className="w-3 h-3" /> Email Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full text-xs p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Choose Template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-12 text-xs font-semibold text-slate-500 dark:text-slate-400">To:</span>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="recipient@institution.edu"
              required
              className="flex-1 p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium px-2 py-1"
              >
                Cc / Bcc
              </button>
            )}
          </div>

          {showCc && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-12 text-xs font-semibold text-slate-500 dark:text-slate-400">Cc:</span>
                <input
                  type="text"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="dean@institution.edu, hod@institution.edu"
                  className="flex-1 p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-12 text-xs font-semibold text-slate-500 dark:text-slate-400">Bcc:</span>
                <input
                  type="text"
                  value={bccEmail}
                  onChange={(e) => setBccEmail(e.target.value)}
                  placeholder="archive@kiwicloudtech.co.in"
                  className="flex-1 p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <span className="w-12 text-xs font-semibold text-slate-500 dark:text-slate-400">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line..."
              required
              className="flex-1 p-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Message Body */}
        <div>
          <textarea
            rows={12}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Type your email content here..."
            required
            className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
          />
        </div>
      </form>
    </div>
  );
}
