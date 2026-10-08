import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { Action, NavContent } from "../../content/landingTypes";
import Button from "../ui/Button";

/**
 * The public site header, shared by the landing page and pricing so the two
 * cannot drift (FR-012).
 *
 * Light-only: `Button`'s primary variant carries no dark classes, which is why
 * it is reused here while `secondary` and `ghost` are not (research R1).
 */
export default function SiteHeader({
  content,
  primaryAction,
}: {
  content: NavContent;
  /**
   * Replaces the trial button for a visitor it would be wrong for -- pricing
   * shows "Go to billing" to someone already signed in. The structure stays
   * identical either way, which is what FR-012 asks for.
   */
  primaryAction?: Action;
}) {
  const action = primaryAction ?? content.primaryAction;
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex items-center gap-2" aria-label={`${content.logoLabel} home`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            O
          </span>
          <span className="text-lg font-semibold text-slate-900">{content.logoLabel}</span>
        </Link>

        {/* Desktop: links inline. The trial button is never inside the
            disclosure, so it stays one tap away at every width (FR-002). */}
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Main">
          <div className="hidden items-center gap-4 text-sm sm:flex">
            {content.links.map((link) => (
              <Link key={link.to} to={link.to} className="text-slate-600 hover:text-slate-900">
                {link.label}
              </Link>
            ))}
          </div>

          <Link to={action.to}>
            <Button className="whitespace-nowrap">{action.label}</Button>
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-nav-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:hidden"
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </nav>
      </div>

      {open && (
        <div id="site-nav-menu" className="border-t border-slate-100 bg-white px-4 py-3 sm:hidden">
          <ul className="flex flex-col gap-3 text-sm">
            {content.links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-slate-600 hover:text-slate-900" onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
