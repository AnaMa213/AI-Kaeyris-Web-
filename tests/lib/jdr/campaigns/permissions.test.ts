import { describe, expect, test } from "vitest";
import { canCreateCampaignSession } from "@/lib/jdr/campaigns/permissions";

describe("canCreateCampaignSession", () => {
  test("allows campaign GMs to create sessions", () => {
    expect(canCreateCampaignSession({ role: "gm" })).toBe(true);
  });

  test("blocks campaign players from creating sessions", () => {
    expect(canCreateCampaignSession({ role: "pj" })).toBe(false);
  });
});
