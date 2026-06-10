"use client";

import { isArtifactAbsentError } from "@/lib/jdr/sessions/artifacts";
import {
  useSessionChunks,
  useSessionTranscription,
  type TranscriptionSegmentOut,
} from "@/lib/jdr/sessions/transcription";
import type { components } from "@/types/api";

type TranscriptionMode = components["schemas"]["TranscriptionMode"];

interface TranscriptionViewerProps {
  sessionId: string;
  transcriptionMode: TranscriptionMode;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function ViewerShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASSES} aria-label={ariaLabel}>
      <h2 className="font-display mb-3 text-xl font-semibold">Transcription</h2>
      {children}
    </section>
  );
}

interface SpeakerGroup {
  speakerLabel: string;
  text: string;
}

/** Merge consecutive segments sharing the same raw speaker label into one turn. */
function groupSegments(segments: TranscriptionSegmentOut[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  for (const segment of segments) {
    const last = groups[groups.length - 1];
    if (last && last.speakerLabel === segment.speaker_label) {
      last.text = `${last.text} ${segment.text}`.trim();
    } else {
      groups.push({ speakerLabel: segment.speaker_label, text: segment.text });
    }
  }
  return groups;
}

/**
 * Story 4.13 — read-only viewer of a finished transcription, mounted in the
 * session page's Transcription tab once `state === "transcribed"`. Branches on
 * `transcription_mode`: non_diarised stitches `GET /chunks` into prose (sorted by
 * `ordre`); diarised renders `GET /transcription` segments with their raw speaker
 * labels. The non-matching query stays disabled so only one endpoint is ever hit
 * (no `409 wrong-mode`). Plain-text rendering on purpose — long-form Markdown
 * typography is owned by Story 5.1.
 */
export function TranscriptionViewer({
  sessionId,
  transcriptionMode,
}: TranscriptionViewerProps) {
  const isNonDiarised = transcriptionMode === "non_diarised";
  const chunksQuery = useSessionChunks(sessionId, { enabled: isNonDiarised });
  const transcriptionQuery = useSessionTranscription(sessionId, {
    enabled: !isNonDiarised,
  });
  const query = isNonDiarised ? chunksQuery : transcriptionQuery;

  if (query.isPending) {
    return (
      <ViewerShell ariaLabel="Chargement de la transcription">
        <p className="text-text-chrome-muted text-sm">
          Chargement de la transcription…
        </p>
      </ViewerShell>
    );
  }

  if (query.isError) {
    const absent = isArtifactAbsentError(query.error);
    return (
      <ViewerShell
        ariaLabel={
          absent
            ? "Transcription indisponible"
            : "Erreur de chargement de la transcription"
        }
      >
        <p
          className={
            absent
              ? "text-text-chrome-muted text-sm"
              : "text-state-error text-sm"
          }
        >
          {absent
            ? "La transcription n'est pas encore disponible."
            : "Impossible de charger la transcription. Réessaie plus tard."}
        </p>
      </ViewerShell>
    );
  }

  if (isNonDiarised) {
    const items = [...(chunksQuery.data?.items ?? [])].sort(
      (a, b) => a.ordre - b.ordre,
    );
    if (items.length === 0) {
      return (
        <ViewerShell ariaLabel="Transcription de la séance">
          <p className="text-text-chrome-muted text-sm">Transcription vide.</p>
        </ViewerShell>
      );
    }
    return (
      <ViewerShell ariaLabel="Transcription de la séance">
        <div className="text-text-chrome flex flex-col gap-4 leading-relaxed">
          {items.map((chunk) => (
            <p key={chunk.chunk_id} className="whitespace-pre-wrap">
              {chunk.text}
            </p>
          ))}
        </div>
      </ViewerShell>
    );
  }

  const groups = groupSegments(transcriptionQuery.data?.segments ?? []);
  if (groups.length === 0) {
    return (
      <ViewerShell ariaLabel="Transcription de la séance">
        <p className="text-text-chrome-muted text-sm">Transcription vide.</p>
      </ViewerShell>
    );
  }
  return (
    <ViewerShell ariaLabel="Transcription de la séance">
      <div className="flex flex-col gap-4">
        {groups.map((group, index) => (
          <div
            key={`${group.speakerLabel}-${index}`}
            className="flex flex-col gap-1"
          >
            <strong className="text-accent-gold text-sm font-semibold">
              {group.speakerLabel}
            </strong>
            <p className="text-text-chrome whitespace-pre-wrap leading-relaxed">
              {group.text}
            </p>
          </div>
        ))}
      </div>
    </ViewerShell>
  );
}
