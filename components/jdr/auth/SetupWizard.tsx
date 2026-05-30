"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupSchema, type SetupInput } from "@/lib/jdr/schemas/auth";

interface SetupWizardProps {
  onSubmit(values: SetupInput): Promise<void> | void;
  submitting: boolean;
  errorMessage: string | null;
  errorDetail?: string | null;
}

export function SetupWizard({
  onSubmit,
  submitting,
  errorMessage,
  errorDetail,
}: SetupWizardProps) {
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const usernameError = form.formState.errors.username?.message;
  const passwordError = form.formState.errors.password?.message;

  const { ref: usernameRegisterRef, ...usernameRegister } =
    form.register("username");
  const passwordRegister = form.register("password");

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-10 p-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="bg-surface-raised border-border-chrome text-accent-gold flex h-14 w-14 items-center justify-center rounded-full border text-2xl"
        >
          ⚔
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Créer le premier compte MJ
          </h1>
          <p className="text-text-chrome-muted mt-2 max-w-md text-sm">
            Aucun compte n&apos;existe encore — cet écran ne réapparaîtra plus
            une fois le compte créé.
          </p>
        </div>
      </header>

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="setup-username">Nom d&apos;utilisateur</Label>
          <Input
            id="setup-username"
            type="text"
            autoComplete="username"
            aria-invalid={Boolean(usernameError) || undefined}
            aria-describedby={usernameError ? "setup-username-error" : undefined}
            ref={(node) => {
              usernameRegisterRef(node);
              usernameInputRef.current = node;
            }}
            {...usernameRegister}
          />
          {usernameError && (
            <p
              id="setup-username-error"
              role="alert"
              className="text-state-error text-sm"
            >
              {usernameError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="setup-password">Mot de passe</Label>
          <Input
            id="setup-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(passwordError) || undefined}
            aria-describedby={passwordError ? "setup-password-error" : undefined}
            {...passwordRegister}
          />
          {passwordError && (
            <p
              id="setup-password-error"
              role="alert"
              className="text-state-error text-sm"
            >
              {passwordError}
            </p>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="text-state-error flex flex-col gap-1 text-sm"
          >
            <p>{errorMessage}</p>
            {errorDetail && (
              <details className="text-text-chrome-muted text-xs">
                <summary>Détails</summary>
                <p className="font-mono mt-1 break-words">{errorDetail}</p>
              </details>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className={submitting ? "animate-pulse" : undefined}
        >
          {submitting ? "Création..." : "Créer le compte"}
        </Button>
      </form>
    </main>
  );
}
