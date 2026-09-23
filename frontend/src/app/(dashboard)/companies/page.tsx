"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/auth";

interface Company {
  id: string;
  organization_name: string;
  code: string;
  type: string;
  website?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  status: string;
  owner_name?: string;
  contacts_count: number;
  active_leads_count: number;
  open_opportunities_count: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    organization_name: "",
    code: "",
    type: "Engineering College",
    website: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "India",
    status: "Prospect",
    notes: "",
  });

  const loadCompanies = async () => {
    try {
      setLoading(true);
      let query = "/companies?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (statusFilter) query += `status=${encodeURIComponent(statusFilter)}&`;
      if (typeFilter) query += `type=${encodeURIComponent(typeFilter)}&`;
      const data = await api.get<Company[]>(query);
      setCompanies(data);
    } catch (err) {
      console.error("Failed to load companies", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [statusFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCompanies();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organization_name || !formData.code) {
      setFormError("Company name and Account code are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/companies", formData);
      setIsCreateModalOpen(false);
      setFormData({
        organization_name: "",
        code: "",
        type: "Engineering College",
        website: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        country: "India",
        status: "Prospect",
        notes: "",
      });
      loadCompanies();
    } catch (err: any) {
      setFormError(err.detail || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Companies & Accounts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Directory of corporate clients, EdTech partners, and Higher Education institutions across all business segments.
          </p>
        </div>
        {hasPermission("crm.companies.create") && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Account / Company
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-center gap-4 justify-between">
        <form onSubmit={handleSearchSubmit} className="w-full md:max-w-md flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by company name, code, city, or website..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="ml-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Account Type Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="">All Account Types</option>
              <option value="Corporate / IT Services">Corporate / IT Services</option>
              <option value="EdTech Partner">EdTech Partner</option>
              <option value="Talent Client">Talent Client</option>
              <option value="Engineering College">Engineering College</option>
              <option value="Arts & Science">Arts & Science</option>
              <option value="University">University</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="Lead">Lead</option>
              <option value="Prospect">Prospect</option>
              <option value="Customer">Customer</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {(search || statusFilter || typeFilter) && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase">Active Filters:</span>
            {search && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Search: "{search}"
              </span>
            )}
            {typeFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-2xs font-medium text-indigo-700 dark:text-indigo-400">
                Type: {typeFilter}
              </span>
            )}
            {statusFilter && (
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-2xs font-medium text-slate-700 dark:text-slate-300">
                Status: {statusFilter}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-2xs text-slate-500 dark:text-slate-400 font-medium">
              Showing {companies.length} {companies.length === 1 ? "account" : "accounts"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setTypeFilter("");
              }}
              className="text-2xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Companies Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading accounts from database...</div>
        ) : companies.length === 0 ? (
          <EmptyState
            title="No accounts found"
            description="Start building your client portfolio by adding your first company or institutional account."
            actionLabel="Add Account / Company"
            onAction={() => setIsCreateModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Company / Account</th>
                  <th className="py-3 px-4">Type & Location</th>
                  <th className="py-3 px-4">Account Owner</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Contacts</th>
                  <th className="py-3 px-4 text-center">Active Deals</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {companies.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <a href={`/companies/${comp.id}`}>{comp.organization_name}</a>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">Code: {comp.code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 dark:text-slate-200 text-xs font-medium">{comp.type}</div>
                      <div className="text-2xs text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
                        <MapPin className="w-3 h-3 mr-1 text-slate-400 dark:text-slate-500" />
                        {comp.city ? `${comp.city}, ${comp.state || "India"}` : "India"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {comp.owner_name || "Unassigned"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="status" status={comp.status}>
                        {comp.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {comp.contacts_count}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-transparent dark:border-indigo-800/50 rounded-full font-bold text-xs">
                        {comp.open_opportunities_count} deals
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/companies/${comp.id}`}
                        className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                      >
                        Account 360 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Company / Account Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Company / Account"
      >
        {formError && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs rounded-lg">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Company / Account Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Infosys Ltd or PSG College of Technology"
              value={formData.organization_name}
              onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Account Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. INF-BLR"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs uppercase font-mono text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Account Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Corporate">Corporate / IT Services</option>
                <option value="EdTech Partner">EdTech Partner</option>
                <option value="Talent Client">Talent / Outsourcing Client</option>
                <option value="Engineering College">Engineering College</option>
                <option value="University">University</option>
                <option value="Autonomous Institution">Autonomous Institution</option>
                <option value="Business School">Business School</option>
                <option value="Arts & Science">Arts & Science</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Website</label>
              <input
                type="url"
                placeholder="https://cit.edu.in"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Lead">Lead</option>
                <option value="Prospect">Prospect</option>
                <option value="Customer">Customer</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
              <input
                type="text"
                placeholder="e.g. Coimbatore"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label>
              <input
                type="text"
                placeholder="e.g. Tamil Nadu"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Strategic Notes</label>
            <textarea
              rows={3}
              placeholder="Key business background, account requirements, or organizational notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
