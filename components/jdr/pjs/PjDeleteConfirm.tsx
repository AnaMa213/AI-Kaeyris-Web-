"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Inner content mounts only while the Dialog is open AND a PJ is selected,
// so the local "typed" state resets on every reopen without a useEffect
// setState dance (avoids the React 19 "no setState in effect" lint).
function DeleteConfirmContent({
  pj,
  onCancel,
  onConfirm,
  submitting,
  errorMessage,
}: {
  pj: PjOut;
  onCancel: () => void;
  onConfirm: (pjId: string) => void;
  submitting: boolean;
  errorMessage?: string | null;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === pj.name;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Supprimer {pj.name} ?</DialogTitle>
        <DialogDescription>
          La suppression sera annulée au prochain rechargement de la page tant
          que l&apos;endpoint backend BD-3 n&apos;est pas livré.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pj-delete-confirm">
          Tape <span className="font-mono">{pj.name}</span> pour confirmer
        </Label>
        <Input
          id="pj-delete-confirm"
          type="text"
          autoComplete="off"
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

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!matches || submitting}
          onClick={() => onConfirm(pj.id)}
          className="text-state-error hover:text-state-error! hover:bg-state-error/10!"
        >
          {submitting ? "Suppression..." : "Supprimer le PJ"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PjDeleteConfirm({
  open,
  onOpenChange,
  pj,
  onConfirm,
  submitting,
  errorMessage,
}: PjDeleteConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && pj && (
          <DeleteConfirmContent
            pj={pj}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
            submitting={submitting}
            errorMessage={errorMessage}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
