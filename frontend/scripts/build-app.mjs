// `npm run build:app` -- the only way release app bundles are produced. Bakes
// the production API base into the Vite build (contracts/app-shell.md) and
// copies it into both native projects with the release Capacitor config.
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  VITE_API_BASE_URL: "https://purchaseorderflow.vercel.app/api",
  ORDERFLOW_CAP_DEV: "",
};
for (const cmd of ["npx tsc -b", "npx vite build", "npx cap sync"]) {
  const r = spawnSync(cmd, { stdio: "inherit", env, shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
