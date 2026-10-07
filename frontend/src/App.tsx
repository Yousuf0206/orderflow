import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequireAuth from "./components/RequireAuth";
import AcceptInvite from "./pages/auth/AcceptInvite";
import Login from "./pages/auth/Login";
import { ForgotPassword, ResetPassword } from "./pages/auth/PasswordReset";
import Signup from "./pages/auth/Signup";
import SuperAdmin from "./pages/admin/SuperAdmin";
import AuditLog from "./pages/audit/AuditLog";
import Billing from "./pages/billing/Billing";
import Dashboard from "./pages/dashboard/Dashboard";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import Landing from "./pages/marketing/Landing";
import Pricing from "./pages/marketing/Pricing";
import Onboarding from "./pages/onboarding/Onboarding";
import PartiesList from "./pages/parties/PartiesList";
import PartyDetail from "./pages/parties/PartyDetail";
import PartyForm from "./pages/parties/PartyForm";
import PurchaseOrderDetail from "./pages/purchase-orders/PurchaseOrderDetail";
import PurchaseOrderForm from "./pages/purchase-orders/PurchaseOrderForm";
import PurchaseOrdersList from "./pages/purchase-orders/PurchaseOrdersList";
import Reports from "./pages/reports/Reports";
import CompanySettings from "./pages/settings/CompanySettings";
import TeamMembers from "./pages/settings/TeamMembers";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RedirectIfAuthed>
            <Landing />
          </RedirectIfAuthed>
        }
      />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <Signup />
          </RedirectIfAuthed>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/parties" element={<PartiesList />} />
        <Route path="/parties/new" element={<PartyForm />} />
        <Route path="/parties/:id" element={<PartyDetail />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersList />} />
        <Route path="/purchase-orders/new" element={<PurchaseOrderForm />} />
        <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/settings/company" element={<CompanySettings />} />
        <Route path="/settings/team" element={<TeamMembers />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/admin" element={<SuperAdmin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
