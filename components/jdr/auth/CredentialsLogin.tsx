"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/jdr/schemas/auth";

interface CredentialsLoginProps {
  onSubmit(values: LoginInput): Promise<void> | void;
  submitting: boolean;
  errorMessage: string | null;
  errorDetail?: string | null;
  clearPasswordTrigger?: number;
}

/**
 * Story 4.11 (A6) — single credentials login. Replaces the former
 * `<ProfilePicker>` (MJ/Joueur cards + reveal-on-click form): the GM now lands
 * straight on the username/password form. The profile choice is obsolete since
 * BD-7 removed the `profile` field — login posts `{ username, password }`.
 */
export function CredentialsLogin({
  onSubmit,
  submitting,
  errorMessage,
  errorDetail,
  clearPasswordTrigger,
}: CredentialsLoginProps) {
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (clearPasswordTrigger === undefined) return;
    form.resetField("password");
    passwordInputRef.current?.focus();
  }, [clearPasswordTrigger, form]);

  const usernameError = form.formState.errors.username?.message;
  const passwordError = form.formState.errors.password?.message;
  const usernameRegister = form.register("username");
  const { ref: passwordRegisterRef, ...passwordRegister } =
    form.register("password");

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
          <h1 className="font-display text-4xl leading-tight font-semibold">
            AI-Kaeyris
          </h1>
          <p className="text-text-chrome-muted text-sm">Personal AI Portal</p>
        </div>
        <p className="text-text-chrome-muted max-w-md font-serif text-lg italic">
          Le codex de vos campagnes.
        </p>
      </header>

      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-username">Nom d&apos;utilisateur</Label>
          <Input
            id="login-username"
            type="text"
            autoComplete="username"
            autoFocus
            aria-invalid={Boolean(usernameError) || undefined}
            aria-describedby={
              usernameError ? "login-username-error" : undefined
            }
            {...usernameRegister}
          />
          {usernameError && (
            <p
              id="login-username-error"
              role="alert"
              className="text-state-error text-sm"
            >
              {usernameError}
            </p>
          )}
        </div>

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
                <p className="mt-1 font-mono break-words">{errorDetail}</p>
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
    </main>
  );
}
