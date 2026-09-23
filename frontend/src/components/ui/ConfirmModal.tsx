"use client";

import React from "react";
import { AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}) => {
  if (!isOpen) return null;

  let icon = <AlertCircle className="w-6 h-6 text-rose-600" />;
  let iconBg = "bg-rose-100";
  let btnBg = "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500";

  if (variant === "warning") {
    icon = <AlertTriangle className="w-6 h-6 text-amber-600" />;
    iconBg = "bg-amber-100";
    btnBg = "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500";
  } else if (variant === "info") {
    icon = <Info className="w-6 h-6 text-indigo-600" />;
    iconBg = "bg-indigo-100";
    btnBg = "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={isLoading ? undefined : onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-2 focus:outline-hidden focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${btnBg}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
