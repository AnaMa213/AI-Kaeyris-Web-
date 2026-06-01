"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  campaignCreateSchema,
  type CampaignCreateInput,
} from "@/lib/jdr/schemas/campaigns";

interface CampaignFormProps {
  onSubmit: (values: CampaignCreateInput) => void;
  onCancel: () => void;
  submitting: boolean;
  errorMessage: string | null;
}

const DESCRIPTION_PLACEHOLDER =
  "Une phrase narrative qui pose le ton — « Un royaume autrefois uni se déchire sous le poids d'une vieille trahison. »";

export function CampaignForm({
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
}: CampaignFormProps) {
  const form = useForm<CampaignCreateInput>({
    resolver: zodResolver(campaignCreateSchema),
    defaultValues: { name: "", description: "" },
  });

  const nameError = form.formState.errors.name?.message;
  const descriptionError = form.formState.errors.description?.message;

  return (
    <form
      noValidate
      onSubmit={
        submitting
          ? (event) => event.preventDefault()
          : form.handleSubmit(onSubmit)
      }
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-name">Nom</Label>
        <Input
          id="campaign-name"
          type="text"
          autoComplete="off"
          autoFocus
          disabled={submitting}
          aria-invalid={Boolean(nameError) || undefined}
          aria-describedby={nameError ? "campaign-name-error" : undefined}
          {...form.register("name")}
        />
        {nameError && (
          <p
            id="campaign-name-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-description">Description (optionnelle)</Label>
        <Textarea
          id="campaign-description"
          rows={5}
          maxLength={4000}
          disabled={submitting}
          placeholder={DESCRIPTION_PLACEHOLDER}
          aria-invalid={Boolean(descriptionError) || undefined}
          aria-describedby={
            descriptionError ? "campaign-description-error" : undefined
          }
          {...form.register("description")}
        />
        {descriptionError && (
          <p
            id="campaign-description-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {descriptionError}
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

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className={submitting ? "animate-pulse" : undefined}
        >
          {submitting ? "Création..." : "Créer la campagne"}
        </Button>
      </div>
    </form>
  );
}
