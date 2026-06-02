"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { jobQueryKey, type JobOut } from "@/lib/jdr/jobs/queries";

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
  // Story 3.3: this only consumes the cache populated by useUploadSessionAudio.
  // Story 3.4 will flip `enabled` to true and add `refetchInterval`.
  const { data: job } = useQuery<JobOut | undefined>({
    queryKey: jobQueryKey(jobId),
    enabled: false,
  });

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
