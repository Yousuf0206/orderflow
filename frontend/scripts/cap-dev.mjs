// `npm run cap:dev [android|ios]` -- syncs the native project with the dev-only
// live-reload config (capacitor.config.dev.ts) and opens it. Refuses to run
// against the production API (constitution XXVII, research R10).
import { spawnSync } from "node:child_process";

const api = process.env.VITE_API_BASE_URL ?? "";
if (api.includes("purchaseorderflow.vercel.app")) {
  console.error("cap:dev must not point at the production API. Unset VITE_API_BASE_URL or use staging.");
  process.exit(1);
}

const platform = process.argv[2] ?? "android";
const env = { ...process.env, ORDERFLOW_CAP_DEV: "1" };
for (const args of [["cap", "sync", platform], ["cap", "open", platform]]) {
  const r = spawnSync("npx", args, { stdio: "inherit", env, shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("Now run `npm run dev -- --host` so the device can reach Vite.");
