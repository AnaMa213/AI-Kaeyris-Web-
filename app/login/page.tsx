"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfilePicker } from "@/components/auth/ProfilePicker";
import { SetupWizard } from "@/components/auth/SetupWizard";
import { createApiClient } from "@/lib/api/client";
import { ApiError, AuthError, NetworkError } from "@/lib/api/errors";
import { safeRedirectTarget } from "@/lib/auth/redirect";
import type { LoginInput, SetupInput } from "@/lib/schemas/auth";

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
  const queryClient = useQueryClient();
  const apiClient = useMemo(() => createApiClient(), []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [clearPasswordTrigger, setClearPasswordTrigger] = useState(0);

  const [setupErrorMessage, setSetupErrorMessage] = useState<string | null>(
    null,
  );
  const [setupErrorDetail, setSetupErrorDetail] = useState<string | null>(null);

  const setupStatusQuery = useQuery({
    queryKey: ["auth", "setup-status"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/services/jdr/auth/setup/status",
      );
      if (error) {
        throw new ApiError({
          type: "about:blank",
          title: "Statut du setup indisponible",
          status: 0,
        });
      }
      return data;
    },
    // Setup status is a one-shot state: false → true → false (after a
    // successful setup we manually invalidate). No need to ever auto-refetch.
    staleTime: Infinity,
    refetchOnMount: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginInput) => {
      const { error } = await apiClient.POST("/services/jdr/auth/login", {
        body: values,
      });
      if (error) {
        throw new ApiError({
          type: "about:blank",
          title: "Connexion impossible",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      const target = safeRedirectTarget(
        searchParams.get("from"),
        window.location.origin,
      );
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

  const setupMutation = useMutation({
    mutationFn: async (values: SetupInput) => {
      const { error } = await apiClient.POST("/services/jdr/auth/setup", {
        body: values,
      });
      if (error) {
        throw new ApiError({
          type: "about:blank",
          title: "Création impossible",
          status: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      const target = safeRedirectTarget(
        searchParams.get("from"),
        window.location.origin,
      );
      router.push(target);
    },
    onError: (error: unknown) => {
      setSetupErrorMessage(
        "Création impossible. Vérifie les informations saisies ou réessaie.",
      );
      if (error instanceof NetworkError) {
        setSetupErrorDetail(
          "Erreur réseau. Vérifie ta connexion ou la base URL.",
        );
      } else if (error instanceof ApiError) {
        setSetupErrorDetail(error.problem.detail ?? error.problem.title);
      } else if (error instanceof Error) {
        setSetupErrorDetail(error.message);
      } else {
        setSetupErrorDetail(null);
      }
    },
  });

  const handleLoginSubmit = async (values: LoginInput) => {
    try {
      await loginMutation.mutateAsync(values);
    } catch {
      // Surfaced via mutation.onError.
    }
  };

  const handleSetupSubmit = async (values: SetupInput) => {
    try {
      await setupMutation.mutateAsync(values);
    } catch {
      // Surfaced via mutation.onError.
    }
  };

  if (setupStatusQuery.isPending) {
    return <div aria-busy="true" className="min-h-screen" />;
  }

  if (setupStatusQuery.data?.required) {
    return (
      <SetupWizard
        onSubmit={handleSetupSubmit}
        submitting={setupMutation.isPending}
        errorMessage={setupErrorMessage}
        errorDetail={setupErrorDetail}
      />
    );
  }

  return (
    <ProfilePicker
      onSubmit={handleLoginSubmit}
      submitting={loginMutation.isPending}
      errorMessage={errorMessage}
      errorDetail={errorDetail}
      clearPasswordTrigger={clearPasswordTrigger}
    />
  );
}
