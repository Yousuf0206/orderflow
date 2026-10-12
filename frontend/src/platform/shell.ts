/**
 * Native chrome around the web UI: status bar and splash screen (T016, T017).
 * Every call is a no-op on the web.
 */
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

/** Matches the app header: dark icons on light, light on dark. */
export async function styleStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const dark = document.documentElement.classList.contains("dark");
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (Capacitor.getPlatform() === "android") {
      // Draw under the bar; safe-area insets in index.css keep content clear.
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    // Cosmetic only; never block start-up on it.
  }
}

/** Called once the first route has painted (launchAutoHide is off). */
export function hideSplash(): void {
  if (!Capacitor.isNativePlatform()) return;
  void SplashScreen.hide().catch(() => undefined);
}
