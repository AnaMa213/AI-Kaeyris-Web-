"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/lib/core/env";
import { jobQueryKey, type JobOut } from "@/lib/jdr/jobs/queries";

/**
 * Story 4.19 — chemin du flux SSE BD-14 (`text/event-stream`). Générique tous
 * kinds de jobs (transcription ET artefacts). Construit relativement ; l'URL
 * absolue est préfixée par `NEXT_PUBLIC_API_BASE_URL` au moment de l'ouverture.
 */
export function jobEventsPath(jobId: string): string {
  return `/services/jdr/jobs/${jobId}/events`;
}

const TERMINAL_STATUSES: JobOut["status"][] = ["succeeded", "failed"];
const JOB_STATUSES: JobOut["status"][] = [
  "queued",
  "running",
  "succeeded",
  "failed",
];

/**
 * Payload d'une frame `event: progress` (BD-14) = projection publique de
 * `JobOut`, identique à `GET /jobs/{id}` mais PARTIELLE (pas d'`id`/`kind`/
 * `queued_at`…). On la fusionne sur le job déjà en cache, jamais on ne remplace.
 */
type JobEventPayload = Partial<JobOut> & Pick<JobOut, "status">;

function isJobEventPayload(value: unknown): value is JobEventPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const status = (value as { status?: unknown }).status;
  return (
    typeof status === "string" &&
    JOB_STATUSES.includes(status as JobOut["status"])
  );
}

interface UseJobEventStreamOptions {
  /** Active le flux SSE (par défaut inerte). Aligné sur `useJob({ live })`. */
  enabled?: boolean;
}

/**
 * Story 4.19 — consomme le flux SSE BD-14 d'un job et alimente le cache partagé
 * `jobQueryKey(jobId)`. Tous les consommateurs (`useJob`, `useArtifactJobFlow`,
 * `<JobStateBadge>`) reflètent le statut poussé sans câblage supplémentaire.
 *
 * Dégradation : si `EventSource` est indisponible (SSR/jsdom/navigateur ancien)
 * ou si le flux tombe en erreur, le hook reste passif (`connected:false`) et le
 * polling de `useJob` reprend la main — le canal SSE n'est qu'un transport, la
 * vérité de complétion reste `Job.status`.
 */
export function useJobEventStream(
  jobId: string | null,
  { enabled = false }: UseJobEventStreamOptions = {},
) {
  const queryClient = useQueryClient();

  // Identité effective du flux : null = pas de SSE (désactivé / pas de job).
  const streamKey = enabled && jobId !== null ? jobId : null;
  // `supported` est dérivé (pas d'état) : l'environnement permet-il le SSE ?
  const supported = streamKey !== null && typeof EventSource !== "undefined";

  const [connected, setConnected] = useState(false);
  const [trackedKey, setTrackedKey] = useState<string | null>(streamKey);

  // Reset à la volée quand le flux change (pattern React « ajuster l'état pendant
  // le render ») : évite qu'un `connected` périmé suspende le polling d'un autre
  // job avant que son propre flux ne s'ouvre. Pas de setState dans l'effet.
  if (streamKey !== trackedKey) {
    setTrackedKey(streamKey);
    if (connected) setConnected(false);
  }

  useEffect(() => {
    if (streamKey === null || typeof EventSource === "undefined") {
      return;
    }

    const url = `${env.NEXT_PUBLIC_API_BASE_URL}${jobEventsPath(streamKey)}`;
    // `withCredentials` : l'app est en auth cookie ; EventSource ne pose pas de
    // header mais embarque le cookie de session quand on l'active.
    const source = new EventSource(url, { withCredentials: true });

    const handleProgress = (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        source.close();
        setConnected(false);
        return;
      }
      if (!isJobEventPayload(parsed)) {
        source.close();
        setConnected(false);
        return;
      }
      const payload = parsed;
      // Fusion (jamais remplacement) : la projection omet id/kind/queued_at,
      // fournis par le GET initial de `useJob`.
      queryClient.setQueryData<JobOut>(
        jobQueryKey(streamKey),
        (previous) => ({ ...(previous ?? {}), ...payload }) as JobOut,
      );
      if (TERMINAL_STATUSES.includes(payload.status)) {
        // Le serveur ferme le flux après la frame terminale ; on ferme aussi côté
        // client, sinon le navigateur tente de se reconnecter à un job terminé.
        source.close();
        setConnected(false);
      }
    };

    source.onopen = () => setConnected(true);
    source.addEventListener("progress", handleProgress as EventListener);
    source.onerror = () => {
      // Erreur de flux (proxy, CORS, coupure) → on bascule sur le polling. On ne
      // rouvre pas le SSE (l'effet ne re-tourne pas tant que streamKey est stable),
      // ce qui évite tout flap de reconnexion.
      source.close();
      setConnected(false);
    };

    return () => {
      source.removeEventListener("progress", handleProgress as EventListener);
      source.close();
    };
  }, [streamKey, queryClient]);

  return { supported, connected };
}
