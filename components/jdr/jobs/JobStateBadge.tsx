"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useJob, type JobOut } from "@/lib/jdr/jobs/queries";

interface JobStateBadgeProps {
  jobId: string;
}

const STATUS_LABEL: Record<JobOut["status"], string> = {
  queued: "En file",
  running: "Transcription en cours",
  succeeded: "Transcrite",
  failed: "Échec",
};

export function JobStateBadge({ jobId }: JobStateBadgeProps) {
  // Story 3.3: read-only consumer of the cache seeded by useUploadSessionAudio.
  // useJob ships with a queryFn so TanStack v5 stops yelling about missing
  // default functions; `enabled: false` keeps it from actually firing.
  // Story 3.4 will flip enabled + add refetchInterval for live polling.
  const { data: job } = useJob(jobId);

  if (!job) return null;

  const label = STATUS_LABEL[job.status];

  if (job.status === "failed") {
    return (
      <Badge
        variant="destructive"
        aria-label={`État de la transcription : ${label}`}
      >
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      aria-label={`État de la transcription : ${label}`}
      className={cn(
        job.status === "running" && "animate-pulse",
        job.status === "succeeded" && "text-state-success border-state-success",
      )}
    >
      {label}
    </Badge>
  );
}
