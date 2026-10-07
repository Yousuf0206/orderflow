import { Link } from "react-router-dom";

import Button from "../../components/ui/Button";

export default function Landing() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-lg font-semibold text-slate-900">OrderFlow</div>
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
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Track Purchase Orders and partial dispatches, live.
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">
          OrderFlow keeps your remaining balances accurate in real time — built for trading
          companies and material dealers who deliver in parts, not all at once.
        </p>
        <Link to="/signup" className="inline-block">
          <Button className="px-6 py-3 text-base">Start your free trial</Button>
        </Link>
      </main>
    </div>
  );
}
