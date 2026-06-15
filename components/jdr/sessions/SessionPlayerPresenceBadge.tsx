"use client";

import { Users } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useListCampaignPjs } from "@/lib/jdr/pjs/queries";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";

interface SessionPlayerPresenceBadgeProps {
  sessionId: string;
  campaignId: string;
}

/**
 * Story 4.23 (AC5) — compact "declared players" indicator for a session row.
 * Resolves the session's `pj_ids` (`GET /players`) against the campaign roster
 * (`GET /pjs`) and lists the names in a tooltip. Rendered as a non-interactive
 * `<span>` trigger so it stays valid inside the row's `<Link>` anchor.
 *
 * Omitted entirely when no player is declared (avoids noise on every row). Adds
 * two queries per row, bounded by the 5-rows/page pagination cap (AC4); there is
 * no batch/aggregate endpoint to use instead.
 */
export function SessionPlayerPresenceBadge({
  sessionId,
  campaignId,
}: SessionPlayerPresenceBadgeProps) {
  const playersQuery = useSessionPlayers(sessionId);
  const pjsQuery = useListCampaignPjs(campaignId);

  const pjIds = playersQuery.data?.pj_ids ?? [];
  if (pjIds.length === 0) return null;

  const roster = pjsQuery.data?.items ?? [];
  const nameById = new Map(roster.map((pj) => [pj.id, pj.name]));
  const names = pjIds.map((id) => nameById.get(id) ?? "PJ inconnu");
  const plural = pjIds.length > 1 ? "s" : "";
  // Names live both in the accessible name (so assistive tech and tests don't
  // need to open the hover tooltip) and in the visual tooltip below.
  const label = `${pjIds.length} joueur${plural} déclaré${plural} : ${names.join(", ")}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="text-text-chrome-muted inline-flex items-center gap-1 text-sm"
            aria-label={label}
          />
        }
      >
        <Users aria-hidden="true" className="size-4" />
        {pjIds.length}
      </TooltipTrigger>
      <TooltipContent>{names.join(", ")}</TooltipContent>
    </Tooltip>
  );
}
