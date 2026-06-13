"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/core/api/errors";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

interface SessionDeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionOut;
  onConfirm: () => void;
  submitting: boolean;
  error?: unknown;
}

function formatDeleteError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    const status = error.problem.status;
    if (status === 403) {
      return "Tu n'as pas les permissions pour supprimer cette séance.";
    }
    if (status === 409 || status === 422) {
      return "Impossible de supprimer cette séance dans son état actuel.";
    }
    return "Suppression impossible.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

export function SessionDeleteConfirm({
  open,
  onOpenChange,
  session,
  onConfirm,
  submitting,
  error,
}: SessionDeleteConfirmProps) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === session.title;
  const errorMessage = formatDeleteError(error);

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Supprimer ${session.title} ?`}
      description="Cette action est irréversible. La séance sera retirée de la campagne."
      confirmLabel="Supprimer la séance"
      pendingLabel="Suppression..."
      onConfirm={onConfirm}
      submitting={submitting}
      confirmDisabled={!matches}
      destructive
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="session-delete-confirm">
          Tape <span className="font-mono">{session.title}</span> pour confirmer
        </Label>
        <Input
          id="session-delete-confirm"
          type="text"
          autoComplete="off"
          disabled={submitting}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="text-state-error flex flex-col gap-1 text-sm"
        >
          <p>{errorMessage}</p>
        </div>
      )}
    </ConfirmDialog>
  );
}
