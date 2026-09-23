"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  ShieldCheck,
  Radio,
  Server,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Info,
  PhoneForwarded,
  Cpu,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

interface TelephonyStatus {
  enabled: boolean;
  provider: string;
  business_number?: string | null;
  supported_providers: string[];
  message: string;
}

export default function TelephonySettingsPage() {
  const [status, setStatus] = useState<TelephonyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await api.get<TelephonyStatus>("/telephony/status");
      setStatus(data);
    } catch (err: any) {
      console.error("Failed to load telephony status", err);
      // Fallback display if endpoint returns error
      setStatus({
        enabled: false,
        provider: "none",
        business_number: null,
        supported_providers: ["none", "exotel", "twilio"],
        message: "Telephony is not configured (TELEPHONY_ENABLED=false).",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestTelephony = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.post("/communications/integrations/test?provider_name=TELEPHONY", {});
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: "DISCONNECTED",
        message: err.detail || "Telephony provider is disabled or unconfigured.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Navigation & Header */}
      <div className="space-y-3">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to System Settings
        </Link>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
              <PhoneCall className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              Telephony & Voice Architecture
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Provider-neutral telephony abstraction layer for outbound calling, bridge dialing, and inbound call logging.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading telephony subsystem status...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subsystem Overview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center">
                  <PhoneForwarded className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Telephony Carrier Status
                    </h2>
                    {status?.enabled ? (
                      <Badge variant="success">ENABLED</Badge>
                    ) : (
                      <Badge variant="neutral">NOT CONFIGURED (DISABLED)</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Operating mode: {status?.enabled ? "Live Carrier Integration" : "Provider-Neutral Fallback"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleTestTelephony}
                disabled={testing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
                {testing ? "Testing..." : "Test Telephony Connection"}
              </button>
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                  testResult.status === "CONNECTED"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                    : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
                }`}
              >
                {testResult.status === "CONNECTED" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    Provider Test: {testResult.status} ({testResult.provider || "TELEPHONY"})
                  </div>
                  <div className="mt-0.5">{testResult.message}</div>
                </div>
              </div>
            )}

            {/* Telephony Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">Configured Provider</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {status?.provider || "none"}
                </div>
                <div className="text-slate-400 dark:text-slate-500 text-3xs">TELEPHONY_PROVIDER in server environment</div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">Caller ID / Business Line</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {status?.business_number || "Not Configured"}
                </div>
                <div className="text-slate-400 dark:text-slate-500 text-3xs">Outbound business caller identification</div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-3xs">Carrier Adapters</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {status?.supported_providers?.join(", ") || "none, exotel, twilio"}
                </div>
                <div className="text-slate-400 dark:text-slate-500 text-3xs">Provider-neutral adapter interfaces supported</div>
              </div>
            </div>

            {/* Architecture Explanation */}
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 text-xs text-purple-950 dark:text-purple-200 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-purple-900 dark:text-purple-300">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                How Telephony Works in KCT CRM
              </div>
              <p className="leading-relaxed">
                The telephony subsystem uses an abstract adapter architecture. When no carrier credentials are present, telephony runs safely in a <strong>disabled state</strong> without failing or producing unhandled errors. Manual call logging remains 100% operational across all Lead, Contact, Company, and Deal timelines.
              </p>
              <p className="leading-relaxed">
                When your company procures an enterprise carrier account (such as Exotel or Twilio), you only need to configure the provider environment variables. Outbound dialing, bridge calling, call recordings, and inbound webhooks will activate without requiring database schema changes or code rebuilds.
              </p>
            </div>

            {/* Provider Configuration Guide */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Future Carrier Activation Variables
              </div>
              <div className="bg-slate-900 text-slate-100 dark:bg-slate-950 p-3 rounded-lg font-mono text-2xs space-y-1">
                <div><span className="text-purple-400">TELEPHONY_ENABLED</span>=false</div>
                <div><span className="text-purple-400">TELEPHONY_PROVIDER</span>=none  <span className="text-slate-500"># or "exotel", "twilio"</span></div>
                <div><span className="text-purple-400">TELEPHONY_BUSINESS_NUMBER</span>=  <span className="text-slate-500"># e.g. "+91XXXXXXXXXX"</span></div>
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Credentials are managed server-side only and never exposed in client JavaScript.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
