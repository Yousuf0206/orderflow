/**
 * The only place the web app knows it might be running inside the native shell
 * (specs/007-native-mobile-apps/contracts/app-shell.md). Nothing here computes
 * or validates a business figure (constitution XXXIII).
 */
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export { tokenStore } from "./tokenStore";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Where `/` lands in the app: there is no landing page to show (R5). */
export function startRoute(signedIn: boolean): string {
  return signedIn ? "/dashboard" : "/login";
}

/**
 * Opens a page of the public website. In the app that is an in-app browser
 * sheet the user can close to return (R6); on the web it is a new tab.
 */
export async function openExternal(url: string): Promise<void> {
  if (isNative()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}

/** Absolute URL of a public website page, for opening outside the app bundle. */
export const WEBSITE_ORIGIN = "https://purchaseorderflow.vercel.app";
