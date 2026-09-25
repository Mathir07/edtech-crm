"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ShellProvider } from "@/components/layout/ShellContext";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading enterprise workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ShellProvider>
      <div className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] flex bg-slate-50 dark:bg-slate-950 overflow-hidden w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full max-h-full overflow-hidden">
          <Topbar />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden main-content-scroll p-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-6 overscroll-y-contain bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </ShellProvider>
  );
}
