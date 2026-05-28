import { describe, expect, test } from "vitest";
import { userCreateSchema, userUpdateSchema } from "@/lib/schemas/users";

describe("userCreateSchema", () => {
  test("accepts a valid GM account", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      profile: "gm",
      password: "secret",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a valid user account", () => {
    const result = userCreateSchema.safeParse({
      username: "bob",
      profile: "user",
      password: "secret",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an uppercase profile (case-sensitive enum)", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      profile: "GM",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a 'player' profile value (handoff legacy term)", () => {
    const result = userCreateSchema.safeParse({
      username: "alice",
      profile: "player",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a payload missing username", () => {
    const result = userCreateSchema.safeParse({
      profile: "user",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });
});

describe("userUpdateSchema", () => {
  test("accepts a partial profile-only update", () => {
    const result = userUpdateSchema.safeParse({ profile: "gm" });
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
});
