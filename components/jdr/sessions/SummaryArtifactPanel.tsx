"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useJob, type JobOut } from "@/lib/jdr/jobs/queries";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";
import {
  summaryArtifactQueryKey,
  useGenerateSummary,
  useSummaryArtifact,
} from "@/lib/jdr/sessions/artifacts";

interface SummaryArtifactPanelProps {
  sessionId: string;
  campaignId: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

// Story 4.3 : labels du badge adaptés à un job d'artefact (pas « transcription »).
const SUMMARY_JOB_LABELS: Record<JobOut["status"], string> = {
  queued: "En file",
  running: "Génération en cours",
  succeeded: "Généré",
  failed: "Échec",
};

export function SummaryArtifactPanel({ sessionId }: SummaryArtifactPanelProps) {
  const queryClient = useQueryClient();
  const summaryQuery = useSummaryArtifact(sessionId);
  const playersQuery = useSessionPlayers(sessionId);
  const generate = useGenerateSummary(sessionId);
  const [jobId, setJobId] = useState<string | null>(null);
  const jobQuery = useJob(jobId, { live: true });
  const job = jobQuery.data;

  const summary = summaryQuery.data;
  const hasPjDeclared = (playersQuery.data?.pj_ids.length ?? 0) > 0;
  const jobFailed = job?.status === "failed";
  // Actif = job en vol OU terminé OK mais le résumé n'est pas encore relu
  // (évite un flash du bouton entre `succeeded` et l'arrivée du texte).
  const jobActive = jobId !== null && !jobFailed && summary == null;

  // À la complétion du job, le résumé devient disponible → on le rafraîchit.
  useEffect(() => {
    if (job?.status === "succeeded") {
      queryClient.invalidateQueries({
        queryKey: summaryArtifactQueryKey(sessionId),
      });
    }
  }, [job?.status, queryClient, sessionId]);

  const handleGenerate = () => {
    if (generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: (queued) => setJobId(queued.id),
      onError: () =>
        toast.error("Impossible de lancer la génération du résumé."),
    });
  };

  if (summary) {
    const generatedAt = parseBackendDate(summary.generated_at);
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="Résumé de la séance">
        <h2 className="font-display mb-3 text-xl font-semibold">Résumé</h2>
        <p className="text-text-chrome leading-relaxed whitespace-pre-wrap">
          {summary.text}
        </p>
        <p className="text-text-chrome-muted mt-4 text-xs">
          Généré le {generatedAt.toLocaleString("fr-FR")} · {summary.model_used}
        </p>
      </section>
    );
  }

  return (
    <section className={SECTION_CARD_CLASSES} aria-label="Génération du résumé">
      <h2 className="font-display mb-2 text-xl font-semibold">Résumé</h2>
      <p className="text-text-chrome-muted mb-4 text-sm">
        Génère le résumé de la séance pour débloquer le Récit, les Éléments et les
        POVs.
      </p>

      {jobId && (
        <div className="mb-3 flex items-center gap-3">
          <JobStateBadge
            jobId={jobId}
            labels={SUMMARY_JOB_LABELS}
            ariaLabelPrefix="État de la génération"
          />
          {jobActive && (
            <span className="text-text-chrome-muted text-sm">
              Le résumé est en cours de génération…
            </span>
          )}
        </div>
      )}

      {!jobActive && (
        <div className="flex flex-col gap-2">
          {!hasPjDeclared && (
            <p className="text-text-chrome-muted text-sm italic">
              Déclare d&apos;abord les PJs présents pour générer le résumé.
            </p>
          )}
          {jobFailed && (
            <p className="text-state-error text-sm">
              La génération a échoué. Réessaie.
            </p>
          )}
          <div>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={!hasPjDeclared || generate.isPending}
              className={generate.isPending ? "animate-pulse" : undefined}
            >
              {generate.isPending
                ? "Lancement…"
                : jobFailed
                  ? "Réessayer"
                  : "Générer le Résumé"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
