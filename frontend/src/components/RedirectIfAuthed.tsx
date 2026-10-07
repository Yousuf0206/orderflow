import { Navigate } from "react-router-dom";

import { isAuthenticated } from "../services/auth";

export default function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
