import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Dev-only live reload (research R10), merged in by capacitor.config.ts only
 * when `npm run cap:dev` sets ORDERFLOW_CAP_DEV=1. Points the WebView at the
 * local Vite server, which talks to a local or staging API -- never production
 * (constitution XXVII). Set CAP_DEV_HOST to this machine's LAN IP for a
 * physical phone; the default reaches the host from the Android emulator.
 */
export function withDevServer(release: CapacitorConfig): CapacitorConfig {
  const host = process.env.CAP_DEV_HOST ?? "10.0.2.2";
  return {
    ...release,
    android: { ...release.android, webContentsDebuggingEnabled: true },
    server: { ...release.server, url: `http://${host}:5173`, cleartext: true },
  };
}
