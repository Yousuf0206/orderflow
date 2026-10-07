/**
 * Validates a `next` redirect target so Login (and RedirectIfAuthed) never
 * send the browser off-origin. Only a same-origin, single-leading-slash
 * path is honored; anything else falls back to `fallback`.
 */
export function getSafeNextPath(rawNext: string | null, fallback: string): string {
  if (!rawNext) return fallback;
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return fallback;
  if (rawNext === "/login" || rawNext.startsWith("/login?") || rawNext === "/signup") return fallback;
  return rawNext;
}
