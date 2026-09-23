"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Kanban,
  TrendingUp,
  CalendarCheck2,
  CheckSquare,
  ShieldAlert,
  Settings,
  Briefcase,
  Layers,
  Headphones,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  Bug,
  Clock,
  Tags,
  CreditCard,
  Receipt,
  Wallet,
  BookOpen,
  Scale,
  Landmark,
  BarChart3,
  Mail,
  MessageSquare,
  PhoneCall,
  FileCode,
  Bell,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useShell } from "./ShellContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const { isCollapsed, toggleCollapsed, isMobileOpen, closeMobileDrawer } = useShell();

  // Collapsible section state for expanded sidebar
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Auto-close mobile drawer when pathname changes
  useEffect(() => {
    closeMobileDrawer();
  }, [pathname]);

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const sections: NavSection[] = [
    {
      title: "WORKSPACE",
      items: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard, show: true },
        { label: "Tasks", href: "/tasks", icon: CheckSquare, show: true },
        { label: "Activities & Follow-ups", href: "/activities", icon: CalendarCheck2, show: true },
        { label: "Notifications", href: "/notifications", icon: Bell, show: true },
      ],
    },
    {
      title: "CUSTOMERS",
      items: [
        { label: "Companies & Accounts", href: "/companies", icon: Building2, show: hasPermission("crm.companies.view") },
        { label: "Contacts", href: "/contacts", icon: Users, show: hasPermission("crm.companies.view") },
        { label: "Leads", href: "/leads", icon: Target, show: hasPermission("crm.leads.view") },
      ],
    },
    {
      title: "SALES",
      items: [
        { label: "Sales Pipeline", href: "/pipeline", icon: Kanban, show: hasPermission("crm.opportunities.view") },
        { label: "Opportunities", href: "/opportunities", icon: TrendingUp, show: hasPermission("crm.opportunities.view") },
        { label: "Quotations", href: "/sales/quotations", icon: FileText, show: hasPermission("sales.quotations.view") },
        { label: "Contracts", href: "/sales/contracts", icon: Briefcase, show: hasPermission("sales.contracts.view") },
        { label: "Sales Orders", href: "/sales/sales-orders", icon: CheckSquare, show: hasPermission("sales.orders.view") },
        { label: "Products Catalog", href: "/sales/products", icon: Layers, show: hasPermission("sales.products.view") || hasPermission("crm.companies.view") },
      ],
    },
    {
      title: "DELIVERY",
      items: [
        { label: "Projects (360)", href: "/projects", icon: FolderGit2, show: hasPermission("projects.view") },
        { label: "Bug Tracker", href: "/bugs", icon: Bug, show: hasPermission("bugs.view") || hasPermission("projects.view") },
      ],
    },
    {
      title: "SERVICE",
      items: [
        { label: "Support Tickets", href: "/service/tickets", icon: Headphones, show: hasPermission("service.create") || hasPermission("crm.companies.view") },
        { label: "SLA & Policies", href: "/service/sla-policies", icon: Clock, show: hasPermission("service.create") || hasPermission("crm.companies.view") },
        { label: "Service Categories", href: "/service/categories", icon: Tags, show: hasPermission("service.create") || hasPermission("crm.companies.view") },
      ],
    },
    {
      title: "FINANCE",
      items: [
        { label: "Finance Hub", href: "/accounting", icon: LayoutDashboard, show: hasPermission("accounting.view") },
        { label: "Invoices (AR)", href: "/accounting/invoices", icon: Receipt, show: hasPermission("accounting.view") || hasPermission("accounting.manage_invoices") },
        { label: "Customer Receipts", href: "/accounting/payments", icon: CreditCard, show: hasPermission("accounting.view") || hasPermission("accounting.manage_payments") },
        { label: "Vendor Bills (AP)", href: "/accounting/bills", icon: FileSpreadsheet, show: hasPermission("accounting.view") },
        { label: "Vendors Directory", href: "/accounting/vendors", icon: Building2, show: hasPermission("accounting.view") },
        { label: "Operating Expenses", href: "/accounting/expenses", icon: Wallet, show: hasPermission("accounting.view") || hasPermission("accounting.create") },
        { label: "Chart of Accounts", href: "/accounting/accounts", icon: BookOpen, show: hasPermission("accounting.view") || hasPermission("accounting.manage_accounts") },
        { label: "Journal Entries", href: "/accounting/journal-entries", icon: Scale, show: hasPermission("accounting.view") },
        { label: "Bank Reconciliation", href: "/accounting/reconciliation", icon: Landmark, show: hasPermission("accounting.view") },
        { label: "Financial Reports", href: "/accounting/reports", icon: BarChart3, show: hasPermission("accounting.view") },
      ],
    },
    {
      title: "COMMUNICATIONS",
      items: [
        { label: "Communications Hub", href: "/communications", icon: Headphones, show: hasPermission("communications.view") },
        { label: "Hostinger Email", href: "/communications/email", icon: Mail, show: hasPermission("communications.view") },
        { label: "WhatsApp Chats", href: "/communications/whatsapp", icon: MessageSquare, show: hasPermission("communications.view") },
        { label: "Phone Call Logs", href: "/communications/calls", icon: PhoneCall, show: hasPermission("communications.view") },
        { label: "Templates", href: "/communications/templates", icon: FileCode, show: hasPermission("communications.view") },
        { label: "Integrations Settings", href: "/communications/integrations", icon: Settings, show: hasPermission("communications.manage_integrations") },
      ],
    },
    {
      title: "INSIGHTS",
      items: [
        { label: "Reports & Analytics", href: "/reports", icon: BarChart3, show: hasPermission("reports.view") },
        { label: "AI Copilot Assistant", href: "/ai", icon: Sparkles, show: true },
      ],
    },
    {
      title: "ADMINISTRATION",
      items: [
        { label: "Audit Logs", href: "/audit-logs", icon: ShieldAlert, show: hasPermission("audit.view") },
        { label: "User Management", href: "/settings/users", icon: Users, show: hasPermission("users.manage") },
        { label: "My Settings", href: "/settings", icon: Settings, show: true },
        { label: "Automation Engine", href: "/settings/automation", icon: Zap, show: hasPermission("automation.view") || hasPermission("automation.manage") },
      ],
    },
  ];

  // Determine which navigation item is currently active.
  // Prioritize exact match, otherwise select the most specific (longest) matching parent route.
  const allNavHrefs = useMemo(() => {
    return sections.flatMap((s) => s.items).filter((i) => i.show).map((i) => i.href);
  }, [sections]);

  const activeHref = useMemo(() => {
    if (allNavHrefs.includes(pathname)) {
      return pathname;
    }
    const matchingHrefs = allNavHrefs.filter(
      (href) => href !== "/" && (pathname === href || pathname.startsWith(href + "/"))
    );
    if (matchingHrefs.length > 0) {
      return matchingHrefs.sort((a, b) => b.length - a.length)[0];
    }
    return pathname === "/" ? "/" : "";
  }, [pathname, allNavHrefs]);

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={closeMobileDrawer}
          aria-label="Close navigation drawer"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-30
          h-screen h-[100dvh] max-h-screen max-h-[100dvh] min-h-0
          bg-slate-900 text-slate-300 flex flex-col shrink-0
          border-r border-slate-800
          transition-all duration-200 select-none
          ${isCollapsed ? "md:w-20" : "md:w-64"}
          ${isMobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Brand Header - Pinned at Top */}
        <div
          className={`h-16 shrink-0 flex items-center border-b border-slate-800 ${
            isCollapsed ? "justify-center px-2" : "px-5 space-x-3"
          }`}
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="Kiwi CRM"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white tracking-tight text-base leading-none">Kiwi CRM</div>
            </div>
          )}
        </div>

        {/* Navigation Groups - Independently Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden sidebar-scroll py-4 px-3 space-y-5 overscroll-y-contain">
          {sections.map((section) => {
            const visibleItems = section.items.filter((item) => item.show);
            if (visibleItems.length === 0) return null;

            const isSectionCollapsed = !!collapsedSections[section.title];

            return (
              <div key={section.title}>
                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-3 py-1 text-2xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 group"
                  >
                    <span>{section.title}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${
                        isSectionCollapsed ? "-rotate-90 text-slate-500" : "text-slate-400"
                      }`}
                    />
                  </button>
                )}

                {/* Items List */}
                {(!isSectionCollapsed || isCollapsed) && (
                  <nav className="mt-1 space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = item.href === activeHref;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMobileDrawer}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center rounded-xl font-medium transition-all group ${
                            isCollapsed ? "justify-center p-2.5" : "px-3 py-2 text-xs space-x-3"
                          } ${
                            isActive
                              ? "bg-indigo-600 text-white shadow-xs font-semibold"
                              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                            }`}
                          />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </nav>
                )}
              </div>
            );
          })}
        </div>

        {/* Collapse Footer Toggle - Pinned at Bottom */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-semibold"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
