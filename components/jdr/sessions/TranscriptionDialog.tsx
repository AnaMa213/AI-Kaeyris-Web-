"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadTextFile } from "@/lib/core/browser/downloadTextFile";
import { TranscriptionViewer } from "@/components/jdr/sessions/TranscriptionViewer";
import {
  transcriptionFileName,
  useDownloadTranscriptionJson,
  type TranscriptionMode,
} from "@/lib/jdr/sessions/transcription";

interface TranscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  transcriptionMode: TranscriptionMode;
  sessionTitle: string;
  canEdit?: boolean;
  editingBlocked?: boolean;
}

/**
 * Story 4.21 — the raw transcription is no longer a first-class page surface.
 * It lives behind a header `Download` icon and opens here: `TranscriptionViewer`
 * branches by mode (chunks read-only for non_diarised; Markdown edit/export for
 * diarised) plus a "Télécharger en JSON" action that saves the EXACT API
 * response (`TranscriptionOut` or `ChunkListOut`).
 */
export function TranscriptionDialog({
  open,
  onOpenChange,
  sessionId,
  transcriptionMode,
  sessionTitle,
  canEdit = false,
  editingBlocked = false,
}: TranscriptionDialogProps) {
  const jsonDownload = useDownloadTranscriptionJson(sessionId, transcriptionMode);

  function handleDownloadJson() {
    if (jsonDownload.isPending) return;
    jsonDownload.mutate(undefined, {
      onSuccess: (payload) => {
        try {
          downloadTextFile(
            transcriptionFileName(sessionTitle, "json"),
            JSON.stringify(payload, null, 2),
            "application/json",
          );
        } catch {
          toast.error("Impossible de télécharger la transcription.");
        }
      },
      onError: () => {
        toast.error("Impossible de télécharger la transcription.");
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => onOpenChange(value)}
      dismissOnOutsidePress
    >
      <DialogContent className="sm:max-w-3xl">
        {/* Accessible name + description kept sr-only: the viewer below carries
            the visible "Transcription" heading. The title is intentionally
            distinct from the viewer's `aria-label` to avoid a duplicate
            accessible name. */}
        <DialogTitle className="sr-only">
          Transcription brute de la séance
        </DialogTitle>
        <DialogDescription className="sr-only">
          Transcription brute de la séance : lecture, édition et export JSON.
        </DialogDescription>
        <div className="flex justify-end pr-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadJson}
            disabled={jsonDownload.isPending}
          >
            <Download />
            {jsonDownload.isPending ? "Téléchargement…" : "Télécharger en JSON"}
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          <TranscriptionViewer
            sessionId={sessionId}
            transcriptionMode={transcriptionMode}
            sessionTitle={sessionTitle}
            canEdit={canEdit}
            editingBlocked={editingBlocked}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
