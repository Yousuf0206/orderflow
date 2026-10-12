/**
 * Session tokens. On the web they stay in localStorage, exactly as before; in
 * the native app they live in the Keychain (iOS) / Keystore (Android) via
 * @aparajita/capacitor-secure-storage (constitution XXXVI, research R4).
 *
 * Secure storage is asynchronous but the API client reads tokens synchronously,
 * so the app hydrates them into memory once before the first render; writes go
 * to memory immediately and to storage in the background. Callers that are
 * about to leave the page (sign-out) must await `set` so the delete lands first.
 */
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Capacitor } from "@capacitor/core";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

const TOKEN_KEY = "orderflow_tokens";

let memory: TokenPair | null = null;

function parse(raw: unknown): TokenPair | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as TokenPair;
  } catch {
    return null;
  }
}

export const tokenStore = {
  async hydrate(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      memory = parse(await SecureStorage.get(TOKEN_KEY));
    } catch {
      // Unreadable keychain entry: treat as signed out rather than blocking start.
      memory = null;
    }
  },

  get(): TokenPair | null {
    if (!Capacitor.isNativePlatform()) return parse(localStorage.getItem(TOKEN_KEY));
    return memory;
  },

  async set(tokens: TokenPair | null): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
      else localStorage.removeItem(TOKEN_KEY);
      return;
    }
    memory = tokens;
    if (tokens) await SecureStorage.set(TOKEN_KEY, JSON.stringify(tokens));
    else await SecureStorage.remove(TOKEN_KEY);
  },
};
