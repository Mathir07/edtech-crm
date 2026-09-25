"use client";

import React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { numberToIndianWords } from "@/lib/numberToWords";

export interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
}

export interface QuotationDocumentData {
  quotation_number: string;
  quotation_date: string;
  valid_until: string | null;
  currency: string;
  company_name: string | null;
  contact_name: string | null;
  opportunity_title?: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  creator_name?: string | null;
  approver_name?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: QuotationItem[];
}

export const BrandedQuotationDocument: React.FC<{
  data: QuotationDocumentData;
  forPrint?: boolean;
}> = ({ data, forPrint = false }) => {
  return (
    <div
      className={`bg-white text-slate-900 font-sans mx-auto print:p-0 print:m-0 print:border-none print:shadow-none ${
        forPrint ? "w-full" : "max-w-4xl p-8 sm:p-12 shadow-2xl rounded-2xl border border-slate-200"
      }`}
      style={{ minHeight: "1000px" }}
    >
      {/* 1. Header with Company Branding & Document Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-indigo-900 pb-6 mb-6">
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
              <span className="font-semibold text-slate-700">Email:</span> enterprise@kiwicloudtech.co.in
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right w-full sm:w-auto">
          <div className="inline-block px-3 py-1 bg-indigo-900 text-white font-mono font-bold text-xs uppercase tracking-widest rounded-sm mb-1.5">
            Commercial Proposal
          </div>
          <p className="font-mono text-lg font-extrabold text-slate-900">
            #{data.quotation_number}
          </p>
          <div className="mt-1">
            <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-800 font-bold text-xs rounded-full border border-indigo-200 uppercase tracking-wider">
              STATUS: {data.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Client & Proposal Particulars */}
      <div className="grid grid-cols-2 gap-6 mb-8 text-xs">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-bold text-slate-500 uppercase tracking-wider text-2xs mb-1.5">
            Prepared For (Client)
          </p>
          <p className="font-bold text-slate-900 text-sm">
            {data.company_name || "Valued Institution / Client"}
          </p>
          {data.contact_name && (
            <p className="text-slate-700 mt-0.5">
              <span className="text-slate-500">Attn:</span> {data.contact_name}
            </p>
          )}
          {data.opportunity_title && (
            <p className="text-slate-600 mt-1">
              <span className="text-slate-500">Project / Scope:</span> {data.opportunity_title}
            </p>
          )}
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-bold text-slate-500 uppercase tracking-wider text-2xs mb-1.5">
            Proposal Details
          </p>
          <div className="space-y-1 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Proposal Date:</span>
              <span className="font-semibold">{formatDate(data.quotation_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Validity Period:</span>
              <span className="font-semibold text-indigo-700">
                {data.valid_until ? formatDate(data.valid_until) : "30 Days from Issue"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Prepared By:</span>
              <span className="font-medium">{data.creator_name || "Enterprise Solutions Team"}</span>
            </div>
            {data.approver_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Approved By:</span>
                <span className="font-medium text-emerald-700">{data.approver_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Deliverables / Line Items Table */}
      <div className="mb-6">
        <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-indigo-950 text-white font-semibold">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-4">Deliverable & Scope Description</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Unit Price</th>
              <th className="py-2.5 px-3 text-right">GST Rate</th>
              <th className="py-2.5 px-3 text-right">Tax (INR)</th>
              <th className="py-2.5 px-4 text-right">Amount (INR)</th>
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
                  No line items listed.
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
            Total Commercial Value in Words
          </p>
          <p className="font-semibold text-slate-800 italic leading-snug">
            {numberToIndianWords(data.total_amount)}
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Base Value):</span>
            <span className="font-mono font-medium">{formatCurrency(data.subtotal)}</span>
          </div>
          {Number(data.discount_amount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Proposed Discount:</span>
              <span className="font-mono font-medium">-{formatCurrency(data.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Applicable GST (18%):</span>
            <span className="font-mono font-medium">{formatCurrency(data.tax_amount)}</span>
          </div>
          <div className="border-t border-slate-300 pt-2 flex justify-between text-slate-900 font-extrabold text-sm">
            <span>Total Contract Value:</span>
            <span className="font-mono text-base text-indigo-900">{formatCurrency(data.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* 5. Terms & Acceptance Dual Signatures */}
      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-300 text-xs">
        {/* Client Acceptance */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <p className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-1">
              Client Acceptance & Confirmation
            </p>
            <p className="text-2xs text-slate-500 mb-8">
              We hereby accept this proposal and authorize execution as per terms.
            </p>
          </div>
          <div className="space-y-1 pt-6 border-t border-dashed border-slate-300 text-2xs text-slate-600">
            <p>Authorized Signature: _____________________</p>
            <p>Name & Title: ___________________________</p>
            <p>Date: ___________________________________</p>
          </div>
        </div>

        {/* Kiwi Cloud Tech Signatory */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between text-right">
          <div>
            <p className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-1">
              For Kiwi Cloud Tech Private Limited
            </p>
            <p className="text-2xs text-slate-500 mb-8">
              Authorized Institutional & Commercial Signatory
            </p>
          </div>
          <div className="pt-6 border-t border-dashed border-slate-300 text-2xs text-slate-600">
            <div className="w-36 ml-auto border-b border-slate-400 mb-1" />
            <p className="font-bold text-slate-900">Authorized Signature & Seal</p>
            <p className="text-slate-500">Enterprise Solutions Division</p>
          </div>
        </div>
      </div>

      {/* 6. Standard Commercial Notes */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-2xs text-slate-500 leading-relaxed">
        <p className="font-bold uppercase tracking-wider mb-1 text-slate-600">Commercial Terms & Scope:</p>
        <p>1. Proposal is valid for 30 calendar days from issue date.</p>
        <p>2. Payment Milestones: 50% advance on signing of Sales Order; 50% on deployment and sign-off.</p>
        <p>3. Taxes are calculated as per prevailing Government of India GST regulations.</p>
      </div>
    </div>
  );
};
