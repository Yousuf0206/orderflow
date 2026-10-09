/**
 * Refuses to run the e2e suite against anything but a local database.
 *
 * The suite signs up through the real API, so every run creates an
 * organization, a user, parties, purchase orders and dispatches in whatever
 * database the backend is pointed at. Pointed at the hosted database, that is
 * fabricated data sitting alongside real customers' records -- which is how
 * this project's production database came to hold several hundred
 * machine-generated organizations.
 *
 * backend/src/scripts/seed_landing_demo.py already refuses a remote host for
 * the same reason. This is the same guard for the suite that writes far more.
 *
 * Set ORDERFLOW_E2E_ALLOW_REMOTE_DB=1 to override. It has to be typed out, and
 * it should be typed out roughly never.
 */

// This file runs under Node, but the project has no @types/node and does not
// need it for anything else. A two-line shim beats a dependency added for one
// environment variable.
declare const process: { env: Record<string, string | undefined> };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db", "postgres"]);

const API_BASE = process.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default async function globalSetup(): Promise<void> {
  if (process.env.ORDERFLOW_E2E_ALLOW_REMOTE_DB === "1") {
    console.warn(
      "[e2e] ORDERFLOW_E2E_ALLOW_REMOTE_DB=1 — database host check skipped. " +
        "This run may write test data to a remote database.",
    );
    return;
  }

  let payload: { database_host?: string | null } | null = null;
  try {
    const resp = await fetch(`${API_BASE}/health`);
    if (resp.ok) payload = await resp.json();
  } catch {
    // The backend may not be up yet; the webServer config starts the frontend,
    // not the API. A suite that cannot reach the backend will fail on its own
    // terms with a clearer message than anything invented here.
    return;
  }

  const host = payload?.database_host;
  if (!host) {
    // An older backend that does not report its host. Refusing would block
    // every run against it; saying nothing would defeat the guard.
    console.warn(
      "[e2e] The backend did not report its database host, so it could not be " +
        "checked. Confirm it is not pointed at production before trusting this run.",
    );
    return;
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the e2e suite: the backend's database host is "${host}", which is not local.\n` +
        `This suite signs up through the API and writes organizations, purchase orders and dispatches.\n` +
        `Point backend/.env at a local Postgres, or set ORDERFLOW_E2E_ALLOW_REMOTE_DB=1 if you truly mean it.`,
    );
  }
}
