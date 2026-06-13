import { env } from "@/lib/core/env";

const MOCK_SESSION_AUDIO_SRC = "/mocks/demo-session.m4a";

export function resolveSessionAudioSrc(sessionId: string): string {
  if (env.NEXT_PUBLIC_MOCK_AUDIO) return MOCK_SESSION_AUDIO_SRC;

  return `${env.NEXT_PUBLIC_API_BASE_URL}/services/jdr/sessions/${sessionId}/audio`;
}
