import { afterEach, describe, expect, it, vi } from "vitest";

import { compressImage, MAX_EDGE } from "../../src/utils/compressImage";

/** Phone photos are shrunk before upload (spec 008 R5). Canvas is mocked: jsdom has none. */

function mockCanvas() {
  const drawn: number[][] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: (_b: unknown, ...args: number[]) => drawn.push(args) }),
    toBlob: (cb: (b: Blob) => void, type: string) => cb(new Blob(["small"], { type })),
  };
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
    tag === "canvas" ? canvas : create(tag)) as typeof document.createElement);
  return { canvas, drawn };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("compressImage", () => {
  it("scales the long edge down to the limit and outputs JPEG", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close() {} }));
    const { canvas } = mockCanvas();
    const out = await compressImage(new Blob(["big"], { type: "image/heic" }));
    expect(canvas.width).toBe(MAX_EDGE);
    expect(canvas.height).toBe(1500);
    expect(out.type).toBe("image/jpeg");
  });

  it("never enlarges a small photo", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 800, height: 600, close() {} }));
    const { canvas } = mockCanvas();
    await compressImage(new Blob(["x"], { type: "image/png" }));
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
  });

  it("sends an undecodable JPEG as-is, refuses other undecodable files", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("decode");
    });
    const jpeg = new Blob(["x"], { type: "image/jpeg" });
    expect(await compressImage(jpeg)).toBe(jpeg);
    await expect(compressImage(new Blob(["x"], { type: "image/heic" }))).rejects.toThrow("unsupported_image");
  });
});
