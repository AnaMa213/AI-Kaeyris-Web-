import { describe, expect, test } from "vitest";
import { pjCreateSchema } from "@/lib/jdr/schemas/pjs";

describe("pjCreateSchema", () => {
  test("accepts a valid name", () => {
    const result = pjCreateSchema.safeParse({ name: "Eldrin le Sage" });
    expect(result.success).toBe(true);
  });

  test("rejects empty string", () => {
    const result = pjCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/requis/i);
    }
  });

  test("rejects whitespace-only after trim", () => {
    const result = pjCreateSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  test("trims surrounding whitespace", () => {
    const result = pjCreateSchema.safeParse({ name: "  Eldrin  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Eldrin");
  });

  test("rejects a name longer than 80 characters", () => {
    const result = pjCreateSchema.safeParse({ name: "x".repeat(81) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop long/i);
    }
  });

  test("rejects missing name field", () => {
    const result = pjCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
