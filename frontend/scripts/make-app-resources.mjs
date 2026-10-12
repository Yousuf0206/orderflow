// Renders the app icon and splash sources in frontend/resources/ from the same
// mark as public/favicon.svg, for `npm run cap:assets` (@capacitor/assets).
// Re-run only when the brand mark changes.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const BRAND = "#4f46e5";
const out = new URL("../resources/", import.meta.url);
mkdirSync(out, { recursive: true });

const letter = (size, scale) =>
  `<text x="${size / 2}" y="${size / 2}" dy="0.35em" font-family="Arial, sans-serif" font-weight="700"
    font-size="${size * scale}" fill="white" text-anchor="middle">O</text>`;

const svg = (size, body, bg = BRAND) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}${body}</svg>`,
  );

const files = {
  // Square, opaque, no rounded corners: the stores apply their own mask.
  "icon-only.png": svg(1024, letter(1024, 0.56)),
  // Android adaptive icon: glyph kept inside the central 66% safe zone.
  "icon-foreground.png": svg(1024, letter(1024, 0.38), null),
  "icon-background.png": svg(1024, ""),
  "splash.png": svg(2732, letter(2732, 0.16)),
  "splash-dark.png": svg(2732, letter(2732, 0.16), "#020617"),
};

for (const [name, data] of Object.entries(files)) {
  await sharp(data).png().toFile(fileURLToPath(new URL(name, out)));
  console.log("wrote resources/" + name);
}
