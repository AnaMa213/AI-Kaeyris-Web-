import type { JobOut } from "@/lib/jdr/jobs/queries";

interface EstimateJobProgressArgs {
  job: JobOut | undefined;
  /** Durée de l'audio (s), depuis `AudioUploadOut.duration_seconds` (nullable). */
  durationSeconds: number | null;
  /** Horloge (`Date.now()`), injectée pour la testabilité. */
  now: number;
  /** Temps de traitement ≈ durée × factor. Réglage perçu (cap 95% de toute façon). */
  factor?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Progression de transcription (Story 3.4 → 3.6). **Adaptateur** : le vrai
 * `progress_percent` exposé par le backend (BD-10) prime ; à défaut (`null` —
 * meta TTL expirée, vieux job, job non-transcription), estimation frontend
 * dérivée de la durée audio et du temps écoulé depuis `started_at`.
 *
 * Retourne `null` quand aucune valeur fiable n'est calculable → le consommateur
 * affiche une barre indéterminée « crédible » (pas de chiffre).
 */
export function estimateJobProgress({
  job,
  durationSeconds,
  now,
  factor = 1,
}: EstimateJobProgressArgs): number | null {
  if (!job) return null;

  // BD-10 (Story 3.6) : le % réel du backend prime sur l'estimation client.
  if (typeof job.progress_percent === "number") {
    return clamp(Math.round(job.progress_percent), 0, 100);
  }

  if (job.status === "succeeded") return 100;
  if (job.status === "failed") return null;
  if (job.status === "queued") return 0;

  // running : estimation, sinon indéterminé.
  if (!durationSeconds || durationSeconds <= 0 || !job.started_at) return null;

  const elapsedSec = (now - new Date(job.started_at).getTime()) / 1000;
  if (elapsedSec <= 0) return 0;

  const estimatedTotalSec = durationSeconds * factor;
  const pct = (elapsedSec / estimatedTotalSec) * 100;
  return clamp(Math.round(pct), 0, 95);
}

/** Repère « high-water » du % affiché, porté par l'appelant (ref), par job. */
export interface DisplayProgressState {
  jobId: string | null;
  value: number;
}

/**
 * Story 3.6 (AC3) — clamp d'affichage **monotone** de la barre :
 * - jamais de régression intra-job (un poll qui retombe — null, estimation
 *   plus basse, hoquet backend — ne fait pas reculer la barre) ;
 * - jamais `100` avant l'état terminal (réservé à `done`/`transcribed`).
 *
 * `state` est réinitialisé au changement de `jobId`. Fonction pure : l'appelant
 * stocke le `floor` retourné dans une ref et réinjecte `value` dans l'UI.
 */
export function resolveDisplayProgress(
  state: DisplayProgressState,
  jobId: string | null,
  computed: number | null,
  isTerminal: boolean,
): { value: number | null; floor: DisplayProgressState } {
  const floor = state.jobId === jobId ? state.value : 0;
  if (isTerminal) {
    // Terminal : on peut atteindre 100 ; le plancher n'a plus à grandir.
    return {
      value: typeof computed === "number" ? computed : 100,
      floor: { jobId, value: floor },
    };
  }
  if (typeof computed === "number") {
    const value = Math.min(99, Math.max(floor, computed));
    return { value, floor: { jobId, value } };
  }
  // Estimation indisponible : on garde le plancher acquis, sinon indéterminé.
  return { value: floor > 0 ? floor : null, floor: { jobId, value: floor } };
}
