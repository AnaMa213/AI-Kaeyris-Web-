"use client";

import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { ApiError } from "@/lib/core/api/errors";
import { useGetSession, type SessionOut } from "@/lib/jdr/sessions/queries";

const STATE_LABEL: Record<SessionOut["state"], string> = {
  created: "Créée",
  audio_uploaded: "Audio uploadé",
  transcribing: "Transcription en cours",
  transcription_failed: "Échec transcription",
  transcribed: "Transcrite",
};

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const sessionQuery = useGetSession(id);

  if (sessionQuery.isPending) {
    return <FantasyLoader message="Consultation du grimoire..." />;
  }

  if (sessionQuery.isError) {
    return (
      <main className="bg-background text-foreground min-h-screen p-8">
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
      </main>
    );
  }

  const session = sessionQuery.data;
  const recordedAt = new Date(session.recorded_at);
  const absoluteDate = format(recordedAt, "dd/MM/yyyy 'à' HH:mm", {
    locale: fr,
  });
  const relativeDate = formatDistanceToNow(recordedAt, {
    addSuffix: true,
    locale: fr,
  });

  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <header className="mx-auto mb-8 max-w-3xl">
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
      </header>

      <section className="mx-auto mb-6 max-w-3xl">
        <h2 className="font-display mb-3 text-xl">Audio</h2>
        <EmptyState
          title="Aucun audio uploadé"
          description="L'upload audio sera disponible dans une story Epic 3."
          action={{
            label: "Uploader",
            onClick: () => {},
            disabled: true,
            disabledHint: "Disponible avec Epic 3",
          }}
        />
      </section>

      <section className="mx-auto max-w-3xl">
        <h2 className="font-display mb-3 text-xl">Transcription</h2>
        <EmptyState
          title="En attente d'audio"
          description="La transcription démarre automatiquement après l'upload."
          action={{
            label: "Voir la transcription",
            onClick: () => {},
            disabled: true,
            disabledHint: "Disponible avec Epic 3",
          }}
        />
      </section>
    </main>
  );
}
