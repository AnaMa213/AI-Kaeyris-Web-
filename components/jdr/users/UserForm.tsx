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
import type {
  UserCreateInput,
  UserUpdateInput,
} from "@/lib/jdr/schemas/users";
import type { UserOut } from "@/lib/jdr/users/queries";

type SubmitPayload =
  | { mode: "create"; values: UserCreateInput }
  | { mode: "edit"; id: string; values: UserUpdateInput };

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: UserOut;
  onSubmit: (payload: SubmitPayload) => void;
  submitting: boolean;
  errorMessage: string | null;
}

// Unified form shape. Validation that differs between create and edit
// (password required only in create) is applied in handleSubmit below.
const formSchema = z.object({
  username: z
    .string({ message: "Nom d'utilisateur requis." })
    .min(1, "Nom d'utilisateur requis."),
  profile: z.enum(["gm", "user"]),
  password: z.string(),
  status: z.enum(["active", "inactive"]),
});

type FormShape = z.infer<typeof formSchema>;

const defaultForCreate = (): FormShape => ({
  username: "",
  profile: "user",
  password: "",
  status: "active",
});

const defaultForEdit = (user: UserOut): FormShape => ({
  username: user.username,
  profile: user.profile,
  password: "",
  // Backend allows "deleted" but the UI never proposes it from the edit form
  // (deletion has its own dialog). Fall back to "inactive" if the user is
  // already deleted (defensive — should not happen in practice).
  status: user.status === "deleted" ? "inactive" : user.status,
});

export function UserForm({
  open,
  onOpenChange,
  mode,
  user,
  onSubmit,
  submitting,
  errorMessage,
}: UserFormProps) {
  const form = useForm<FormShape>({
    resolver: zodResolver(formSchema),
    defaultValues:
      mode === "create" || !user ? defaultForCreate() : defaultForEdit(user),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "create" || !user ? defaultForCreate() : defaultForEdit(user),
    );
  }, [open, mode, user, form]);

  const usernameError = form.formState.errors.username?.message;
  const profileError = form.formState.errors.profile?.message;
  const passwordError = form.formState.errors.password?.message;

  const handleSubmit = (values: FormShape) => {
    if (mode === "create") {
      // Password required in create mode (the unified schema can't express it).
      if (values.password.length === 0) {
        form.setError("password", {
          type: "manual",
          message: "Mot de passe requis.",
        });
        return;
      }
      onSubmit({
        mode: "create",
        values: {
          username: values.username,
          profile: values.profile,
          password: values.password,
        },
      });
      return;
    }
    if (!user) return;
    const patch: UserUpdateInput = {
      profile: values.profile,
      status: values.status,
    };
    // Empty password = "do not change". Omit from payload so the backend
    // doesn't treat it as a reset.
    if (values.password.length > 0) {
      patch.password = values.password;
    }
    onSubmit({ mode: "edit", id: user.id, values: patch });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nouveau compte" : "Modifier le compte"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Le compte sera utilisable immédiatement."
              : "Laisser le mot de passe vide pour ne pas le changer."}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-username">Nom d&apos;utilisateur</Label>
            <Input
              id="user-username"
              type="text"
              autoComplete="off"
              disabled={mode === "edit"}
              aria-invalid={Boolean(usernameError) || undefined}
              aria-describedby={
                usernameError ? "user-username-error" : undefined
              }
              {...form.register("username")}
            />
            {usernameError && (
              <p
                id="user-username-error"
                role="alert"
                className="text-state-error text-sm"
              >
                {usernameError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-profile">Profil</Label>
            <select
              id="user-profile"
              className="border-border-chrome bg-surface-raised rounded-md border px-3 py-2 text-sm"
              aria-invalid={Boolean(profileError) || undefined}
              {...form.register("profile")}
            >
              <option value="gm">MJ</option>
              <option value="user">Joueur</option>
            </select>
            {profileError && (
              <p role="alert" className="text-state-error text-sm">
                {profileError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-password">
              {mode === "create"
                ? "Mot de passe"
                : "Nouveau mot de passe (optionnel)"}
            </Label>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(passwordError) || undefined}
              aria-describedby={
                passwordError ? "user-password-error" : undefined
              }
              {...form.register("password")}
            />
            {passwordError && (
              <p
                id="user-password-error"
                role="alert"
                className="text-state-error text-sm"
              >
                {passwordError}
              </p>
            )}
          </div>

          {mode === "edit" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-status">Statut</Label>
              <select
                id="user-status"
                className="border-border-chrome bg-surface-raised rounded-md border px-3 py-2 text-sm"
                {...form.register("status")}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
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
                ? "Enregistrement..."
                : mode === "create"
                  ? "Créer"
                  : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { SubmitPayload };
