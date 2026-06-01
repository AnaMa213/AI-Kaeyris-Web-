import { describe, expect, test } from "vitest";
import { userCreateSchema, userUpdateSchema } from "@/lib/jdr/schemas/users";

describe("userCreateSchema", () => {
  test("accepts a valid admin account", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      system_role: "admin",
      password: "secret",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a valid standard user account", () => {
    const result = userCreateSchema.safeParse({
      username: "bob",
      system_role: "user",
      password: "secret",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an uppercase system_role (case-sensitive enum)", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      system_role: "ADMIN",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a 'gm' system_role value (legacy from pre-BD-7)", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      system_role: "gm",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a payload missing username with the French error", () => {
    const result = userCreateSchema.safeParse({
      system_role: "user",
      password: "secret",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.username).toEqual(["Nom d'utilisateur requis."]);
    }
  });

  test("rejects a payload missing password with the French error", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      system_role: "user",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.password).toEqual(["Mot de passe requis."]);
    }
  });
});

describe("userUpdateSchema", () => {
  test("accepts a partial system_role-only update", () => {
    const result = userUpdateSchema.safeParse({ system_role: "admin" });
    expect(result.success).toBe(true);
  });

  test("accepts a partial password-only update", () => {
    const result = userUpdateSchema.safeParse({ password: "newsecret" });
    expect(result.success).toBe(true);
  });

  test("accepts a status-only update (deactivate/reactivate)", () => {
    const result = userUpdateSchema.safeParse({ status: "inactive" });
    expect(result.success).toBe(true);
  });

  test("accepts an empty update object (no-op)", () => {
    const result = userUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects an unknown status value", () => {
    const result = userUpdateSchema.safeParse({ status: "banned" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty password (cannot blank an existing password)", () => {
    const result = userUpdateSchema.safeParse({ password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.password).toEqual(["Mot de passe requis."]);
    }
  });
});
