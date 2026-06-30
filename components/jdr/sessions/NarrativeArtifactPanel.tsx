"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { ApiError } from "@/lib/core/api/errors";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  isArtifactAbsentError,
  isArtifactBusyError,
  isArtifactEditedError,
  narrativeArtifactQueryKey,
  useGenerateNarrative,
  useNarrativeArtifact,
  usePatchNarrative,
} from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { ArtifactExportButton } from "@/components/jdr/sessions/ArtifactExportButton";
import { ArtifactTextEditor } from "@/components/jdr/sessions/ArtifactTextEditor";
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
 * Story 4.4 — génère et affiche le Récit. Story 8.2 — édition rich-text Markdown
 * (mode lecture ↔ édition) ; régénérer un récit édité passe par une confirmation.
 */
export function NarrativeArtifactPanel({
  sessionId,
  sessionTitle,
}: NarrativeArtifactPanelProps) {
  const narrativeQuery = useNarrativeArtifact(sessionId);
  const generate = useGenerateNarrative(sessionId);
  const patch = usePatchNarrative(sessionId);
  const narrative = narrativeQuery.data;
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
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

  const runGenerate = (force: boolean) => {
    generate.mutate(force ? { force: true } : undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: (error) => {
        if (!force && isArtifactEditedError(error)) {
          setForceConfirmOpen(true);
          return;
        }
        toast.error("Impossible de lancer la génération du récit.");
      },
    });
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Récit</h2>
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
                kind="narrative"
                variant="icon"
              />
              <ArtifactRegenerateControls
                part="trigger"
                artifactLabel="le Récit"
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
            idPrefix={`narrative-${sessionId}`}
            initialMarkdown={narrative.text}
            kind="narrative"
            onSave={handleSave}
            onCancel={cancelEditing}
            saving={patch.isPending}
            saveError={saveError}
          />
        ) : (
          <>
            <NarrativeReader markdown={narrative.text} kind="narrative" />
            <p className="text-text-chrome-muted mt-4 text-xs">
              Généré le {generatedAt.toLocaleString("fr-FR")} ·{" "}
              {narrative.model_used}
              {narrative.is_edited ? " · modifié par le MJ" : ""}
            </p>
            <ArtifactRegenerateControls
              part="status"
              artifactLabel="le Récit"
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
          title="Régénérer le Récit ?"
          description="Ce récit a été modifié manuellement. Le régénérer remplacera vos modifications."
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
      ) : (
        !flow.jobActive && (
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
        )
      )}
    </NarrativeShell>
  );
}
