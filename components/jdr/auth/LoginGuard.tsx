"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";
import { safeRedirectTarget } from "@/lib/core/auth/redirect";

export function LoginGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.status === "authenticated") {
      const from = searchParams.get("from");
      const target = from
        ? safeRedirectTarget(from, window.location.origin)
        : "/jdr/sessions";
      router.replace(target);
    }
  }, [user.status, router, searchParams]);

  if (user.status === "unauthenticated") {
    return <>{children}</>;
  }

  return <FantasyLoader message="Vérification de la session..." />;
}
