import type { JobOut } from "@/lib/jdr/jobs/queries";

/** Sous-acte visuel rendu DANS l'uiState `transcribing` (Story 3.6). */
export type TranscribingActVariant = "reducing" | "transcribing";

/**
 * Story 3.6 (BD-10) — projette la `phase` backend sur le sous-acte fantasy à
 * afficher pendant l'uiState `transcribing`. Seul `reducing` reçoit l'habillage
 * « préparation du grimoire » ; tout le reste (`transcribing`, `done`, `failed`,
 * `null`/absent → dégradation) garde l'acte des scribes.
 *
 * `phase` est purement décoratif : il ne pilote JAMAIS la FSM (`status` reste la
 * seule source de complétion — cf. `pipelineState.ts`).
 */
export function phaseToTranscribingAct(
  phase: JobOut["phase"] | undefined,
): TranscribingActVariant {
  return phase === "reducing" ? "reducing" : "transcribing";
}
