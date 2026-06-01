"use client";

import Link from "next/link";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";

interface CampaignBreadcrumbProps {
  campaignId: string;
}

export function CampaignBreadcrumb({ campaignId }: CampaignBreadcrumbProps) {
  const campaignQuery = useGetCampaign(campaignId);

  const label = campaignQuery.data?.name
    ?? (campaignQuery.isError ? "Campagne introuvable" : "...");

  return (
    <Link
      href={`/jdr/campaigns/${campaignId}`}
      className="text-text-chrome-muted hover:text-accent-gold! inline-flex items-center gap-1 text-sm"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
