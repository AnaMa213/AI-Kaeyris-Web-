import { describe, expect, test } from "vitest";
import { normalizeForSearch } from "@/lib/core/strings/normalizeForSearch";

describe("normalizeForSearch", () => {
  test("lowercases", () => {
    expect(normalizeForSearch("La CITÉ")).toBe("la cite");
  });

  test("strips diacritics but keeps spaces", () => {
    expect(normalizeForSearch("Là où coulent les rivières")).toBe(
      "la ou coulent les rivieres",
    );
  });

  test("trims leading/trailing whitespace, preserves inner spaces", () => {
    expect(normalizeForSearch("  Le  pacte  ")).toBe("le  pacte");
  });

  test("is idempotent on already-normalised input", () => {
    expect(normalizeForSearch("session 12")).toBe("session 12");
  });

  test("returns empty string for whitespace-only input", () => {
    expect(normalizeForSearch("   ")).toBe("");
  });
});
