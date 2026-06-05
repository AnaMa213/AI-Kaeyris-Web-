"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useJob, type JobOut } from "@/lib/jdr/jobs/queries";

interface JobStateBadgeProps {
  jobId: string;
  /**
   * Story 4.3 : labels par statut. Défaut = vocabulaire transcription (Stories
   * 3.3/3.4 — call sites inchangés) ; un job d'artefact passe ses propres labels.
   */
  labels?: Record<JobOut["status"], string>;
  /** Préfixe ARIA — défaut « État de la transcription ». */
  ariaLabelPrefix?: string;
}

const STATUS_LABEL: Record<JobOut["status"], string> = {
  queued: "En file",
  running: "Transcription en cours",
  succeeded: "Transcrite",
  failed: "Échec",
};

export function JobStateBadge({
  jobId,
  labels = STATUS_LABEL,
  ariaLabelPrefix = "État de la transcription",
}: JobStateBadgeProps) {
  // Story 3.3: read-only consumer of the cache seeded by useUploadSessionAudio.
  // useJob ships with a queryFn so TanStack v5 stops yelling about missing
  // default functions; `enabled: false` keeps it from actually firing.
  // Story 3.4 will flip enabled + add refetchInterval for live polling.
  const { data: job } = useJob(jobId);

  if (!job) return null;

  const label = labels[job.status];

  if (job.status === "failed") {
    return (
      <Badge
        variant="destructive"
        aria-label={`${ariaLabelPrefix} : ${label}`}
      >
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      aria-label={`${ariaLabelPrefix} : ${label}`}
      className={cn(
        job.status === "running" && "animate-pulse",
        job.status === "succeeded" && "text-state-success border-state-success",
      )}
    >
      {label}
    </Badge>
  );
}
