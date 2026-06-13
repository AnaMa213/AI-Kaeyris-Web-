import { describe, expect, test } from "vitest";

import { slugifySessionTitle } from "@/lib/core/strings/slugify";

describe("slugifySessionTitle", () => {
  test("lowercases and strips diacritics", () => {
    expect(slugifySessionTitle("Ma Séance")).toBe("ma-seance");
    expect(slugifySessionTitle("L'Éveil des Anciens")).toBe(
      "l-eveil-des-anciens",
    );
  });

  test("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugifySessionTitle("Donjon   &   Dragons!!!")).toBe(
      "donjon-dragons",
    );
  });

  test("trims leading and trailing dashes", () => {
    expect(slugifySessionTitle("  --Hello-- ")).toBe("hello");
  });

  test("returns an empty string when no usable characters remain", () => {
    expect(slugifySessionTitle("!!!")).toBe("");
    expect(slugifySessionTitle("")).toBe("");
  });
});
