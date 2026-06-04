"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/core/api/errors";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

interface CampaignDeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignOut;
  onConfirm: () => void;
  submitting: boolean;
  error?: unknown;
}

function formatDeleteError(error: unknown, sessionCount: number): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    const status = error.problem.status;
    if (status === 409 || status === 422) {
      const noun = sessionCount <= 1 ? "session" : "sessions";
      return `Impossible : cette campagne contient encore ${sessionCount} ${noun}. Supprime-les d'abord.`;
    }
    if (status === 403) {
      return "Tu n'as pas les permissions pour supprimer cette campagne.";
    }
    return "Suppression impossible.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

export function CampaignDeleteConfirm({
  open,
  onOpenChange,
  campaign,
  onConfirm,
  submitting,
  error,
}: CampaignDeleteConfirmProps) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === campaign.name;
  const errorMessage = formatDeleteError(error, campaign.session_count);

  // Reset the typed name on close so a reopen starts blank (no setState-in-effect).
  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={`Supprimer ${campaign.name} ?`}
      description="Cette action est irréversible. La campagne sera retirée de ta liste."
      confirmLabel="Supprimer la campagne"
      pendingLabel="Suppression..."
      onConfirm={onConfirm}
      submitting={submitting}
      confirmDisabled={!matches}
      destructive
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-delete-confirm">
          Tape <span className="font-mono">{campaign.name}</span> pour confirmer
        </Label>
        <Input
          id="campaign-delete-confirm"
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
