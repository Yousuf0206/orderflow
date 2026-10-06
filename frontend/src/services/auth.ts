import { api, getTokens, setTokens, type TokenPair } from "./apiClient";

export function isAuthenticated(): boolean {
  return getTokens() !== null;
}

export async function login(email: string, password: string): Promise<void> {
  const tokens = await api.post<TokenPair>("/auth/login", { email, password });
  setTokens(tokens);
}

export async function signup(email: string, password: string, organizationName: string): Promise<void> {
  const tokens = await api.post<TokenPair>("/auth/signup", {
    email,
    password,
    organization_name: organizationName,
  });
  setTokens(tokens);
}

export function logout(): void {
  setTokens(null);
  window.location.assign("/login");
}
