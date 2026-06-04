"use client";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface ReplaceAudioConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Story 3.5 — Destructive confirmation before replacing the session audio.
 * The current audio is permanently deleted before the new POST. No pending
 * state: the dialog closes on confirm and the upload ritual takes over.
 */
export function ReplaceAudioConfirm({
  open,
  onOpenChange,
  onConfirm,
}: ReplaceAudioConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remplacer l'enregistrement ?"
      description="L'audio actuel sera supprimé puis remplacé par le nouveau fichier. Une nouvelle transcription sera lancée. Cette action est irréversible."
      confirmLabel="Remplacer l'enregistrement"
      onConfirm={onConfirm}
      destructive
    />
  );
}
