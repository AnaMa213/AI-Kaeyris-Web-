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
  sessionUpdateSchema,
  type SessionUpdateInput,
} from "@/lib/jdr/schemas/sessions";
import {
  useUpdateSession,
  type SessionOut,
} from "@/lib/jdr/sessions/queries";

interface SessionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionOut;
  campaignId: string;
}

interface SessionEditFormInnerProps {
  session: SessionOut;
  campaignId: string;
  onClose: () => void;
}

function formatEditError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.problem.status === 403) {
      return "Tu n'as pas les permissions pour modifier cette session.";
    }
    return "Modification impossible. Vérifie les informations saisies.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

function SessionEditFormInner({
  session,
  campaignId,
  onClose,
}: SessionEditFormInnerProps) {
  const updateMutation = useUpdateSession(session.id, campaignId);
  const updateInFlightRef = useRef(false);

  const form = useForm<SessionUpdateInput>({
    resolver: zodResolver(sessionUpdateSchema),
    defaultValues: {
      title: session.title,
      campaign_context: session.campaign_context ?? "",
    },
  });

  const titleError = form.formState.errors.title?.message;
  const campaignContextError = form.formState.errors.campaign_context?.message;
  const submitting = updateMutation.isPending;
  const errorMessage = formatEditError(updateMutation.error);

  // Double-submit safety needs a synchronous guard because React Query's
  // isPending flag only flips after React has had a chance to rerender.
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting) {
      event.preventDefault();
      return;
    }
    void form.handleSubmit((values) => {
      if (updateInFlightRef.current) return;
      updateInFlightRef.current = true;
      updateMutation.mutate(values, {
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
        <Label htmlFor="session-edit-title">Titre</Label>
        <Input
          id="session-edit-title"
          type="text"
          autoComplete="off"
          autoFocus
          disabled={submitting}
          aria-invalid={Boolean(titleError) || undefined}
          aria-describedby={
            titleError ? "session-edit-title-error" : undefined
          }
          {...form.register("title")}
        />
        {titleError && (
          <p
            id="session-edit-title-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {titleError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="session-edit-context">
          Contexte de campagne (optionnel)
        </Label>
        <Textarea
          id="session-edit-context"
          rows={5}
          maxLength={8000}
          disabled={submitting}
          placeholder="Bloc d'orientation narrative — PNJ récurrents, ton, fil narratif."
          aria-invalid={Boolean(campaignContextError) || undefined}
          aria-describedby={
            campaignContextError
              ? "session-edit-context-error"
              : "session-edit-context-help"
          }
          {...form.register("campaign_context")}
        />
        {campaignContextError ? (
          <p
            id="session-edit-context-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {campaignContextError}
          </p>
        ) : (
          <p
            id="session-edit-context-help"
            className="text-text-chrome-muted text-xs"
          >
            Bloc d&apos;orientation narrative envoyé au LLM lors de la
            génération des artefacts.
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

export function SessionEditDialog({
  open,
  onOpenChange,
  session,
  campaignId,
}: SessionEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la session</DialogTitle>
          <DialogDescription>
            Corrige le titre ou ajuste le contexte narratif transmis au LLM.
          </DialogDescription>
        </DialogHeader>

        {/* Inner form is mounted only when open — defaultValues from
            session prop are re-applied on every open without a useEffect. */}
        {open && (
          <SessionEditFormInner
            session={session}
            campaignId={campaignId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
