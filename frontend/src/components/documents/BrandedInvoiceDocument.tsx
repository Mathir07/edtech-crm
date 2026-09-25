"use client";

import React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { numberToIndianWords } from "@/lib/numberToWords";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
}

export interface InvoiceDocumentData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  company_name: string | null;
  contact_name: string | null;
  sales_order_number: string | null;
  contract_number?: string | null;
  project_number?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  notes?: string | null;
  terms?: string | null;
  items: InvoiceItem[];
}

export const BrandedInvoiceDocument: React.FC<{
  data: InvoiceDocumentData;
  forPrint?: boolean;
}> = ({ data, forPrint = false }) => {
  const isPaid = data.amount_due <= 0 || data.status === "Paid";
  const isPartial = data.amount_paid > 0 && data.amount_due > 0;

  // Compute CGST and SGST (9% each for standard 18% GST intra-state)
  const halfTax = (Number(data.tax_amount) || 0) / 2;

  return (
    <div
      className={`bg-white text-slate-900 font-sans mx-auto print:p-0 print:m-0 print:border-none print:shadow-none ${
        forPrint ? "w-full" : "max-w-4xl p-8 sm:p-12 shadow-2xl rounded-2xl border border-slate-200"
      }`}
      style={{ minHeight: "1000px" }}
    >
      {/* 1. Header with Company Branding & Document Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
        <div className="flex items-center space-x-3.5 mb-4 sm:mb-0">
          <img
            src="/logo.png"
            alt="Kiwi Cloud Tech Logo"
            className="w-14 h-14 object-contain shrink-0"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              Kiwi Cloud Tech Private Limited
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              14/2, Bharathi Park 7th Cross, Saibaba Colony, Coimbatore, Tamil Nadu – 641011
            </p>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">GSTIN:</span> 33AAACK1234F1Z5 &nbsp;|&nbsp;{" "}
              <span className="font-semibold text-slate-700">Email:</span> billing@kiwicloudtech.co.in
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right w-full sm:w-auto">
          <div className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-widest rounded-sm mb-1.5">
            Tax Invoice
          </div>
          <p className="font-mono text-lg font-extrabold text-slate-900">
            #{data.invoice_number}
          </p>
          <div className="mt-1">
            {isPaid ? (
              <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full border border-emerald-300 uppercase tracking-wider">
                PAID IN FULL
              </span>
            ) : isPartial ? (
              <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-xs rounded-full border border-amber-300 uppercase tracking-wider">
                PARTIALLY PAID
              </span>
            ) : (
              <span className="inline-block px-2.5 py-0.5 bg-rose-100 text-rose-800 font-bold text-xs rounded-full border border-rose-300 uppercase tracking-wider">
                PAYMENT DUE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Metadata Grid: Bill To vs. Invoice Particulars */}
      <div className="grid grid-cols-2 gap-6 mb-8 text-xs">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-bold text-slate-500 uppercase tracking-wider text-2xs mb-1.5">
            Billed To
          </p>
          <p className="font-bold text-slate-900 text-sm">
            {data.company_name || "Valued Client"}
          </p>
          {data.contact_name && (
            <p className="text-slate-700 mt-0.5">
              <span className="text-slate-500">Attn:</span> {data.contact_name}
            </p>
          )}
          <p className="text-slate-600 mt-1">Client Account / Corporate Entity</p>
          <p className="text-slate-500 mt-0.5">Place of Supply: Tamil Nadu (33)</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-bold text-slate-500 uppercase tracking-wider text-2xs mb-1.5">
            Invoice Particulars
          </p>
          <div className="space-y-1 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Date:</span>
              <span className="font-semibold">{formatDate(data.invoice_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Due Date:</span>
              <span className="font-semibold text-rose-700">{formatDate(data.due_date)}</span>
            </div>
            {data.sales_order_number && (
              <div className="flex justify-between">
                <span className="text-slate-500">Sales Order Ref:</span>
                <span className="font-mono font-medium">{data.sales_order_number}</span>
              </div>
            )}
            {data.project_number && (
              <div className="flex justify-between">
                <span className="text-slate-500">Project Code:</span>
                <span className="font-mono font-medium">{data.project_number}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Items Table */}
      <div className="mb-6">
        <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-900 text-white font-semibold">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-4">Item & Description</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Unit Price</th>
              <th className="py-2.5 px-3 text-right">GST Rate</th>
              <th className="py-2.5 px-3 text-right">Tax (INR)</th>
              <th className="py-2.5 px-4 text-right">Total (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.items && data.items.length > 0 ? (
              data.items.map((item, index) => (
                <tr key={item.id || index} className="even:bg-slate-50/60">
                  <td className="py-3 px-3 text-center text-slate-500 font-mono">
                    {index + 1}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {item.description}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {item.tax_rate}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {formatCurrency(item.tax_amount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-4 text-center text-slate-400">
                  No line items recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Financial Calculations & Amount in Words */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 items-start">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <p className="font-bold text-slate-500 uppercase tracking-wider text-2xs mb-1">
            Total Amount in Words
          </p>
          <p className="font-semibold text-slate-800 italic leading-snug">
            {numberToIndianWords(data.total_amount)}
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Taxable Subtotal:</span>
            <span className="font-mono font-medium">{formatCurrency(data.subtotal)}</span>
          </div>
          {Number(data.discount_amount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Trade Discount:</span>
              <span className="font-mono font-medium">-{formatCurrency(data.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Central GST (CGST @ 9%):</span>
            <span className="font-mono font-medium">{formatCurrency(halfTax)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>State GST (SGST @ 9%):</span>
            <span className="font-mono font-medium">{formatCurrency(halfTax)}</span>
          </div>
          <div className="border-t border-slate-300 pt-2 flex justify-between text-slate-900 font-extrabold text-sm">
            <span>Total Invoice Amount:</span>
            <span className="font-mono text-base">{formatCurrency(data.total_amount)}</span>
          </div>
          {Number(data.amount_paid) > 0 && (
            <div className="flex justify-between text-emerald-700 pt-1">
              <span>Amount Paid:</span>
              <span className="font-mono font-medium">{formatCurrency(data.amount_paid)}</span>
            </div>
          )}
          <div className="flex justify-between text-rose-700 font-bold border-t border-slate-200 pt-1">
            <span>Balance Payable:</span>
            <span className="font-mono">{formatCurrency(data.amount_due)}</span>
          </div>
        </div>
      </div>

      {/* 5. Bank Account Details & Authorized Signatory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-300 text-xs items-end">
        <div>
          <p className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-2">
            Payment & Bank Wire Details
          </p>
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1 text-slate-700 font-mono text-2xs">
            <p><span className="text-slate-500 font-sans">Bank:</span> HDFC Bank Ltd.</p>
            <p><span className="text-slate-500 font-sans">A/C Name:</span> Kiwi Cloud Tech Private Limited</p>
            <p><span className="text-slate-500 font-sans">A/C No.:</span> 50200088921475</p>
            <p><span className="text-slate-500 font-sans">IFSC Code:</span> HDFC0001234</p>
            <p><span className="text-slate-500 font-sans">Branch:</span> Saibaba Colony, Coimbatore</p>
            <p><span className="text-slate-500 font-sans">UPI VPA:</span> billing@kiwicloudtech</p>
          </div>
        </div>

        <div className="text-center sm:text-right flex flex-col items-center sm:items-end justify-end">
          <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-14">
            For Kiwi Cloud Tech Private Limited
          </p>
          <div className="w-48 border-b border-slate-400 mb-1.5" />
          <p className="text-xs font-bold text-slate-900">Authorized Signatory</p>
          <p className="text-2xs text-slate-500">Finance & Commercial Operations</p>
        </div>
      </div>

      {/* 6. Terms & Conditions Footer */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-2xs text-slate-500 leading-relaxed">
        <p className="font-bold uppercase tracking-wider mb-1 text-slate-600">Terms & Conditions:</p>
        <p>1. Payment is strictly due on or before the due date mentioned above.</p>
        <p>2. Please quote Invoice #{data.invoice_number} in your bank payment reference or remittance advice.</p>
        <p>3. This is a computer-generated tax invoice issued in accordance with the Central Goods and Services Tax Act, 2017.</p>
      </div>
    </div>
  );
};
