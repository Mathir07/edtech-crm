"use client";

import React, { useState } from "react";
import { ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const setDemoUser = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Admin@123");
    setError(null);
  };

  return (
    <div className="min-h-screen h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/20 blur-[120px] pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 mb-3">
          <img
            src="/logo.png"
            alt="Kiwi CRM Logo"
            className="w-full h-full object-contain drop-shadow-xl"
          />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Kiwi CRM Enterprise</h2>
        <p className="mt-2 text-sm text-slate-400">
          Internal Enterprise Relationship & Business Lifecycle Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@edtechcrm.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign in to Workplace"}
              {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
            </button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="text-xs font-medium text-slate-400 mb-3 text-center">
              Quick Login with Seeded Demo Roles:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoUser("admin@edtechcrm.com")}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all text-center truncate ${
                  email === "admin@edtechcrm.com" || email === "admin@kiwicloudtech.co.in"
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
                title="Super Admin (admin@edtechcrm.com)"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("sales.manager@edtechcrm.com")}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all text-center truncate ${
                  email === "sales.manager@edtechcrm.com"
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
                title="Sales Manager (sales.manager@edtechcrm.com)"
              >
                Sales Mgr
              </button>
              <button
                type="button"
                onClick={() => setDemoUser("sales.exec@edtechcrm.com")}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all text-center truncate ${
                  email === "sales.exec@edtechcrm.com"
                    ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                }`}
                title="Sales Executive (sales.exec@edtechcrm.com)"
              >
                Sales Exec
              </button>
            </div>
            <div className="mt-2 text-3xs text-slate-400 text-center font-mono">
              Default password: <span className="text-indigo-400 font-semibold">Admin@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
