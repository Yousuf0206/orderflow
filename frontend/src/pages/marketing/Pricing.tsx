import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

const PLANS = [
  { name: "Starter", price: "$29/mo", users: 5, pos: 100 },
  { name: "Business", price: "$79/mo", users: 20, pos: 1000 },
  { name: "Pro", price: "$199/mo", users: "Unlimited", pos: "Unlimited" },
];

export default function Pricing() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          OrderFlow
        </Link>
        <Link to="/signup">
          <Button>Start free trial</Button>
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-8 text-center text-2xl font-bold text-slate-900 sm:text-3xl">Simple, usage-based pricing</h1>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.name} className="space-y-2 p-6 text-center">
              <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
              <p className="text-2xl font-bold text-slate-900">{plan.price}</p>
              <p className="text-sm text-slate-500">{plan.users} users</p>
              <p className="text-sm text-slate-500">{plan.pos} active POs</p>
              <Link to="/signup" className="block pt-2">
                <Button className="w-full">Start trial</Button>
              </Link>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
