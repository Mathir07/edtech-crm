export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "won":
    case "customer":
    case "completed":
    case "active":
    case "resolved":
    case "closed":
    case "on_track":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "qualified":
    case "in progress":
    case "in_progress":
    case "open":
    case "assigned":
    case "scheduled":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "new":
    case "prospect":
    case "contacted":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending":
    case "medium":
    case "waiting_for_customer":
    case "waiting_for_internal":
    case "customer_confirmation":
    case "at_risk":
    case "paused":
    case "partially_paid":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "lost":
    case "urgent":
    case "high":
    case "critical":
    case "cancelled":
    case "breached":
    case "reopened":
    case "overdue":
    case "void":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "paid":
    case "posted":
    case "reconciled":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "issued":
    case "received":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "reversed":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}
