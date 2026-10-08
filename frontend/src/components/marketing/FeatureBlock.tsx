import { Check } from "lucide-react";

import type { FeatureBlockContent } from "../../content/landingTypes";
import ScreenshotFrame from "./ScreenshotFrame";

/**
 * One claim, one crop of the screen that delivers it.
 *
 * Below the desktop breakpoint the order is always copy-then-image regardless
 * of `imageSide`: alternating sides is a desktop rhythm, and honouring it on a
 * phone would put a screenshot before the sentence explaining it.
 */
export default function FeatureBlock({ content }: { content: FeatureBlockContent }) {
  const imageFirst = content.imageSide === "left";

  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div className={imageFirst ? "lg:order-2" : undefined}>
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{content.title}</h3>
        <p className="mt-3 text-base text-slate-600">{content.copy}</p>
        {content.bullet && (
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
            <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
            {content.bullet}
          </p>
        )}
      </div>
      <ScreenshotFrame image={content.image} className={imageFirst ? "lg:order-1" : undefined} />
    </div>
  );
}
