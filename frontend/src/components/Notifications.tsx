import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Clock } from "lucide-react";
import { useState } from "react";

import { api, describeApiError } from "../services/apiClient";
import EmptyState from "./ui/EmptyState";

interface NotificationItem {
  id: string;
  type: string;
  purchase_order_id: string | null;
  sent_at: string;
  read_at: string | null;
}

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/notifications"),
    refetchInterval: 60_000,
  });

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
              Notifications
            </div>
            <div className="max-h-96 overflow-y-auto">
              {/* "You're all caught up" on a failed fetch is a false
                  reassurance -- there may be overdue orders we simply never
                  retrieved, and this panel is the only place they surface. */}
              {isError && (
                <div className="px-4 py-3 text-sm">
                  <p role="alert" className="text-red-700 dark:text-red-400">
                    {describeApiError(error, "We couldn't load your notifications.")}
                  </p>
                  <button type="button" onClick={() => refetch()} className="mt-1 font-medium underline">
                    Try again
                  </button>
                </div>
              )}
              {!isError && isLoading && (
                <p className="px-4 py-3 text-sm text-slate-400">Checking for updates…</p>
              )}
              {!isError && !isLoading && (data ?? []).length === 0 && (
                <EmptyState icon={Bell} title="You're all caught up" description="No notifications yet." />
              )}
              {(data ?? []).map((n) => {
                const Icon = n.type === "overdue" ? AlertTriangle : Clock;
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex w-full items-start gap-2.5 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                      n.read_at ? "text-slate-400 dark:text-slate-500" : "font-medium text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <Icon size={15} className={n.type === "overdue" ? "mt-0.5 text-red-500" : "mt-0.5 text-amber-500"} />
                    <span>
                      PO {n.type === "overdue" ? "overdue" : "due soon"}
                      <span className="mt-0.5 block text-xs font-normal text-slate-400 dark:text-slate-500">
                        {new Date(n.sent_at).toLocaleString()}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
