"use client";

import { useState } from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  Minus,
  Quote,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  NarrativeArtifact,
  type NarrativeArtifactKind,
} from "@/components/narrative/NarrativeArtifact";

/**
 * Story 8.2 (BD-23 / ADR DP-6) — editor for the text artifacts (Résumé / Récit /
 * POV). Markdown stays the single storage/render/export format: the toolbar only
 * emits Markdown (no arbitrary font size, no HTML), and the live preview uses the
 * production `NarrativeArtifact` renderer so what is edited equals what is read.
 *
 * Presentational: the parent panel owns the read↔edit toggle and the mutation.
 */

export type MarkdownCommand =
  | "bold"
  | "italic"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "quote"
  | "hr";

export interface EditorSelection {
  value: string;
  start: number;
  end: number;
}

const HEADING_PREFIX: Record<"h1" | "h2" | "h3", string> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
};

const PLACEHOLDER = "texte";

/**
 * Pure transform — apply a Markdown command to a `{value, start, end}` selection
 * and return the new value plus where the selection should land. Kept pure so it
 * is trivially unit-testable independent of the DOM.
 */
export function applyMarkdownCommand(
  cmd: MarkdownCommand,
  sel: EditorSelection,
): EditorSelection {
  const { value, start, end } = sel;
  const selected = value.slice(start, end);

  if (cmd === "bold" || cmd === "italic") {
    const marker = cmd === "bold" ? "**" : "*";
    const inner = selected || PLACEHOLDER;
    const replacement = `${marker}${inner}${marker}`;
    const innerStart = start + marker.length;
    return {
      value: value.slice(0, start) + replacement + value.slice(end),
      start: innerStart,
      end: innerStart + inner.length,
    };
  }

  if (cmd === "hr") {
    const block = "\n\n---\n\n";
    const caret = start + block.length;
    return {
      value: value.slice(0, start) + block + value.slice(end),
      start: caret,
      end: caret,
    };
  }

  // Line-prefix commands (headings / list / quote): prepend the marker at the
  // start of the line that contains the caret.
  const prefix =
    cmd === "ul" ? "- " : cmd === "quote" ? "> " : HEADING_PREFIX[cmd];
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  return {
    value: value.slice(0, lineStart) + prefix + value.slice(lineStart),
    start: start + prefix.length,
    end: end + prefix.length,
  };
}

const TOOLBAR: ReadonlyArray<{
  cmd: MarkdownCommand;
  label: string;
  Icon: typeof Bold;
}> = [
  { cmd: "bold", label: "Gras", Icon: Bold },
  { cmd: "italic", label: "Italique", Icon: Italic },
  { cmd: "h1", label: "Titre 1", Icon: Heading1 },
  { cmd: "h2", label: "Titre 2", Icon: Heading2 },
  { cmd: "h3", label: "Titre 3", Icon: Heading3 },
  { cmd: "ul", label: "Liste", Icon: List },
  { cmd: "quote", label: "Citation", Icon: Quote },
  { cmd: "hr", label: "Séparateur", Icon: Minus },
];

interface ArtifactTextEditorProps {
  initialMarkdown: string;
  kind: NarrativeArtifactKind;
  onSave: (text: string) => void;
  onCancel: () => void;
  saving: boolean;
  saveError?: string | null;
  /** Disambiguates the textarea id when several editors mount (e.g. per-PJ POV). */
  idPrefix: string;
}

export function ArtifactTextEditor({
  initialMarkdown,
  kind,
  onSave,
  onCancel,
  saving,
  saveError,
  idPrefix,
}: ArtifactTextEditorProps) {
  const [draft, setDraft] = useState(initialMarkdown);
  const editorId = `${idPrefix}-md-editor`;
  const blank = draft.trim() === "";

  function runCommand(cmd: MarkdownCommand) {
    if (saving) return;
    const el =
      typeof document !== "undefined"
        ? (document.getElementById(editorId) as HTMLTextAreaElement | null)
        : null;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = applyMarkdownCommand(cmd, { value: draft, start, end });
    setDraft(next.value);
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.start, next.end);
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="toolbar"
        aria-label="Mise en forme"
        className="flex flex-wrap gap-1"
      >
        {TOOLBAR.map(({ cmd, label, Icon }) => (
          <Button
            key={cmd}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={label}
            title={label}
            onClick={() => runCommand(cmd)}
            disabled={saving}
          >
            <Icon />
          </Button>
        ))}
      </div>

      <Textarea
        id={editorId}
        aria-label="Éditeur Markdown"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-invalid={Boolean(saveError)}
        className="text-text-chrome min-h-72 font-mono text-sm leading-relaxed"
        disabled={saving}
      />

      {saveError && (
        <p className="text-state-error text-sm" role="alert">
          {saveError}
        </p>
      )}

      <div>
        <p className="text-text-chrome-muted mb-1 text-xs">Aperçu</p>
        <NarrativeArtifact markdown={blank ? "_(vide)_" : draft} kind={kind} />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          <X />
          Annuler
        </Button>
        <Button
          type="button"
          onClick={() => onSave(draft)}
          disabled={saving || blank}
          className={saving ? "animate-pulse" : undefined}
        >
          <Save />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
