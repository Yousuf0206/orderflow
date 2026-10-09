import { ApiError, getTokens } from "./apiClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/**
 * Fetch an authenticated file and hand it to the browser as a download.
 *
 * Extracted from the Reports screen so the party-level export uses the same
 * path rather than its own copy. The `resp.ok` check below is the reason it is
 * shared: without it, a 403 or 500 response body went straight into
 * createObjectURL and landed in the user's downloads as a file named
 * report.csv containing a JSON error. Reimplementing this per screen would
 * reintroduce that bug one screen at a time.
 *
 * Throws on failure, so the caller can say the export did not download. It
 * never saves a file it could not verify.
 */
export async function downloadExport(path: string, fallbackFilename: string): Promise<void> {
  const tokens = getTokens();
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: tokens ? { Authorization: `Bearer ${tokens.access_token}` } : {},
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new ApiError(resp.status, body);
  }

  const disposition = resp.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename="?([^"]+)"?/.exec(disposition);
  const blob = await resp.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filenameMatch?.[1] ?? fallbackFilename;
  link.click();
  URL.revokeObjectURL(link.href);
}
