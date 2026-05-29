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
import type { UserOut } from "@/lib/users/queries";

interface UserDeactivateConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserOut | null;
  onConfirm: (userId: string) => void;
  submitting: boolean;
  errorMessage?: string | null;
}

// The inner component holds the controlled Input state. It only mounts while
// the Dialog is open, so the state is fresh on every (re-)open without a
// useEffect setState dance. Avoids the React 19 "no setState in effect" lint.
function DeactivateConfirmContent({
  user,
  onCancel,
  onConfirm,
  submitting,
  errorMessage,
}: {
  user: UserOut;
  onCancel: () => void;
  onConfirm: (userId: string) => void;
  submitting: boolean;
  errorMessage?: string | null;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed === user.username;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Désactiver {user.username} ?</DialogTitle>
        <DialogDescription>
          Cet utilisateur ne pourra plus se connecter. La désactivation peut
          être annulée plus tard en modifiant le compte.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="deactivate-confirm">
          Tape <span className="font-mono">{user.username}</span> pour
          confirmer
        </Label>
        <Input
          id="deactivate-confirm"
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
          variant="destructive"
          disabled={!matches || submitting}
          onClick={() => onConfirm(user.id)}
        >
          {submitting ? "Désactivation..." : "Désactiver le compte"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function UserDeactivateConfirm({
  open,
  onOpenChange,
  user,
  onConfirm,
  submitting,
  errorMessage,
}: UserDeactivateConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && user && (
          <DeactivateConfirmContent
            user={user}
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
