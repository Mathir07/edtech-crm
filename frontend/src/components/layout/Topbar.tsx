"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  LogOut,
  User as UserIcon,
  CheckCheck,
  ExternalLink,
  Settings,
  Sparkles,
  ChevronRight,
  Plus,
  Menu,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { notificationsApi, NotificationItem } from "@/lib/notificationsApi";
import { GlobalSearchModal } from "../search/GlobalSearchModal";
import { GlobalCreateModal } from "./GlobalCreateModal";
import { useShell } from "./ShellContext";

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toggleCollapsed, isCreateOpen, openCreateModal, closeCreateModal, createType } = useShell();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Global hotkey Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchUnread = async () => {
    try {
      const data = await notificationsApi.getUnreadCount();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Ignore unauthenticated
    }
  };

  const fetchRecentNotifs = async () => {
    try {
      setLoadingNotifs(true);
      const data = await notificationsApi.getNotifications({ page: 1, page_size: 5 });
      setRecentNotifs(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Ignore error
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleNotif = () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState) {
      fetchRecentNotifs();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markRead({ mark_all: true });
      setUnreadCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // Ignore
    }
  };

  // Generate dynamic breadcrumb items
  const pathSegments = pathname.split("/").filter(Boolean);
  const getBreadcrumbTitle = (seg: string) => {
    if (seg === "sales") return "Sales";
    if (seg === "accounting") return "Finance";
    if (seg === "service") return "Service";
    if (seg === "communications") return "Communications";
    if (seg === "reports") return "Reports";
    if (seg === "settings") return "Settings";
    if (seg === "companies") return "Companies & Accounts";
    if (seg === "contacts") return "Contacts";
    if (seg === "leads") return "Leads";
    if (seg === "pipeline") return "Pipeline";
    if (seg === "opportunities") return "Opportunities";
    if (seg === "projects") return "Projects";
    if (seg === "bugs") return "Bugs";
    if (seg === "notifications") return "Notifications";
    if (seg === "activities") return "Activities";
    if (seg === "audit-logs") return "Audit Logs";
    if (seg === "ai") return "AI Assistant";
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
  };

  return (
    <>
      <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between z-20 shadow-2xs">
        {/* Left: Sidebar Toggle & Dynamic Breadcrumbs */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Kiwi CRM
            </Link>
            {pathSegments.length > 0 ? (
              pathSegments.map((seg, idx) => {
                const isLast = idx === pathSegments.length - 1;
                const pathUrl = "/" + pathSegments.slice(0, idx + 1).join("/");
                return (
                  <React.Fragment key={pathUrl}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    {isLast ? (
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {getBreadcrumbTitle(seg)}
                      </span>
                    ) : (
                      <Link href={pathUrl} className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors truncate">
                        {getBreadcrumbTitle(seg)}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-slate-100">Dashboard</span>
              </>
            )}
          </nav>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs text-left"
          >
            <div className="flex items-center space-x-2 truncate">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate">Search companies, contacts, leads, opportunities, projects, tickets...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-2xs font-mono font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Search Button for Mobile */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* + Create Button */}
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* AI Assistant Shortcut */}
          <Link
            href="/ai"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors"
            title="AI Copilot Assistant"
          >
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </Link>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              type="button"
              onClick={handleToggleNotif}
              className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-2xs font-bold text-white shadow-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Panel */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-2xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center space-x-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingNotifs && (
                    <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">Loading alerts...</div>
                  )}
                  {!loadingNotifs && recentNotifs.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">No new notifications</div>
                  )}
                  {!loadingNotifs &&
                    recentNotifs.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start space-x-3 ${
                          !item.is_read ? "bg-indigo-50/20 dark:bg-indigo-950/30" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.title}</div>
                          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{item.message}</p>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 inline-flex items-center space-x-1"
                  >
                    <span>View all notifications</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2.5 p-1 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user?.first_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              <div className="hidden lg:block">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none truncate max-w-[120px]">
                  {user?.full_name || user?.email}
                </div>
                <div className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium truncate max-w-[120px]">
                  {user?.is_superuser ? "Super Admin" : user?.roles?.[0] || "User"}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hidden lg:block" />
            </button>

            {/* User Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.full_name}</div>
                  <div className="text-2xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email}</div>
                  <div className="mt-2 inline-flex px-2 py-0.5 text-2xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md">
                    {user?.is_superuser ? "Super Administrator" : user?.roles?.join(", ") || "Staff Member"}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>Account & RBAC</span>
                  </Link>
                  <Link
                    href="/notifications"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    <Bell className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>Notification Settings</span>
                  </Link>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Global + Create Modal */}
      <GlobalCreateModal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        initialType={createType}
      />
    </>
  );
};
