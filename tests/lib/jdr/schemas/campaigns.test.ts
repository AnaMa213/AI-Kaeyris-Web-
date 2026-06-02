import { describe, expect, test } from "vitest";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
} from "@/lib/jdr/schemas/campaigns";

describe("campaignCreateSchema", () => {
  test("accepts a name without a description", () => {
    const result = campaignCreateSchema.safeParse({ name: "Les Royaumes Brisés" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Les Royaumes Brisés");
      expect(result.data.description).toBeUndefined();
    }
  });

  test("accepts a name with a description", () => {
    const result = campaignCreateSchema.safeParse({
      name: "Les Royaumes Brisés",
      description: "Un royaume autrefois uni se déchire.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Un royaume autrefois uni se déchire.");
    }
  });

  test("rejects an empty name", () => {
    const result = campaignCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/requis/i);
    }
  });

  test("rejects whitespace-only name after trim", () => {
    const result = campaignCreateSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  test("trims surrounding whitespace from name", () => {
    const result = campaignCreateSchema.safeParse({ name: "  Royaumes  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Royaumes");
  });

  test("rejects a name longer than 200 characters", () => {
    const result = campaignCreateSchema.safeParse({ name: "x".repeat(201) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop long/i);
    }
  });

  test("rejects a description longer than 4000 characters", () => {
    const result = campaignCreateSchema.safeParse({
      name: "Royaumes",
      description: "x".repeat(4001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop longue/i);
    }
  });

  test("accepts an empty-string description (treated as empty by the query layer)", () => {
    const result = campaignCreateSchema.safeParse({
      name: "Royaumes",
      description: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("");
  });

  test("trims a whitespace-only description down to empty string", () => {
    const result = campaignCreateSchema.safeParse({
      name: "Royaumes",
      description: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("");
  });

  test("rejects missing name field", () => {
    const result = campaignCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("campaignUpdateSchema", () => {
  test("accepts a valid name with no description", () => {
    const result = campaignUpdateSchema.safeParse({ name: "Royaumes Brisés" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Royaumes Brisés");
      expect(result.data.description).toBeUndefined();
    }
  });

  test("accepts a valid name + description", () => {
    const result = campaignUpdateSchema.safeParse({
      name: "Royaumes",
      description: "Pitch ajusté pour la saison 2.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Pitch ajusté pour la saison 2.");
    }
  });

  test("trims a whitespace-only description down to empty string", () => {
    const result = campaignUpdateSchema.safeParse({
      name: "Royaumes",
      description: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("");
  });

  test("rejects an empty name", () => {
    const result = campaignUpdateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/requis/i);
    }
  });

  test("rejects a name longer than 200 chars", () => {
    const result = campaignUpdateSchema.safeParse({ name: "x".repeat(201) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop long/i);
    }
  });

  test("rejects a description longer than 4000 chars", () => {
    const result = campaignUpdateSchema.safeParse({
      name: "Royaumes",
      description: "x".repeat(4001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop longue/i);
    }
  });
});
