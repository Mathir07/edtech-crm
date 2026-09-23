"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Tags,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Layers,
  FolderTree,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";

interface SubcategoryItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  subcategories: SubcategoryItem[];
}

export default function ServiceCategoriesPage() {
  const { hasPermission } = useAuth();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState("");
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await api.get<CategoryItem[]>("/service/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);
      await api.post("/service/categories", {
        name: catName,
        description: catDesc || undefined,
      });
      setIsCatModalOpen(false);
      setCatName("");
      setCatDesc("");
      loadCategories();
    } catch (err: any) {
      setErrorMessage(err?.detail || "Failed to create category.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId || !subName.trim()) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);
      await api.post(`/service/categories/${selectedCatId}/subcategories`, {
        name: subName,
        description: subDesc || undefined,
      });
      setIsSubModalOpen(false);
      setSubName("");
      setSubDesc("");
      loadCategories();
    } catch (err: any) {
      setErrorMessage(err?.detail || "Failed to create subcategory.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Service Taxonomies & Categories</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure institutional helpdesk classification, ticket domains, and subcategories.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/service"
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Service Operations</span>
          </Link>

          {hasPermission("service.categories.manage") && (
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 dark:text-slate-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">No service categories defined.</div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <FolderTree className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{cat.name}</span>
                    </h2>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {cat.description || "Institutional service area"}
                    </p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
                </div>

                {/* Subcategories */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-3xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Subcategories ({cat.subcategories?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.subcategories?.length === 0 ? (
                      <span className="text-3xs text-slate-400 dark:text-slate-500 italic">No subcategories defined</span>
                    ) : (
                      cat.subcategories.map((sub) => (
                        <span
                          key={sub.id}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-2xs font-medium"
                        >
                          {sub.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              {hasPermission("service.categories.manage") && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setIsSubModalOpen(true);
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Subcategory</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Category Modal */}
      <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title="New Service Category">
        <form onSubmit={handleCreateCategory} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category Name</label>
            <input
              type="text"
              placeholder="e.g. Identity & SSO"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <input
              type="text"
              placeholder="SAML, OAuth, LDAP, and institutional identity provider issues"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCatModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              {actionLoading ? "Creating..." : "Create Category"}
            </button>
          </div>
        </form>
      </Modal>

      {/* New Subcategory Modal */}
      <Modal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} title="New Subcategory">
        <form onSubmit={handleCreateSubcategory} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subcategory Name</label>
            <input
              type="text"
              placeholder="e.g. SAML Certificate Expiry"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <input
              type="text"
              placeholder="Certificate rotation and signature validation issues"
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSubModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              {actionLoading ? "Creating..." : "Create Subcategory"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
