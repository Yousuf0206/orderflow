import type { ImageAssetRef } from "../../content/landingTypes";

/**
 * Renders a captured product screenshot inside optional window chrome.
 *
 * Light-only by design: the landing page presents one treatment, and every
 * asset is captured in the app's light theme
 * (specs/003-landing-page-upgrade/research.md R1). No `dark:` class belongs in
 * this file.
 *
 * The chrome is drawn in CSS rather than baked into the captured pixels, so
 * the frame can change without re-capturing anything.
 */
export default function ScreenshotFrame({
  image,
  mobileImage,
  chrome = "window",
  className = "",
  priority = false,
}: {
  image: ImageAssetRef;
  /** A tighter crop of the same screen, used below the `sm` breakpoint. */
  mobileImage?: ImageAssetRef;
  chrome?: "window" | "none";
  className?: string;
  /** Hero only: hints the browser to fetch this image first. */
  priority?: boolean;
}) {
  const picture = (
    <picture>
      {mobileImage && (
        <source
          media="(max-width: 639px)"
          srcSet={`${mobileImage.src} 1x, ${mobileImage.src2x} 2x`}
          width={mobileImage.width}
          height={mobileImage.height}
        />
      )}
      <img
        src={image.src}
        srcSet={`${image.src} 1x, ${image.src2x} 2x`}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading={image.loading}
        decoding="async"
        // Reserves the right box before the bytes arrive, so nothing shifts
        // as the visitor scrolls (FR-023).
        className="h-auto w-full rounded-lg object-cover object-top"
        // React 18 does not know the camelCase prop, so the attribute is spelled
        // the way the DOM wants it. Dropping it would cost the hero its LCP head
        // start (research R4).
        {...(priority ? { fetchpriority: "high" } : {})}
      />
    </picture>
  );

  if (chrome === "none") {
    return <div className={className}>{picture}</div>;
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 ${className}`}
    >
      {/* Decorative: announcing "three dots" tells a screen-reader user
          nothing about the product. The <img> alt carries the meaning. */}
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
      </div>
      <div className="bg-slate-50 p-2 sm:p-3">{picture}</div>
    </div>
  );
}
