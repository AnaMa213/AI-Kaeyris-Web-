import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

export function canCreateCampaignSession(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}
