"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Target,
  TrendingUp,
  CalendarCheck2,
  Clock,
  FileText,
  History,
  Plus,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Briefcase,
  Layers,
  Headphones,
  FileSpreadsheet,
  ShoppingBag,
  FileCheck2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface Company360Data {
  company: any;
  contacts: any[];
  leads: any[];
  opportunities: any[];
  activities: any[];
  tasks: any[];
  meetings: any[];
  notes: any[];
  timeline: any[];
  quotations?: any[];
  contracts?: any[];
  sales_orders?: any[];
  tickets?: any[];
}

export default function Company360Page() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const [data, setData] = useState<Company360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Forms
  const [contactForm, setContactForm] = useState({
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    is_primary: false,
  });

  const [noteContent, setNoteContent] = useState("");

  const [activityForm, setActivityForm] = useState({
    type: "Call",
    subject: "",
    description: "",
    due_at: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get<Company360Data>(`/companies/${companyId}`);
      setData(res);
    } catch (err) {
      console.error("Failed to load Company 360", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/contacts", { ...contactForm, company_id: companyId });
      setIsContactModalOpen(false);
      setContactForm({ name: "", designation: "", department: "", email: "", phone: "", is_primary: false });
      success("Contact added successfully.");
      loadData();
    } catch (err: any) {
      toastError(err?.detail || "Failed to create contact.");
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      await api.post("/notes", {
        content: noteContent,
        related_entity_type: "company",
        related_entity_id: companyId,
      });
      setIsNoteModalOpen(false);
      setNoteContent("");
      success("Note posted successfully.");
      loadData();
    } catch (err: any) {
      toastError(err?.detail || "Failed to create note.");
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/activities", {
        ...activityForm,
        due_at: activityForm.due_at ? new Date(activityForm.due_at).toISOString() : new Date().toISOString(),
        related_entity_type: "company",
        related_entity_id: companyId,
      });
      setIsActivityModalOpen(false);
      setActivityForm({ type: "Call", subject: "", description: "", due_at: "" });
      success("Activity logged successfully.");
      loadData();
    } catch (err: any) {
      toastError(err?.detail || "Failed to log activity.");
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      await api.patch(`/activities/${activityId}/complete`);
      success("Activity marked complete.");
      loadData();
    } catch (err: any) {
      toastError(err?.detail || "Failed to mark activity complete.");
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading Account 360 profile...</div>;
  }

  if (!data?.company) {
    return (
      <EmptyState
        title="Account not found"
        description="The requested account record does not exist or was removed."
        actionLabel="Back to Companies & Accounts"
        onAction={() => router.push("/companies")}
      />
    );
  }

  const { company, contacts, leads, opportunities, activities, tasks, meetings, notes, timeline } = data;
  const quotations = data.quotations || [];
  const contracts = data.contracts || [];
  const salesOrders = data.sales_orders || [];
  const tickets = data.tickets || [];

  const tabs = [
    { id: "overview", label: "Overview", count: null },
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "leads", label: "Leads", count: leads.length },
    { id: "opportunities", label: "Opportunities", count: opportunities.length },
    { id: "quotations", label: "Quotations", count: quotations.length },
    { id: "contracts", label: "Contracts", count: contracts.length },
    { id: "sales_orders", label: "Sales Orders", count: salesOrders.length },
    { id: "tickets", label: "Support Tickets", count: tickets.length },
    { id: "activities", label: "Activities", count: activities.length },
    { id: "timeline", label: "Chronological Timeline", count: timeline.length },
    { id: "notes", label: "Notes", count: notes.length },
    { id: "lifecycle", label: "Later Lifecycle Modules", count: null },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button & Top Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/companies")}
          className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Companies & Accounts
        </button>
        <div className="flex items-center space-x-2">
          {hasPermission("crm.companies.edit") && (
            <>
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs transition-colors flex items-center"
              >
                <Users className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" />
                Add Contact
              </button>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs transition-colors flex items-center"
              >
                <CalendarCheck2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                Log Follow-up
              </button>
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-xs transition-colors flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Note
              </button>
            </>
          )}
        </div>
      </div>

      {/* Company 360 Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{company.organization_name}</h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                  {company.code}
                </span>
                <Badge variant="status" status={company.status}>
                  {company.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{company.type}</span>
                <span>•</span>
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
                  {company.city ? `${company.city}, ${company.state || "India"}` : "India"}
                </span>
                {company.website && (
                  <>
                    <span>•</span>
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      {company.website}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{contacts.length}</div>
              <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold">Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{leads.length}</div>
              <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold">Leads</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{opportunities.length}</div>
              <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold">Active Deals</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Business</div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(
              salesOrders.reduce((sum: number, so: any) => sum + (Number(so.total_amount) || 0), 0) ||
                quotations
                  .filter((q: any) => q.status === "Accepted")
                  .reduce((sum: number, q: any) => sum + (Number(q.total_amount) || 0), 0)
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Deals</div>
          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
            {opportunities.filter((o: any) => o.status === "Open").length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Contracts / Orders</div>
          <div className="text-base font-bold text-teal-600 dark:text-teal-400 mt-1 font-mono">
            {contracts.length + salesOrders.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Open Tickets</div>
          <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {tickets.filter((t: any) => !["RESOLVED", "CLOSED"].includes(t.status)).length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pipeline Est.</div>
          <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {formatCurrency(opportunities.reduce((sum: number, o: any) => sum + (Number(o.value) || 0), 0))}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto text-sm font-medium">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-2xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Company / Account Profile</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">Official Email</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">{company.email || "Not specified"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">Telephone</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">{company.phone || "Not specified"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">Office / Campus Address</dt>
                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">{company.address || "Not specified"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase">Strategic Notes</dt>
                    <dd className="mt-1 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/60 leading-relaxed">
                      {company.notes || "No notes documented yet."}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Key Account Owner</h3>
                <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/60">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    {company.owner_name?.[0] || "U"}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {company.owner_name || "Unassigned"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Sales Representative</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTACTS TAB */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Company Contacts & Stakeholders</h3>
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
              >
                + Add Contact
              </button>
            </div>
            {contacts.length === 0 ? (
              <EmptyState
                title="No contacts added"
                description="Add key executives, managers, or decision makers for this account."
                actionLabel="Add Contact"
                onAction={() => setIsContactModalOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.map((con) => (
                  <div key={con.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          <span>{con.name}</span>
                          {con.is_primary && (
                            <span className="text-3xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                              Primary Contact
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          {con.designation || "Stakeholder / Contact"}
                        </div>
                      </div>
                      <Badge variant="status" status={con.status}>
                        {con.status}
                      </Badge>
                    </div>
                    <div className="pt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      {con.email && (
                        <div className="flex items-center">
                          <Mail className="w-3.5 h-3.5 mr-2 text-slate-400 dark:text-slate-500" />
                          <a href={`mailto:${con.email}`} className="hover:underline">{con.email}</a>
                        </div>
                      )}
                      {con.phone && (
                        <div className="flex items-center">
                          <Phone className="w-3.5 h-3.5 mr-2 text-slate-400 dark:text-slate-500" />
                          <span>{con.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LEADS TAB */}
        {activeTab === "leads" && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Associated Leads</h3>
            {leads.length === 0 ? (
              <EmptyState title="No leads for this account" description="Create a lead to track potential deals." />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Lead Title</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Est. Value</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{l.title}</td>
                        <td className="py-3 px-4">
                          <Badge variant="status" status={l.priority}>
                            {l.priority}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(l.expected_value)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="status" status={l.status}>
                            {l.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a href={`/leads/${l.id}`} className="text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:underline">
                            View Lead
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* OPPORTUNITIES TAB */}
        {activeTab === "opportunities" && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Account Opportunities & Deals</h3>
            {opportunities.length === 0 ? (
              <EmptyState title="No opportunities open" description="Convert a qualified lead into an opportunity." />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Opportunity</th>
                      <th className="py-3 px-4">Pipeline Stage</th>
                      <th className="py-3 px-4">Contract Value</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {opportunities.map((opp) => (
                      <tr key={opp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{opp.title}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-transparent dark:border-indigo-800/50">
                            {opp.stage_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(opp.value)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="status" status={opp.status}>
                            {opp.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a href={`/opportunities/${opp.id}`} className="text-indigo-600 dark:text-indigo-400 font-semibold text-xs hover:underline">
                            View Deal
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ACTIVITIES TAB */}
        {activeTab === "activities" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Activities & Scheduled Follow-ups</h3>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
              >
                + Log Follow-up
              </button>
            </div>
            {activities.length === 0 ? (
              <EmptyState title="No activities logged" description="Keep track of calls, emails, and meetings." />
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold text-xs border border-transparent dark:border-indigo-800/50">
                        {act.type}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{act.subject}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{act.description}</div>
                        <div className="text-2xs text-slate-400 dark:text-slate-500 mt-1">Due: {formatDateTime(act.due_at)}</div>
                      </div>
                    </div>
                    <div>
                      {act.is_completed ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Completed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteActivity(act.id)}
                          className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHRONOLOGICAL TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Chronological Event Timeline</h3>
            {timeline.length === 0 ? (
              <EmptyState title="Timeline is empty" description="Events, notes, and changes will be logged here." />
            ) : (
              <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-6 py-2">
                {timeline.map((item, idx) => (
                  <div key={idx} className="relative pl-6">
                    <div className="absolute -left-2 top-1.5 w-3.5 h-3.5 bg-indigo-600 rounded-full ring-4 ring-white dark:ring-slate-950" />
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.title}</span>
                        <span className="text-2xs text-slate-400 dark:text-slate-500 font-medium">
                          {formatDateTime(item.timestamp)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                      )}
                      {item.author && (
                        <div className="text-2xs text-slate-400 dark:text-slate-500 mt-2 font-medium">By {item.author}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Strategic Notes</h3>
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
              >
                + Add Note
              </button>
            </div>
            {notes.length === 0 ? (
              <EmptyState title="No notes recorded" description="Add private notes on stakeholder discussions." />
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{n.content}</p>
                    <div className="mt-3 text-2xs text-slate-400 dark:text-slate-500 font-medium flex justify-between">
                      <span>Author: {n.author_name || "Team member"}</span>
                      <span>{formatDateTime(n.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUOTATIONS TAB */}
        {activeTab === "quotations" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Quotations & Proposals ({quotations.length})
              </h3>
              {hasPermission("sales.quotations.create") && (
                <Link
                  href="/sales/quotations/new"
                  className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Quotation
                </Link>
              )}
            </div>
            {quotations.length === 0 ? (
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                No quotations created for this account yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-3xs">
                    <tr>
                      <th className="p-3.5">Quotation #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Subtotal</th>
                      <th className="p-3.5">GST</th>
                      <th className="p-3.5 font-bold text-slate-900 dark:text-slate-100">Total Amount</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {quotations.map((q: any) => (
                      <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          <Link href={`/sales/quotations/${q.id}`} className="hover:underline">
                            {q.quotation_number}
                          </Link>
                        </td>
                        <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{q.quotation_date}</td>
                        <td className="p-3.5">
                          <Badge variant="status" status={q.status}>
                            {q.status}
                          </Badge>
                        </td>
                        <td className="p-3.5 font-mono">{formatCurrency(q.subtotal)}</td>
                        <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{formatCurrency(q.tax_amount)}</td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(q.total_amount)}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            href={`/sales/quotations/${q.id}`}
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                          >
                            View →
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

        {/* CONTRACTS TAB */}
        {activeTab === "contracts" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Contracts & MSAs ({contracts.length})
              </h3>
              {hasPermission("sales.contracts.create") && (
                <Link
                  href="/sales/contracts"
                  className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Manage Contracts
                </Link>
              )}
            </div>
            {contracts.length === 0 ? (
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                No contracts or master service agreements registered for this account yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-3xs">
                    <tr>
                      <th className="p-3.5">Contract #</th>
                      <th className="p-3.5">Title</th>
                      <th className="p-3.5">Period</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 font-bold text-slate-900 dark:text-slate-100">Contract Value</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {contracts.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{c.contract_number}</td>
                        <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">{c.title}</td>
                        <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">
                          {c.start_date} → {c.end_date}
                        </td>
                        <td className="p-3.5">
                          <Badge variant="status" status={c.status}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(c.contract_value)}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            href="/sales/contracts"
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                          >
                            Manage →
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

        {/* SALES ORDERS TAB */}
        {activeTab === "sales_orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Sales Orders ({salesOrders.length})
              </h3>
              {hasPermission("sales.orders.create") && (
                <Link
                  href="/sales/sales-orders"
                  className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Manage Orders
                </Link>
              )}
            </div>
            {salesOrders.length === 0 ? (
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                No sales orders confirmed or created for this account yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-3xs">
                    <tr>
                      <th className="p-3.5">Order #</th>
                      <th className="p-3.5">Order Date</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5 font-bold text-slate-900 dark:text-slate-100">Total Value</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salesOrders.map((so: any) => (
                      <tr key={so.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{so.order_number}</td>
                        <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">
                          {so.order_date || so.created_at?.split("T")[0]}
                        </td>
                        <td className="p-3.5">
                          <Badge variant="status" status={so.status}>
                            {so.status}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          {so.items ? so.items.length : 1} item(s)
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(so.total_amount)}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            href="/sales/sales-orders"
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                          >
                            Manage →
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

        {/* SUPPORT TICKETS TAB */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Support & Service Tickets ({tickets.length})
              </h3>
              <Link
                href="/service/tickets"
                className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Raise Support Ticket
              </Link>
            </div>

            {tickets.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
                <Headphones className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium">No support tickets recorded for this account.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  When the account raises technical inquiries or service issues, they will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-3xs">
                    <tr>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">SLA Status</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Assignee</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tickets.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          <Link href={`/service/tickets/${t.id}`} className="hover:underline">
                            {t.ticket_number}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                          {t.subject}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="status" status={t.status}>
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="status" status={t.sla_status}>
                            {t.sla_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {t.priority}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {t.assigned_to_name || <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/service/tickets/${t.id}`}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                          >
                            Manage →
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

        {/* EXTENSION POINTS TAB */}
        {activeTab === "lifecycle" && (
          <div className="space-y-6">
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
              <strong>Modular Monolith Architecture:</strong> As specified in the CRM context, full Accounting,
              Project Delivery, QA Testing, and Service SLA modules attach to each client account via
              dedicated modular micro-APIs in Phase 3.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center space-x-3 mb-2">
                  <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Quotations & Contracts</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Extension points for commercial proposals, quotation PDF generation, and Board approvals.
                </p>
                <div className="mt-4 font-mono text-3xs text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-2 rounded">
                  Endpoint: /api/v1/extensions/documents/status
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center space-x-3 mb-2">
                  <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Project Implementation</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Client project setup, system integration, and rollout milestone trackers.
                </p>
                <div className="mt-4 font-mono text-3xs text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-2 rounded">
                  Endpoint: /api/v1/extensions/projects/status
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center space-x-3 mb-2">
                  <Headphones className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Service Tickets & SLA</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Client helpdesk ticketing, administrator query resolution, and service renewals.
                </p>
                <div className="mt-4 font-mono text-3xs text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-2 rounded">
                  Endpoint: /api/v1/extensions/service/status
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center space-x-3 mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Invoices & Receivables</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  GST invoices, payment milestone collection, and financial reconciliation for this account.
                </p>
                <div className="mt-4 font-mono text-3xs text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-2 rounded">
                  Endpoint: /api/v1/extensions/accounting/status
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} title="Add Account Contact">
        <form onSubmit={handleCreateContact} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. S. K. Narayanan or Alex Johnson"
              value={contactForm.name}
              onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
              <input
                type="text"
                placeholder="e.g. VP Engineering / Principal / Director"
                value={contactForm.designation}
                onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <input
                type="text"
                placeholder="e.g. Technology / Procurement"
                value={contactForm.department}
                onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                placeholder="contact@company.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={contactForm.is_primary}
              onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_primary" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Designate as Primary Account Contact
            </label>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsContactModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              Save Contact
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="Add Strategic Note">
        <form onSubmit={handleCreateNote} className="space-y-4 text-sm">
          <div>
            <textarea
              required
              rows={4}
              placeholder="Document discussion details, governance board priorities, or deal notes..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsNoteModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              Save Note
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Activity Modal */}
      <Modal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} title="Log Follow-up / Activity">
        <form onSubmit={handleCreateActivity} className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Activity Type</label>
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Call">Call</option>
                <option value="Email">Email</option>
                <option value="Meeting">Meeting</option>
                <option value="Demo">Demo</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date & Time</label>
              <input
                type="datetime-local"
                value={activityForm.due_at}
                onChange={(e) => setActivityForm({ ...activityForm, due_at: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
            <input
              type="text"
              required
              placeholder="e.g. Discuss revised proposal pricing"
              value={activityForm.subject}
              onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Details on what needs to be discussed..."
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              Log Activity
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
