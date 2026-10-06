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

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (tokens) headers.set("Authorization", `Bearer ${tokens.access_token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

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
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
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
