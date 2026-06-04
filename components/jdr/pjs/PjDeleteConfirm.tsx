"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PjOut } from "@/lib/jdr/pjs/queries";

interface PjDeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pj: PjOut | null;
  onConfirm: (pjId: string) => void;
  submitting: boolean;
  errorMessage?: string | null;
}

export function PjDeleteConfirm({
  open,
  onOpenChange,
  pj,
  onConfirm,
  submitting,
  errorMessage,
}: PjDeleteConfirmProps) {
  const [typed, setTyped] = useState("");
  const matches = pj != null && typed.trim() === pj.name;

  // Reset the typed name on close so a reopen starts blank (no setState-in-effect).
  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  return (
    <ConfirmDialog
      open={open && pj != null}
      onOpenChange={handleOpenChange}
      title={pj ? `Supprimer ${pj.name} ?` : ""}
      description="La suppression sera annulée au prochain rechargement de la page tant que l'endpoint backend BD-3 n'est pas livré."
      confirmLabel="Supprimer le PJ"
      pendingLabel="Suppression..."
      onConfirm={() => pj && onConfirm(pj.id)}
      submitting={submitting}
      confirmDisabled={!matches}
      destructive
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="pj-delete-confirm">
          Tape <span className="font-mono">{pj?.name}</span> pour confirmer
        </Label>
        <Input
          id="pj-delete-confirm"
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
