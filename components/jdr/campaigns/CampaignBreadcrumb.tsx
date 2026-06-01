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
      className="text-text-chrome-muted hover:bg-accent-gold/10 hover:text-accent-gold! -mx-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm transition-all duration-120"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
