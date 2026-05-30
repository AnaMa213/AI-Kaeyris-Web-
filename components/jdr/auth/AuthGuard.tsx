"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [user.status, router]);

  if (user.status === "authenticated") {
    return <>{children}</>;
  }

  const message =
    user.status === "unauthenticated"
      ? "Redirection vers la connexion..."
      : "Ouverture du grimoire...";
  return <FantasyLoader message={message} />;
}
