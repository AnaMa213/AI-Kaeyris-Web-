import type { CampaignOut } from "@/lib/jdr/campaigns/queries";
import type { components } from "@/types/api";

type SessionState = components["schemas"]["SessionState"];

/**
 * Story 2.8 — Only the gm of a campaign can edit its sessions metadata
 * (title, campaign_context). The backend enforces this with a 403 (BD-7
 * authorization); this helper is a frontend-side defence-in-depth that
 * hides the "Modifier" CTA upstream of any network roundtrip.
 */
export function canEditCampaignSession(
  campaign: Pick<CampaignOut, "role">,
): boolean {
  return campaign.role === "gm";
}

/**
 * Story 3.5 / 7.1 — The "Replace audio" affordance is offered on states where an
 * audio exists and is not actively locked by a running transcription:
 * `audio_uploaded` (job queued, not yet running), `transcription_failed`
 * (recovery), and `transcribed` (Story 7.1 — redo the audio even after a
 * successful transcription, e.g. to recover from a failed artifact). It is
 * hidden on `transcribing` (locked) and on `created` (no prior audio — the plain
 * upload dropzone applies). Gated on raw `session.state`, NOT the FSM `uiState`
 * (which collapses `audio_uploaded` into the `transcribing` act). Compose with
 * `canEditCampaignSession` (gm role) at the call site.
 */
export function canReplaceAudio(state: SessionState): boolean {
  return (
    state === "audio_uploaded" ||
    state === "transcription_failed" ||
    state === "transcribed"
  );
}
