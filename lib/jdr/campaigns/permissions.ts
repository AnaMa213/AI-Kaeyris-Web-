import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

export function canCreateCampaignSession(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}

export function canEditCampaign(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}

export function canDeleteCampaign(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}

export function canManageCampaignPjs(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}
