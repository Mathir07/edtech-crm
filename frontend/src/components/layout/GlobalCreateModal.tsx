"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Target,
  TrendingUp,
  Calendar,
  CheckSquare,
  FileText,
  Briefcase,
  ShoppingBag,
  FolderGit2,
  Headphones,
  Receipt,
  CreditCard,
  X,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface GlobalCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string | null;
}

interface OptionItem {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  permission: string;
  isDirectRoute?: string;
}

export const GlobalCreateModal: React.FC<GlobalCreateModalProps> = ({
  isOpen,
  onClose,
  initialType,
}) => {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeForm, setActiveForm] = useState<string | null>(initialType || null);
  const [companies, setCompanies] = useState<Array<{ id: string; organization_name: string }>>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [companyData, setCompanyData] = useState({ organization_name: "", code: "", type: "Engineering College", city: "", state: "" });
  const [contactData, setContactData] = useState({ name: "", email: "", phone: "", designation: "", company_id: "" });
  const [leadData, setLeadData] = useState({ title: "", description: "", company_id: "", expected_value: 100000, priority: "Medium" });
  const [opportunityData, setOpportunityData] = useState({ title: "", company_id: "", pipeline_id: "", stage_id: "", value: 250000 });
  const [taskData, setTaskData] = useState({ title: "", description: "", due_date: "", priority: "Medium", related_entity_type: "company", related_entity_id: "" });
  const [meetingData, setMeetingData] = useState({ title: "", description: "", start_time: "", end_time: "", location: "Online", company_id: "" });
  const [ticketData, setTicketData] = useState({ subject: "", description: "", company_id: "", priority: "MEDIUM", severity: "MEDIUM" });

  useEffect(() => {
    if (initialType) setActiveForm(initialType);
    else setActiveForm(null);
    setFormError(null);
  }, [initialType, isOpen]);

  // Load supporting options when modal opens
  useEffect(() => {
    if (!isOpen) return;
    async function loadOptions() {
      try {
        setLoadingLookups(true);
        const [colRes, pipeRes] = await Promise.all([
          api.get<any[]>("/companies").catch(() => []),
          api.get<any[]>("/pipelines").catch(() => []),
        ]);
        const cols = Array.isArray(colRes) ? colRes : (colRes as any)?.items || [];
        setCompanies(cols);
        setPipelines(pipeRes || []);
        if (cols.length > 0) {
          const firstCol = cols[0].id;
          setContactData((p) => ({ ...p, company_id: firstCol }));
          setLeadData((p) => ({ ...p, company_id: firstCol }));
          setOpportunityData((p) => ({ ...p, company_id: firstCol }));
          setTaskData((p) => ({ ...p, related_entity_id: firstCol }));
          setMeetingData((p) => ({ ...p, company_id: firstCol }));
          setTicketData((p) => ({ ...p, company_id: firstCol }));
        }
        if (pipeRes && pipeRes.length > 0) {
          const p = pipeRes[0];
          setOpportunityData((prev) => ({
            ...prev,
            pipeline_id: p.id,
            stage_id: p.stages?.[0]?.id || "",
          }));
        }
      } finally {
        setLoadingLookups(false);
      }
    }
    loadOptions();
  }, [isOpen]);

  if (!isOpen) return null;

  const createOptions: OptionItem[] = [
    {
      id: "company",
      label: "New Company / Account",
      category: "Customers",
      description: "Onboard company or client account",
      icon: Building2,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800",
      permission: "crm.companies.create",
    },
    {
      id: "contact",
      label: "New Contact",
      category: "Customers",
      description: "Add client or organizational contact",
      icon: Users,
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
      permission: "crm.companies.edit",
    },
    {
      id: "lead",
      label: "New Lead",
      category: "Customers",
      description: "Log inbound inquiry or prospect lead",
      icon: Target,
      color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800",
      permission: "crm.leads.create",
    },
    {
      id: "opportunity",
      label: "New Opportunity",
      category: "Sales",
      description: "Initiate commercial deal pipeline",
      icon: TrendingUp,
      color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
      permission: "crm.opportunities.create",
    },
    {
      id: "quotation",
      label: "New Quotation",
      category: "Sales",
      description: "Compose multi-tier proposal document",
      icon: FileText,
      color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800",
      permission: "sales.quotations.create",
      isDirectRoute: "/sales/quotations/new",
    },
    {
      id: "task",
      label: "New Task",
      category: "Work",
      description: "Assign an operational to-do item",
      icon: CheckSquare,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
      permission: "crm.companies.edit",
    },
    {
      id: "meeting",
      label: "New Meeting",
      category: "Work",
      description: "Schedule demonstration or institutional call",
      icon: Calendar,
      color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800",
      permission: "crm.companies.edit",
    },
    {
      id: "ticket",
      label: "New Support Ticket",
      category: "Service",
      description: "Open customer support issue with SLA tracking",
      icon: Headphones,
      color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
      permission: "service.create",
    },
    {
      id: "contract",
      label: "New Contract",
      category: "Sales",
      description: "Create formal institutional agreement",
      icon: Briefcase,
      color: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
      permission: "sales.contracts.create",
      isDirectRoute: "/sales/contracts",
    },
    {
      id: "invoice",
      label: "New Invoice",
      category: "Finance",
      description: "Issue customer tax invoice",
      icon: Receipt,
      color: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800",
      permission: "accounting.manage_invoices",
      isDirectRoute: "/accounting/invoices",
    },
    {
      id: "payment",
      label: "Record Payment",
      category: "Finance",
      description: "Log customer payment receipt",
      icon: CreditCard,
      color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",
      permission: "accounting.manage_payments",
      isDirectRoute: "/accounting/payments",
    },
    {
      id: "project",
      label: "New Project",
      category: "Delivery",
      description: "Spin up company onboarding deployment",
      icon: FolderGit2,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800",
      permission: "projects.create",
      isDirectRoute: "/projects",
    },
  ];

  // Filter options strictly by permission
  const allowedOptions = createOptions.filter((opt) => hasPermission(opt.permission));

  const handleSelectOption = (opt: OptionItem) => {
    if (opt.isDirectRoute) {
      onClose();
      router.push(opt.isDirectRoute);
    } else {
      setActiveForm(opt.id);
      setFormError(null);
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyData.organization_name || !companyData.code) {
      setFormError("Company name and code are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/companies", companyData);
      success(`Company "${companyData.organization_name}" created successfully.`);
      onClose();
      router.push("/companies");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create company.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactData.name || !contactData.company_id) {
      setFormError("Contact name and Company are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/contacts", contactData);
      success(`Contact "${contactData.name}" created.`);
      onClose();
      router.push("/contacts");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create contact.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadData.title || !leadData.company_id) {
      setFormError("Lead title and Company are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/leads", leadData);
      success(`Lead "${leadData.title}" created.`);
      onClose();
      router.push("/leads");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpportunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunityData.title || !opportunityData.company_id || !opportunityData.stage_id) {
      setFormError("Opportunity title, Company, and Stage are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/opportunities", opportunityData);
      success(`Opportunity "${opportunityData.title}" created.`);
      onClose();
      router.push("/opportunities");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create opportunity.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskData.title || !taskData.related_entity_id) {
      setFormError("Task title and Company are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/tasks", {
        ...taskData,
        due_date: taskData.due_date || new Date().toISOString().split("T")[0],
      });
      success(`Task "${taskData.title}" assigned.`);
      onClose();
      router.push("/activities");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingData.title || !meetingData.company_id) {
      setFormError("Meeting title and Company are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const now = new Date();
      const start = meetingData.start_time ? new Date(meetingData.start_time).toISOString() : now.toISOString();
      const end = meetingData.end_time ? new Date(meetingData.end_time).toISOString() : new Date(now.getTime() + 3600000).toISOString();
      await api.post("/meetings", {
        ...meetingData,
        start_time: start,
        end_time: end,
      });
      success(`Meeting "${meetingData.title}" scheduled.`);
      onClose();
      router.push("/activities");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to schedule meeting.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketData.subject || !ticketData.company_id) {
      setFormError("Ticket subject and Company are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/service/tickets", ticketData);
      success(`Ticket "${ticketData.subject}" submitted.`);
      onClose();
      router.push("/service/tickets");
    } catch (err: any) {
      setFormError(err?.detail || "Failed to create ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={submitting ? undefined : onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center space-x-2">
            {activeForm && (
              <button
                type="button"
                onClick={() => {
                  setActiveForm(null);
                  setFormError(null);
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mr-2"
              >
                ← Back
              </button>
            )}
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {activeForm ? `Create ${activeForm.charAt(0).toUpperCase() + activeForm.slice(1)}` : "+ Quick Create"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Selection Grid when activeForm is null */}
          {!activeForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allowedOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt)}
                    className="flex items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 transition-all text-left group"
                  >
                    <div className={`p-2 rounded-lg border mr-3 shrink-0 ${opt.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-between">
                        <span>{opt.label}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
              {allowedOptions.length === 0 && (
                <div className="col-span-2 text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                  No creation actions permitted for your account role.
                </div>
              )}
            </div>
          )}

          {/* 2. Company Form */}
          {activeForm === "company" && (
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyData.organization_name}
                    onChange={(e) => setCompanyData({ ...companyData, organization_name: e.target.value })}
                    placeholder="e.g. Kumaraguru College of Technology"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Company Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyData.code}
                    onChange={(e) => setCompanyData({ ...companyData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. KCT"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={companyData.city}
                    onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                    placeholder="Coimbatore"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={companyData.state}
                    onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                    placeholder="Tamil Nadu"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Company / Account</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. Contact Form */}
          {activeForm === "contact" && (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Company / Account *
                  </label>
                  <select
                    required
                    value={contactData.company_id}
                    onChange={(e) => setContactData({ ...contactData, company_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactData.name}
                    onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                    placeholder="Dr. Rajesh Kumar"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={contactData.designation}
                    onChange={(e) => setContactData({ ...contactData, designation: e.target.value })}
                    placeholder="Principal / Director"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={contactData.email}
                    onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Phone</label>
                  <input
                    type="tel"
                    value={contactData.phone}
                    onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Contact</span>
                </button>
              </div>
            </form>
          )}

          {/* 4. Lead Form */}
          {activeForm === "lead" && (
            <form onSubmit={handleLeadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Lead Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadData.title}
                    onChange={(e) => setLeadData({ ...leadData, title: e.target.value })}
                    placeholder="Campus ERP Upgrade Inquiry"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Company *</label>
                  <select
                    required
                    value={leadData.company_id}
                    onChange={(e) => setLeadData({ ...leadData, company_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Estimated Deal Value (₹)
                  </label>
                  <input
                    type="number"
                    value={leadData.expected_value}
                    onChange={(e) => setLeadData({ ...leadData, expected_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Lead</span>
                </button>
              </div>
            </form>
          )}

          {/* 5. Opportunity Form */}
          {activeForm === "opportunity" && (
            <form onSubmit={handleOpportunitySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Opportunity Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={opportunityData.title}
                    onChange={(e) => setOpportunityData({ ...opportunityData, title: e.target.value })}
                    placeholder="Full ERP SaaS Licensing 2026-2027"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Company *</label>
                  <select
                    required
                    value={opportunityData.company_id}
                    onChange={(e) => setOpportunityData({ ...opportunityData, company_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Business Pipeline *
                  </label>
                  <select
                    required
                    value={opportunityData.pipeline_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const targetPipe = pipelines.find((p) => p.id === pid);
                      setOpportunityData({
                        ...opportunityData,
                        pipeline_id: pid,
                        stage_id: targetPipe?.stages?.[0]?.id || "",
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Stage *
                  </label>
                  <select
                    required
                    value={opportunityData.stage_id}
                    onChange={(e) => setOpportunityData({ ...opportunityData, stage_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {(pipelines.find((p) => p.id === opportunityData.pipeline_id)?.stages || []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Deal Value (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={opportunityData.value}
                    onChange={(e) => setOpportunityData({ ...opportunityData, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Opportunity</span>
                </button>
              </div>
            </form>
          )}

          {/* 6. Task Form */}
          {activeForm === "task" && (
            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskData.title}
                  onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                  placeholder="Send compliance quotation draft"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Company *</label>
                  <select
                    required
                    value={taskData.related_entity_id}
                    onChange={(e) => setTaskData({ ...taskData, related_entity_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskData.due_date}
                    onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Task</span>
                </button>
              </div>
            </form>
          )}

          {/* 7. Meeting Form */}
          {activeForm === "meeting" && (
            <form onSubmit={handleMeetingSubmit} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Meeting Agenda / Title *
                </label>
                <input
                  type="text"
                  required
                  value={meetingData.title}
                  onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })}
                  placeholder="Dean & HOD Enterprise ERP Walkthrough"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Company *</label>
                  <select
                    required
                    value={meetingData.company_id}
                    onChange={(e) => setMeetingData({ ...meetingData, company_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Location</label>
                  <input
                    type="text"
                    value={meetingData.location}
                    onChange={(e) => setMeetingData({ ...meetingData, location: e.target.value })}
                    placeholder="Google Meet / On Campus"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Schedule Meeting</span>
                </button>
              </div>
            </form>
          )}

          {/* 8. Ticket Form */}
          {activeForm === "ticket" && (
            <form onSubmit={handleTicketSubmit} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Ticket Subject *
                </label>
                <input
                  type="text"
                  required
                  value={ticketData.subject}
                  onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
                  placeholder="Payment gateway webhook timeout on fee portal"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Company *</label>
                  <select
                    required
                    value={ticketData.company_id}
                    onChange={(e) => setTicketData({ ...ticketData, company_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Priority</label>
                  <select
                    value={ticketData.priority}
                    onChange={(e) => setTicketData({ ...ticketData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveForm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Open Ticket</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
