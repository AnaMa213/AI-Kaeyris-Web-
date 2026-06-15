"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/common/IconButton";
import { downloadTextFile } from "@/lib/core/browser/downloadTextFile";
import {
  artifactMarkdownFileName,
  useDownloadArtifactMarkdown,
  type ArtifactExportKind,
} from "@/lib/jdr/sessions/artifactExport";

const KIND_LABELS: Record<ArtifactExportKind, string> = {
  summary: "le résumé",
  narrative: "le récit",
  elements: "les éléments",
};

interface ArtifactExportButtonProps {
  sessionId: string;
  sessionTitle: string;
  kind: ArtifactExportKind;
  /**
   * Story 4.23 (AC6) — `"icon"` rend un bouton-icône (Download) avec tooltip
   * pour l'en-tête du bloc ; `"text"` (défaut) garde le bouton texte historique.
   */
  variant?: "text" | "icon";
}

/**
 * Story 5.5 — bouton « Exporter .md » d'un artefact (Résumé / Récit / Éléments).
 * Au clic, fetch toujours le `.md` canonique (`GET /artifacts/{kind}.md`) puis
 * sauvegarde via `downloadTextFile`. POV n'est pas géré ici (Story 5.7).
 */
export function ArtifactExportButton({
  sessionId,
  sessionTitle,
  kind,
  variant = "text",
}: ArtifactExportButtonProps) {
  const download = useDownloadArtifactMarkdown(sessionId, kind);

  const handleExport = () => {
    if (download.isPending) return;
    download.mutate(undefined, {
      onSuccess: (markdown) => {
        try {
          downloadTextFile(artifactMarkdownFileName(sessionTitle, kind), markdown);
        } catch {
          toast.error(`Impossible d'exporter ${KIND_LABELS[kind]} en Markdown.`);
        }
      },
      onError: () => {
        toast.error(`Impossible d'exporter ${KIND_LABELS[kind]} en Markdown.`);
      },
    });
  };

  if (variant === "icon") {
    return (
      <IconButton
        label={`Exporter ${KIND_LABELS[kind]} en Markdown`}
        icon={<Download aria-hidden="true" />}
        onClick={handleExport}
        disabled={download.isPending}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={download.isPending}
    >
      <Download />
      {download.isPending ? "Export…" : "Exporter .md"}
    </Button>
  );
}
