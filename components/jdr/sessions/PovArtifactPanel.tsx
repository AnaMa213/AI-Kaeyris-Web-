"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import { useGeneratePovs } from "@/lib/jdr/sessions/artifacts";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";

interface PovArtifactPanelProps {
  sessionId: string;
  campaignId: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

/**
 * Story 4.4 — déclenche la génération des POVs. UN seul job génère un
 * `pov:<pj_id>` par PJ déclaré. Portée volontairement limitée au déclenchement +
 * confirmation : il n'existe pas de GET-liste, et la lecture par PJ (sous-onglets
 * `GET /artifacts/povs/{pj_id_str}`) est portée par la Story 5.7. On ne peut donc
 * pas auto-détecter « déjà généré » au chargement ici — c'est attendu.
 *
 * En non_diarised, la liste `/players` fait office de mapping : on garde le job
 * derrière une présence ≥1 PJ (le résumé l'avait déjà garantie) et on n'appelle
 * jamais `PUT /mapping` (diarised-only).
 */
export function PovArtifactPanel({ sessionId }: PovArtifactPanelProps) {
  const playersQuery = useSessionPlayers(sessionId);
  const generate = useGeneratePovs(sessionId);
  // Pas de GET-liste en 4.4 → `isPresent: false` ; `succeeded` est géré à part.
  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: false,
    artifactNoun: "des POVs",
  });
  const [regenerationStarted, setRegenerationStarted] = useState(false);

  const playersLoading = playersQuery.isPending;
  const playersFailed = playersQuery.isError;
  const hasPjDeclared = (playersQuery.data?.pj_ids.length ?? 0) > 0;
  const showGeneratedState = flow.jobSucceeded || regenerationStarted;

  const handleGenerate = () => {
    if (generate.isPending) return;
    if (showGeneratedState) {
      setRegenerationStarted(true);
    }
    generate.mutate(undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: () => toast.error("Impossible de lancer la génération des POVs."),
    });
  };

  if (showGeneratedState) {
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="POVs de la séance">
        <h2 className="font-display mb-2 text-xl font-semibold">POVs</h2>
        <p className="text-state-success text-sm">
          POVs générés — la consultation par PJ arrivera prochainement.
        </p>
        {/*
          Story 4.5 — régénération des POVs. Comme il n'existe pas de GET-liste
          (4.4), on ne peut proposer « Régénérer » que dans cet état post-succès
          (POVs générés dans la session courante). Au rechargement, l'état
          antérieur est inconnu → le panneau retombe sur le trigger simple, sans
          confirmation forcée. La consultation par PJ reste la Story 5.7.
        */}
        <ArtifactRegenerateControls
          artifactLabel="les POVs"
          jobId={flow.jobId}
          jobInFlight={flow.jobInFlight}
          jobFailed={flow.jobFailed}
          failureReason={flow.failureReason}
          pending={generate.isPending}
          onConfirm={handleGenerate}
        />
      </section>
    );
  }

  // job en file/en cours (succeeded est traité ci-dessus → ici = queued/running).
  const jobPending = flow.jobId !== null && !flow.jobFailed;

  return (
    <section className={SECTION_CARD_CLASSES} aria-label="Génération des POVs">
      <h2 className="font-display mb-2 text-xl font-semibold">POVs</h2>
      <p className="text-text-chrome-muted mb-4 text-sm">
        Génère un point de vue par PJ présent à partir du résumé.
      </p>

      {flow.jobId && (
        <div className="mb-3 flex items-center gap-3">
          <JobStateBadge
            jobId={flow.jobId}
            labels={ARTIFACT_JOB_LABELS}
            ariaLabelPrefix="État de la génération"
          />
          {jobPending && (
            <span className="text-text-chrome-muted text-sm">
              Les POVs sont en cours de génération…
            </span>
          )}
        </div>
      )}

      {!jobPending && (
        <div className="flex flex-col gap-2">
          {playersLoading && (
            <p className="text-text-chrome-muted text-sm italic">
              Vérification des PJs présents…
            </p>
          )}
          {playersFailed && (
            <p className="text-state-error text-sm">
              Impossible de vérifier les PJs présents. Réessaie plus tard.
            </p>
          )}
          {!playersLoading && !playersFailed && !hasPjDeclared && (
            <p className="text-text-chrome-muted text-sm italic">
              Déclare d&apos;abord les PJs présents pour générer les POVs.
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
              disabled={
                playersLoading ||
                playersFailed ||
                !hasPjDeclared ||
                generate.isPending
              }
              className={generate.isPending ? "animate-pulse" : undefined}
            >
              {generate.isPending
                ? "Lancement…"
                : flow.jobFailed
                  ? "Réessayer"
                  : "Générer les POVs"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
