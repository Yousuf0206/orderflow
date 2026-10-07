import { useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

const STEPS = [
  { title: "Create your first Party", desc: "Add the customer or supplier you'll be tracking Purchase Orders against.", to: "/parties/new" },
  { title: "Create your first Purchase Order", desc: "Record the material, quantity, and due date you're expecting.", to: "/purchase-orders/new" },
  { title: "Record a Dispatch", desc: "Open that Purchase Order and log a partial dispatch to see the Remaining Balance update live.", to: "/purchase-orders" },
];

export default function Onboarding() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Welcome to OrderFlow</h1>
          <p className="text-slate-500 dark:text-slate-400">Three steps to your first tracked Purchase Order.</p>
        </div>
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="flex gap-3 p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm text-white">
                {i + 1}
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">{step.title}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{step.desc}</div>
              </div>
            </Card>
          ))}
        </ol>
        <Button onClick={() => navigate("/parties/new")} className="w-full">
          Get started
        </Button>
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full rounded-lg py-2 text-sm text-slate-500 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-400"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
