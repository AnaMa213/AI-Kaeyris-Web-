import { describe, expect, test } from "vitest";
import { sessionCreateSchema, toIsoUtc } from "@/lib/jdr/schemas/sessions";

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
