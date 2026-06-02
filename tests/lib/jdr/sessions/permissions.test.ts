import { describe, expect, test } from "vitest";
import { canEditCampaignSession } from "@/lib/jdr/sessions/permissions";

describe("canEditCampaignSession", () => {
  test("returns true when role is gm", () => {
    expect(canEditCampaignSession({ role: "gm" })).toBe(true);
  });

  test("returns false when role is pj", () => {
    expect(canEditCampaignSession({ role: "pj" })).toBe(false);
  });
});
