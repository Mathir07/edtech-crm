"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  Building2,
  Mail,
  Phone,
  ArrowLeft,
  Briefcase,
  Target,
  TrendingUp,
  CalendarCheck2,
  Clock,
  Plus,
  CheckCircle2,
  Edit2,
  Calendar,
  MessageSquare,
  Video,
  FileText,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface ContactDetailData {
  contact: {
    id: string;
    company_id: string;
    college_name?: string;
    company_name?: string;
    name: string;
    designation?: string;
    department?: string;
    email?: string;
    phone?: string;
    alternate_phone?: string;
    linkedin_url?: string;
    is_primary: boolean;
    status: string;
    created_at: string;
  };
  company?: {
    id: string;
    organization_name: string;
    code: string;
    type: string;
    industry: string;
    city?: string;
    state?: string;
    status: string;
    website?: string;
    email?: string;
    phone?: string;
  };
  leads: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    expected_value?: number;
    next_action?: string;
    next_follow_up_date?: string;
    business_segment?: string;
    created_at: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    pipeline_name?: string;
    stage_name?: string;
    stage_color?: string;
    value: number;
    probability: number;
    expected_close_date?: string;
    status: string;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    subject: string;
    description?: string;
    due_at?: string;
    is_completed: boolean;
    completed_at?: string;
    assigned_to_name?: string;
    created_at: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date?: string;
    assigned_to_name?: string;
  }>;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const [data, setData] = useState<ContactDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "leads" | "opportunities" | "activities">("overview");

  // Modals
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Forms
  const [activityForm, setActivityForm] = useState({
    type: "Follow-up",
    subject: "",
    description: "",
    due_at: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    is_primary: false,
    status: "Active",
  });

  const loadContact = async () => {
    try {
      setLoading(true);
      const res = await api.get<ContactDetailData>(`/contacts/${contactId}`);
      setData(res);
      if (res?.contact) {
        setEditForm({
          name: res.contact.name || "",
          designation: res.contact.designation || "",
          department: res.contact.department || "",
          email: res.contact.email || "",
          phone: res.contact.phone || "",
          is_primary: res.contact.is_primary || false,
          status: res.contact.status || "Active",
        });
      }
    } catch (err: any) {
      console.error("Failed to load contact", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contactId) loadContact();
  }, [contactId]);

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.subject) {
      toastError("Subject is required.");
      return;
    }
    try {
      await api.post("/activities", {
        ...activityForm,
        related_entity_type: "contact",
        related_entity_id: contactId,
        due_at: activityForm.due_at ? new Date(activityForm.due_at).toISOString() : new Date().toISOString(),
      });
      success("Activity logged successfully.");
      setIsActivityModalOpen(false);
      setActivityForm({
        type: "Follow-up",
        subject: "",
        description: "",
        due_at: "",
      });
      loadContact();
    } catch (err: any) {
      toastError(err?.detail || "Failed to log activity.");
    }
  };

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name) {
      toastError("Name is required.");
      return;
    }
    try {
      await api.put(`/contacts/${contactId}`, editForm);
      success("Contact updated successfully.");
      setIsEditModalOpen(false);
      loadContact();
    } catch (err: any) {
      toastError(err?.detail || "Failed to update contact.");
    }
  };

  const handleCompleteActivity = async (actId: string) => {
    try {
      await api.patch(`/activities/${actId}/complete`);
      success("Activity marked complete.");
      loadContact();
    } catch (err: any) {
      toastError(err?.detail || "Failed to complete activity.");
    }
  };

  const handleInitiateCall = async () => {
    if (!data?.contact?.phone) {
      toastError("Contact does not have a phone number.");
      return;
    }
    try {
      await api.post("/telephony/initiate", {
        to_phone: data.contact.phone,
        contact_id: data.contact.id,
        company_id: data.contact.company_id,
      });
      success(`Calling ${data.contact.phone}...`);
    } catch (err: any) {
      toastError(
        err?.detail || "Telephony is not configured. Log the call manually via 'Log Activity'."
      );
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "Call":
        return <Phone className="w-3.5 h-3.5 text-blue-600" />;
      case "Email":
        return <Mail className="w-3.5 h-3.5 text-purple-600" />;
      case "Meeting":
      case "Demo":
        return <Video className="w-3.5 h-3.5 text-emerald-600" />;
      case "WhatsApp":
        return <MessageSquare className="w-3.5 h-3.5 text-teal-600" />;
      default:
        return <CalendarCheck2 className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Loading contact profile...</div>;
  }

  if (!data || !data.contact) {
    return (
      <EmptyState
        title="Contact not found"
        description="The contact record could not be found or has been deleted."
        actionLabel="Back to Contacts"
        onAction={() => router.push("/contacts")}
      />
    );
  }

  const { contact, company, leads, opportunities, activities, tasks } = data;

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/contacts")}
          className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Contacts
        </button>
        <div className="flex items-center space-x-2">
          {contact.is_primary && (
            <span className="text-2xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Primary Contact
            </span>
          )}
          <Badge variant="status" status={contact.status}>
            {contact.status}
          </Badge>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
              {contact.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{contact.name}</h1>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                {contact.designation || "Executive"} {contact.department ? `• ${contact.department}` : ""}
              </p>
              {company && (
                <div className="flex items-center text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                  <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  <Link href={`/companies/${company.id}`} className="hover:underline">
                    {company.organization_name}
                  </Link>
                  <span className="text-slate-300 dark:text-slate-600 mx-2">•</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">{company.type || company.industry}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {contact.phone && (
              <button
                type="button"
                onClick={handleInitiateCall}
                className="inline-flex items-center px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors"
                title={`Call ${contact.phone}`}
              >
                <Phone className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
                Call
              </button>
            )}
            {hasPermission("crm.companies.edit") && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <CalendarCheck2 className="w-3.5 h-3.5 mr-1.5" />
                  Log Activity / Follow-up
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Contact Info Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold block">Email</span>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">
                  {contact.email}
                </a>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">Not provided</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold block">Phone</span>
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} className="font-mono font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400">
                  {contact.phone}
                </a>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">Not provided</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <div>
              <span className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold block">Account / Company</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {company?.organization_name || contact.company_name || contact.college_name || "Independent"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 text-xs font-semibold">
          {[
            { id: "overview", label: "Overview & Details" },
            { id: "leads", label: `Related Leads (${leads.length})` },
            { id: "opportunities", label: `Deals & Opportunities (${opportunities.length})` },
            { id: "activities", label: `Activities & Follow-ups (${activities.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Company Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
              Company / Account Details
            </h3>
            {company ? (
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-slate-400 dark:text-slate-500 uppercase text-2xs font-semibold">Account Name</dt>
                  <dd className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                    <Link href={`/companies/${company.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                      {company.organization_name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 dark:text-slate-500 uppercase text-2xs font-semibold">Type / Industry</dt>
                  <dd className="text-slate-700 dark:text-slate-300 mt-0.5 font-medium">{company.type} ({company.industry})</dd>
                </div>
                {company.city && (
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500 uppercase text-2xs font-semibold">Location</dt>
                    <dd className="text-slate-700 dark:text-slate-300 mt-0.5">{company.city}, {company.state || "India"}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-400 dark:text-slate-500 uppercase text-2xs font-semibold">Account Status</dt>
                  <dd className="mt-1">
                    <Badge variant="status" status={company.status}>{company.status}</Badge>
                  </dd>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/companies/${company.id}`}
                    className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View Complete Account 360 →
                  </Link>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No corporate account associated.</p>
            )}
          </div>

          {/* Recent Follow-up & Activity Summary */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                Latest Interactions & Next Follow-ups
              </h3>
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                + Log Follow-up
              </button>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                No recent activity logged for this contact.
              </p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 4).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        {getActivityIcon(act.type)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{act.subject}</div>
                        {act.description && (
                          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{act.description}</p>
                        )}
                        <div className="text-3xs text-slate-400 dark:text-slate-500 mt-1">
                          {act.due_at ? `Scheduled: ${formatDateTime(act.due_at)}` : `Logged: ${formatDate(act.created_at)}`}
                        </div>
                      </div>
                    </div>

                    <div>
                      {act.is_completed ? (
                        <span className="text-2xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteActivity(act.id)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-2xs font-semibold rounded-lg shadow-2xs transition-colors"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. LEADS TAB */}
      {activeTab === "leads" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No sales leads associated with this contact.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">Lead Title</th>
                    <th className="py-3 px-4">Segment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Next Action / Follow-up</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        <Link href={`/leads/${l.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                          {l.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{l.business_segment || "General"}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant="status" status={l.status}>{l.status}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        <div className="font-medium">{l.next_action || "—"}</div>
                        {l.next_follow_up_date && (
                          <div className="text-3xs font-mono text-indigo-600 dark:text-indigo-400">
                            Due: {formatDate(l.next_follow_up_date)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {l.expected_value ? formatCurrency(l.expected_value) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/leads/${l.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                          View Lead →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. OPPORTUNITIES TAB */}
      {activeTab === "opportunities" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {opportunities.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No commercial deals or opportunities associated with this contact.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">Deal Title</th>
                    <th className="py-3 px-4">Pipeline</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Contract Value</th>
                    <th className="py-3 px-4">Target Close</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {opportunities.map((opp) => (
                    <tr key={opp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        <Link href={`/opportunities/${opp.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                          {opp.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{opp.pipeline_name || "Sales"}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
                          style={{
                            backgroundColor: `${opp.stage_color || "#6366f1"}15`,
                            color: opp.stage_color || "#6366f1",
                          }}
                        >
                          {opp.stage_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(opp.value)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-2xs">
                        {formatDate(opp.expected_close_date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="status" status={opp.status}>{opp.status}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link href={`/opportunities/${opp.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                          View Deal →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. ACTIVITIES TAB */}
      {activeTab === "activities" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Contact Activity Timeline</h3>
            <button
              onClick={() => setIsActivityModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              + Log Activity
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No activities logged for this contact yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      {getActivityIcon(act.type)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{act.subject}</span>
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {act.type}
                        </span>
                      </div>
                      {act.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{act.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-2xs text-slate-400 dark:text-slate-500">
                        {act.due_at && <span>Due: {formatDateTime(act.due_at)}</span>}
                        <span>•</span>
                        <span>Logged: {formatDate(act.created_at)}</span>
                        {act.assigned_to_name && (
                          <>
                            <span>•</span>
                            <span>Assigned: {act.assigned_to_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {act.is_completed ? (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCompleteActivity(act.id)}
                        className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log Activity Modal */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title={`Log Activity for ${contact.name}`}
      >
        <form onSubmit={handleLogActivity} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Activity Type *
              </label>
              <select
                required
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
              >
                <option value="Follow-up">Follow-up</option>
                <option value="Call">Phone Call</option>
                <option value="Email">Email</option>
                <option value="Meeting">Meeting</option>
                <option value="Demo">Demonstration</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Note">Internal Note</option>
              </select>
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Target Date / Time
              </label>
              <input
                type="datetime-local"
                value={activityForm.due_at}
                onChange={(e) => setActivityForm({ ...activityForm, due_at: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Subject / Action Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Discuss Q3 requirement proposal"
              value={activityForm.subject}
              onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Detailed Notes
            </label>
            <textarea
              rows={3}
              placeholder="Meeting discussion points, follow-up commitments, next steps..."
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Save Activity
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Contact Information"
      >
        <form onSubmit={handleEditContact} className="space-y-4">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Designation
              </label>
              <input
                type="text"
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Department
              </label>
              <input
                type="text"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Phone
              </label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="edit_primary_contact"
              checked={editForm.is_primary}
              onChange={(e) => setEditForm({ ...editForm, is_primary: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="edit_primary_contact" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Primary Contact for this Account
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
