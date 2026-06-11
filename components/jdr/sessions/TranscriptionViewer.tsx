"use client";

import { useState } from "react";
import { Download, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/core/api/errors";
import { downloadTextFile } from "@/lib/core/browser/downloadTextFile";
import { isArtifactAbsentError } from "@/lib/jdr/sessions/artifacts";
import {
  useDownloadTranscriptionMarkdown,
  useSessionTranscriptionMarkdown,
  useUpdateTranscriptionMarkdown,
} from "@/lib/jdr/sessions/transcription";
import type { components } from "@/types/api";

type TranscriptionMode = components["schemas"]["TranscriptionMode"];

interface TranscriptionViewerProps {
  sessionId: string;
  transcriptionMode: TranscriptionMode;
  sessionTitle: string;
  canEdit?: boolean;
  editingBlocked?: boolean;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function ViewerShell({
  ariaLabel,
  action,
  children,
}: {
  ariaLabel: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASSES} aria-label={ariaLabel}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Transcription</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Build a filesystem-friendly `.md` filename from the session title. */
function transcriptionFileName(sessionTitle: string): string {
  const slug = sessionTitle
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `transcription-${slug}.md` : "transcription.md";
}

function DownloadTranscriptionButton({
  sessionId,
  sessionTitle,
}: {
  sessionId: string;
  sessionTitle: string;
}) {
  const download = useDownloadTranscriptionMarkdown(sessionId);

  function handleDownload() {
    if (download.isPending) return;
    download.mutate(undefined, {
      onSuccess: (markdown) => {
        downloadTextFile(transcriptionFileName(sessionTitle), markdown);
      },
      onError: () => {
        toast.error("Impossible de télécharger la transcription.");
      },
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={download.isPending}
    >
      <Download />
      {download.isPending ? "Téléchargement…" : "Télécharger (.md)"}
    </Button>
  );
}

function formatEditError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.problem.status === 404) {
      return "Cette session est introuvable. Recharge la page.";
    }
    if (error.problem.status === 409) {
      return "La transcription n'est pas encore disponible.";
    }
  }
  return "Sauvegarde impossible. Réessaie.";
}

/**
 * Story 4.17 - viewer/editor of the canonical Markdown transcription. BD-13
 * makes `GET /transcription.md` return the edited override when it exists, so
 * this single source covers both transcription modes without structured edits.
 * Plain-text Markdown rendering remains intentional until Epic 5 owns long-form
 * typography.
 */
export function TranscriptionViewer({
  sessionId,
  sessionTitle,
  canEdit = false,
  editingBlocked = false,
}: TranscriptionViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const markdownQuery = useSessionTranscriptionMarkdown(sessionId, {
    enabled: true,
  });
  const updateTranscription = useUpdateTranscriptionMarkdown(sessionId);
  const renderedMarkdown =
    updateTranscription.data?.content_md ?? markdownQuery.data ?? "";

  if (markdownQuery.isPending) {
    return (
      <ViewerShell ariaLabel="Chargement de la transcription">
        <p className="text-text-chrome-muted text-sm">
          Chargement de la transcription…
        </p>
      </ViewerShell>
    );
  }

  if (markdownQuery.isError) {
    const absent = isArtifactAbsentError(markdownQuery.error);
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

  if (renderedMarkdown.trim() === "") {
    return (
      <ViewerShell ariaLabel="Transcription de la séance">
        <p className="text-text-chrome-muted text-sm">Transcription vide.</p>
      </ViewerShell>
    );
  }

  function startEditing() {
    if (editingBlocked) return;
    setDraft(renderedMarkdown);
    setFormError(null);
    updateTranscription.reset();
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraft(renderedMarkdown);
    setFormError(null);
    updateTranscription.reset();
    setIsEditing(false);
  }

  function saveEditing() {
    if (editingBlocked) {
      setFormError("Transcription en cours — modification bloquée.");
      return;
    }
    if (draft.trim() === "") {
      setFormError("La transcription ne peut pas être vide.");
      return;
    }
    setFormError(null);
    updateTranscription.mutate(
      { content_md: draft },
      {
        onSuccess: (data) => {
          setDraft(data.content_md);
          setIsEditing(false);
        },
        onError: (error) => {
          setFormError(formatEditError(error));
        },
      },
    );
  }

  const action = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={startEditing}
          disabled={editingBlocked}
          title={
            editingBlocked
              ? "Transcription en cours — modification bloquée."
              : undefined
          }
        >
          <Pencil />
          Modifier
        </Button>
      )}
      <DownloadTranscriptionButton
        sessionId={sessionId}
        sessionTitle={sessionTitle}
      />
    </div>
  );

  return (
    <ViewerShell ariaLabel="Transcription de la séance" action={action}>
      {isEditing ? (
        <div className="flex flex-col gap-3">
          <label
            htmlFor={`transcription-editor-${sessionId}`}
            className="text-text-chrome text-sm font-medium"
          >
            Transcription Markdown
          </label>
          <Textarea
            id={`transcription-editor-${sessionId}`}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (formError) setFormError(null);
            }}
            aria-invalid={Boolean(formError)}
            className="text-text-chrome min-h-72 font-mono text-sm leading-relaxed"
            disabled={updateTranscription.isPending}
          />
          {formError && (
            <p className="text-state-error text-sm" role="alert">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEditing}
              disabled={updateTranscription.isPending}
            >
              <X />
              Annuler
            </Button>
            <Button
              type="button"
              onClick={saveEditing}
              disabled={updateTranscription.isPending || editingBlocked}
            >
              <Save />
              {updateTranscription.isPending
                ? "Enregistrement…"
                : "Enregistrer"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-text-chrome whitespace-pre-wrap leading-relaxed">
          {renderedMarkdown}
        </div>
      )}
    </ViewerShell>
  );
}
