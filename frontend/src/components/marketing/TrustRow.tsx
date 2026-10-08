import { FileClock, Lock, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { TrustContent } from "../../content/landingTypes";

/**
 * Three things that are true of the shipped application: the role model, the
 * audit trail, and per-organisation data scoping.
 *
 * No certification, compliance standard or encryption claim belongs here. The
 * page may only say what the product does (FR-020), and a security badge is
 * exactly the kind of claim a buyer checks.
 */
const ICONS: LucideIcon[] = [Users, FileClock, Lock];

export default function TrustRow({ content }: { content: TrustContent }) {
  return (
    <section aria-label={content.heading} className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mx-auto mb-10 max-w-2xl text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {content.heading}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {content.statements.map((statement, i) => {
            const Icon = ICONS[i] ?? Lock;
            return (
              <div key={statement.title} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="font-semibold text-slate-900">{statement.title}</h3>
                <p className="text-sm text-slate-500">{statement.text}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Read our{" "}
          {content.legalLinks.map((link, i) => (
            <span key={link.to}>
              {i > 0 && " and "}
              <Link to={link.to} className="font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900">
                {link.label}
              </Link>
            </span>
          ))}
          .
        </p>
      </div>
    </section>
  );
}
