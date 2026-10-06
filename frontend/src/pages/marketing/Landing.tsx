import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center p-4 max-w-5xl mx-auto">
        <div className="font-semibold text-lg">OrderFlow</div>
        <nav className="flex gap-4 items-center text-sm">
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="bg-slate-900 text-white rounded px-3 py-1.5">Start free trial</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <h1 className="text-4xl font-bold">Track Purchase Orders and partial dispatches, live.</h1>
        <p className="text-lg text-slate-600">
          OrderFlow keeps your remaining balances accurate in real time — built for trading
          companies and material dealers who deliver in parts, not all at once.
        </p>
        <Link to="/signup" className="inline-block bg-slate-900 text-white rounded px-6 py-3">
          Start your free trial
        </Link>
      </main>
    </div>
  );
}
