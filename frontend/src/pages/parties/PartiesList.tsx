import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import QueryState from "../../components/ui/QueryState";
import PageHeader from "../../components/ui/PageHeader";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { api } from "../../services/apiClient";

interface Party {
  id: string;
  party_code: string;
  party_name: string;
  city: string | null;
  contact_person: string | null;
  phone: string | null;
}

export default function PartiesList() {
  const [q, setQ] = useState("");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["parties", q],
    queryFn: () => api.get<Party[]>(`/parties${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parties"
        description="Customers and suppliers you create Purchase Orders against."
        action={
          <Link to="/parties/new">
            <Button>
              <Plus size={16} /> New Party
            </Button>
          </Link>
        }
      />

      <div className="relative w-full sm:w-80">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search by name or code..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>

      <Card className="overflow-x-auto">
        {/* `data ?? []` used to render "No parties yet" when the fetch had
            failed -- telling a user their parties are gone instead of that we
            couldn't load them. */}
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          refetch={refetch}
          errorFallback="We couldn't load your parties. Your data is safe — this is a display problem."
          loading={<TableSkeleton />}
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState
              icon={Users}
              title={q ? "No parties match that search" : "No parties yet"}
              description={
                q
                  ? "Try a different name or code."
                  : "Add the customers or suppliers you'll be tracking Purchase Orders against."
              }
              action={
                q ? undefined : (
                  <Link to="/parties/new">
                    <Button>
                      <Plus size={16} /> New Party
                    </Button>
                  </Link>
                )
              }
            />
          }
        >
          {(rows) => (
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{p.party_code}</td>
                  <td className="px-5 py-3">
                    <Link to={`/parties/${p.id}`} className="font-medium text-slate-900 hover:text-brand-600 hover:underline dark:text-white">
                      {p.party_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.city ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.contact_person ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
