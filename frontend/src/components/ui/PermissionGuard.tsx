"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface PermissionGuardProps {
  permission: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showFallbackScreen?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  requireAll = false,
  children,
  fallback,
  showFallbackScreen = false,
}) => {
  const { hasPermission } = useAuth();

  const permissions = Array.isArray(permission) ? permission : [permission];
  const isAllowed = requireAll
    ? permissions.every((p) => hasPermission(p))
    : permissions.some((p) => hasPermission(p));

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showFallbackScreen) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4 border border-amber-200/60">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Your account role does not have the required permissions ({permissions.join(", ")}) to view this module.
          Please contact your system administrator if you require access.
        </p>
      </div>
    );
  }

  return null;
};
