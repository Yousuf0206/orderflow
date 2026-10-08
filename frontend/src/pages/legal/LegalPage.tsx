import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { usePageMeta } from "../../hooks/usePageMeta";

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  // Both legal pages are public and were the only ones without a distinct
  // title. Done here rather than in each page, since there is one wrapper.
  usePageMeta(title, `${title} for OrderFlow — purchase order and dispatch tracking.`);

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            O
          </div>
          <span className="font-semibold tracking-tight text-slate-900">OrderFlow</span>
        </Link>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
          Back to home
        </Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">Last updated: {updated}</p>
        </div>
        <div className="space-y-5 text-sm leading-6 text-slate-600 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}
