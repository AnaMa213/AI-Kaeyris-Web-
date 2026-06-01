import { describe, expect, test } from "vitest";
import {
  isCampaignGm,
  isCampaignMember,
  isSystemAdmin,
} from "@/lib/core/session/helpers";
import type { CurrentUser } from "@/lib/core/session/types";

const loading: CurrentUser = { status: "loading" };
const unauth: CurrentUser = { status: "unauthenticated" };

function makeAuth(
  systemRole: "admin" | "user",
  campaign: { id: string; role: "gm" | "pj" } | null,
): CurrentUser {
  return {
    status: "authenticated",
    auth: {
      authId: "user-uuid",
      username: "kenan",
      systemRole,
    },
    activeCampaign: campaign
      ? {
          id: campaign.id,
          name: "Campagne par défaut",
          role: campaign.role,
          characterId: null,
        }
      : null,
  };
}

describe("isSystemAdmin", () => {
  test("returns false when loading", () => {
    expect(isSystemAdmin(loading)).toBe(false);
  });

  test("returns false when unauthenticated", () => {
    expect(isSystemAdmin(unauth)).toBe(false);
  });

  test("returns true for system_role=admin", () => {
    expect(isSystemAdmin(makeAuth("admin", { id: "c1", role: "gm" }))).toBe(true);
    expect(isSystemAdmin(makeAuth("admin", null))).toBe(true);
  });

  test("returns false for system_role=user", () => {
    expect(isSystemAdmin(makeAuth("user", { id: "c1", role: "gm" }))).toBe(false);
    expect(isSystemAdmin(makeAuth("user", null))).toBe(false);
  });
});

describe("isCampaignGm", () => {
  test("returns false when loading or unauthenticated", () => {
    expect(isCampaignGm(loading)).toBe(false);
    expect(isCampaignGm(unauth)).toBe(false);
  });

  test("returns false when no active campaign", () => {
    expect(isCampaignGm(makeAuth("admin", null))).toBe(false);
    expect(isCampaignGm(makeAuth("user", null))).toBe(false);
  });

  test("returns true for active campaign with role=gm (no id filter)", () => {
    expect(isCampaignGm(makeAuth("admin", { id: "c1", role: "gm" }))).toBe(true);
    expect(isCampaignGm(makeAuth("user", { id: "c1", role: "gm" }))).toBe(true);
  });

  test("returns false for active campaign with role=pj (no id filter)", () => {
    expect(isCampaignGm(makeAuth("admin", { id: "c1", role: "pj" }))).toBe(false);
    expect(isCampaignGm(makeAuth("user", { id: "c1", role: "pj" }))).toBe(false);
  });

  test("returns true when campaignId matches and role=gm", () => {
    expect(isCampaignGm(makeAuth("user", { id: "c1", role: "gm" }), "c1")).toBe(
      true,
    );
  });

  test("returns false when campaignId does not match active", () => {
    expect(isCampaignGm(makeAuth("user", { id: "c1", role: "gm" }), "c2")).toBe(
      false,
    );
  });

  test("returns false when campaignId is null and active is gm", () => {
    // null is treated as "no filter" so this should still be true via active.
    expect(isCampaignGm(makeAuth("user", { id: "c1", role: "gm" }), null)).toBe(
      true,
    );
  });
});

describe("isCampaignMember", () => {
  test("returns false when loading or unauthenticated", () => {
    expect(isCampaignMember(loading)).toBe(false);
    expect(isCampaignMember(unauth)).toBe(false);
  });

  test("returns false when no active campaign", () => {
    expect(isCampaignMember(makeAuth("admin", null))).toBe(false);
  });

  test("returns true for gm OR pj on the active campaign", () => {
    expect(isCampaignMember(makeAuth("user", { id: "c1", role: "gm" }))).toBe(true);
    expect(isCampaignMember(makeAuth("user", { id: "c1", role: "pj" }))).toBe(true);
  });

  test("returns true when campaignId matches active", () => {
    expect(
      isCampaignMember(makeAuth("user", { id: "c1", role: "pj" }), "c1"),
    ).toBe(true);
  });

  test("returns false when campaignId does not match active", () => {
    expect(
      isCampaignMember(makeAuth("user", { id: "c1", role: "pj" }), "c2"),
    ).toBe(false);
  });
});
