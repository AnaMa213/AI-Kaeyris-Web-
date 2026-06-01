"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import type { CampaignRole } from "@/lib/core/session/types";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

interface CampaignCardProps {
  campaign: CampaignOut;
}

const ROLE_LABEL: Record<CampaignRole, string> = {
  gm: "MJ",
  pj: "Joueur",
};

function lastSessionLabels(value: string | null | undefined) {
  if (!value) return null;
  const date = parseBackendDate(value);
  return {
    relative: formatDistanceToNow(date, { addSuffix: true, locale: fr }),
    absolute: format(date, "dd/MM/yyyy", { locale: fr }),
    raw: value,
  };
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const lastSession = lastSessionLabels(campaign.last_session_at);
  const roleClass =
    campaign.role === "gm"
      ? "border-accent-gold text-accent-gold"
      : "border-state-info text-state-info";

  return (
    <Link
      href={`/jdr/campaigns/${campaign.id}`}
      className="border-border-chrome bg-surface-raised group hover:border-accent-gold focus-visible:ring-accent-gold flex flex-col gap-2 rounded-md border px-6 py-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display group-hover:text-accent-gold text-2xl transition-colors">
          {campaign.name}
        </h2>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs tracking-wide uppercase ${roleClass}`}
        >
          {ROLE_LABEL[campaign.role]}
        </span>
      </div>

      {campaign.description && (
        <p className="font-narrative text-text-chrome-muted line-clamp-2 text-base italic">
          {campaign.description}
        </p>
      )}

      <div className="text-text-chrome-muted mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          <strong className="text-text-chrome font-medium">
            {campaign.session_count}
          </strong>{" "}
          {campaign.session_count <= 1 ? "session" : "sessions"}
        </span>
        {lastSession ? (
          <time
            dateTime={lastSession.raw}
            className="flex items-center gap-2 text-xs"
          >
            <span>{lastSession.relative}</span>
            <span aria-hidden="true">·</span>
            <span>{lastSession.absolute}</span>
          </time>
        ) : (
          <span className="text-xs italic">Aucune séance encore</span>
        )}
      </div>
    </Link>
  );
}
