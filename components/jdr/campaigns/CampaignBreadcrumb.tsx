"use client";

import Link from "next/link";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";

interface CampaignBreadcrumbProps {
  campaignId: string;
  /**
   * Story 4.23 (AC8) — optional leaf crumb (session title, "Nouvelle session",
   * later "PJs"/"Lore"). Rendered as plain text, not a link.
   */
  current?: string;
}

const CRUMB_LINK_CLASSES =
  "text-text-chrome-muted hover:bg-accent-gold/10 hover:text-accent-gold! -mx-1 rounded px-1 py-0.5 transition-all duration-120";

function Separator() {
  return (
    <li aria-hidden="true" className="text-text-chrome-muted/60 select-none">
      ›
    </li>
  );
}

/**
 * Story 4.23 (AC8) — full breadcrumb trail:
 * `Toutes les Campagnes → {Campagne} → {current}`. Kept as a custom component
 * (no shadcn `breadcrumb` primitive) consistent with the existing minimal style.
 */
export function CampaignBreadcrumb({
  campaignId,
  current,
}: CampaignBreadcrumbProps) {
  const campaignQuery = useGetCampaign(campaignId);

  const campaignLabel =
    campaignQuery.data?.name ??
    (campaignQuery.isError ? "Campagne introuvable" : "...");

  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="text-text-chrome-muted flex flex-wrap items-center gap-1.5 text-sm">
        <li>
          <Link href="/jdr/campaigns" className={CRUMB_LINK_CLASSES}>
            Toutes les Campagnes
          </Link>
        </li>
        <Separator />
        <li>
          <Link
            href={`/jdr/campaigns/${campaignId}`}
            className={CRUMB_LINK_CLASSES}
          >
            {campaignLabel}
          </Link>
        </li>
        {current && (
          <>
            <Separator />
            <li aria-current="page" className="text-text-chrome truncate">
              {current}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
