import { getStatusMeta } from "./statusMeta";

export function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta.badgeClass}`}
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
