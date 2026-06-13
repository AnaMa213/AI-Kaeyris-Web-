"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  summaryArtifactQueryKey,
  useGenerateSummary,
  useSummaryArtifact,
} from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { NarrativeArtifact } from "@/components/narrative/NarrativeArtifact";

interface SummaryArtifactPanelProps {
  sessionId: string;
  campaignId: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

/**
 * Story 4.3 — génère et affiche le Résumé. Story 4.5 — branché sur le flux
 * partagé `useArtifactJobFlow` (qui pilote aussi la régénération) et expose un
 * CTA « Régénérer le Résumé » une fois le résumé présent.
 */
export function SummaryArtifactPanel({ sessionId }: SummaryArtifactPanelProps) {
  const summaryQuery = useSummaryArtifact(sessionId);
  const playersQuery = useSessionPlayers(sessionId);
  const generate = useGenerateSummary(sessionId);
  const summary = summaryQuery.data;
  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: Boolean(summary),
    keyFactory: summaryArtifactQueryKey,
    artifactVersion: summary?.generated_at,
    artifactNoun: "du résumé",
  });

  const hasPjDeclared = (playersQuery.data?.pj_ids.length ?? 0) > 0;

  const handleGenerate = () => {
    if (generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: () =>
        toast.error("Impossible de lancer la génération du résumé."),
    });
  };

  if (summary) {
    const generatedAt = parseBackendDate(summary.generated_at);
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="Résumé de la séance">
        <h2 className="font-display mb-3 text-xl font-semibold">Résumé</h2>
        {/* Story 5.1 — rendu long-form Markdown sur parchemin (drop-cap, ornement,
            pull-quote). Le composant ne fetch rien : il reçoit le markdown brut. */}
        <NarrativeArtifact markdown={summary.text} kind="summary" />
        <p className="text-text-chrome-muted mt-4 text-xs">
          Généré le {generatedAt.toLocaleString("fr-FR")} · {summary.model_used}
        </p>
        <ArtifactRegenerateControls
          artifactLabel="le Résumé"
          jobId={flow.jobId}
          jobInFlight={flow.jobInFlight}
          artifactSettling={flow.artifactSettling}
          jobFailed={flow.jobFailed}
          failureReason={flow.failureReason}
          pending={generate.isPending}
          onConfirm={handleGenerate}
        />
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

      {flow.jobId && (
        <div className="mb-3 flex items-center gap-3">
          <JobStateBadge
            jobId={flow.jobId}
            labels={ARTIFACT_JOB_LABELS}
            ariaLabelPrefix="État de la génération"
          />
          {flow.jobActive && (
            <span className="text-text-chrome-muted text-sm">
              Le résumé est en cours de génération…
            </span>
          )}
        </div>
      )}

      {!flow.jobActive && (
        <div className="flex flex-col gap-2">
          {!hasPjDeclared && (
            <p className="text-text-chrome-muted text-sm italic">
              Déclare d&apos;abord les PJs présents pour générer le résumé.
            </p>
          )}
          {flow.jobFailed && (
            <p className="text-state-error text-sm">
              {flow.failureReason
                ? `La génération a échoué : ${flow.failureReason}`
                : "La génération a échoué. Réessaie."}
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
                : flow.jobFailed
                  ? "Réessayer"
                  : "Générer le Résumé"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
