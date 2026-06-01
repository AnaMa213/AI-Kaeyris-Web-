import { describe, expect, test } from "vitest";
import { loginSchema, setupSchema } from "@/lib/jdr/schemas/auth";

describe("loginSchema", () => {
  test("accepts a valid login payload (BD-7: no profile field anymore)", () => {
    const result = loginSchema.safeParse({
      username: "alice",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a payload missing username with the French error", () => {
    const result = loginSchema.safeParse({
      password: "hunter2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.username).toEqual(["Nom d'utilisateur requis."]);
    }
  });

  test("rejects a payload missing password with the French error", () => {
    const result = loginSchema.safeParse({ username: "alice" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.password).toEqual(["Mot de passe requis."]);
    }
  });

  test("tolerates an extra profile field (zod default: strips unknowns)", () => {
    const result = loginSchema.safeParse({
      username: "alice",
      password: "hunter2",
      profile: "gm",
    });
    expect(result.success).toBe(true);
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

  test("tolerates an extra profile field (legacy; backend ignores)", () => {
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
