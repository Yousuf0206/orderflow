import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { api } from "../../services/apiClient";

interface OpenOrder {
  id: string;
  po_number: string;
  material: string;
  remaining_balance: number;
  status: string;
  due_date: string;
}

interface PartyDetailData {
  party: { id: string; party_code: string; party_name: string; city: string | null };
  open_orders: OpenOrder[];
}

export default function PartyDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: () => api.get<PartyDetailData>(`/parties/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <p>Loading...</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{data.party.party_name}</h1>
        <p className="text-slate-500 text-sm">
          {data.party.party_code} {data.party.city ? `· ${data.party.city}` : ""}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-left border-b text-slate-500">
              <th className="px-4 py-2">PO Number</th>
              <th className="px-4 py-2">Material</th>
              <th className="px-4 py-2">Remaining</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due</th>
            </tr>
          </thead>
          <tbody>
            {data.open_orders.map((po) => (
              <tr key={po.id} className="border-b last:border-b-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link to={`/purchase-orders/${po.id}`} className="underline">
                    {po.po_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{po.material}</td>
                <td className="px-4 py-2">{po.remaining_balance}</td>
                <td className="px-4 py-2 capitalize">{po.status.replace("_", " ")}</td>
                <td className="px-4 py-2">{po.due_date}</td>
              </tr>
            ))}
            {data.open_orders.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>No open orders for this party.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
