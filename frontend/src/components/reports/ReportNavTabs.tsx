"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Kanban,
  FolderGit2,
  Bug,
  LifeBuoy,
  Landmark,
  Headphones,
  Users,
  BookmarkCheck,
} from "lucide-react";

export const ReportNavTabs: React.FC = () => {
  const pathname = usePathname();

  const tabs = [
    { label: "Executive", href: "/reports", icon: LayoutDashboard },
    { label: "Sales & Leads", href: "/reports/sales", icon: TrendingUp },
    { label: "Pipeline", href: "/reports/pipeline", icon: Kanban },
    { label: "Projects", href: "/reports/projects", icon: FolderGit2 },
    { label: "QA & Testing", href: "/reports/qa", icon: Bug },
    { label: "Service SLA", href: "/reports/service", icon: LifeBuoy },
    { label: "Finance & Aging", href: "/reports/finance", icon: Landmark },
    { label: "Communications", href: "/reports/communications", icon: Headphones },
    { label: "Team Workload", href: "/reports/team", icon: Users },
    { label: "Saved Reports", href: "/reports/saved", icon: BookmarkCheck },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto">
      <nav className="flex space-x-1 min-w-max pb-px">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/reports"
              ? pathname === "/reports"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center space-x-2 py-2.5 px-3.5 border-b-2 text-xs font-semibold rounded-t-lg transition-colors ${
                isActive
                  ? "border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
