"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { pjUpdateSchema, type PjCreateInput } from "@/lib/jdr/schemas/pjs";
import type { PjOut } from "@/lib/jdr/pjs/queries";
import type { UserOut } from "@/lib/jdr/users/queries";

type SubmitPayload =
  | { mode: "create"; values: PjCreateInput }
  | {
      mode: "edit";
      id: string;
      values: { name: string; user_id: string | null };
    };

interface PjFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  pj?: PjOut | null;
  /** Users for the link picker (edit mode). Resolved from GET /users. */
  users?: UserOut[];
  onSubmit: (payload: SubmitPayload) => void;
  submitting: boolean;
  errorMessage: string | null;
}

// Unified form shape — name is always validated; userId only matters in edit
// mode ("" is the unlinked sentinel, mapped to null at submit).
type FormShape = z.infer<typeof pjUpdateSchema>;

const defaultForCreate = (): FormShape => ({ name: "", userId: "" });

const defaultForEdit = (pj: PjOut): FormShape => ({
  name: pj.name,
  userId: pj.user_id ?? "",
});

function unresolvedLinkedUser(pj: PjOut | null | undefined, users: UserOut[]) {
  if (!pj?.user_id) return null;
  return users.some((user) => user.id === pj.user_id) ? null : pj.user_id;
}

export function PjForm({
  open,
  onOpenChange,
  mode = "create",
  pj,
  users = [],
  onSubmit,
  submitting,
  errorMessage,
}: PjFormProps) {
  const isEdit = mode === "edit" && pj != null;

  const form = useForm<FormShape>({
    resolver: zodResolver(pjUpdateSchema),
    defaultValues: isEdit ? defaultForEdit(pj) : defaultForCreate(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(isEdit ? defaultForEdit(pj) : defaultForCreate());
  }, [open, isEdit, pj, form]);

  const nameError = form.formState.errors.name?.message;
  const unresolvedUserId = isEdit ? unresolvedLinkedUser(pj, users) : null;

  const handleSubmit = (values: FormShape) => {
    if (mode === "edit" && pj) {
      onSubmit({
        mode: "edit",
        id: pj.id,
        values: {
          name: values.name,
          user_id: values.userId === "" ? null : values.userId,
        },
      });
      return;
    }
    onSubmit({ mode: "create", values: { name: values.name } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le PJ" : "Nouveau PJ"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Renomme le PJ et associe-le à un compte joueur (ou laisse non lié)."
              : "Le nom du PJ sera visible dans le grimoire de tes campagnes."}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit(handleSubmit)}
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

          {isEdit && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pj-user">Joueur lié</Label>
              <select
                id="pj-user"
                className="border-border-chrome bg-surface-raised rounded-md border px-3 py-2 text-sm"
                {...form.register("userId")}
              >
                <option value="">Aucun (non lié)</option>
                {unresolvedUserId && (
                  <option value={unresolvedUserId}>
                    Joueur lié (non résolu)
                  </option>
                )}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {submitting
                ? isEdit
                  ? "Enregistrement..."
                  : "Création..."
                : isEdit
                  ? "Mettre à jour"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { SubmitPayload as PjFormSubmitPayload };
