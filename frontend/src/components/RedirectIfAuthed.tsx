import { Navigate, useSearchParams } from "react-router-dom";

import { isAuthenticated } from "../services/auth";
import { getSafeNextPath } from "../utils/safeNext";

export default function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  if (isAuthenticated()) {
    return <Navigate to={getSafeNextPath(searchParams.get("next"), "/dashboard")} replace />;
  }
  return <>{children}</>;
}
