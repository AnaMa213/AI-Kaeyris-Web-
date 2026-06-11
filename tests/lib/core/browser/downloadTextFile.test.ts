// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { downloadTextFile } from "@/lib/core/browser/downloadTextFile";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadTextFile", () => {
  test("creates an object URL, clicks an anchor with the filename, then revokes it", () => {
    let capturedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:fake-url";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      rel: "",
      click,
    } as unknown as HTMLAnchorElement;
    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    downloadTextFile("transcription-ma-seance.md", "# Titre\n\nCorps");

    expect(createElement).toHaveBeenCalledWith("a");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeInstanceOf(Blob);
    expect(capturedBlob?.type).toBe("text/markdown");
    expect(anchor.download).toBe("transcription-ma-seance.md");
    expect(anchor.href).toBe("blob:fake-url");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  test("revokes the object URL even if the click throws", () => {
    const createObjectURL = vi.fn(() => "blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const anchor = {
      href: "",
      download: "",
      rel: "",
      click: vi.fn(() => {
        throw new Error("boom");
      }),
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    expect(() => downloadTextFile("x.md", "content")).toThrow("boom");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  test("honours a custom mime type", () => {
    let capturedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:fake-url";
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      rel: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);

    downloadTextFile("data.txt", "plain", "text/plain");
    expect(capturedBlob?.type).toBe("text/plain");
  });
});
