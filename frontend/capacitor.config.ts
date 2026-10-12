import type { CapacitorConfig } from "@capacitor/cli";

import { withDevServer } from "./capacitor.config.dev";

/**
 * Release config. Bundles the production Vite build (research R1) and has no
 * `server.url`, so a release build never loads a remote page. The API base is
 * baked in at build time by `npm run build:app` (contracts/app-shell.md).
 */
const release: CapacitorConfig = {
  appId: "app.orderflow.mobile",
  appName: "OrderFlow",
  webDir: "dist",
  android: {
    // Release builds must not be inspectable from a desktop browser (R11).
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      // Hidden by the app once the first route renders (src/platform/shell.ts).
      launchAutoHide: false,
      backgroundColor: "#4f46e5",
    },
  },
};

export default process.env.ORDERFLOW_CAP_DEV === "1" ? withDevServer(release) : release;
