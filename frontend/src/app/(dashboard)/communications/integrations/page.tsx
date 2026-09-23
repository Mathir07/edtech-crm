"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Radio,
  Mail,
  MessageSquare,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Key,
  Globe,
  HelpCircle,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface IntegrationOverview {
  hostinger?: {
    provider: string;
    domain: string;
    connected: boolean;
    account_email: string;
    smtp_host: string;
    smtp_port: number;
    imap_host: string;
    imap_port: number;
    status: string;
  };
  gmail?: {
    provider: string;
    connected: boolean;
    account_email?: string;
    status: string;
    last_sync?: string;
  };
  whatsapp: {
    provider: string;
    connected: boolean;
    phone_number_id?: string;
    phone_number?: string;
    status: string;
  };
  phone: {
    provider: string;
    connected: boolean;
    phone_number?: string;
    status: string;
  };
}

interface TestResult {
  status: string;
  smtp?: string;
  imap?: string;
  message?: string;
  smtp_host?: string;
  imap_host?: string;
  provider?: string;
}

export default function IntegrationsSettingsPage() {
  const [overview, setOverview] = useState<IntegrationOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Email test & sync state
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<TestResult | null>(null);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [emailSyncResult, setEmailSyncResult] = useState<any | null>(null);

  // Phone test state
  const [testingPhone, setTestingPhone] = useState(false);
  const [phoneTestResult, setPhoneTestResult] = useState<any | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const data = await api.get<IntegrationOverview>("/communications/integrations");
      setOverview(data);
    } catch (err) {
      console.error("Failed to load integrations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      setEmailTestResult(null);
      const res = await api.post<TestResult>("/communications/integrations/email/test", {});
      setEmailTestResult(res);
      await fetchOverview();
    } catch (err: any) {
      setEmailTestResult({
        status: "ERROR",
        message: err.detail || "Connection test request failed",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSyncEmail = async () => {
    try {
      setSyncingEmail(true);
      setEmailSyncResult(null);
      const res = await api.post<any>("/communications/email/sync", {});
      setEmailSyncResult(res);
      await fetchOverview();
    } catch (err: any) {
      setEmailSyncResult({
        status: "ERROR",
        message: err.detail || "Email sync request failed",
      });
    } finally {
      setSyncingEmail(false);
    }
  };

  const handleTestPhone = async () => {
    try {
      setTestingPhone(true);
      setPhoneTestResult(null);
      const res = await api.post<any>("/communications/integrations/test?provider_name=TELEPHONY", {});
      setPhoneTestResult(res);
    } catch (err: any) {
      setPhoneTestResult({
        status: "DISCONNECTED",
        message: err.detail || "Telephony is disabled or unconfigured.",
      });
    } finally {
      setTestingPhone(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "CONNECTED") return <Badge variant="success">CONNECTED</Badge>;
    if (s === "NOT_CONFIGURED" || s === "DISCONNECTED") return <Badge variant="neutral">NOT CONFIGURED</Badge>;
    return <Badge variant="danger">{s}</Badge>;
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Integrations & External Channels
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise connectivity: Hostinger Webmail (SMTP/IMAP), WhatsApp Business Platform, and Telephony
          </p>
        </div>
        <button
          onClick={fetchOverview}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading integration configurations...</div>
      ) : (
        <div className="space-y-6">
          {/* 1. HOSTINGER EMAIL INTEGRATION */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Hostinger Email (Primary Provider)</h2>
                    {getStatusBadge(overview?.hostinger?.status || "NOT_CONFIGURED")}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Official Hostinger SMTP and IMAP servers for institutional communications
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncEmail}
                  disabled={syncingEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  <Inbox className={`w-3.5 h-3.5 ${syncingEmail ? "animate-spin" : ""}`} />
                  {syncingEmail ? "Syncing..." : "Sync Hostinger Inbox"}
                </button>
                <button
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingEmail ? "animate-spin" : ""}`} />
                  {testingEmail ? "Testing Connection..." : "Test Hostinger Connection"}
                </button>
              </div>
            </div>

            {/* Sync Result Feedback */}
            {emailSyncResult && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                  emailSyncResult.status === "completed" || emailSyncResult.status === "OK"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                }`}
              >
                {emailSyncResult.status === "completed" || emailSyncResult.status === "OK" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">Inbox Sync: {emailSyncResult.status || "Completed"}</div>
                  <div className="mt-0.5">
                    {emailSyncResult.message || `Messages synced: ${emailSyncResult.messages_synced ?? 0}`}
                  </div>
                </div>
              </div>
            )}

            {/* Test Result Feedback */}
            {emailTestResult && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                  emailTestResult.status === "CONNECTED"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                    : emailTestResult.status === "NOT_CONFIGURED"
                    ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                    : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                }`}
              >
                {emailTestResult.status === "CONNECTED" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    Hostinger Status: {emailTestResult.status} (SMTP: {emailTestResult.smtp || "N/A"}, IMAP: {emailTestResult.imap || "N/A"})
                  </div>
                  <div className="mt-0.5 font-sans">{emailTestResult.message}</div>
                </div>
              </div>
            )}

            {/* Config details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Outgoing (SMTP) Configuration
                </div>
                <div className="grid grid-cols-2 gap-1 text-slate-600 dark:text-slate-300 font-mono">
                  <span className="text-slate-400 dark:text-slate-500">Host:</span>
                  <span>{overview?.hostinger?.smtp_host || "smtp.hostinger.com"}</span>
                  <span className="text-slate-400 dark:text-slate-500">Port:</span>
                  <span>{overview?.hostinger?.smtp_port || 465} (SSL)</span>
                  <span className="text-slate-400 dark:text-slate-500">Security:</span>
                  <span>SSL / TLS Enabled</span>
                  <span className="text-slate-400 dark:text-slate-500">Account:</span>
                  <span className="truncate">{overview?.hostinger?.account_email || "Not Configured"}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Incoming (IMAP) Configuration
                </div>
                <div className="grid grid-cols-2 gap-1 text-slate-600 dark:text-slate-300 font-mono">
                  <span className="text-slate-400 dark:text-slate-500">Host:</span>
                  <span>{overview?.hostinger?.imap_host || "imap.hostinger.com"}</span>
                  <span className="text-slate-400 dark:text-slate-500">Port:</span>
                  <span>{overview?.hostinger?.imap_port || 993} (SSL)</span>
                  <span className="text-slate-400 dark:text-slate-500">Protocol:</span>
                  <span>IMAP4_SSL</span>
                  <span className="text-slate-400 dark:text-slate-500">Sync:</span>
                  <span>Incremental UID Search</span>
                </div>
              </div>
            </div>

            <div className="text-2xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                Hostinger passwords are kept strictly secure in the backend deployment environment (HOSTINGER_SMTP_PASSWORD, HOSTINGER_IMAP_PASSWORD). They are never exposed in frontend bundles or API responses.
              </span>
            </div>
          </div>

          {/* 2. WHATSAPP BUSINESS PLATFORM */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">WhatsApp Business Platform (Cloud API)</h2>
                    {getStatusBadge(overview?.whatsapp?.status || "NOT_CONFIGURED")}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Official Meta WhatsApp Business Cloud API with HMAC-SHA256 signature verification
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-slate-600 dark:text-slate-300 font-mono">
                <div><span className="text-slate-400 dark:text-slate-500">Provider:</span> Meta Cloud Platform</div>
                <div><span className="text-slate-400 dark:text-slate-500">Phone Number ID:</span> {overview?.whatsapp?.phone_number_id || "Not Configured"}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Registered Phone:</span> {overview?.whatsapp?.phone_number || "Not Configured"}</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-800 dark:text-slate-200">Webhook Receiver Endpoint:</div>
                <div className="font-mono text-2xs bg-white dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 select-all">
                  POST /api/v1/communications/whatsapp/webhook
                </div>
                <div className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">Requires X-Hub-Signature-256 header validation</div>
              </div>
            </div>
          </div>

          {/* 3. TELEPHONY & CALL LOGGING (PROVIDER-NEUTRAL) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Telephony & Voice Architecture</h2>
                    {getStatusBadge(overview?.phone?.status || "NOT_CONFIGURED")}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Provider-neutral telephony layer. Manual logging active; live carrier integration ready for future setup.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestPhone}
                  disabled={testingPhone}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingPhone ? "animate-spin" : ""}`} />
                  {testingPhone ? "Testing..." : "Test Connection"}
                </button>
                <Link
                  href="/settings/telephony"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 rounded-lg transition-colors shadow-xs"
                >
                  <span>Telephony Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Test Result Feedback */}
            {phoneTestResult && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                  phoneTestResult.status === "CONNECTED"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                }`}
              >
                {phoneTestResult.status === "CONNECTED" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">Telephony Status: {phoneTestResult.status} ({phoneTestResult.provider || "TELEPHONY"})</div>
                  <div className="mt-0.5">{phoneTestResult.message}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-slate-600 dark:text-slate-300 font-mono">
                <div><span className="text-slate-400 dark:text-slate-500">Provider:</span> none (Disabled)</div>
                <div><span className="text-slate-400 dark:text-slate-500">Supported Adapters:</span> Exotel, Twilio, Generic SIP</div>
                <div><span className="text-slate-400 dark:text-slate-500">Manual Call Logging:</span> Active</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-800 dark:text-slate-200">Carrier Neutrality:</div>
                <p className="text-slate-500 dark:text-slate-400 text-2xs leading-relaxed">
                  The CRM requires no code or schema changes to connect real carrier accounts. Voice calling and webhook endpoints are fully ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
