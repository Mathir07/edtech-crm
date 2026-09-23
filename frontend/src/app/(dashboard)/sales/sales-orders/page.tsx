"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
  Building2,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  Sparkles,
  FolderGit2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string | null;
  product_name: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  company_id: string;
  college_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  quotation_id: string | null;
  quotation_number: string | null;
  contract_id: string | null;
  contract_number: string | null;
  order_date: string | null;
  currency: string;
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  created_by_id: string | null;
  creator_name: string | null;
  confirmed_by_id: string | null;
  confirmer_name: string | null;
  confirmed_at: string | null;
  items: SalesOrderItem[];
  created_at: string;
  updated_at: string;
}

interface CompanyOption {
  id: string;
  organization_name: string;
}

interface QuotationOption {
  id: string;
  quotation_number: string;
  total_amount: number;
  company_id: string;
  status: string;
}

export default function SalesOrdersListPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selected Order Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  // Project Handoff Modal
  const [handoffOrder, setHandoffOrder] = useState<SalesOrder | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    company_id: "",
    quotation_id: "",
    notes: "Institutional purchase order issued for campus technology rollout.",
  });

  useEffect(() => {
    loadColleges();
    loadQuotations();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [search, statusFilter]);

  const loadColleges = async () => {
    try {
      const data = await api.get<CompanyOption[]>("/companies");
      setCompanies(data);
      if (data.length > 0 && !createForm.company_id) {
        setCreateForm((prev) => ({ ...prev, company_id: data[0].id }));
      }
    } catch (err) {
      console.error("Failed to load companies", err);
    }
  };

  const loadQuotations = async () => {
    try {
      const data = await api.get<QuotationOption[]>("/quotations");
      // filter only approved or sent quotations
      setQuotations(data || []);
    } catch (err) {
      console.error("Failed to load quotations", err);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const data = await api.get<SalesOrder[]>(`/sales-orders?${params.toString()}`);
      setOrders(data);
    } catch (err) {
      console.error("Failed to load sales orders", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.company_id) {
      toast.error("Please select an institution");
      return;
    }
    try {
      setCreateLoading(true);
      const payload: any = {
        company_id: createForm.company_id,
        notes: createForm.notes,
        quotation_id: createForm.quotation_id || undefined,
        items: [],
      };

      // If no quotation selected, add a baseline service order item
      if (!createForm.quotation_id) {
        payload.items = [
          {
            description: "Institutional Software Subscription & Deployment",
            quantity: 1,
            unit_price: 150000,
            discount: 0,
            tax_rate: 18,
          },
        ];
      }

      await api.post("/sales-orders", payload);
      toast.success("Sales order created successfully");
      setIsCreateOpen(false);
      setCreateForm({
        company_id: companies[0]?.id || "",
        quotation_id: "",
        notes: "Institutional purchase order issued for campus technology rollout.",
      });
      loadOrders();
    } catch (err: any) {
      toast.error(err.detail || "Failed to create sales order");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to confirm this sales order? This triggers project handoff readiness.")) return;
    try {
      const res: any = await api.post(`/sales-orders/${orderId}/confirm`, {});
      toast.success("Sales order confirmed");
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(res.sales_order || null);
      }
      // Open handoff notification card
      if (res.project_handoff) {
        setHandoffOrder(res.sales_order || orders.find((o) => o.id === orderId) || null);
      }
    } catch (err: any) {
      toast.error(err.detail || "Failed to confirm sales order");
    }
  };

  const handleHandoffToProject = async () => {
    if (!handoffOrder) return;
    try {
      setHandoffLoading(true);
      const res = await api.post<{ id: string }>("/projects/from-sales-order", {
        sales_order_id: handoffOrder.id,
        name: `Implementation: ${handoffOrder.college_name || "Campus"}`,
        notes: `Automated handoff from sales order ${handoffOrder.order_number}`,
      });
      toast.success("Project initialized from sales order");
      setHandoffOrder(null);
      window.location.href = `/projects/${res.id}`;
    } catch (err: any) {
      toast.error(err.detail || "Failed to initialize implementation project");
    } finally {
      setHandoffLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const statusBadges: Record<string, { bg: string; text: string; icon: any }> = {
    Draft: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", icon: Clock },
    Confirmed: { bg: "bg-emerald-100 dark:bg-emerald-950/50", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
    Cancelled: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500 dark:text-slate-400", icon: XCircle },
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Institutional Sales Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Confirmed institutional orders, purchase execution, and automated handoff payload readiness for campus deployment.
          </p>
        </div>
        {hasPermission("sales.orders.create") && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Sales Order
          </button>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          {["ALL", "Draft", "Confirmed", "Cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {st === "ALL" ? "All Orders" : st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search order # or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Order #</th>
                <th className="px-6 py-3.5">Company / Client</th>
                <th className="px-6 py-3.5">Quotation / Contract Ref</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Items</th>
                <th className="px-6 py-3.5">Total Amount</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-500">
                    Loading sales orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 dark:text-slate-500">
                    No sales orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const badge = statusBadges[o.status] || {
                    bg: "bg-slate-100 dark:bg-slate-800",
                    text: "text-slate-600 dark:text-slate-400",
                    icon: Clock,
                  };
                  const Icon = badge.icon;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="hover:underline text-left"
                        >
                          {o.order_number}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{o.college_name || "Independent"}</div>
                        {o.contact_name && <div className="text-xs text-slate-400 dark:text-slate-500">{o.contact_name}</div>}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {o.quotation_number ? (
                          <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                            {o.quotation_number}
                          </span>
                        ) : o.contract_number ? (
                          <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                            {o.contract_number}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {o.order_date || o.created_at.split("T")[0]}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300">
                        {o.items.length} line item{o.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(o.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          View
                        </button>
                        {o.status === "Draft" && hasPermission("sales.orders.confirm") && (
                          <button
                            onClick={() => handleConfirmOrder(o.id)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Confirm Order
                          </button>
                        )}
                        {o.status === "Confirmed" && (
                          <button
                            onClick={() => setHandoffOrder(o)}
                            className="inline-flex items-center text-xs font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                          >
                            <Layers className="w-3 h-3 mr-1" />
                            Handoff
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Order Detail Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Sales Order: ${selectedOrder.order_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedOrder.college_name}</h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Order Status: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedOrder.status}</span>
                  {selectedOrder.quotation_number && ` | Ref Quote: ${selectedOrder.quotation_number}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xs uppercase text-slate-400 dark:text-slate-500 font-semibold">Total Invoiceable Value</div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {formatCurrency(selectedOrder.total_amount)}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h5 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-2">Order Line Items</h5>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-3">Product / Service</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">GST</th>
                      <th className="p-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedOrder.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{it.product_name || "Service Item"}</div>
                          <div className="text-3xs text-slate-400 dark:text-slate-500">{it.description}</div>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{it.quantity}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(it.unit_price)}</td>
                        <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400">{it.tax_rate}%</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(it.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Discount:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    -{formatCurrency(selectedOrder.discount_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>GST (18%):</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(selectedOrder.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
                  <span>Total Amount:</span>
                  <span className="font-mono">{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {selectedOrder.notes && (
              <div>
                <h5 className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">Order Notes</h5>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  {selectedOrder.notes}
                </p>
              </div>
            )}

            {/* Handoff banner if confirmed */}
            {selectedOrder.status === "Confirmed" && (
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h6 className="text-xs font-bold text-purple-900 dark:text-purple-200">Project Handoff Active</h6>
                    <p className="text-2xs text-purple-700 dark:text-purple-300 mt-0.5">
                      Confirmed by {selectedOrder.confirmer_name || "Manager"} on{" "}
                      {selectedOrder.confirmed_at?.split("T")[0]}. Ready for milestone tracking.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHandoffOrder(selectedOrder)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  View Readiness
                </button>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              {selectedOrder.status === "Draft" && hasPermission("sales.orders.confirm") && (
                <button
                  onClick={() => handleConfirmOrder(selectedOrder.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Confirm Sales Order
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Project Handoff Readiness Card / Modal */}
      {handoffOrder && (
        <Modal
          isOpen={!!handoffOrder}
          onClose={() => setHandoffOrder(null)}
          title="Project Implementation Handoff Readiness"
          maxWidth="lg"
        >
          <div className="space-y-5">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Ready for Campus Deployment & Milestone Setup
                </h5>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Sales order <span className="font-mono font-bold">{handoffOrder.order_number}</span> has been
                  formally confirmed. All contractual specifications are locked and pre-formatted for Phase 3
                  Project & Milestone creation.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Institution:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{handoffOrder.college_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Sales Order Ref:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{handoffOrder.order_number}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Total Contract Value:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(handoffOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Deliverable Line Items:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{handoffOrder.items.length} Modules / Deliverables</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Target Extension:</span>
                <span className="text-purple-600 dark:text-purple-400 font-bold">/api/v1/projects (Phase 3)</span>
              </div>
            </div>

            <div className="text-2xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              Payload Schema: company_id, contract_id, order_id, order_number, total_value, items_count, next_module
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setHandoffOrder(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleHandoffToProject}
                disabled={handoffLoading}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <FolderGit2 className="w-4 h-4 mr-1" />
                <span>{handoffLoading ? "Launching Project..." : "Launch Implementation Project"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Order Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Sales Order" maxWidth="lg">
        <form onSubmit={handleCreateOrder} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Institution / Company *</label>
            <select
              required
              value={createForm.company_id}
              onChange={(e) => setCreateForm({ ...createForm, company_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Link Accepted Quotation (Optional)
            </label>
            <select
              value={createForm.quotation_id}
              onChange={(e) => setCreateForm({ ...createForm, quotation_id: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">None (Custom Order Items)</option>
              {quotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quotation_number} — {formatCurrency(q.total_amount)}
                </option>
              ))}
            </select>
            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-1">
              Selecting an accepted quotation automatically copies all line items, pricing, and discount structures.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Order Notes & Scope</label>
            <textarea
              rows={3}
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {createLoading ? "Creating..." : "Create Sales Order"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
