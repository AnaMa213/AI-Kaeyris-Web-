"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJob, type JobOut } from "@/lib/jdr/jobs/queries";

/**
 * Story 4.4 — labels du `<JobStateBadge>` pour un job d'artefact dérivé
 * (Récit / Éléments / POVs). Identiques au vocabulaire du Résumé (Story 4.3).
 */
export const ARTIFACT_JOB_LABELS: Record<JobOut["status"], string> = {
  queued: "En file",
  running: "Génération en cours",
  succeeded: "Généré",
  failed: "Échec",
};

const ARTIFACT_SETTLE_REFETCH_LIMIT = 5;
const ARTIFACT_SETTLE_REFETCH_DELAY_MS = 1000;

interface UseArtifactJobFlowOptions {
  sessionId: string;
  /**
   * Présence du contenu déjà relu. Sert à replier l'état « actif » entre
   * `succeeded` et l'arrivée du GET (évite un flash du bouton). Les POVs n'ayant
   * pas de GET-liste en Story 4.4 passent `false` et gèrent `succeeded` à part.
   */
  isPresent: boolean;
  /**
   * Fabrique de clé de requête à invalider à la complétion du job. Doit être une
   * constante module-level (identité stable) pour rester saine en dépendance
   * d'effet. Absente pour les POVs (aucun GET à rafraîchir ici).
   */
  keyFactory?: (sessionId: string) => readonly unknown[];
  /**
   * Version stable du contenu relu (ex. `generated_at`). Sur régénération, elle
   * permet de continuer les invalidations tant que le GET renvoie l'ancien
   * artefact, puis de s'arrêter dès que le remplacement est visible.
   */
  artifactVersion?: unknown;
}

/**
 * Story 4.4 — flux commun « déclenche → suit le job → rafraîchit » partagé par
 * les panneaux d'artefacts dérivés. Encapsule la partie subtile (le `jobActive`
 * qui évite le flash du bouton, et l'invalidation à `succeeded`) tout en laissant
 * chaque panneau appeler sa mutation explicitement via `onJobQueued`.
 */
export function useArtifactJobFlow({
  sessionId,
  isPresent,
  keyFactory,
  artifactVersion,
}: UseArtifactJobFlowOptions) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [settleRefetchAttempt, setSettleRefetchAttempt] = useState(0);
  const [artifactUnavailable, setArtifactUnavailable] = useState(false);
  const [queuedArtifactVersion, setQueuedArtifactVersion] =
    useState<unknown>(null);
  const jobQuery = useJob(jobId, { live: true });
  const job = jobQuery.data;
  const jobLookupFailed = jobQuery.isError;
  const jobFailed = job?.status === "failed" || jobLookupFailed;
  const jobSucceeded = job?.status === "succeeded";
  // Actif = job en vol OU terminé OK mais le contenu n'est pas encore relu.
  // (Premier rendu uniquement : se replie sur `isPresent` pour éviter le flash
  // du bouton entre `succeeded` et l'arrivée du GET.)
  const jobActive = jobId !== null && !jobFailed && !artifactUnavailable && !isPresent;
  // Story 4.5 — job en file/en cours, indépendant de `isPresent`. Sert à la
  // régénération (contenu déjà présent) : pilote le badge + la désactivation du
  // bouton « Régénérer » pendant que le job tourne.
  const jobInFlight = jobId !== null && !jobFailed && !jobSucceeded;
  const artifactSettling =
    jobSucceeded &&
    keyFactory != null &&
    isPresent &&
    queuedArtifactVersion !== null &&
    artifactVersion === queuedArtifactVersion &&
    settleRefetchAttempt <= ARTIFACT_SETTLE_REFETCH_LIMIT;

  const refreshArtifact = useCallback(() => {
    if (!keyFactory) return;
    queryClient.invalidateQueries({ queryKey: keyFactory(sessionId) });
  }, [keyFactory, queryClient, sessionId]);

  const onJobQueued = useCallback(
    (nextJobId: string) => {
      setJobId(nextJobId);
      setSettleRefetchAttempt(0);
      setArtifactUnavailable(false);
      setQueuedArtifactVersion(isPresent ? (artifactVersion ?? null) : null);
    },
    [artifactVersion, isPresent],
  );

  // À la complétion, le contenu peut arriver avec une petite latence backend.
  // On retente quelques invalidations avant de rendre un état non bloquant.
  useEffect(() => {
    if (!jobSucceeded || !keyFactory) return;

    // Story 4.5 — régénération : le contenu est déjà présent. On garde l'ancien
    // contenu affiché, mais on ré-invalide brièvement tant que le GET relit
    // encore la version connue au moment du POST.
    if (isPresent) {
      if (
        queuedArtifactVersion !== null &&
        artifactVersion !== queuedArtifactVersion
      ) {
        return;
      }
      if (settleRefetchAttempt > ARTIFACT_SETTLE_REFETCH_LIMIT) return;

      refreshArtifact();

      const timer = window.setTimeout(() => {
        setSettleRefetchAttempt((attempt) => attempt + 1);
      }, ARTIFACT_SETTLE_REFETCH_DELAY_MS);

      return () => window.clearTimeout(timer);
    }

    if (artifactUnavailable) return;

    refreshArtifact();

    const timer = window.setTimeout(() => {
      setSettleRefetchAttempt((attempt) => {
        if (attempt >= ARTIFACT_SETTLE_REFETCH_LIMIT) {
          setArtifactUnavailable(true);
          return attempt;
        }
        return attempt + 1;
      });
    }, ARTIFACT_SETTLE_REFETCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    artifactUnavailable,
    artifactVersion,
    isPresent,
    jobSucceeded,
    keyFactory,
    queuedArtifactVersion,
    refreshArtifact,
    settleRefetchAttempt,
  ]);

  return {
    jobId,
    job,
    jobFailed,
    jobLookupFailed,
    jobSucceeded,
    jobActive,
    jobInFlight,
    artifactSettling,
    artifactUnavailable,
    refreshArtifact,
    /** À brancher sur le `onSuccess` de la mutation de génération. */
    onJobQueued,
  };
}
