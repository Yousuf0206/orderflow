/**
 * Shrinks a phone photo before upload (spec 008 R5): long edge at most 2000 px,
 * JPEG quality 0.8 -- typically 300-700 KB, well under the 4 MB server limit
 * and quicker on a weak connection. HEIC and other formats the browser can
 * decode come out as JPEG; one it cannot decode is sent as-is only if it is
 * already JPEG or PNG.
 */
export const MAX_EDGE = 2000;
export const QUALITY = 0.8;

export async function compressImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.type === "image/jpeg" || file.type === "image/png") return file;
    throw new Error("unsupported_image");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  return blob ?? file;
}
