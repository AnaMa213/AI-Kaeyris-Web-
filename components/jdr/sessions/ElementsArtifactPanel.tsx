"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { ApiError } from "@/lib/core/api/errors";
import type { components } from "@/types/api";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  elementsArtifactQueryKey,
  isArtifactAbsentError,
  isArtifactBusyError,
  isArtifactEditedError,
  isElementsEmptyClearUnconfirmedError,
  useElementsArtifact,
  useGenerateElements,
  usePutElements,
} from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { ArtifactExportButton } from "@/components/jdr/sessions/ArtifactExportButton";
import { ElementsEditor } from "@/components/jdr/sessions/ElementsEditor";
import { ElementsView } from "@/components/jdr/sessions/ElementsView";

type Element = components["schemas"]["Element"];

/** Story 8.3 — message for a failed synchronous elements save (busy vs other). */
function formatSaveError(error: unknown): string {
  if (isArtifactBusyError(error)) {
    return "Une génération est en cours pour cette séance. Réessaie une fois terminée.";
  }
  if (error instanceof ApiError && error.problem.status === 404) {
    return "Cette séance est introuvable. Recharge la page.";
  }
  return "Sauvegarde impossible. Réessaie.";
}

interface ElementsArtifactPanelProps {
  sessionId: string;
  campaignId: string;
  sessionTitle: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function ElementsShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASSES} aria-label={ariaLabel}>
      <h2 className="font-display mb-2 text-xl font-semibold">Éléments</h2>
      {children}
    </section>
  );
}

/**
 * Story 4.4 + 8.1/8.3 (BD-26) — génère et affiche les Éléments structurés d'une
 * séance. Le contrat expose une liste plate `elements[]` de `{category, name,
 * description}` (catégories libres ; la génération IA amorce PNJ/Lieux/Objets/
 * Indices) ; on regroupe par catégorie en préservant l'ordre d'apparition.
 */
export function ElementsArtifactPanel({
  sessionId,
  sessionTitle,
}: ElementsArtifactPanelProps) {
  const elementsQuery = useElementsArtifact(sessionId);
  const generate = useGenerateElements(sessionId);
  const elements = elementsQuery.data;
  const elementsAbsent =
    elementsQuery.isError && isArtifactAbsentError(elementsQuery.error);
  const elementsLoadFailed = elementsQuery.isError && !elementsAbsent;
  const patch = usePutElements(sessionId);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: Boolean(elements),
    keyFactory: elementsArtifactQueryKey,
    artifactVersion: elements?.generated_at,
    artifactNoun: "des éléments",
  });

  const runGenerate = (force: boolean) => {
    generate.mutate(force ? { force: true } : undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: (error) => {
        if (!force && isArtifactEditedError(error)) {
          setForceConfirmOpen(true);
          return;
        }
        toast.error("Impossible de lancer la génération des éléments.");
      },
    });
  };

  const handleGenerate = () => {
    if (generate.isPending) return;
    runGenerate(false);
  };

  const putElements = (next: Element[], confirmEmpty: boolean) => {
    setSaveError(null);
    patch.mutate(
      { elements: next, confirmEmpty },
      {
        onSuccess: () => {
          setEmptyConfirmOpen(false);
          setIsEditing(false);
        },
        onError: (error) => {
          if (isElementsEmptyClearUnconfirmedError(error)) {
            setEmptyConfirmOpen(true);
            return;
          }
          setSaveError(formatSaveError(error));
        },
      },
    );
  };

  const handleSave = (next: Element[]) => {
    if (next.length === 0) {
      setEmptyConfirmOpen(true);
      return;
    }
    putElements(next, false);
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

  if (elementsQuery.isPending) {
    return (
      <ElementsShell ariaLabel="Chargement des éléments">
        <p className="text-text-chrome-muted text-sm">
          Vérification des éléments existants…
        </p>
      </ElementsShell>
    );
  }

  if (elementsLoadFailed) {
    return (
      <ElementsShell ariaLabel="Erreur de chargement des éléments">
        <p className="text-state-error text-sm">
          Impossible de vérifier les éléments existants. Réessaie plus tard.
        </p>
      </ElementsShell>
    );
  }

  if (elements) {
    const generatedAt = parseBackendDate(elements.generated_at);
    return (
      <section
        className={SECTION_CARD_CLASSES}
        aria-label="Éléments de la séance"
      >
        {/* Story 4.23 (AC6) — export + régénérer. Story 8.3 — Modifier. */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Éléments</h2>
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
                kind="elements"
                variant="icon"
              />
              <ArtifactRegenerateControls
                part="trigger"
                artifactLabel="les Éléments"
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
          <ElementsEditor
            initialElements={elements.elements ?? []}
            onSave={handleSave}
            onCancel={cancelEditing}
            saving={patch.isPending}
            saveError={saveError}
          />
        ) : (
          <>
            <ElementsView elements={elements.elements ?? []} />
            <p className="text-text-chrome-muted mt-4 text-xs">
              Généré le {generatedAt.toLocaleString("fr-FR")} ·{" "}
              {elements.model_used}
              {elements.is_edited ? " · modifié par le MJ" : ""}
            </p>
            <ArtifactRegenerateControls
              part="status"
              artifactLabel="les Éléments"
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
          title="Régénérer les Éléments ?"
          description="Cette fiche a été modifiée manuellement. La régénérer remplacera vos modifications."
          confirmLabel="Régénérer"
          pendingLabel="Régénération…"
          submitting={generate.isPending}
          onConfirm={() => {
            setForceConfirmOpen(false);
            runGenerate(true);
          }}
        />

        <ConfirmDialog
          open={emptyConfirmOpen}
          onOpenChange={setEmptyConfirmOpen}
          title="Vider la fiche d'éléments ?"
          description="Aucun élément ne sera conservé pour cette séance."
          confirmLabel="Vider"
          pendingLabel="Suppression…"
          submitting={patch.isPending}
          onConfirm={() => putElements([], true)}
        />
      </section>
    );
  }

  return (
    <ElementsShell ariaLabel="Génération des éléments">
      <p className="text-text-chrome-muted mb-4 text-sm">
        Génère la fiche d&apos;éléments (PNJ, lieux, objets, indices) à partir du
        résumé.
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
              Les éléments sont en cours de génération…
            </span>
          )}
        </div>
      )}

      {flow.artifactUnavailable ? (
        <div className="flex flex-col gap-2">
          <p className="text-state-warning text-sm">
            La génération est terminée, mais les éléments ne sont pas encore
            disponibles.
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={flow.refreshArtifact}
              disabled={elementsQuery.isFetching}
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
                  : "Générer les Éléments"}
            </Button>
          </div>
        </div>
      )}
    </ElementsShell>
  );
}
