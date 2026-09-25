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
  Check,
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
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

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

  const handleMarkSingleRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead({ notification_ids: [id] });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setRecentNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // Ignore
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await notificationsApi.markRead({ notification_ids: [item.id] });
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setRecentNotifs((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      } catch {
        // Ignore
      }
    }
    setIsNotifOpen(false);
    if (item.entity_type) {
      const type = item.entity_type.toLowerCase();
      if (type === "quotation") router.push(`/sales/quotations/${item.entity_id || ""}`);
      else if (type === "ticket") router.push(`/service/tickets/${item.entity_id || ""}`);
      else if (type === "lead") router.push(`/leads/${item.entity_id || ""}`);
      else if (type === "opportunity") router.push(`/opportunities/${item.entity_id || ""}`);
      else if (type === "invoice") router.push(`/accounting/invoices/${item.entity_id || ""}`);
      else if (type === "project") router.push(`/projects/${item.entity_id || ""}`);
      else if (type === "bug") router.push(`/bugs/${item.entity_id || ""}`);
      else if (type === "task") router.push("/tasks");
      else router.push("/notifications");
    } else {
      router.push("/notifications");
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "";
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
      <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 md:px-6 flex items-center justify-between z-20 shadow-2xs">
        {/* Left: Sidebar Toggle & Dynamic Breadcrumbs */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Current Screen Title */}
          <div className="sm:hidden font-bold text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
            {pathSegments.length > 0 ? getBreadcrumbTitle(pathSegments[pathSegments.length - 1]) : "Dashboard"}
          </div>

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
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
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
            className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-colors shrink-0"
            title="Create new record"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* AI Assistant Shortcut (visible on tablets/desktop, in menu on mobile) */}
          <Link
            href="/ai"
            className="hidden sm:flex p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors"
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
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-150">
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
                        onClick={() => handleNotificationClick(item)}
                        className={`p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start justify-between gap-2.5 cursor-pointer group ${
                          !item.is_read ? "bg-indigo-50/30 dark:bg-indigo-950/30" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.priority === "CRITICAL"
                                  ? "bg-rose-500"
                                  : item.priority === "HIGH"
                                  ? "bg-amber-500"
                                  : "bg-indigo-500"
                              }`}
                            />
                            <span className={`text-xs truncate ${!item.is_read ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"}`}>
                              {item.title}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 pl-4">
                            {item.message}
                          </p>
                          <div className="flex items-center space-x-2 mt-1.5 pl-4 text-3xs text-slate-400 dark:text-slate-500">
                            <span>{formatTimeAgo(item.created_at)}</span>
                            {item.entity_type && (
                              <span className="font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                • {item.entity_type}
                              </span>
                            )}
                          </div>
                        </div>

                        {!item.is_read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkSingleRead(e, item.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
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
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
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
                      setIsLogoutConfirmOpen(true);
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

      {/* Sign Out Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onClick={() => !isLoggingOut && setIsLogoutConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative transition-all transform animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-xs">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="logout-confirm-title"
                  className="text-base font-semibold text-slate-900 dark:text-white leading-tight"
                >
                  Sign Out
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Confirm session termination
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Are you sure you want to sign out of Kiwi CRM? You will need to log in again to access your workplace.
            </p>

            <div className="flex items-center justify-end space-x-2.5">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors focus:outline-hidden disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm shadow-rose-600/30 transition-all flex items-center space-x-1.5 focus:outline-hidden disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isLoggingOut ? "Signing Out..." : "Yes, Sign Out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
