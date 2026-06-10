"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sessionCreateSchema,
  type SessionCreateInput,
  type SessionCreateFormInput,
} from "@/lib/jdr/schemas/sessions";

interface NewSessionFormProps {
  onSubmit: (values: SessionCreateInput) => void;
  onCancel: () => void;
  submitting: boolean;
  errorMessage: string | null;
}

function todayLocalDatetime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  // datetime-local expects "YYYY-MM-DDTHH:mm" without seconds nor TZ.
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function NewSessionForm({
  onSubmit,
  onCancel,
  submitting,
  errorMessage,
}: NewSessionFormProps) {
  // Three-generic form: the raw input type (transcription_mode optional, schema
  // default) feeds the resolver; the parsed output type reaches onSubmit.
  const form = useForm<SessionCreateFormInput, unknown, SessionCreateInput>({
    resolver: zodResolver(sessionCreateSchema),
    defaultValues: {
      title: "",
      recorded_at: todayLocalDatetime(),
      transcription_mode: "non_diarised",
    },
  });

  const titleError = form.formState.errors.title?.message;
  const recordedAtError = form.formState.errors.recorded_at?.message;

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
        <Label htmlFor="session-title">Titre</Label>
        <Input
          id="session-title"
          type="text"
          autoComplete="off"
          autoFocus
          disabled={submitting}
          aria-invalid={Boolean(titleError) || undefined}
          aria-describedby={titleError ? "session-title-error" : undefined}
          {...form.register("title")}
        />
        {titleError && (
          <p
            id="session-title-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {titleError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="session-recorded-at">Date de la séance</Label>
        <Input
          id="session-recorded-at"
          type="datetime-local"
          disabled={submitting}
          aria-invalid={Boolean(recordedAtError) || undefined}
          aria-describedby={
            recordedAtError ? "session-recorded-at-error" : undefined
          }
          {...form.register("recorded_at")}
        />
        {recordedAtError && (
          <p
            id="session-recorded-at-error"
            role="alert"
            className="text-state-error text-sm"
          >
            {recordedAtError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="session-transcription-mode">
          Type de transcription
        </Label>
        <select
          id="session-transcription-mode"
          disabled={submitting}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 dark:bg-input/30 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          {...form.register("transcription_mode")}
        >
          <option value="non_diarised">
            Sans distinction des intervenants
          </option>
          <option value="diarised">Avec distinction des intervenants</option>
        </select>
        <p className="text-text-chrome-muted text-sm">
          Choisis si la transcription doit distinguer qui parle. Non modifiable
          après la création.
        </p>
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
          {submitting ? "Création..." : "Créer la session"}
        </Button>
      </div>
    </form>
  );
}
