import { describe, expect, test } from "vitest";
import { loginSchema, setupSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  test("accepts a valid GM login payload", () => {
    const result = loginSchema.safeParse({
      username: "alice",
      profile: "gm",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a payload missing username with the French error", () => {
    const result = loginSchema.safeParse({
      profile: "gm",
      password: "hunter2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.username).toEqual(["Nom d'utilisateur requis."]);
    }
  });

  test("rejects an uppercase profile (case-sensitive literal)", () => {
    const result = loginSchema.safeParse({
      username: "alice",
      profile: "GM",
      password: "hunter2",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a user profile value (V1 login is GM-only)", () => {
    const result = loginSchema.safeParse({
      username: "alice",
      profile: "user",
      password: "hunter2",
    });
    expect(result.success).toBe(false);
  });
});

describe("setupSchema", () => {
  test("accepts a valid first-run setup payload", () => {
    const result = setupSchema.safeParse({
      username: "admin",
      password: "secret",
    });
    expect(result.success).toBe(true);
  });

  test("does not require a profile field (setup implicitly creates GM)", () => {
    const result = setupSchema.safeParse({
      username: "admin",
      password: "secret",
      profile: "gm",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an empty username", () => {
    const result = setupSchema.safeParse({
      username: "",
      password: "secret",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.username).toEqual(["Nom d'utilisateur requis."]);
    }
  });
});
