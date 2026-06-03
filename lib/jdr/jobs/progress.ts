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
 * Progression de transcription (Story 3.4). **Adaptateur** : si le backend
 * expose un jour `job.progress`, il prime ; sinon estimation frontend dérivée
 * de la durée audio et du temps écoulé depuis `started_at`.
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

  // Adaptateur : vrai % backend prioritaire (champ futur, absent de JobOut V1).
  const backendProgress = (job as { progress?: number }).progress;
  if (typeof backendProgress === "number") {
    return clamp(Math.round(backendProgress), 0, 100);
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
