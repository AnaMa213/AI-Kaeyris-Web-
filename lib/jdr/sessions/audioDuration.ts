/**
 * Persistance de la durée audio par session (Story 3.4). Pourquoi : le backend
 * n'expose pas la durée du média ; sans elle, `estimateJobProgress` retombe en
 * indéterminé après un refresh navigateur. `sessionStorage` survit au reload
 * mais s'évapore à la fermeture d'onglet — exactement la portée d'une
 * transcription en cours.
 */

const KEY_PREFIX = "kaeyris:session:";
const KEY_SUFFIX = ":audio-duration";

function key(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}${KEY_SUFFIX}`;
}

export function readAudioDuration(sessionId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key(sessionId));
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function writeAudioDuration(
  sessionId: string,
  duration: number | null,
): void {
  if (typeof window === "undefined") return;
  if (duration === null) {
    window.sessionStorage.removeItem(key(sessionId));
    return;
  }
  window.sessionStorage.setItem(key(sessionId), String(duration));
}
