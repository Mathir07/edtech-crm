"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  Filter,
  ArrowRight,
  Briefcase,
  UserCheck,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

interface ContactItem {
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
}

interface CompanyOption {
  id: string;
  organization_name: string;
  type?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total_rows: number;
    imported: number;
    duplicates: number;
    validation_errors: number;
    row_errors: string[];
  } | null>(null);
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const [formData, setFormData] = useState({
    company_id: "",
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    is_primary: false,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (companyFilter) queryParams.append("company_id", companyFilter);
      if (statusFilter) queryParams.append("status", statusFilter);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const [contactsData, collegesData] = await Promise.all([
        api.get<ContactItem[]>(`/contacts${qs}`),
        api.get<CompanyOption[]>("/companies"),
      ]);
      setContacts(contactsData || []);
      setCompanies(collegesData || []);
      if (collegesData && collegesData.length > 0 && !formData.company_id) {
        setFormData((prev) => ({ ...prev, company_id: collegesData[0].id }));
      }
    } catch (err) {
      console.error("Failed to load contacts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_id || !formData.name) {
      toastError("Company / Account and Contact Name are required.");
      return;
    }
    try {
      await api.post("/contacts", formData);
      success(`Contact "${formData.name}" added successfully.`);
      setIsModalOpen(false);
      setFormData({
        company_id: companies[0]?.id || "",
        name: "",
        designation: "",
        department: "",
        email: "",
        phone: "",
        is_primary: false,
      });
      loadData();
    } catch (err: any) {
      toastError(err?.detail || "Failed to create contact.");
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (companyFilter) params.set("company_id", companyFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const filename = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`;
      await api.downloadFile(`/contacts/export?${params.toString()}`, filename);
      success("Contacts exported successfully.");
    } catch (err: any) {
      toastError(err?.message || "Failed to export contacts");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await api.downloadFile("/contacts/template", "contacts_template.csv");
    } catch (err: any) {
      toastError("Failed to download template");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toastError("Please select a valid CSV file");
      return;
    }
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || "";
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, 6);
      const parsed = lines.map((l) => l.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim()));
      setImportPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toastError("Please select a CSV file to import");
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append("file", importFile);

      const data = await api.upload<any>("/contacts/import", formData);

      setImportResult(data);
      if (data.imported > 0) {
        success(`Import complete: ${data.imported} contacts added successfully.`);
        loadData();
      } else {
        toastError("No new contacts were imported. Please review errors below.");
      }
    } catch (err: any) {
      toastError(err?.message || "CSV import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const getCompanyName = (con: ContactItem) => {
    if (con.company_name) return con.company_name;
        const comp = companies.find((c) => c.id === con.company_id);
    return comp ? comp.organization_name : "Associated Account";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Contacts & People</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {contacts.length} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Directory of corporate decision-makers, business executives, and institutional leaders across all business segments.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
            title="Export filtered contacts to CSV"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
            Export CSV
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
            title="Download blank CSV template for import"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
            Download Template
          </button>
          {hasPermission("crm.companies.edit") && (
            <button
              onClick={() => {
                setIsImportOpen(true);
                setImportResult(null);
                setImportFile(null);
                setImportPreview([]);
              }}
              className="inline-flex items-center px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors"
              title="Import contacts from CSV"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
              Import CSV
            </button>
          )}
          {hasPermission("crm.companies.edit") && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Contact
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-md flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search contacts by name, email, company, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="ml-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-2xs uppercase font-semibold text-slate-400 dark:text-slate-500">Account:</span>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 max-w-[200px]"
            >
              <option value="">All Companies & Accounts</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-2xs uppercase font-semibold text-slate-400 dark:text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(search || companyFilter || statusFilter) && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase">Active Filters:</span>
            {search && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Search: "{search}"
              </span>
            )}
            {companyFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-indigo-700 dark:text-indigo-300">
                Account: {companies.find((c) => c.id === companyFilter)?.organization_name}
              </span>
            )}
            {statusFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-750 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Status: {statusFilter}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">
              Showing {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCompanyFilter("");
                setStatusFilter("");
              }}
              className="text-2xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <EmptyState
            title="No contacts found"
            description="Add business contacts and institutional decision-makers to track interactions."
            actionLabel="Add Contact"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Company / Account</th>
                  <th className="py-3 px-4">Designation & Role</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                        <Link href={`/contacts/${c.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                          {c.name}
                        </Link>
                        {c.is_primary && (
                          <span className="text-3xs px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold uppercase">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/companies/${c.company_id}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                      >
                        <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{getCompanyName(c)}</span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{c.designation || "—"}</div>
                      {c.department && <div className="text-slate-400 dark:text-slate-500 text-3xs">{c.department}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 space-y-0.5">
                      {c.email ? (
                        <div className="flex items-center">
                          <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <a href={`mailto:${c.email}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 truncate max-w-[180px]">
                            {c.email}
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-3xs">No email</span>
                      )}
                      {c.phone && (
                        <div className="flex items-center font-mono text-2xs text-slate-500 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <a href={`tel:${c.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                            {c.phone}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="status" status={c.status}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/contacts/${c.id}`}
                        className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        View Profile <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Contact">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Company / Account *
            </label>
            <select
              required
              value={formData.company_id}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
            >
              <option value="">Select Company / Account...</option>
              {companies.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.organization_name} {col.type ? `(${col.type})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Priya Venkat"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                placeholder="e.g. Head of Talent Acquisition"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Department
              </label>
              <input
                type="text"
                placeholder="e.g. Human Resources"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="priya@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="is_primary_contact"
              checked={formData.is_primary}
              onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_primary_contact" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Mark as Primary Contact for this Account
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Save Contact
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Contacts from CSV"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Instructions & Template Download */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200">CSV Template & Requirements</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download Blank Template
              </button>
            </div>
            <p>
              Upload a UTF-8 encoded CSV file. Every contact must map to an existing <strong className="text-slate-800 dark:text-slate-100">Company / Account</strong> by name or code.
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              * Duplicates matching existing emails or phone numbers are safely skipped without overwriting existing data.
            </p>
          </div>

          {/* File Selector */}
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900 cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-xl p-1"
              />
            </div>

            {/* Preview table (up to 5 rows) */}
            {importPreview.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-2xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  File Preview (First 5 Rows)
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-2xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr>
                        {importPreview[0].map((col, idx) => (
                          <th key={idx} className="px-2.5 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {importPreview.slice(1).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Results Summary */}
            {importResult && (
              <div className="rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Import Results</span>
                  <span className="text-2xs text-slate-500 dark:text-slate-400">Processed {importResult.total_rows} rows</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported}</div>
                    <div className="text-2xs font-semibold text-emerald-800 dark:text-emerald-300">Imported</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{importResult.duplicates}</div>
                    <div className="text-2xs font-semibold text-amber-800 dark:text-amber-300">Duplicates Skipped</div>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-rose-700 dark:text-rose-400">{importResult.validation_errors}</div>
                    <div className="text-2xs font-semibold text-rose-800 dark:text-rose-300">Validation Errors</div>
                  </div>
                </div>

                {importResult.row_errors && importResult.row_errors.length > 0 && (
                  <div className="mt-2 text-2xs space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">Detailed Messages:</div>
                    <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1 text-slate-600 dark:text-slate-300">
                      {importResult.row_errors.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {importResult ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={!importFile || isImporting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center"
              >
                {isImporting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Start Import
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
