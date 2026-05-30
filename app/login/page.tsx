"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfilePicker } from "@/components/jdr/auth/ProfilePicker";
import { SetupWizard } from "@/components/jdr/auth/SetupWizard";
import { LoginGuard } from "@/components/jdr/auth/LoginGuard";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import SessionProvider from "@/lib/core/session/SessionProvider";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError, AuthError, NetworkError } from "@/lib/core/api/errors";
import { safeRedirectTarget } from "@/lib/core/auth/redirect";
import type { LoginInput, SetupInput } from "@/lib/jdr/schemas/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<FantasyLoader />}>
      <SessionProvider>
        <LoginGuard>
          <LoginForm />
        </LoginGuard>
      </SessionProvider>
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
    // Fail loud once instead of retrying 3× with exponential backoff. A failed
    // setup/status (e.g. CORS, network) is a deployment-level problem we want
    // visible immediately, not buried under ~7s of silent retries.
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: ["session", "me"] });
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
      queryClient.invalidateQueries({ queryKey: ["session", "me"] });
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

  const expired = searchParams.get("expired") === "true";

  if (setupStatusQuery.isPending) {
    return <FantasyLoader />;
  }

  if (setupStatusQuery.isError) {
    return (
      <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div
          role="alert"
          className="text-state-error flex max-w-md flex-col gap-2 text-center text-sm"
        >
          <p className="font-display text-2xl">Backend injoignable</p>
          <p>
            Impossible de déterminer si un compte MJ existe. Vérifie que le
            backend tourne sur{" "}
            <code className="font-mono">
              {process.env.NEXT_PUBLIC_API_BASE_URL ?? "l'URL configurée"}
            </code>{" "}
            et que CORS autorise{" "}
            <code className="font-mono">http://localhost:3000</code>.
          </p>
        </div>
      </main>
    );
  }

  const expiredBanner = expired ? (
    <div
      role="status"
      className="bg-surface-raised text-text-chrome-muted border-border-chrome border-b px-4 py-3 text-center text-sm"
    >
      Session expirée, reconnectez-vous.
    </div>
  ) : null;

  if (setupStatusQuery.data?.required) {
    return (
      <>
        {expiredBanner}
        <SetupWizard
          onSubmit={handleSetupSubmit}
          submitting={setupMutation.isPending}
          errorMessage={setupErrorMessage}
          errorDetail={setupErrorDetail}
        />
      </>
    );
  }

  return (
    <>
      {expiredBanner}
      <ProfilePicker
        onSubmit={handleLoginSubmit}
        submitting={loginMutation.isPending}
        errorMessage={errorMessage}
        errorDetail={errorDetail}
        clearPasswordTrigger={clearPasswordTrigger}
      />
    </>
  );
}
