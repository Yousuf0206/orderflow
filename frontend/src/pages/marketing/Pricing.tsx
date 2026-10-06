import { Link } from "react-router-dom";

const PLANS = [
  { name: "Starter", price: "$29/mo", users: 5, pos: 100 },
  { name: "Business", price: "$79/mo", users: 20, pos: 1000 },
  { name: "Pro", price: "$199/mo", users: "Unlimited", pos: "Unlimited" },
];

export default function Pricing() {
  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center p-4 max-w-5xl mx-auto">
        <Link to="/" className="font-semibold text-lg">OrderFlow</Link>
        <Link to="/signup" className="bg-slate-900 text-white rounded px-3 py-1.5 text-sm">Start free trial</Link>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center mb-8">Simple, usage-based pricing</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div key={plan.name} className="bg-white rounded-lg shadow p-6 text-center space-y-2">
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="text-2xl font-bold">{plan.price}</p>
              <p className="text-sm text-slate-500">{plan.users} users</p>
              <p className="text-sm text-slate-500">{plan.pos} active POs</p>
              <Link to="/signup" className="block bg-slate-900 text-white rounded py-2 mt-4">
                Start trial
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
