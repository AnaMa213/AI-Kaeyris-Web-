"use client";

import { Button } from "@/components/ui/button";

interface StuckTranscriptionCardProps {
  /** Re-check the job status (in case the 404 was a transient lookup error). */
  onRetry: () => void;
  /** Unblock the session via the recover endpoint (→ transcription_failed). */
  onRecover: () => void;
  /** Vrai pendant l'appel de déblocage. */
  recovering?: boolean;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

/**
 * Story 4.23 (AC10) — a session wedged in `transcribing` whose RQ job has
 * vanished (worker crashed mid-run) is no longer presented as "still processing
 * forever". This card gives the GM an honest message plus two affordances:
 *
 * - "Réessayer" re-checks the job status (the 404 may have been transient);
 * - "Débloquer la séance" calls `POST /transcription/recover`, which moves the
 *   session to `transcription_failed` so the audio can be replaced or the
 *   session deleted (the backend verifies the job is truly dead first).
 */
export function StuckTranscriptionCard({
  onRetry,
  onRecover,
  recovering = false,
}: StuckTranscriptionCardProps) {
  return (
    <section
      className={SECTION_CARD_CLASSES}
      aria-label="Transcription interrompue"
      data-ritual-state="interrupted"
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="h-20 w-20" aria-hidden="true">
          <svg
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="text-text-chrome-muted h-full w-full opacity-70 saturate-50"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <rect x="28" y="22" width="44" height="56" rx="3" strokeWidth="2.5" />
            <path d="M50 22 V78" strokeWidth="1" opacity="0.4" />
            <path d="M40 44 L60 56 M60 44 L40 56" strokeWidth="2" opacity="0.7" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-1">
          <h2 className="font-display text-text-chrome text-xl">
            Transcription interrompue
          </h2>
          <p className="text-text-chrome-muted max-w-md text-sm">
            La transcription a été interrompue de façon inattendue. Réessaie une
            nouvelle transcription, ou contacte le support si le problème
            persiste.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="ghost" onClick={onRetry}>
            Réessayer
          </Button>
          <Button
            type="button"
            onClick={onRecover}
            disabled={recovering}
            className={recovering ? "animate-pulse" : undefined}
          >
            {recovering ? "Déblocage…" : "Débloquer la séance"}
          </Button>
        </div>
      </div>
    </section>
  );
}
