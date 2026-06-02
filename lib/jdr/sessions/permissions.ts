import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

/**
 * Story 2.8 — Only the gm of a campaign can edit its sessions metadata
 * (title, campaign_context). The backend enforces this with a 403 (BD-7
 * authorization); this helper is a frontend-side defence-in-depth that
 * hides the "Modifier" CTA upstream of any network roundtrip.
 */
export function canEditCampaignSession(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}
