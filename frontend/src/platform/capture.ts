/**
 * Gets one delivery-note photo from the camera or the photo library
 * (spec 008 R8). Web: a file input, which iOS Safari and Android Chrome open
 * as "take photo or choose". App: @capacitor/camera with the native prompt.
 * Resolves null when the user cancels.
 */
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

import { isNative } from ".";

export class CameraDeniedError extends Error {}

function pickWithInput(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // Fired by browsers that support it when the picker closes empty.
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export async function capturePhoto(): Promise<Blob | null> {
  if (!isNative()) return pickWithInput();
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.DataUrl,
      quality: 85,
      promptLabelHeader: "Delivery note",
      promptLabelPhoto: "Choose from photos",
      promptLabelPicture: "Take photo",
    });
    if (!photo.dataUrl) return null;
    return await (await fetch(photo.dataUrl)).blob();
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("cancel")) return null;
    if (message.includes("denied") || message.includes("permission")) throw new CameraDeniedError(message);
    throw err;
  }
}
