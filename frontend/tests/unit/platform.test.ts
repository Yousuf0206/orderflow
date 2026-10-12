import { beforeEach, describe, expect, it, vi } from "vitest";

/** Platform module (spec 007 contracts/app-shell.md): secure tokens in the app, web unchanged. */

const native = vi.hoisted(() => ({ value: false }));
const secure = vi.hoisted(() => new Map<string, string>());
const browserOpen = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.value, getPlatform: () => "android" },
}));
vi.mock("@aparajita/capacitor-secure-storage", () => ({
  SecureStorage: {
    get: vi.fn(async (k: string) => secure.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => void secure.set(k, v)),
    remove: vi.fn(async (k: string) => secure.delete(k)),
  },
}));
vi.mock("@capacitor/browser", () => ({ Browser: { open: browserOpen } }));

const pair = { access_token: "a", refresh_token: "r" };

async function load() {
  vi.resetModules();
  return import("../../src/platform");
}

beforeEach(() => {
  localStorage.clear();
  secure.clear();
  browserOpen.mockClear();
});

describe("tokenStore on the web", () => {
  beforeEach(() => {
    native.value = false;
  });

  it("keeps using localStorage", async () => {
    const { tokenStore } = await load();
    await tokenStore.set(pair);
    expect(JSON.parse(localStorage.getItem("orderflow_tokens")!)).toEqual(pair);
    expect(tokenStore.get()).toEqual(pair);
    expect(secure.size).toBe(0);
    await tokenStore.set(null);
    expect(localStorage.getItem("orderflow_tokens")).toBeNull();
  });
});

describe("tokenStore in the app", () => {
  beforeEach(() => {
    native.value = true;
  });

  it("writes to secure storage, never localStorage", async () => {
    const { tokenStore } = await load();
    await tokenStore.set(pair);
    expect(tokenStore.get()).toEqual(pair);
    expect(JSON.parse(secure.get("orderflow_tokens")!)).toEqual(pair);
    expect(localStorage.length).toBe(0);
  });

  it("survives a restart via hydrate", async () => {
    secure.set("orderflow_tokens", JSON.stringify(pair));
    const { tokenStore } = await load();
    expect(tokenStore.get()).toBeNull();
    await tokenStore.hydrate();
    expect(tokenStore.get()).toEqual(pair);
  });

  it("sign-out clears memory and secure storage", async () => {
    const { tokenStore } = await load();
    await tokenStore.set(pair);
    await tokenStore.set(null);
    expect(tokenStore.get()).toBeNull();
    expect(secure.has("orderflow_tokens")).toBe(false);
  });

  it("treats an unreadable entry as signed out", async () => {
    secure.set("orderflow_tokens", "{not json");
    const { tokenStore } = await load();
    await tokenStore.hydrate();
    expect(tokenStore.get()).toBeNull();
  });

  it("opens legal pages in the in-app browser", async () => {
    const { openExternal } = await load();
    await openExternal("https://purchaseorderflow.vercel.app/privacy");
    expect(browserOpen).toHaveBeenCalledWith({ url: "https://purchaseorderflow.vercel.app/privacy" });
  });
});

describe("startRoute", () => {
  it("is the dashboard when signed in, sign-in otherwise", async () => {
    const { startRoute } = await load();
    expect(startRoute(true)).toBe("/dashboard");
    expect(startRoute(false)).toBe("/login");
  });
});
