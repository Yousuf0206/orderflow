import { AlertTriangle, CheckCircle2, Clock, PackageCheck, type LucideIcon } from "lucide-react";

export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
  chartColor: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  on_track: {
    label: "On Track",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    dotClass: "bg-emerald-500",
    chartColor: "#10b981",
  },
  due_soon: {
    label: "Due Soon",
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
    dotClass: "bg-amber-500",
    chartColor: "#f59e0b",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    badgeClass: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20",
    dotClass: "bg-red-500",
    chartColor: "#ef4444",
  },
  fully_dispatched: {
    label: "Fully Dispatched",
    icon: PackageCheck,
    badgeClass: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/20",
    dotClass: "bg-slate-400",
    chartColor: "#94a3b8",
  },
};

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? STATUS_META.on_track;
}
