"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Ghost destructive confirm button styling, shared by all destructive dialogs. */
export const DESTRUCTIVE_CONFIRM_CLASSES =
  "text-state-error hover:text-state-error! hover:bg-state-error/10!";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Optional body between the description and the footer (e.g. a type-to-confirm input). */
  children?: ReactNode;
  confirmLabel: string;
  /** Label shown on the confirm button while `submitting` (defaults to `confirmLabel`). */
  pendingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  submitting?: boolean;
  /** Extra gate on the confirm button (e.g. type-to-confirm not yet matched). */
  confirmDisabled?: boolean;
  destructive?: boolean;
}

/**
 * Shared confirmation dialog (shadcn `<Dialog>`). Body is gated on `open` so any
 * local state passed via `children` resets on reopen. Used by the destructive
 * delete/replace confirms — keeps the chrome, footer, and destructive button
 * styling in one place.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Annuler",
  onConfirm,
  submitting = false,
  confirmDisabled = false,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description != null && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </DialogHeader>

            {children}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onConfirm}
                disabled={confirmDisabled || submitting}
                className={destructive ? DESTRUCTIVE_CONFIRM_CLASSES : undefined}
              >
                {submitting && pendingLabel ? pendingLabel : confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
