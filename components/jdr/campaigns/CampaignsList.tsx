"use client";

import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";
import { CampaignCard } from "./CampaignCard";

interface CampaignsListProps {
  campaigns: CampaignOut[];
}

function sortByLastSessionDesc(items: CampaignOut[]): CampaignOut[] {
  return [...items].sort((a, b) => {
    if (!a.last_session_at && !b.last_session_at) return 0;
    if (!a.last_session_at) return 1;
    if (!b.last_session_at) return -1;
    return (
      parseBackendDate(b.last_session_at).getTime() -
      parseBackendDate(a.last_session_at).getTime()
    );
  });
}

export function CampaignsList({ campaigns }: CampaignsListProps) {
  const sorted = sortByLastSessionDesc(campaigns);
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((campaign) => (
        <li key={campaign.id}>
          <CampaignCard campaign={campaign} />
        </li>
      ))}
    </ul>
  );
}
