"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import type { components } from "@/types/api";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  elementsArtifactQueryKey,
  isArtifactAbsentError,
  useElementsArtifact,
  useGenerateElements,
} from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { ArtifactExportButton } from "@/components/jdr/sessions/ArtifactExportButton";

type Element = components["schemas"]["Element"];

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

// Ordre d'affichage fixe des 4 catégories (contrat : listes toujours présentes).
const ELEMENT_GROUPS: Array<{
  title: string;
  field: "npcs" | "locations" | "items" | "clues";
}> = [
  { title: "PNJ", field: "npcs" },
  { title: "Lieux", field: "locations" },
  { title: "Objets", field: "items" },
  { title: "Indices", field: "clues" },
];

function ElementGroup({ title, items }: { title: string; items?: Element[] }) {
  return (
    <div>
      <h3 className="font-display text-text-chrome mb-1 text-sm font-semibold">
        {title}
      </h3>
      {items && items.length > 0 ? (
        <ul className="text-text-chrome list-disc space-y-1 pl-5 text-sm">
          {items.map((el, index) => (
            <li key={`${el.name}-${index}`}>
              <span className="font-medium">{el.name}</span>
              {el.description ? (
                <span className="text-text-chrome-muted"> — {el.description}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-chrome-muted text-sm italic">Aucun</p>
      )}
    </div>
  );
}

/**
 * Story 4.4 — génère et affiche les Éléments structurés (PNJ / Lieux / Objets /
 * Indices) d'une séance. Les quatre listes sont toujours présentes côté contrat
 * (`[]` si vides) ; une liste vide est rendue « Aucun » plutôt qu'omise.
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
  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: Boolean(elements),
    keyFactory: elementsArtifactQueryKey,
    artifactVersion: elements?.generated_at,
    artifactNoun: "des éléments",
  });

  const handleGenerate = () => {
    if (generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: () =>
        toast.error("Impossible de lancer la génération des éléments."),
    });
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
        <h2 className="font-display mb-3 text-xl font-semibold">Éléments</h2>
        <div className="space-y-4">
          {ELEMENT_GROUPS.map((group) => (
            <ElementGroup
              key={group.field}
              title={group.title}
              items={elements[group.field]}
            />
          ))}
        </div>
        <p className="text-text-chrome-muted mt-4 text-xs">
          Généré le {generatedAt.toLocaleString("fr-FR")} · {elements.model_used}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ArtifactExportButton
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            kind="elements"
          />
        </div>
        <ArtifactRegenerateControls
          artifactLabel="les Éléments"
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
