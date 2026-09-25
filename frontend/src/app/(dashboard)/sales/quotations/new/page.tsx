"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  Save,
  Send,
  Building2,
  Calendar,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface Company {
  id: string;
  organization_name: string;
}

interface Contact {
  id: string;
  name: string;
  designation: string | null;
}

interface Opportunity {
  id: string;
  title: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  base_price: number;
  tax_rate: number;
  unit: string;
}

interface QuotationLineItem {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get("company_id") || "";
  const initialOppId = searchParams.get("opportunity_id") || "";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [collegeId, setCompanyId] = useState(initialCompanyId);
  const [contactId, setContactId] = useState("");
  const [opportunityId, setOpportunityId] = useState(initialOppId);
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("Standard higher education ERP implementation and cloud hosting proposal.");
  const [terms, setTerms] = useState("Payment Schedule: 50% on Purchase Order, 40% on UAT Sign-off, 10% on Go-Live. Net 30 days.");

  const [items, setItems] = useState<QuotationLineItem[]>([
    {
      description: "HigherEd Campus ERP License",
      quantity: 1,
      unit_price: 500000,
      discount: 0,
      tax_rate: 18,
    },
  ]);

  const [calcTotals, setCalcTotals] = useState({
    subtotal: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load Initial Metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const [cols, prods] = await Promise.all([
          api.get<Company[]>("/companies"),
          api.get<Product[]>("/products?status=Active"),
        ]);
        setCompanies(cols);
        setProducts(prods);
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    }
    loadMeta();
  }, []);

  // When company selection changes, load its contacts and opportunities
  useEffect(() => {
    if (!collegeId) {
      setContacts([]);
      setOpportunities([]);
      setContactId("");
      setOpportunityId("");
      return;
    }

    async function loadCompanyDetails() {
      try {
        const data = await api.get<any>(`/companies/${collegeId}`);
        setContacts(data.contacts || []);
        setOpportunities(data.opportunities || []);
        if (data.contacts && data.contacts.length > 0 && !contactId) {
          setContactId(data.contacts[0].id);
        }
      } catch (err) {
        console.error("Failed to load company contacts/opps", err);
      }
    }
    loadCompanyDetails();
  }, [collegeId]);

  // Recalculate totals on item change
  useEffect(() => {
    let totSubtotal = 0;
    let totDiscount = 0;
    let totTax = 0;

    items.forEach((it) => {
      const q = Math.max(0, it.quantity);
      const p = Math.max(0, it.unit_price);
      const lineSub = q * p;
      const d = Math.min(lineSub, Math.max(0, it.discount));
      const taxable = Math.max(0, lineSub - d);
      const tax = taxable * (it.tax_rate / 100);

      totSubtotal += lineSub;
      totDiscount += d;
      totTax += tax;
    });

    setCalcTotals({
      subtotal: totSubtotal,
      discount_amount: totDiscount,
      tax_amount: totTax,
      total_amount: totSubtotal - totDiscount + totTax,
    });
  }, [items]);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        discount: 0,
        tax_rate: 18,
      },
    ]);
  };

  const handleSelectProduct = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    const next = [...items];
    next[index] = {
      ...next[index],
      product_id: prod.id,
      description: prod.name + (prod.unit ? ` (${prod.unit})` : ""),
      unit_price: Number(prod.base_price),
      tax_rate: Number(prod.tax_rate),
    };
    setItems(next);
  };

  const handleUpdateItem = (index: number, field: keyof QuotationLineItem, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (submitForApproval: boolean) => {
    setErrorMsg("");
    if (!collegeId) {
      setErrorMsg("Please select a target company / account.");
      return;
    }
    if (items.length === 0 || items.some((it) => !it.description.trim())) {
      setErrorMsg("Please provide a description for all line items.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        company_id: collegeId,
        contact_id: contactId || null,
        opportunity_id: opportunityId || null,
        quotation_date: quotationDate,
        valid_until: validUntil,
        currency: "INR",
        notes,
        terms,
        items: items.map((it) => ({
          product_id: it.product_id || null,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount: Number(it.discount),
          tax_rate: Number(it.tax_rate),
        })),
      };

      const quote = await api.post<any>("/quotations", payload);

      if (submitForApproval) {
        await api.post(`/quotations/${quote.id}/submit`);
      }

      router.push(`/sales/quotations/${quote.id}`);
    } catch (err: any) {
      setErrorMsg(err.detail || "Failed to create quotation");
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/sales/quotations"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create Institutional Quotation</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Build a custom commercial proposal with verified GST calculations.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-sm disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4 mr-1.5" />
            Save & Submit
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Company & Contact Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Client & Opportunity Context
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Company / Institution *</label>
            <select
              value={collegeId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="">Select institution...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Institutional Contact</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              disabled={!collegeId}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 dark:disabled:text-slate-400"
            >
              <option value="">Select contact...</option>
              {contacts.map((con) => (
                <option key={con.id} value={con.id}>
                  {con.name} {con.designation ? `(${con.designation})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Linked Opportunity</label>
            <select
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              disabled={!collegeId}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 dark:disabled:text-slate-400"
            >
              <option value="">Select opportunity (optional)...</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quotation Date</label>
            <input
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Line Items Composer */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Proposal Line Items
          </h2>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" />
            Add Row
          </button>
        </div>

        <div className="p-6 space-y-4">
          {items.map((item, idx) => {
            const lineSub = Math.max(0, item.quantity) * Math.max(0, item.unit_price);
            const lineDisc = Math.min(lineSub, Math.max(0, item.discount));
            const taxable = Math.max(0, lineSub - lineDisc);
            const tax = taxable * (item.tax_rate / 100);
            const lineTotal = taxable + tax;

            return (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Item #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => handleSelectProduct(idx, e.target.value)}
                      value={item.product_id || ""}
                      className="text-xs px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 font-semibold focus:outline-none"
                    >
                      <option value="">Insert Catalog Item...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code}) - {formatCurrency(p.base_price)}
                        </option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-2xs font-semibold text-slate-600 dark:text-slate-400">Item Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EduSuite Campus ERP Cloud"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(idx, "description", e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-2xs font-semibold text-slate-600 dark:text-slate-400">Qty</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(idx, "quantity", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-2xs font-semibold text-slate-600 dark:text-slate-400">Unit Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleUpdateItem(idx, "unit_price", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-2xs font-semibold text-slate-600 dark:text-slate-400">Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => handleUpdateItem(idx, "discount", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 font-mono text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-2xs font-semibold text-slate-600 dark:text-slate-400">GST Rate (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={item.tax_rate}
                      onChange={(e) => handleUpdateItem(idx, "tax_rate", Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1 text-xs text-slate-500 dark:text-slate-400 gap-4 font-mono">
                  <span>Tax: {formatCurrency(tax)}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Line Total: {formatCurrency(lineTotal)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Calculation Rollup */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-6 border-t border-slate-200 dark:border-slate-800 flex flex-col items-end space-y-2">
          <div className="w-full sm:w-80 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{formatCurrency(calcTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Total Discount:</span>
              <span className="font-mono font-medium">- {formatCurrency(calcTotals.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>GST Tax Amount:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">+ {formatCurrency(calcTotals.tax_amount)}</span>
            </div>
            <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between text-base font-bold text-slate-900 dark:text-slate-100">
              <span>Grand Total:</span>
              <span className="font-mono text-indigo-700 dark:text-indigo-400">{formatCurrency(calcTotals.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Terms & Notes */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Proposal Terms & Institutional Notes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Terms of Payment & Implementation</label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Internal & Client Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
