import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { usePermissions, type PermissionsState } from "../hooks/usePermissions";
import { describeApiError } from "../services/apiClient";
import { getMe, logout } from "../services/auth";
import Notifications from "./Notifications";
import ThemeToggle from "./ui/ThemeToggle";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/parties", label: "Parties", icon: Users },
  { to: "/purchase-orders", label: "Purchase Orders", icon: Package },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText },
];

// Visibility reads the shared capability table rather than comparing role
// strings here. Role literals used to live inline in this file, which is how
// the dispatch screen ended up with no role check at all -- there was no one
// place to look.
const SETTINGS_ITEMS = [
  {
    to: "/settings/team",
    label: "Team",
    icon: Users,
    visible: (caps: PermissionsState) => caps.canManageTeamMembers,
  },
  { to: "/settings/company", label: "Company", icon: Settings, visible: () => true },
  {
    to: "/billing",
    label: "Billing",
    icon: Wallet,
    visible: (caps: PermissionsState) => caps.canManageBilling,
  },
] as const;

function NavItem({ to, label, icon: Icon, onClick }: { to: string; label: string; icon: typeof LayoutDashboard; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`
      }
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

function SidebarContent({
  userEmail,
  role,
  caps,
  isSuperAdmin,
  onNavigate,
}: {
  userEmail?: string;
  role?: string | null;
  caps: PermissionsState;
  isSuperAdmin?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          O
        </div>
        <span className="font-semibold tracking-tight text-slate-900 dark:text-white">OrderFlow</span>
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
        <p className="mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Organization
        </p>
        {SETTINGS_ITEMS.filter((item) => item.visible(caps)).map(({ visible: _visible, ...item }) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
        {isSuperAdmin && <NavItem to="/admin" label="Super Admin" icon={ShieldCheck} onClick={onNavigate} />}
      </nav>
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        {userEmail && (
          <div className="px-3 pb-1">
            <p className="truncate text-xs text-slate-400 dark:text-slate-500" title={userEmail}>
              {userEmail}
            </p>
            {/* Role was only ever used to gate nav items. Showing it means a
                user can tell "I'm a Viewer" from "this is broken" when an
                action isn't available to them. */}
            {role && <p className="text-xs capitalize text-slate-400 dark:text-slate-600">{role}</p>}
          </div>
        )}
        <button
          onClick={logout}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          Log out
        </button>
      </div>
    </>
  );
}

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const caps = usePermissions();
  const {
    data: me,
    isError: meFailed,
    error: meError,
    refetch: refetchMe,
  } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 5 * 60 * 1000 });

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <SidebarContent
          userEmail={me?.user.email}
          role={me?.role}
          caps={caps}
          isSuperAdmin={me?.is_super_admin}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white py-4 dark:bg-slate-900">
            <div className="flex items-center justify-between px-3">
              <span className="font-semibold text-slate-900 dark:text-white">Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent
              userEmail={me?.user.email}
              role={me?.role}
              caps={caps}
              isSuperAdmin={me?.is_super_admin}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:px-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex">
            <Building2 size={16} />
            <span>{me?.organization?.name ?? "Workspace"}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Notifications />
          </div>
        </header>
        {/* Deliberately a banner, not a full-page error: the page below may well
            have loaded fine. But it can't be silent either -- without the role
            from /auth/me, an owner loses Team and Billing from the nav, which
            reads as "my permissions were taken away" rather than "this didn't
            load". */}
        {meFailed && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 md:px-6"
          >
            <span>
              {describeApiError(
                meError,
                "We couldn't load your account details, so some menu items may be missing.",
              )}
            </span>
            <button type="button" onClick={() => refetchMe()} className="font-medium underline">
              Try again
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
