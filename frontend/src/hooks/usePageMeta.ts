import { useEffect } from "react";

const DEFAULT_DESCRIPTION =
  "Track purchase orders and partial dispatches live. OrderFlow keeps remaining balances accurate in real time for trading companies and material dealers.";

/**
 * Sets a unique <title> and meta description per public page. Note: this
 * only helps the browser tab and JS-executing crawlers (Google) -- link
 * unfurlers that don't run JS (Slack, Twitter, etc.) only ever see the
 * static defaults in index.html, since this is a client-rendered SPA with
 * no server-side rendering.
 */
export function usePageMeta(title: string, description: string = DEFAULT_DESCRIPTION) {
  useEffect(() => {
    const fullTitle = `${title} · OrderFlow`;
    const previousTitle = document.title;
    document.title = fullTitle;

    const descriptionTag = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionTag?.getAttribute("content") ?? DEFAULT_DESCRIPTION;
    descriptionTag?.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      descriptionTag?.setAttribute("content", previousDescription);
    };
  }, [title, description]);
}
