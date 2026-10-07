import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ScrollText,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePageMeta } from "../../hooks/usePageMeta";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Wallet,
    title: "Live remaining balance",
    desc: "Every partial dispatch updates the remaining balance instantly — no spreadsheet reconciliation at month-end.",
  },
  {
    icon: Truck,
    title: "Partial dispatch tracking",
    desc: "Log dispatches as they go out the door and see ordered, dispatched, and remaining quantities side by side.",
  },
  {
    icon: Users,
    title: "Multi-party management",
    desc: "Keep every customer and supplier's open orders and balances organized in one place, searchable by party.",
  },
  {
    icon: ScrollText,
    title: "Audit trail & team roles",
    desc: "Every action is logged. Invite your team with owner, manager, staff, or viewer roles to match who should edit what.",
  },
];

const STEPS = [
  {
    title: "Add your parties",
    desc: "Set up the customers and suppliers you place or receive purchase orders with.",
  },
  {
    title: "Create a purchase order",
    desc: "Record the material, quantity, unit, and due date you're expecting delivery by.",
  },
  {
    title: "Log dispatches as they happen",
    desc: "Each partial delivery updates the remaining balance live — for you and everyone on your team.",
  },
];

const INDUSTRIES = ["Steel & Metals", "Cement & Building Materials", "Chemicals", "Textiles", "Agri Commodities"];

export default function Landing() {
  usePageMeta(
    "Track purchase orders and partial dispatches, live",
    "OrderFlow keeps your remaining balances accurate in real time for trading companies and material dealers who deliver in parts, not all at once.",
  );

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            O
          </div>
          <span className="text-lg font-semibold text-slate-900">OrderFlow</span>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/pricing" className="text-slate-600 hover:text-slate-900">
            Pricing
          </Link>
          <Link to="/login" className="text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link to="/signup">
            <Button>Start free trial</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl space-y-6 px-4 pb-14 pt-10 text-center sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Track Purchase Orders and partial dispatches, live.
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">
          OrderFlow keeps your remaining balances accurate in real time — built for trading
          companies and material dealers who deliver in parts, not all at once.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/signup" className="inline-block w-full sm:w-auto">
            <Button className="w-full px-6 py-3 text-base sm:w-auto">
              Start your free trial
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            See pricing
          </Link>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <CheckCircle2 size={14} className="text-emerald-500" />
          14-day free trial · No credit card required
        </p>
      </section>

      {/* Industries strip */}
      <section className="border-y border-slate-100 bg-slate-50 py-6">
        <div className="mx-auto max-w-5xl px-4">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            Built for teams who deliver in parts
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            {INDUSTRIES.map((industry) => (
              <span key={industry}>{industry}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Everything you need to stop guessing what's left to deliver
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="space-y-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Up and running in three steps
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Card key={step.title} className="space-y-3 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <div className="flex flex-col items-center gap-4 rounded-xl bg-brand-600 p-10 text-center shadow-card">
          <ClipboardList size={28} className="text-white" />
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to see your remaining balances update live?
          </h2>
          <p className="max-w-md text-sm text-brand-100">
            Start your free trial today — no credit card required, cancel anytime.
          </p>
          <Link to="/signup">
            <Button variant="secondary" className="px-6 py-3 text-base">
              Start your free trial
              <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} OrderFlow</span>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-slate-900">
              Pricing
            </Link>
            <Link to="/login" className="hover:text-slate-900">
              Log in
            </Link>
            <Link to="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
