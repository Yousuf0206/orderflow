import { useNavigate } from "react-router-dom";

const STEPS = [
  { title: "Create your first Party", desc: "Add the customer or supplier you'll be tracking Purchase Orders against.", to: "/parties/new" },
  { title: "Create your first Purchase Order", desc: "Record the material, quantity, and due date you're expecting.", to: "/purchase-orders/new" },
  { title: "Record a Dispatch", desc: "Open that Purchase Order and log a partial dispatch to see the Remaining Balance update live.", to: "/purchase-orders" },
];

export default function Onboarding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Welcome to OrderFlow</h1>
          <p className="text-slate-500">Three steps to your first tracked Purchase Order.</p>
        </div>
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="bg-white rounded-lg shadow p-4 flex gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm shrink-0">
                {i + 1}
              </div>
              <div>
                <div className="font-medium">{step.title}</div>
                <div className="text-sm text-slate-500">{step.desc}</div>
              </div>
            </li>
          ))}
        </ol>
        <button
          onClick={() => navigate("/parties/new")}
          className="w-full bg-slate-900 text-white rounded py-2"
        >
          Get started
        </button>
        <button onClick={() => navigate("/dashboard")} className="w-full text-sm text-slate-500 underline">
          Skip for now
        </button>
      </div>
    </div>
  );
}
