"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ProfilePicker } from "@/components/auth/ProfilePicker";
import { createApiClient } from "@/lib/api/client";
import { ApiError, AuthError, NetworkError } from "@/lib/api/errors";
import type { LoginInput } from "@/lib/schemas/auth";

function safeRedirectTarget(from: string | null): string {
  if (!from || !from.startsWith("/") || from.includes("\\")) return "/";

  try {
    const target = new URL(from, window.location.origin);
    if (target.origin !== window.location.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiClient = useMemo(() => createApiClient(), []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [clearPasswordTrigger, setClearPasswordTrigger] = useState(0);

  const mutation = useMutation({
    mutationFn: async (values: LoginInput) => {
      const { error } = await apiClient.POST("/auth/login", { body: values });
      if (error) {
        // Defensive: createErrorMiddleware should throw before we reach this branch.
        throw new ApiError({
          type: "about:blank",
          title: "Connexion impossible",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      const target = safeRedirectTarget(searchParams.get("from"));
      router.push(target);
    },
    onError: (error: unknown) => {
      const isAuth =
        error instanceof AuthError ||
        (error instanceof Error && error.name === "AuthError");
      if (isAuth) {
        setErrorMessage("Identifiants invalides.");
        setErrorDetail(null);
      } else {
        setErrorMessage(
          "Connexion impossible. Réessaie dans quelques instants.",
        );
        if (error instanceof NetworkError) {
          setErrorDetail("Erreur réseau. Vérifie ta connexion ou la base URL.");
        } else if (error instanceof ApiError) {
          setErrorDetail(error.problem.detail ?? error.problem.title);
        } else if (error instanceof Error) {
          setErrorDetail(error.message);
        } else {
          setErrorDetail(null);
        }
      }
      if (isAuth) {
        setClearPasswordTrigger((counter) => counter + 1);
      }
    },
  });

  const handleSubmit = async (values: LoginInput) => {
    try {
      await mutation.mutateAsync(values);
    } catch {
      // Errors are surfaced via the mutation.onError handler above. Swallow
      // the re-throw so react-hook-form's submit promise resolves cleanly.
    }
  };

  return (
    <ProfilePicker
      onSubmit={handleSubmit}
      submitting={mutation.isPending}
      errorMessage={errorMessage}
      errorDetail={errorDetail}
      clearPasswordTrigger={clearPasswordTrigger}
    />
  );
}
