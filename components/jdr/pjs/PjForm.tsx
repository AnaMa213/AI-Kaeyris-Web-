"use client";

import { useEffect } from "react";
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
import { pjCreateSchema, type PjCreateInput } from "@/lib/jdr/schemas/pjs";

interface PjFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PjCreateInput) => void;
  submitting: boolean;
  errorMessage: string | null;
}

const defaultValues = (): PjCreateInput => ({ name: "" });

export function PjForm({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  errorMessage,
}: PjFormProps) {
  const form = useForm<PjCreateInput>({
    resolver: zodResolver(pjCreateSchema),
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues());
  }, [open, form]);

  const nameError = form.formState.errors.name?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau PJ</DialogTitle>
          <DialogDescription>
            Le nom du PJ sera visible dans le grimoire de tes campagnes.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="pj-name">Nom du PJ</Label>
            <Input
              id="pj-name"
              type="text"
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(nameError) || undefined}
              aria-describedby={nameError ? "pj-name-error" : undefined}
              {...form.register("name")}
            />
            {nameError && (
              <p
                id="pj-name-error"
                role="alert"
                className="text-state-error text-sm"
              >
                {nameError}
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
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={submitting ? "animate-pulse" : undefined}
            >
              {submitting ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
