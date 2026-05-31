"use client";

import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Upload, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { ApiError } from "@/lib/core/api/errors";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useGetSession, type SessionOut } from "@/lib/jdr/sessions/queries";

const STATE_LABEL: Record<SessionOut["state"], string> = {
  created: "Créée",
  audio_uploaded: "Audio uploadé",
  transcribing: "Transcription en cours",
  transcription_failed: "Échec transcription",
  transcribed: "Transcrite",
};

const AUDIO_DISABLED_HINT = "Disponible avec Epic 3";

function hasAudio(state: SessionOut["state"]): boolean {
  return state !== "created";
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const sessionQuery = useGetSession(id);

  if (sessionQuery.isPending) {
    return <FantasyLoader message="Consultation du grimoire..." />;
  }

  if (sessionQuery.isError) {
    return (
      <section className="bg-background text-foreground min-h-full p-8">
        <div
          role="alert"
          className="text-state-error border-state-error/30 bg-state-error/10 mx-auto max-w-3xl rounded-md border p-4 text-sm"
        >
          <p className="font-medium">Session introuvable.</p>
          {sessionQuery.error instanceof ApiError && (
            <p className="text-text-chrome-muted mt-2 text-xs">
              {sessionQuery.error.problem.title}
            </p>
          )}
        </div>
      </section>
    );
  }

  const session = sessionQuery.data;
  const recordedAt = parseBackendDate(session.recorded_at);
  const absoluteDate = format(recordedAt, "dd/MM/yyyy 'à' HH:mm", {
    locale: fr,
  });
  const relativeDate = formatDistanceToNow(recordedAt, {
    addSuffix: true,
    locale: fr,
  });
  const audioReady = hasAudio(session.state);

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <header className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold">
                {session.title}
              </h1>
              <Badge variant="outline">{STATE_LABEL[session.state]}</Badge>
            </div>
            <time
              dateTime={session.recorded_at}
              className="text-text-chrome-muted flex flex-col text-sm"
            >
              <span>{relativeDate}</span>
              <span className="text-xs">{absoluteDate}</span>
            </time>
          </div>

          <div className="shrink-0">
            {audioReady ? (
              <Button
                type="button"
                variant="outline"
                disabled
                title={AUDIO_DISABLED_HINT}
                aria-label="Lire l'audio de la séance"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Lire l&apos;audio
              </Button>
            ) : (
              <Button
                type="button"
                disabled
                title={AUDIO_DISABLED_HINT}
                aria-label="Uploader l'audio de la séance"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Uploader l&apos;audio
              </Button>
            )}
          </div>
        </div>
      </header>
    </section>
  );
}
