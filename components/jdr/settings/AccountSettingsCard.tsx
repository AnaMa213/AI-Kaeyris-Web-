"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accountPasswordChangeSchema,
  type AccountPasswordChangeInput,
} from "@/lib/jdr/schemas/account";

interface AccountSettingsCardProps {
  username: string;
  onSubmit: (values: AccountPasswordChangeInput) => void;
  submitting: boolean;
  errorMessage: string | null;
}

/**
 * Story 6.1 — bloc « Informations personnelles » de la page Paramètres.
 * Le nom d'utilisateur est en **lecture seule** (le schéma backend `UserUpdate`
 * n'accepte pas de `username` — voir Dev Notes de la story). Seul le changement
 * de mot de passe est éditable, avec confirmation par re-saisie côté client.
 *
 * La remise à zéro après succès est pilotée par le parent via un `key` qui
 * remonte ce composant (le formulaire repart vide).
 */
export function AccountSettingsCard({
  username,
  onSubmit,
  submitting,
  errorMessage,
}: AccountSettingsCardProps) {
  const form = useForm<AccountPasswordChangeInput>({
    resolver: zodResolver(accountPasswordChangeSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordError = form.formState.errors.password?.message;
  const confirmPasswordError = form.formState.errors.confirmPassword?.message;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Informations personnelles</CardTitle>
        <CardDescription>
          Consulte ton identifiant et modifie ton mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-2">
          <Label htmlFor="account-username">Nom d&apos;utilisateur</Label>
          <p
            id="account-username"
            className="text-foreground border-border-chrome bg-surface-raised/50 rounded-md border px-3 py-2 text-sm"
          >
            {username}
          </p>
        </div>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-password">Nouveau mot de passe</Label>
            <Input
              id="account-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(passwordError) || undefined}
              aria-describedby={
                passwordError ? "account-password-error" : undefined
              }
              {...form.register("password")}
            />
            {passwordError && (
              <p
                id="account-password-error"
                role="alert"
                className="text-state-error text-sm"
              >
                {passwordError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-confirm-password">
              Confirme le mot de passe
            </Label>
            <Input
              id="account-confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(confirmPasswordError) || undefined}
              aria-describedby={
                confirmPasswordError
                  ? "account-confirm-password-error"
                  : undefined
              }
              {...form.register("confirmPassword")}
            />
            {confirmPasswordError && (
              <p
                id="account-confirm-password-error"
                role="alert"
                className="text-state-error text-sm"
              >
                {confirmPasswordError}
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

          <Button
            type="submit"
            disabled={submitting}
            className={submitting ? "animate-pulse self-start" : "self-start"}
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
