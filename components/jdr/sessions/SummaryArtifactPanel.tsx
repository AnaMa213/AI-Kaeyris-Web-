"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { ApiError } from "@/lib/core/api/errors";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  isArtifactBusyError,
  isArtifactEditedError,
  summaryArtifactQueryKey,
  useGenerateSummary,
  usePatchSummary,
  useSummaryArtifact,
} from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { ArtifactExportButton } from "@/components/jdr/sessions/ArtifactExportButton";
import { ArtifactTextEditor } from "@/components/jdr/sessions/ArtifactTextEditor";
import { NarrativeReader } from "@/components/narrative/NarrativeReader";

interface SummaryArtifactPanelProps {
  sessionId: string;
  campaignId: string;
  sessionTitle: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

/** Story 8.2 — message for a failed synchronous edit (busy job vs other). */
function formatSaveError(error: unknown): string {
  if (isArtifactBusyError(error)) {
    return "Une génération est en cours pour cette séance. Réessaie une fois terminée.";
  }
  if (error instanceof ApiError && error.problem.status === 404) {
    return "Cette séance est introuvable. Recharge la page.";
  }
  return "Sauvegarde impossible. Réessaie.";
}

/**
 * Story 4.3 — génère et affiche le Résumé. Story 4.5 — régénération via le flux
 * partagé. Story 8.2 — édition rich-text Markdown (mode lecture ↔ édition) ;
 * la régénération d'un résumé édité passe par une confirmation (force).
 */
export function SummaryArtifactPanel({
  sessionId,
  sessionTitle,
}: SummaryArtifactPanelProps) {
  const summaryQuery = useSummaryArtifact(sessionId);
  const playersQuery = useSessionPlayers(sessionId);
  const generate = useGenerateSummary(sessionId);
  const patch = usePatchSummary(sessionId);
  const summary = summaryQuery.data;
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: Boolean(summary),
    keyFactory: summaryArtifactQueryKey,
    artifactVersion: summary?.generated_at,
    artifactNoun: "du résumé",
  });

  const hasPjDeclared = (playersQuery.data?.pj_ids.length ?? 0) > 0;

  const runGenerate = (force: boolean) => {
    generate.mutate(
      force ? { force: true } : undefined,
      {
        onSuccess: (queued) => flow.onJobQueued(queued.id),
        onError: (error) => {
          if (!force && isArtifactEditedError(error)) {
            setForceConfirmOpen(true);
            return;
          }
          toast.error("Impossible de lancer la génération du résumé.");
        },
      },
    );
  };

  const handleGenerate = () => {
    if (generate.isPending) return;
    runGenerate(false);
  };

  const handleSave = (text: string) => {
    setSaveError(null);
    patch.mutate(text, {
      onSuccess: () => setIsEditing(false),
      onError: (error) => setSaveError(formatSaveError(error)),
    });
  };

  const startEditing = () => {
    if (flow.jobInFlight) return;
    setSaveError(null);
    patch.reset();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setSaveError(null);
    patch.reset();
    setIsEditing(false);
  };

  if (summary) {
    const generatedAt = parseBackendDate(summary.generated_at);
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="Résumé de la séance">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Résumé</h2>
          {!isEditing && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={startEditing}
                disabled={flow.jobInFlight}
                title={
                  flow.jobInFlight
                    ? "Génération en cours — modification bloquée."
                    : undefined
                }
              >
                <Pencil />
                Modifier
              </Button>
              <ArtifactExportButton
                sessionId={sessionId}
                sessionTitle={sessionTitle}
                kind="summary"
                variant="icon"
              />
              <ArtifactRegenerateControls
                part="trigger"
                artifactLabel="le Résumé"
                jobId={flow.jobId}
                jobInFlight={flow.jobInFlight}
                artifactSettling={flow.artifactSettling}
                jobFailed={flow.jobFailed}
                failureReason={flow.failureReason}
                pending={generate.isPending}
                onConfirm={handleGenerate}
              />
            </div>
          )}
        </div>

        {isEditing ? (
          <ArtifactTextEditor
            idPrefix={`summary-${sessionId}`}
            initialMarkdown={summary.text}
            kind="summary"
            onSave={handleSave}
            onCancel={cancelEditing}
            saving={patch.isPending}
            saveError={saveError}
          />
        ) : (
          <>
            <NarrativeReader markdown={summary.text} kind="summary" />
            <p className="text-text-chrome-muted mt-4 text-xs">
              Généré le {generatedAt.toLocaleString("fr-FR")} ·{" "}
              {summary.model_used}
              {summary.is_edited ? " · modifié par le MJ" : ""}
            </p>
            <ArtifactRegenerateControls
              part="status"
              artifactLabel="le Résumé"
              jobId={flow.jobId}
              jobInFlight={flow.jobInFlight}
              artifactSettling={flow.artifactSettling}
              jobFailed={flow.jobFailed}
              failureReason={flow.failureReason}
              pending={generate.isPending}
              onConfirm={handleGenerate}
            />
          </>
        )}

        <ConfirmDialog
          open={forceConfirmOpen}
          onOpenChange={setForceConfirmOpen}
          title="Régénérer le Résumé ?"
          description="Ce résumé a été modifié manuellement. Le régénérer remplacera vos modifications."
          confirmLabel="Régénérer"
          pendingLabel="Régénération…"
          submitting={generate.isPending}
          onConfirm={() => {
            setForceConfirmOpen(false);
            runGenerate(true);
          }}
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
