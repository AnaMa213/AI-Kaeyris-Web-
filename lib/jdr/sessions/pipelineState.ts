"use client";

import { useMemo } from "react";
import type { components } from "@/types/api";

type SessionState = components["schemas"]["SessionState"];
type JobStatus = components["schemas"]["JobStatus"];

/**
 * FSM UI unifiée du pipeline de transcription (Story 3.3.1).
 *
 * Projette les 5 états backend (`SessionState`) + la phase locale de la card
 * (`CardPhase`) + le statut du job (`JobStatus`, Story 3.4) vers 4 actes UI :
 *
 *   idle → uploading → transcribing → transcribed   (+ branche failed)
 *
 * Le reduce ffmpeg (`reducing`) et la confirmation (`preparing`) sont absorbés
 * dans `uploading` — le tracker ne connaît jamais ffmpeg.
 */
export type PipelineUIState =
  | "idle"
  | "uploading"
  | "transcribing"
  | "transcribed"
  | "failed";

/** Phase locale de `<SessionAudioUploadCard>`. */
export type CardPhase = "idle" | "reducing" | "preparing" | "uploading";

interface DeriveSessionPipelineStateArgs {
  cardPhase: CardPhase;
  sessionState: SessionState;
  /** Statut du job de transcription (présent à partir de Story 3.4). */
  jobStatus?: JobStatus;
}

// Exhaustif : ajouter un SessionState sans le mapper ici = erreur tsc.
const SESSION_STATE_MAP: Record<SessionState, PipelineUIState> = {
  created: "idle",
  audio_uploaded: "transcribing",
  transcribing: "transcribing",
  transcribed: "transcribed",
  transcription_failed: "failed",
};

/**
 * Priorité : `cardPhase` (upload local en vol) > `jobStatus` (signal job
 * précis) > `sessionState` (état persistant backend). Cette priorité garantit
 * la monotonie : une mutation locale ne régresse pas vers `idle` sur un refetch
 * concurrent.
 */
export function deriveSessionPipelineState({
  cardPhase,
  sessionState,
  jobStatus,
}: DeriveSessionPipelineStateArgs): PipelineUIState {
  if (
    cardPhase === "reducing" ||
    cardPhase === "preparing" ||
    cardPhase === "uploading"
  ) {
    return "uploading";
  }
  if (jobStatus === "failed") return "failed";
  if (jobStatus === "succeeded") return "transcribed";
  return SESSION_STATE_MAP[sessionState];
}

export interface SessionPipelineState {
  uiState: PipelineUIState;
  isTerminal: boolean;
}

/** Hook de dérivation pure — aucune requête réseau (le fetch job est Story 3.4). */
export function useSessionPipelineState(
  args: DeriveSessionPipelineStateArgs,
): SessionPipelineState {
  const { cardPhase, sessionState, jobStatus } = args;
  return useMemo(() => {
    const uiState = deriveSessionPipelineState({
      cardPhase,
      sessionState,
      jobStatus,
    });
    return {
      uiState,
      isTerminal: uiState === "transcribed" || uiState === "failed",
    };
  }, [cardPhase, sessionState, jobStatus]);
}
