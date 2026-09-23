"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title?: string; message: string; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({
      type = "info",
      title,
      message,
      duration = 4000,
    }: {
      type?: ToastType;
      title?: string;
      message: string;
      duration?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((message: string, title?: string) => addToast({ type: "success", title, message }), [addToast]);
  const error = useCallback((message: string, title?: string) => addToast({ type: "error", title, message, duration: 6000 }), [addToast]);
  const warning = useCallback((message: string, title?: string) => addToast({ type: "warning", title, message, duration: 5000 }), [addToast]);
  const info = useCallback((message: string, title?: string) => addToast({ type: "info", title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning, info }}>
      {children}
      {/* Toast Overlay Container */}
      <div
        aria-live="assertive"
        className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          let bg = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100";
          let icon = <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />;

          if (t.type === "success") {
            bg = "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/80 text-slate-800 dark:text-slate-100";
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
          } else if (t.type === "error") {
            bg = "bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800/80 text-slate-800 dark:text-slate-100";
            icon = <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />;
          } else if (t.type === "warning") {
            bg = "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/80 text-slate-800 dark:text-slate-100";
            icon = <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start p-3.5 rounded-xl border shadow-lg dark:shadow-slate-950/60 transition-all transform ease-out duration-200 ${bg}`}
            >
              <div className="mt-0.5 mr-3">{icon}</div>
              <div className="flex-1 min-w-0">
                {t.title && <div className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{t.title}</div>}
                <div className={`text-xs ${t.title ? "text-slate-500 dark:text-slate-400 mt-0.5" : "text-slate-700 dark:text-slate-300 font-medium"}`}>
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="ml-2 -mr-1 -mt-1 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
