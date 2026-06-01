"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, ScrollText } from "lucide-react";
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

function hasDescription(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const lastSession = lastSessionLabels(campaign.last_session_at);
  const roleClass =
    campaign.role === "gm"
      ? "border-accent-gold text-accent-gold"
      : "border-state-info text-state-info";
  const showDescription = hasDescription(campaign.description);

  return (
    <Link
      href={`/jdr/campaigns/${campaign.id}`}
      className="bg-surface-card border-border-card hover:border-border-card-hover focus-visible:outline-accent-gold group flex min-h-50 flex-col gap-3 rounded-[10px] border p-6 shadow-(--shadow-card-inset) transition-all duration-180 hover:-translate-y-0.5 hover:shadow-(--shadow-card-hover) focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display group-hover:text-accent-gold text-2xl leading-tight transition-colors">
          {campaign.name}
        </h2>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs tracking-wide uppercase ${roleClass}`}
        >
          {ROLE_LABEL[campaign.role]}
        </span>
      </div>

      {showDescription ? (
        <p className="font-narrative text-text-chrome-muted line-clamp-2 text-base italic">
          {campaign.description}
        </p>
      ) : (
        <p className="font-narrative text-text-chrome-muted/60 text-sm italic">
          Sans description
        </p>
      )}

      <div className="text-text-chrome-muted mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
          <strong className="text-text-chrome font-medium">
            {campaign.session_count}
          </strong>{" "}
          {campaign.session_count <= 1 ? "session" : "sessions"}
        </span>
        {lastSession ? (
          <time
            dateTime={lastSession.raw}
            className="inline-flex items-center gap-1.5 text-xs"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lastSession.relative}</span>
            <span aria-hidden="true">·</span>
            <span>{lastSession.absolute}</span>
          </time>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs italic">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Aucune séance encore
          </span>
        )}
      </div>
    </Link>
  );
}
