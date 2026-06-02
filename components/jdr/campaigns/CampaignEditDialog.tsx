"use client";

import { useRef, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/core/api/errors";
import {
  campaignUpdateSchema,
  type CampaignUpdateInput,
} from "@/lib/jdr/schemas/campaigns";
import {
  useUpdateCampaign,
  type CampaignOut,
  type UpdateCampaignInput,
} from "@/lib/jdr/campaigns/queries";

interface CampaignEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignOut;
}

interface CampaignEditFormInnerProps {
  campaign: CampaignOut;
  onClose: () => void;
}

function formatEditError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.problem.status === 403) {
      return "Tu n'as pas les permissions pour modifier cette campagne.";
    }
    return "Modification impossible. Vérifie les informations saisies.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

function CampaignEditFormInner({
  campaign,
  onClose,
}: CampaignEditFormInnerProps) {
  const updateMutation = useUpdateCampaign(campaign.id);
  const updateInFlightRef = useRef(false);

  const form = useForm<CampaignUpdateInput>({
    resolver: zodResolver(campaignUpdateSchema),
    defaultValues: {
      name: campaign.name,
      description: campaign.description ?? "",
    },
  });

  const nameError = form.formState.errors.name?.message;
  const descriptionError = form.formState.errors.description?.message;
  const submitting = updateMutation.isPending;
  const errorMessage = formatEditError(updateMutation.error);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting) {
      event.preventDefault();
      return;
    }
    void form.handleSubmit((values) => {
      if (updateInFlightRef.current) return;
      const payload: UpdateCampaignInput = {};
      const currentName = campaign.name.trim();
      if (values.name !== currentName) payload.name = values.name;
      const currentDescription = (campaign.description ?? "").trim();
      const nextDescription = values.description ?? "";
      if (nextDescription !== currentDescription) {
        payload.description = nextDescription;
      }
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      updateInFlightRef.current = true;
      updateMutation.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
        onSettled: () => {
          updateInFlightRef.current = false;
        },
      });
    })(event);
  };

  return (
    <form
      noValidate
      onSubmit={handleFormSubmit}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-edit-name">Nom</Label>
        <Input
          id="campaign-edit-name"
          type="text"
          autoComplete="off"
          autoFocus
          disabled={submitting}
          aria-invalid={Boolean(nameError) || undefined}
          aria-describedby={
            nameError ? "campaign-edit-name-error" : undefined
          }
          {...form.register("name")}
        />
        {nameError && (
          <p
            id="campaign-edit-name-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-edit-description">
          Description (optionnel)
        </Label>
        <Textarea
          id="campaign-edit-description"
          rows={4}
          maxLength={4000}
          disabled={submitting}
          placeholder="Pitch ou résumé court de la campagne — visible par tous les joueurs."
          aria-invalid={Boolean(descriptionError) || undefined}
          aria-describedby={
            descriptionError
              ? "campaign-edit-description-error"
              : "campaign-edit-description-help"
          }
          {...form.register("description")}
        />
        {descriptionError ? (
          <p
            id="campaign-edit-description-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {descriptionError}
          </p>
        ) : (
          <p
            id="campaign-edit-description-help"
            className="text-text-chrome-muted text-xs"
          >
            Pitch ou résumé court de la campagne — visible par tous les joueurs.
          </p>
        )}
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
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className={submitting ? "animate-pulse" : undefined}
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CampaignEditDialog({
  open,
  onOpenChange,
  campaign,
}: CampaignEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la campagne</DialogTitle>
          <DialogDescription>
            Corrige le nom ou ajuste le pitch partagé avec tes joueurs.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <CampaignEditFormInner
            campaign={campaign}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
