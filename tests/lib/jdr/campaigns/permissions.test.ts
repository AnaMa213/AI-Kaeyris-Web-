import { describe, expect, test } from "vitest";
import {
  canCreateCampaignSession,
  canDeleteCampaign,
  canEditCampaign,
} from "@/lib/jdr/campaigns/permissions";

describe("canCreateCampaignSession", () => {
  test("allows campaign GMs to create sessions", () => {
    expect(canCreateCampaignSession({ role: "gm" })).toBe(true);
  });

  test("blocks campaign players from creating sessions", () => {
    expect(canCreateCampaignSession({ role: "pj" })).toBe(false);
  });
});

describe("canEditCampaign", () => {
  test("returns true when role is gm", () => {
    expect(canEditCampaign({ role: "gm" })).toBe(true);
  });

  test("returns false when role is pj", () => {
    expect(canEditCampaign({ role: "pj" })).toBe(false);
  });
});

describe("canDeleteCampaign", () => {
  test("returns true when role is gm", () => {
    expect(canDeleteCampaign({ role: "gm" })).toBe(true);
  });

  test("returns false when role is pj", () => {
    expect(canDeleteCampaign({ role: "pj" })).toBe(false);
  });
});
