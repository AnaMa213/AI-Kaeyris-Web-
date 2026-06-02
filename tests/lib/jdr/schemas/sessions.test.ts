import { describe, expect, test } from "vitest";
import {
  sessionCreateSchema,
  sessionUpdateSchema,
  toIsoUtc,
} from "@/lib/jdr/schemas/sessions";

describe("sessionCreateSchema", () => {
  test("accepts a valid title + recorded_at", () => {
    const result = sessionCreateSchema.safeParse({
      title: "Session 7 — La crypte oubliée",
      recorded_at: "2026-05-31T20:00",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an empty title", () => {
    const result = sessionCreateSchema.safeParse({
      title: "",
      recorded_at: "2026-05-31T20:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/requis/i);
    }
  });

  test("rejects a whitespace-only title", () => {
    const result = sessionCreateSchema.safeParse({
      title: "   ",
      recorded_at: "2026-05-31T20:00",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a title longer than 500 characters", () => {
    const result = sessionCreateSchema.safeParse({
      title: "x".repeat(501),
      recorded_at: "2026-05-31T20:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop long/i);
    }
  });

  test("rejects a missing recorded_at", () => {
    const result = sessionCreateSchema.safeParse({ title: "OK" });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid recorded_at string", () => {
    const result = sessionCreateSchema.safeParse({
      title: "OK",
      recorded_at: "not-a-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toMatch(/invalide/i);
    }
  });
});

describe("sessionUpdateSchema", () => {
  test("accepts a valid title with no campaign_context", () => {
    const result = sessionUpdateSchema.safeParse({
      title: "Session 12 — La cité engloutie (corrigée)",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe(
        "Session 12 — La cité engloutie (corrigée)",
      );
      expect(result.data.campaign_context).toBeUndefined();
    }
  });

  test("accepts a valid title + non-empty campaign_context", () => {
    const result = sessionUpdateSchema.safeParse({
      title: "Session 13",
      campaign_context: "Les ombres se rassemblent à la frontière nord.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaign_context).toBe(
        "Les ombres se rassemblent à la frontière nord.",
      );
    }
  });

  test("accepts a whitespace-only campaign_context (trimmed to empty string)", () => {
    const result = sessionUpdateSchema.safeParse({
      title: "Session 13",
      campaign_context: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.campaign_context).toBe("");
  });

  test("rejects a campaign_context longer than 8000 chars", () => {
    const result = sessionUpdateSchema.safeParse({
      title: "OK",
      campaign_context: "x".repeat(8001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toMatch(/trop long/i);
    }
  });

  test("rejects an empty title", () => {
    const result = sessionUpdateSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});

describe("toIsoUtc()", () => {
  test("converts a local datetime to ISO-8601 UTC", () => {
    // Round-trip: anything parseable goes through Date.toISOString()
    const isoFromLocal = toIsoUtc("2026-05-31T20:00");
    expect(isoFromLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    // Sanity: parsing the ISO back gives the same instant.
    expect(new Date(isoFromLocal).toISOString()).toBe(isoFromLocal);
  });

  test("accepts an already-ISO datetime untouched (idempotent)", () => {
    const iso = "2026-05-31T18:00:00.000Z";
    expect(toIsoUtc(iso)).toBe(iso);
  });

  test("throws RangeError on an invalid input", () => {
    expect(() => toIsoUtc("not-a-date")).toThrow(RangeError);
  });
});
