import { describe, expect, test } from "vitest";
import { pjCreateSchema, pjUpdateSchema } from "@/lib/jdr/schemas/pjs";

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

describe("pjUpdateSchema", () => {
  test("accepts a name with a linked userId", () => {
    const result = pjUpdateSchema.safeParse({
      name: "Aragorn",
      userId: "1f2e3d4c-0000-0000-0000-000000000000",
    });
    expect(result.success).toBe(true);
  });

  test("accepts an empty userId (unlinked sentinel)", () => {
    const result = pjUpdateSchema.safeParse({ name: "Aragorn", userId: "" });
    expect(result.success).toBe(true);
  });

  test("trims the name and rejects empty/whitespace", () => {
    expect(pjUpdateSchema.safeParse({ name: "  Aragorn  ", userId: "" }).data)
      .toMatchObject({ name: "Aragorn" });
    expect(pjUpdateSchema.safeParse({ name: "   ", userId: "" }).success).toBe(
      false,
    );
  });

  test("rejects a name longer than 80 characters", () => {
    const result = pjUpdateSchema.safeParse({
      name: "x".repeat(81),
      userId: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop long/i);
    }
  });
});
