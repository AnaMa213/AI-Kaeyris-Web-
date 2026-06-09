"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { CampaignDeleteConfirm } from "@/components/jdr/campaigns/CampaignDeleteConfirm";
import { CampaignEditDialog } from "@/components/jdr/campaigns/CampaignEditDialog";
import { CampaignPjsCard } from "@/components/jdr/campaigns/CampaignPjsCard";
import { ApiError } from "@/lib/core/api/errors";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import {
  canCreateCampaignSession,
  canDeleteCampaign,
  canEditCampaign,
} from "@/lib/jdr/campaigns/permissions";
import {
  useDeleteCampaign,
  useGetCampaign,
} from "@/lib/jdr/campaigns/queries";
import {
  useListSessions,
  type SessionOut,
} from "@/lib/jdr/sessions/queries";

const STATE_LABEL: Record<SessionOut["state"], string> = {
  created: "Créée",
  audio_uploaded: "Audio uploadé",
  transcribing: "Transcription en cours",
  transcription_failed: "Échec transcription",
  transcribed: "Transcrite",
};

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function sortByRecordedAtDesc(items: SessionOut[]): SessionOut[] {
  return [...items].sort(
    (a, b) =>
      parseBackendDate(b.recorded_at).getTime() -
      parseBackendDate(a.recorded_at).getTime(),
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ campId: string }>();
  const router = useRouter();
  const campId = typeof params.campId === "string" ? params.campId : "";

  const campaignQuery = useGetCampaign(campId);
  const sessionsQuery = useListSessions({ campaignId: campId });
  const deleteMutation = useDeleteCampaign(campId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (campaignQuery.isPending) {
    return <FantasyLoader message="Consultation du grimoire..." />;
  }

  if (campaignQuery.isError) {
    return (
      <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
        <div
          role="alert"
          className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
        >
          <p className="font-medium">Campagne introuvable.</p>
          {campaignQuery.error instanceof ApiError && (
            <p className="text-text-chrome-muted mt-2 text-xs">
              {campaignQuery.error.problem.title}
            </p>
          )}
        </div>
      </section>
    );
  }

  const campaign = campaignQuery.data;
  const createdAt = parseBackendDate(campaign.created_at);
  const createdLabel = format(createdAt, "dd/MM/yyyy", { locale: fr });
  const canCreateSession = canCreateCampaignSession(campaign);
  const canEdit = canEditCampaign(campaign);
  const canDelete = canDeleteCampaign(campaign);
  const sessions = sessionsQuery.data?.items ?? [];
  const sortedSessions = sortByRecordedAtDesc(sessions);

  const handleConfirmDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setDeleting(false);
        router.push("/jdr/campaigns");
      },
    });
  };

  return (
    <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
      <Link
        href="/jdr/campaigns"
        className="text-text-chrome-muted hover:bg-accent-gold/10 hover:text-accent-gold -mx-2 mb-4 inline-flex items-center gap-1 rounded px-2 py-1 text-sm transition-all duration-120"
      >
        <span aria-hidden="true">←</span>
        <span>Toutes les campagnes</span>
      </Link>

      <header
        className={`${SECTION_CARD_CLASSES} mb-7 lg:p-8`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold leading-tight">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="font-narrative text-text-chrome-muted mt-2 max-w-[70ch] text-base italic">
                {campaign.description}
              </p>
            )}
            <p className="text-text-chrome-muted mt-3 text-sm">
              <strong className="text-text-chrome font-medium">
                {campaign.session_count}
              </strong>{" "}
              {campaign.session_count <= 1 ? "session" : "sessions"} · démarrée
              le {createdLabel}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                Modifier
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleting(true)}
                className="text-state-error hover:text-state-error! hover:bg-state-error/10!"
              >
                Supprimer
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
        <section
          aria-label="Sessions"
          className={`${SECTION_CARD_CLASSES} lg:col-span-2`}
        >
          {/* Story 4.8 (C5) : le CTA « Nouvelle session » vit sur la ligne du
              header « Sessions », à droite (et non plus dans le header campagne). */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">Sessions</h2>
            <div className="flex items-center gap-3">
              <span className="text-text-chrome-muted text-xs tracking-wide uppercase">
                {sortedSessions.length} · zone de recherche future
              </span>
              {canCreateSession && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    router.push(`/jdr/campaigns/${campId}/sessions/new`)
                  }
                >
                  Nouvelle session
                </Button>
              )}
            </div>
          </div>
          {sessionsQuery.isPending ? (
            <p className="text-text-chrome-muted text-sm">
              Chargement des sessions...
            </p>
          ) : sessionsQuery.isError ? (
            <div
              role="alert"
              className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
            >
              <p className="font-medium">
                Les sessions de cette campagne n&apos;ont pas pu être chargées.
              </p>
              {sessionsQuery.error instanceof ApiError && (
                <p className="text-text-chrome-muted mt-2 text-xs">
                  {sessionsQuery.error.problem.title}
                </p>
              )}
            </div>
          ) : sortedSessions.length === 0 ? (
            <EmptyState
              title="Aucune session dans cette campagne."
              description={
                canCreateSession
                  ? "Crée ta première session pour commencer un récit."
                  : "Les sessions créées par le MJ apparaîtront ici."
              }
              action={
                canCreateSession
                  ? {
                      label: "Nouvelle session",
                      onClick: () =>
                        router.push(`/jdr/campaigns/${campId}/sessions/new`),
                    }
                  : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {sortedSessions.map((session) => {
                const recordedAt = parseBackendDate(session.recorded_at);
                const relative = formatDistanceToNow(recordedAt, {
                  addSuffix: true,
                  locale: fr,
                });
                const absolute = format(recordedAt, "dd/MM/yyyy 'à' HH:mm", {
                  locale: fr,
                });
                return (
                  <li key={session.id}>
                    <Link
                      href={`/jdr/campaigns/${campId}/sessions/${session.id}`}
                      className="group hover:bg-accent-gold/5 hover:border-accent-gold/20 -mx-3 flex flex-col gap-1 rounded-lg border border-transparent px-3 py-3 transition-all duration-120"
                    >
                      <div className="flex items-center gap-3">
                        <h3 className="font-display group-hover:text-accent-gold text-lg transition-colors">
                          {session.title}
                        </h3>
                        <Badge variant="outline">
                          {STATE_LABEL[session.state]}
                        </Badge>
                      </div>
                      <time
                        dateTime={session.recorded_at}
                        className="text-text-chrome-muted text-sm"
                      >
                        {relative} · {absolute}
                      </time>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 lg:col-span-1">
          <CampaignPjsCard campaign={campaign} />
        </aside>
      </div>

      <CampaignEditDialog
        open={editing}
        onOpenChange={setEditing}
        campaign={campaign}
      />
      <CampaignDeleteConfirm
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) deleteMutation.reset();
        }}
        campaign={campaign}
        onConfirm={handleConfirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteMutation.error}
      />
    </section>
  );
}
