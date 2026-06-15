"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { useJob } from "@/lib/jdr/jobs/queries";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

/**
 * Story 4.7 (S1) — chip d'état unique de la séance.
 *
 * Une seule pastille colour-codée, jamais deux : tant qu'un job est actif
 * (`currentJobId`), on délègue à `<JobStateBadge>` (statut live, déjà colour-codé) ;
 * sinon on rend un chip statique reflétant `session.state`. Remplace l'ancien
 * duo `Badge variant="outline"` + `JobStateBadge` qui se dupliquaient pendant la
 * transcription.
 */
const STATE_LABEL: Record<SessionOut["state"], string> = {
  created: "Créée",
  audio_uploaded: "Audio uploadé",
  transcribing: "Transcription en cours",
  transcription_failed: "Échec transcription",
  transcribed: "Transcrite",
};

// Couleurs token-driven, alignées sur le vocabulaire de `JobStateBadge`.
const STATE_CLASS: Partial<Record<SessionOut["state"], string>> = {
  transcribing: "animate-pulse",
  transcribed: "text-state-success border-state-success",
};

interface SessionStateChipProps {
  state: SessionOut["state"];
  /** Job de transcription en cours (BD-8) — quand présent, son statut prime. */
  currentJobId: string | null;
}

export function SessionStateChip({ state, currentJobId }: SessionStateChipProps) {
  // Lecture seule du cache (le polling live est porté par la page). Sert à
  // distinguer un job de transcription d'un job d'artefact, et à savoir s'il
  // tourne encore.
  const { data: job } = useJob(currentJobId);

  if (currentJobId) {
    const isArtifactJob = job != null && job.kind !== "transcription";

    // Transcription : délégué au JobStateBadge (statut live, « En file » /
    // « Transcription en cours » / « Transcrite ») — comportement historique.
    if (!isArtifactJob) {
      return <JobStateBadge jobId={currentJobId} />;
    }

    // Artefact en cours (file/exécution) → libellé générique « Génération en
    // cours ». Une fois terminé, on retombe sur l'état au repos de la séance
    // (« Transcrite ») plutôt que d'afficher « … généré ».
    const generating = job.status === "queued" || job.status === "running";
    if (generating) {
      const generatingLabel = "Génération en cours";
      return (
        <Badge
          variant="outline"
          aria-label={`État de la séance : ${generatingLabel}`}
          className="animate-pulse"
        >
          {generatingLabel}
        </Badge>
      );
    }
  }

  const label = STATE_LABEL[state];

  if (state === "transcription_failed") {
    return (
      <Badge variant="destructive" aria-label={`État de la séance : ${label}`}>
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      aria-label={`État de la séance : ${label}`}
      className={cn(STATE_CLASS[state])}
    >
      {label}
    </Badge>
  );
}
