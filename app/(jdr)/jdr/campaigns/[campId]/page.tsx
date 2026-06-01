"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { ApiError } from "@/lib/core/api/errors";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";
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

  if (campaignQuery.isPending) {
    return <FantasyLoader message="Consultation du grimoire..." />;
  }

  if (campaignQuery.isError) {
    return (
      <section className="bg-background text-foreground min-h-full p-8">
        <div
          role="alert"
          className="text-state-error border-state-error/30 bg-state-error/10 mx-auto max-w-3xl rounded-md border p-4 text-sm"
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
  const sessions = sessionsQuery.data?.items ?? [];
  const sortedSessions = sortByRecordedAtDesc(sessions);

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/jdr/campaigns"
          className="text-text-chrome-muted hover:text-accent-gold! mb-4 inline-flex items-center gap-1 text-sm"
        >
          <span aria-hidden="true">←</span>
          <span>Toutes les campagnes</span>
        </Link>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="font-narrative text-text-chrome-muted mt-1 text-base italic">
                {campaign.description}
              </p>
            )}
            <p className="text-text-chrome-muted mt-2 text-sm">
              <strong className="text-text-chrome font-medium">
                {campaign.session_count}
              </strong>{" "}
              {campaign.session_count <= 1 ? "session" : "sessions"} · démarrée
              le {createdLabel}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled
              title="Disponible avec Story 2.8"
            >
              Modifier
            </Button>
            <Button
              type="button"
              onClick={() =>
                router.push(`/jdr/campaigns/${campId}/sessions/new`)
              }
            >
              Nouvelle session
            </Button>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="font-display mb-3 text-xl">Sessions</h2>
          {sessionsQuery.isPending ? (
            <p className="text-text-chrome-muted text-sm">
              Chargement des sessions...
            </p>
          ) : sortedSessions.length === 0 ? (
            <EmptyState
              title="Aucune session dans cette campagne."
              description="Crée ta première session pour commencer un récit."
              action={{
                label: "Nouvelle session",
                onClick: () =>
                  router.push(`/jdr/campaigns/${campId}/sessions/new`),
              }}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-white/5">
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
                      className="group flex flex-col gap-1 py-4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <h3 className="font-display group-hover:text-accent-gold text-xl transition-colors">
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

        <section>
          <h2 className="font-display mb-3 text-xl">PJs</h2>
          <p className="text-text-chrome-muted text-sm italic">
            Les PJs liés à cette campagne arrivent bientôt.
          </p>
        </section>
      </div>
    </section>
  );
}
