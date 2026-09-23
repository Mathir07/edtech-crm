"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Building2,
  Download,
  BookmarkPlus,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";
import { ReportFilterParams, reportsApi } from "@/lib/reportsApi";
import { api } from "@/lib/api";

interface CompanyOption {
  id: string;
  name: string;
}

interface ReportFilterBarProps {
  reportType: string;
  onFilterChange: (filters: ReportFilterParams) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onOpenSaveModal?: () => void;
  currentFilters?: ReportFilterParams;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  reportType,
  onFilterChange,
  onRefresh,
  isLoading = false,
  onOpenSaveModal,
  currentFilters = {},
}) => {
  const [datePreset, setDatePreset] = useState<string>(
    currentFilters.date_preset || "THIS_MONTH"
  );
  const [dateFrom, setDateFrom] = useState<string>(currentFilters.date_from || "");
  const [dateTo, setDateTo] = useState<string>(currentFilters.date_to || "");
  const [companyId, setCompanyId] = useState<string>(currentFilters.company_id || "");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch companies for dropdown
    const fetchCompanies = async () => {
      try {
        const res = await api.get<{ items: CompanyOption[] } | CompanyOption[]>(
          "/companies?limit=100"
        );
        if (Array.isArray(res)) {
          setCompanies(res);
        } else if (res && Array.isArray((res as any).items)) {
          setCompanies((res as any).items);
        }
      } catch {
        // Silently ignore if companies fail to load
      }
    };
    fetchCompanies();
  }, []);

  const handleApply = (newPreset?: string) => {
    const preset = newPreset !== undefined ? newPreset : datePreset;
    const filters: ReportFilterParams = {};
    if (preset && preset !== "CUSTOM") {
      filters.date_preset = preset;
    }
    if (preset === "CUSTOM") {
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;
    }
    if (companyId) {
      filters.company_id = companyId;
    }
    onFilterChange(filters);
  };

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset !== "CUSTOM") {
      setDateFrom("");
      setDateTo("");
      handleApply(preset);
    }
  };

  const handleReset = () => {
    setDatePreset("THIS_MONTH");
    setDateFrom("");
    setDateTo("");
    setCompanyId("");
    onFilterChange({ date_preset: "THIS_MONTH" });
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      const filters: ReportFilterParams = {};
      if (datePreset && datePreset !== "CUSTOM") {
        filters.date_preset = datePreset;
      }
      if (datePreset === "CUSTOM") {
        if (dateFrom) filters.date_from = dateFrom;
        if (dateTo) filters.date_to = dateTo;
      }
      if (companyId) filters.company_id = companyId;

      await reportsApi.exportCsv(reportType, filters);
    } catch (err: any) {
      setExportError(err.message || "Failed to export report CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Dropdown */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <select
              value={datePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              <option value="THIS_MONTH" className="dark:bg-slate-950">This Month</option>
              <option value="LAST_30_DAYS" className="dark:bg-slate-950">Last 30 Days</option>
              <option value="LAST_90_DAYS" className="dark:bg-slate-950">Last 90 Days</option>
              <option value="THIS_WEEK" className="dark:bg-slate-950">This Week</option>
              <option value="THIS_QUARTER" className="dark:bg-slate-950">This Quarter</option>
              <option value="THIS_YEAR" className="dark:bg-slate-950">This Year</option>
              <option value="TODAY" className="dark:bg-slate-950">Today</option>
              <option value="YESTERDAY" className="dark:bg-slate-950">Yesterday</option>
              <option value="CUSTOM" className="dark:bg-slate-950">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Inputs if CUSTOM is selected */}
          {datePreset === "CUSTOM" && (
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-950/60 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
                className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-200"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
                className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={() => handleApply()}
                className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded hover:bg-indigo-700 font-medium"
              >
                Apply
              </button>
            </div>
          )}

          {/* Company Selector */}
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                const filters: ReportFilterParams = {
                  date_preset: datePreset !== "CUSTOM" ? datePreset : undefined,
                  date_from: datePreset === "CUSTOM" ? dateFrom : undefined,
                  date_to: datePreset === "CUSTOM" ? dateTo : undefined,
                  company_id: e.target.value || undefined,
                };
                onFilterChange(filters);
              }}
              className="text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-700 dark:text-slate-200 max-w-xs truncate"
            >
              <option value="" className="dark:bg-slate-950">All Companies & Accounts</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-slate-950">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset button if filters active */}
          {(datePreset !== "THIS_MONTH" || companyId || dateFrom || dateTo) && (
            <button
              onClick={handleReset}
              className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors"
              title="Reset Filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
            </button>
          )}

          {onOpenSaveModal && (
            <button
              onClick={onOpenSaveModal}
              className="flex items-center space-x-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Save Preset</span>
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center space-x-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-bounce" : ""}`} />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">
          {exportError}
        </div>
      )}
    </div>
  );
};
