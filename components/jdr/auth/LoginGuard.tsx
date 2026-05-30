"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";

export function LoginGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.status === "authenticated") {
      router.replace("/jdr/sessions");
    }
  }, [user.status, router]);

  if (user.status === "unauthenticated") {
    return <>{children}</>;
  }

  return <FantasyLoader message="Vérification de la session..." />;
}
