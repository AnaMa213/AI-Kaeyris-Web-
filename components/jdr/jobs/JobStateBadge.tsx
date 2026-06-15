"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useJob, type JobOut } from "@/lib/jdr/jobs/queries";

interface JobStateBadgeProps {
  jobId: string;
  /**
   * Story 4.3 : labels par statut. Si omis, ils sont dérivés du `kind` du job —
   * un job d'artefact affiche alors « Génération du résumé / récit / … » au lieu
   * du vocabulaire transcription. Un appelant peut toujours forcer ses libellés.
   */
  labels?: Record<JobOut["status"], string>;
  /** Préfixe ARIA. Si omis, dérivé du `kind` du job. */
  ariaLabelPrefix?: string;
}

// Vocabulaire par type de job (Story 4.7 S1 — le chip de séance n'a pas de
// libellés explicites : il doit refléter le `kind` du job courant, transcription
// comme artefact dérivé, sinon une génération s'affiche « Transcription en cours »).
const LABELS_BY_KIND: Record<JobOut["kind"], Record<JobOut["status"], string>> = {
  transcription: {
    queued: "En file",
    running: "Transcription en cours",
    succeeded: "Transcrite",
    failed: "Échec",
  },
  summary: {
    queued: "En file",
    running: "Génération du résumé",
    succeeded: "Résumé généré",
    failed: "Échec",
  },
  narrative: {
    queued: "En file",
    running: "Génération du récit",
    succeeded: "Récit généré",
    failed: "Échec",
  },
  elements: {
    queued: "En file",
    running: "Génération des éléments",
    succeeded: "Éléments générés",
    failed: "Échec",
  },
  povs: {
    queued: "En file",
    running: "Génération des POVs",
    succeeded: "POVs générés",
    failed: "Échec",
  },
};

const ARIA_PREFIX_BY_KIND: Record<JobOut["kind"], string> = {
  transcription: "État de la transcription",
  summary: "État de la génération",
  narrative: "État de la génération",
  elements: "État de la génération",
  povs: "État de la génération",
};

export function JobStateBadge({
  jobId,
  labels,
  ariaLabelPrefix,
}: JobStateBadgeProps) {
  // Story 3.3: read-only consumer of the cache seeded by useUploadSessionAudio.
  // useJob ships with a queryFn so TanStack v5 stops yelling about missing
  // default functions; `enabled: false` keeps it from actually firing.
  // Story 3.4 will flip enabled + add refetchInterval for live polling.
  const { data: job } = useJob(jobId);

  if (!job) return null;

  const resolvedLabels =
    labels ?? LABELS_BY_KIND[job.kind] ?? LABELS_BY_KIND.transcription;
  const prefix =
    ariaLabelPrefix ??
    ARIA_PREFIX_BY_KIND[job.kind] ??
    ARIA_PREFIX_BY_KIND.transcription;
  const label = resolvedLabels[job.status];

  if (job.status === "failed") {
    return (
      <Badge
        variant="destructive"
        aria-label={`${prefix} : ${label}`}
      >
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      aria-label={`${prefix} : ${label}`}
      className={cn(
        job.status === "running" && "animate-pulse",
        job.status === "succeeded" && "text-state-success border-state-success",
      )}
    >
      {label}
    </Badge>
  );
}
