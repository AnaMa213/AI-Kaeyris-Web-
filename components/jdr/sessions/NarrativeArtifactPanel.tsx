"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  narrativeArtifactQueryKey,
  isArtifactAbsentError,
  useGenerateNarrative,
  useNarrativeArtifact,
} from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { ArtifactExportButton } from "@/components/jdr/sessions/ArtifactExportButton";
import { NarrativeReader } from "@/components/narrative/NarrativeReader";

interface NarrativeArtifactPanelProps {
  sessionId: string;
  campaignId: string;
  sessionTitle: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function NarrativeShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASSES} aria-label={ariaLabel}>
      <h2 className="font-display mb-2 text-xl font-semibold">Récit</h2>
      {children}
    </section>
  );
}

/**
 * Story 4.4 — génère et affiche le Récit (artefact dérivé, indépendant du
 * Résumé). Affichage en texte brut volontairement minimal : la typographie
 * longue (drop-cap, TOC, remark/rehype) est portée par la Story 5.1.
 */
export function NarrativeArtifactPanel({
  sessionId,
  sessionTitle,
}: NarrativeArtifactPanelProps) {
  const narrativeQuery = useNarrativeArtifact(sessionId);
  const generate = useGenerateNarrative(sessionId);
  const narrative = narrativeQuery.data;
  const narrativeAbsent =
    narrativeQuery.isError && isArtifactAbsentError(narrativeQuery.error);
  const narrativeLoadFailed = narrativeQuery.isError && !narrativeAbsent;
  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: Boolean(narrative?.text),
    keyFactory: narrativeArtifactQueryKey,
    artifactVersion: narrative?.generated_at,
    artifactNoun: "du récit",
  });

  const handleGenerate = () => {
    if (generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: () => toast.error("Impossible de lancer la génération du récit."),
    });
  };

  if (narrativeQuery.isPending) {
    return (
      <NarrativeShell ariaLabel="Chargement du récit">
        <p className="text-text-chrome-muted text-sm">
          Vérification du récit existant…
        </p>
      </NarrativeShell>
    );
  }

  if (narrativeLoadFailed) {
    return (
      <NarrativeShell ariaLabel="Erreur de chargement du récit">
        <p className="text-state-error text-sm">
          Impossible de vérifier le récit existant. Réessaie plus tard.
        </p>
      </NarrativeShell>
    );
  }

  if (narrative?.text) {
    const generatedAt = parseBackendDate(narrative.generated_at);
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="Récit de la séance">
        <h2 className="font-display mb-3 text-xl font-semibold">Récit</h2>
        {/* Story 5.1 — rendu long-form Markdown sur parchemin (drop-cap, ornement,
            pull-quote). Story 5.2 — NarrativeReader ajoute le sommaire/scrollspy.
            Le composant ne fetch rien : il reçoit le markdown brut. */}
        <NarrativeReader markdown={narrative.text} kind="narrative" />
        <p className="text-text-chrome-muted mt-4 text-xs">
          Généré le {generatedAt.toLocaleString("fr-FR")} · {narrative.model_used}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ArtifactExportButton
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            kind="narrative"
          />
        </div>
        <ArtifactRegenerateControls
          artifactLabel="le Récit"
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
    <NarrativeShell ariaLabel="Génération du récit">
      <p className="text-text-chrome-muted mb-4 text-sm">
        Génère le récit narratif de la séance à partir du résumé.
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
              Le récit est en cours de génération…
            </span>
          )}
        </div>
      )}

      {flow.artifactUnavailable ? (
        <div className="flex flex-col gap-2">
          <p className="text-state-warning text-sm">
            La génération est terminée, mais le récit n&apos;est pas encore
            disponible.
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={flow.refreshArtifact}
              disabled={narrativeQuery.isFetching}
            >
              Vérifier à nouveau
            </Button>
          </div>
        </div>
      ) : !flow.jobActive && (
        <div className="flex flex-col gap-2">
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
              disabled={generate.isPending}
              className={generate.isPending ? "animate-pulse" : undefined}
            >
              {generate.isPending
                ? "Lancement…"
                : flow.jobFailed
                  ? "Réessayer"
                  : "Générer le Récit"}
            </Button>
          </div>
        </div>
      )}
    </NarrativeShell>
  );
}
