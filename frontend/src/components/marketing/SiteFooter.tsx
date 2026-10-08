import { Link } from "react-router-dom";

import type { FooterContent } from "../../content/landingTypes";

/**
 * Shared by the landing page and pricing, so Privacy and Terms cannot go
 * missing from one of them (FR-011, Principle XI).
 */
export default function SiteFooter({ content }: { content: FooterContent }) {
  return (
    <footer className="border-t border-slate-100 bg-white py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} OrderFlow</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          {content.links.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
