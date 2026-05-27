"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

interface ProfilePickerProps {
  onSubmit(values: LoginInput): Promise<void> | void;
  submitting: boolean;
  errorMessage: string | null;
  errorDetail?: string | null;
  clearPasswordTrigger?: number;
}

export function ProfilePicker({
  onSubmit,
  submitting,
  errorMessage,
  errorDetail,
  clearPasswordTrigger,
}: ProfilePickerProps) {
  const [profileSelected, setProfileSelected] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { profile: "gm", password: "" },
  });

  useEffect(() => {
    if (clearPasswordTrigger === undefined) return;
    form.resetField("password");
    passwordInputRef.current?.focus();
  }, [clearPasswordTrigger, form]);

  const passwordError = form.formState.errors.password?.message;
  const { ref: passwordRegisterRef, ...passwordRegister } = form.register(
    "password",
  );

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
            AI-Kaeyris
          </h1>
          <p className="text-text-chrome-muted text-sm">Personal AI Portal</p>
        </div>
        <p className="font-serif text-text-chrome-muted max-w-md text-lg italic">
          Le codex de vos campagnes.
        </p>
      </header>

      <section
        aria-label="Choisir un profil"
        className="grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2"
      >
        <Card
          role="button"
          tabIndex={0}
          aria-pressed={profileSelected}
          onClick={() => setProfileSelected(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setProfileSelected(true);
            }
          }}
          className={`bg-surface-raised border-border-chrome cursor-pointer transition-colors ${
            profileSelected
              ? "border-accent-gold"
              : "hover:border-accent-gold"
          }`}
        >
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="font-display text-2xl font-semibold">MJ</span>
            <span className="text-text-chrome-muted text-sm">
              Accède à tes campagnes
            </span>
          </CardContent>
        </Card>

        <Card
          aria-disabled="true"
          className="bg-surface-raised border-border-chrome cursor-not-allowed opacity-60"
        >
          <CardContent className="relative flex flex-col items-center gap-2 p-8 text-center">
            <span className="text-accent-gold absolute top-2 right-2 text-xs">
              Bientôt — V2
            </span>
            <span className="font-display text-2xl font-semibold">Joueur</span>
            <span className="text-text-chrome-muted text-sm">
              Profil disponible avec la prochaine version.
            </span>
          </CardContent>
        </Card>
      </section>

      {profileSelected && (
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-sm flex-col gap-4"
        >
          <input type="hidden" {...form.register("profile")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Mot de passe</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(passwordError) || undefined}
              aria-describedby={
                errorMessage || passwordError ? "login-error" : undefined
              }
              ref={(node) => {
                passwordRegisterRef(node);
                passwordInputRef.current = node;
              }}
              {...passwordRegister}
            />
            {passwordError && (
              <p
                id="login-error"
                role="alert"
                className="text-state-error text-sm"
              >
                {passwordError}
              </p>
            )}
          </div>

          {errorMessage && (
            <div
              id={passwordError ? undefined : "login-error"}
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
            {submitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      )}
    </main>
  );
}
