"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Filter,
  Search,
  Settings,
  RefreshCw,
  Clock,
  Calendar,
  DollarSign,
  AlertTriangle,
  Briefcase,
  Bug,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  LifeBuoy,
  Plus,
  Send,
  X,
} from "lucide-react";
import { notificationsApi, NotificationItem } from "@/lib/notificationsApi";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Test Notification Simulation Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testForm, setTestForm] = useState({
    title: "Quotation Q-2026-004 Approved",
    message: "Commercial proposal for Apex Tech was approved by the Sales Director. Ready for client delivery.",
    priority: "HIGH",
    notification_type: "QUOTATION_APPROVED",
    entity_type: "QUOTATION",
    entity_id: "",
  });

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const is_read = statusFilter === "unread" ? false : statusFilter === "read" ? true : undefined;
      const notification_type = typeFilter !== "all" ? typeFilter : undefined;
      const priority = priorityFilter !== "all" ? priorityFilter : undefined;

      const data = await notificationsApi.getNotifications({
        is_read,
        notification_type,
        priority,
        page,
        page_size: pageSize,
      });

      setNotifications(data.items);
      setTotal(data.total);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, statusFilter, typeFilter, priorityFilter]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markRead({ mark_all: true });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleMarkItemRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead({ notification_ids: [id] });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const handleOpenRecord = (item: NotificationItem) => {
    if (!item.is_read) {
      notificationsApi.markRead({ notification_ids: [item.id] }).catch(() => {});
    }

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
      else if (type === "meeting") router.push("/activities");
    }
  };

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSendingTest(true);
      await notificationsApi.triggerTestNotification(testForm);
      setIsTestModalOpen(false);
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to send test notification", err);
    } finally {
      setSendingTest(false);
    }
  };

  const renderIcon = (type: string) => {
    if (type.includes("QUOTATION")) return <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    if (type.includes("TICKET")) return <LifeBuoy className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    if (type.includes("LEAD")) return <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    if (type.includes("BUG")) return <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    if (type.includes("SLA")) return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    if (type.includes("INVOICE") || type.includes("PAYMENT")) return <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    if (type.includes("MEETING")) return <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    if (type.includes("TASK")) return <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    if (type.includes("PROJECT")) return <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    return <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "HIGH":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "MEDIUM":
        return "bg-sky-50 text-sky-700 border-sky-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time business reminders, CRM follow-ups, SLA alerts, and critical escalations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchNotifications}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors shadow-2xs"
            >
              <CheckCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Mark All as Read</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-sm font-medium transition-colors"
            title="Create a test alert to verify real-time notification delivery"
          >
            <Plus className="w-4 h-4" />
            <span>Simulate Alert</span>
          </button>
          <Link
            href="/settings/notifications"
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-sm font-medium transition-colors shadow-xs"
          >
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          <button
            onClick={() => { setStatusFilter("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setStatusFilter("unread"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === "unread"
                ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => { setStatusFilter("read"); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === "read"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Read
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 pr-8 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Types</option>
              <option value="TASK_DUE">Task Due</option>
              <option value="TASK_OVERDUE">Task Overdue</option>
              <option value="MEETING_REMINDER">Meeting Reminder</option>
              <option value="LEAD_FOLLOWUP">Lead Follow-up</option>
              <option value="OPPORTUNITY_FOLLOWUP">Opportunity Follow-up</option>
              <option value="INVOICE_DUE">Invoice Due</option>
              <option value="PAYMENT_RECEIVED">Payment Received</option>
              <option value="SLA_WARNING">SLA Warning</option>
              <option value="SLA_BREACH">SLA Breach</option>
              <option value="PROJECT_DELAY">Project Delay</option>
              <option value="QA_CRITICAL_BUG">Critical QA Bug</option>
              <option value="SYSTEM">System Alerts</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 pr-8 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Loading notifications...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No notifications found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              There are no notifications matching your current filters. Everything is up to date!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenRecord(item)}
                className={`p-4 sm:p-5 transition-colors flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                  !item.is_read ? "bg-indigo-50/20 dark:bg-indigo-950/20" : ""
                }`}
              >
                <div className="flex items-start space-x-4 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs mt-0.5 shrink-0">
                    {renderIcon(item.notification_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span
                        className={`text-sm tracking-tight ${
                          !item.is_read ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.title}
                      </span>
                      <span
                        className={`text-3xs font-semibold px-2 py-0.5 border rounded-full ${getPriorityBadge(
                          item.priority
                        )}`}
                      >
                        {item.priority}
                      </span>
                      {item.entity_type && (
                        <span className="text-3xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                          {item.entity_type}
                        </span>
                      )}
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{item.message}</p>
                    <div className="flex items-center space-x-4 mt-2 text-3xs text-slate-400 dark:text-slate-500">
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                      {item.read_at && <span>Read: {new Date(item.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!item.is_read && (
                    <button
                      onClick={(e) => handleMarkItemRead(item.id, e)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Mark as Read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  {item.entity_type && (
                    <button
                      onClick={() => handleOpenRecord(item)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Open CRM Record"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Dismiss / Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} alerts
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <button
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Notification Simulator Modal */}
      {isTestModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Simulate Real-Time Alert</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestNotification} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Notification Scenario
                </label>
                <select
                  value={testForm.notification_type}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "QUOTATION_APPROVED") {
                      setTestForm({
                        title: "Quotation Q-2026-004 Approved",
                        message: "Commercial proposal for Apex Tech was approved by the Sales Director. Ready for client delivery.",
                        priority: "HIGH",
                        notification_type: "QUOTATION_APPROVED",
                        entity_type: "QUOTATION",
                        entity_id: "",
                      });
                    } else if (val === "QUOTATION_SUBMITTED") {
                      setTestForm({
                        title: "Quotation Q-2026-005 Pending Review",
                        message: "A new quotation of ₹4,50,000 for Kiwi Edu was submitted for management sign-off.",
                        priority: "HIGH",
                        notification_type: "QUOTATION_SUBMITTED",
                        entity_type: "QUOTATION",
                        entity_id: "",
                      });
                    } else if (val === "TICKET_ASSIGNED") {
                      setTestForm({
                        title: "Support Ticket #1042 Assigned",
                        message: "You were assigned ticket: 'VPN Gateway connectivity issue' with HIGH SLA priority.",
                        priority: "HIGH",
                        notification_type: "TICKET_ASSIGNED",
                        entity_type: "TICKET",
                        entity_id: "",
                      });
                    } else if (val === "LEAD_ASSIGNED") {
                      setTestForm({
                        title: "New High-Value Lead Assigned",
                        message: "You have been assigned lead 'Karan Sharma (St. Joseph College of Engineering)'.",
                        priority: "MEDIUM",
                        notification_type: "LEAD_ASSIGNED",
                        entity_type: "LEAD",
                        entity_id: "",
                      });
                    } else if (val === "PAYMENT_RECEIVED") {
                      setTestForm({
                        title: "Invoice #INV-2026-003 Paid",
                        message: "A wire transfer receipt of ₹2,36,000 has been verified and settled.",
                        priority: "MEDIUM",
                        notification_type: "PAYMENT_RECEIVED",
                        entity_type: "INVOICE",
                        entity_id: "",
                      });
                    }
                  }}
                  className="w-full text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5"
                >
                  <option value="QUOTATION_APPROVED">Quotation Approved (Sales)</option>
                  <option value="QUOTATION_SUBMITTED">Quotation Awaiting Review (Management)</option>
                  <option value="TICKET_ASSIGNED">Support Ticket Assigned (Service)</option>
                  <option value="LEAD_ASSIGNED">Lead Assigned (CRM Sales)</option>
                  <option value="PAYMENT_RECEIVED">Payment Settled (Finance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Notification Title
                </label>
                <input
                  type="text"
                  required
                  value={testForm.title}
                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                  className="w-full text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Notification Message
                </label>
                <textarea
                  required
                  rows={3}
                  value={testForm.message}
                  onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                  className="w-full text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={testForm.priority}
                    onChange={(e) => setTestForm({ ...testForm, priority: e.target.value })}
                    className="w-full text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Target Module
                  </label>
                  <select
                    value={testForm.entity_type}
                    onChange={(e) => setTestForm({ ...testForm, entity_type: e.target.value })}
                    className="w-full text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5"
                  >
                    <option value="QUOTATION">Quotation</option>
                    <option value="TICKET">Support Ticket</option>
                    <option value="LEAD">Sales Lead</option>
                    <option value="INVOICE">Invoice</option>
                    <option value="OPPORTUNITY">Opportunity</option>
                    <option value="TASK">Task</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingTest ? "Delivering..." : "Deliver Alert"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
