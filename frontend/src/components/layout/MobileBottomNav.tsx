"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Target,
  Receipt,
  Menu,
  Bell,
} from "lucide-react";
import { useShell } from "./ShellContext";

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { toggleCollapsed, isMobileOpen } = useShell();

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: LayoutDashboard,
      isActive: pathname === "/",
    },
    {
      label: "Pipeline",
      href: "/pipeline",
      icon: Kanban,
      isActive: pathname.startsWith("/pipeline"),
    },
    {
      label: "Leads",
      href: "/leads",
      icon: Target,
      isActive: pathname.startsWith("/leads"),
    },
    {
      label: "Invoices",
      href: "/accounting/invoices",
      icon: Receipt,
      isActive: pathname.startsWith("/accounting"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 px-2 py-1 safe-area-pb shadow-lg"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 min-w-[56px] ${
                item.isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  item.isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/60 scale-105"
                    : ""
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-3xs mt-0.5 tracking-tight font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More / Menu Drawer Toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 min-w-[56px] ${
            isMobileOpen
              ? "text-indigo-600 dark:text-indigo-400 font-semibold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          title="Open CRM modules navigation"
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              isMobileOpen ? "bg-indigo-50 dark:bg-indigo-950/60 scale-105" : ""
            }`}
          >
            <Menu className="w-4 h-4" />
          </div>
          <span className="text-3xs mt-0.5 tracking-tight font-medium">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
};
