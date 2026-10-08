const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "orderflow_tokens";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export function getTokens(): TokenPair | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as TokenPair) : null;
}

export function setTokens(tokens: TokenPair | null): void {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * A request that never reached a response: a stalled connection we aborted, or
 * an outright network failure. Distinct from `ApiError`, which means the server
 * answered and we didn't like the answer.
 */
export class NetworkError extends Error {
  timedOut: boolean;
  constructor(timedOut: boolean) {
    super(timedOut ? "Request timed out" : "Network request failed");
    this.timedOut = timedOut;
  }
}

/**
 * Per-request budget. A screen must resolve to data, empty, or an error -- never
 * sit on a loading message -- so a request that neither resolves nor rejects has
 * to be cut off rather than waited on.
 *
 * 12s, under the 15s a screen is allowed to take, and paired with no automatic
 * retry (see main.tsx) so the worst case stays one attempt.
 */
export const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Turns a thrown error into a user-facing message that reflects the real
 * cause, falling back to `fallback` only for errors this function can't
 * interpret (network failures, unexpected 500s, etc).
 */
export function describeApiError(err: unknown, fallback: string): string {
  // Checked before the ApiError guard below: a stalled or failed connection is
  // the one case where the raw error text ("AbortError") is actively misleading
  // to a non-technical reader, so it never reaches the fallback.
  if (err instanceof NetworkError) {
    return err.timedOut
      ? "This is taking longer than expected. Check your connection and try again."
      : "Couldn't reach the server. Check your connection and try again.";
  }

  if (!(err instanceof ApiError)) return fallback;

  const detail = (err.body as { detail?: unknown } | null)?.detail;

  if (err.status === 422 && Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
    return field ? `${field}: ${first.msg ?? "Invalid value"}` : (first.msg ?? fallback);
  }

  if (typeof detail === "string") return detail;

  if (err.status >= 500) return "Something went wrong on our end. Please try again in a moment.";

  return fallback;
}

/**
 * Extracts per-field validation messages from a 422 response, keyed by the
 * last segment of each error's `loc` (e.g. ["body", "password"] -> "password").
 * Returns {} for anything that isn't a 422 pydantic validation error.
 */
export function getValidationErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 422) return {};
  const detail = (err.body as { detail?: unknown } | null)?.detail;
  if (!Array.isArray(detail)) return {};

  const out: Record<string, string> = {};
  for (const item of detail as { msg?: string; loc?: unknown[] }[]) {
    const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : undefined;
    if (typeof field === "string" && item.msg) out[field] = item.msg;
  }
  return out;
}

/**
 * Runs `fetch` under a deadline. On expiry the underlying request is actually
 * aborted rather than merely ignored, so a stalled connection is released
 * instead of being left open behind a screen that has already given up.
 */
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    // `abort()` and a dropped connection both surface here; only the former
    // means we hit the deadline.
    throw new NetworkError(controller.signal.aborted);
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (tokens) headers.set("Authorization", `Bearer ${tokens.access_token}`);

  const response = await fetchWithTimeout(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && tokens && retry) {
    const refreshed = await tryRefresh(tokens.refresh_token);
    if (refreshed) {
      return request<T>(path, options, false);
    }
    setTokens(null);
    window.location.assign("/login");
    throw new ApiError(401, null);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv") || contentType.includes("spreadsheetml")) {
    return response.blob() as unknown as T;
  }
  return response.json() as Promise<T>;
}

async function tryRefresh(refreshToken: string): Promise<boolean> {
  try {
    // Also deadline-bound: a stalled refresh would otherwise hang the original
    // request that is waiting on it, reintroducing the stuck-screen case.
    const resp = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) return false;
    const tokens = (await resp.json()) as TokenPair;
    setTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
