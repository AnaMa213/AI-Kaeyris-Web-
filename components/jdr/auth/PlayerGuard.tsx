"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";
import { isCampaignPlayer } from "@/lib/core/session/helpers";

/**
 * Story 8.4 — gate for the read-only player area. Unauthenticated → /login.
 * Authenticated non-players (GM) → the campaign area (the player surface is not
 * theirs). Only campaign players (role `pj`) see the children.
 */
export function PlayerGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();
  const allowed = isCampaignPlayer(user);

  useEffect(() => {
    if (user.status === "unauthenticated") {
      router.replace("/login");
    } else if (user.status === "authenticated" && !allowed) {
      router.replace("/jdr/campaigns");
    }
  }, [user.status, allowed, router]);

  if (allowed) {
    return <>{children}</>;
  }

  const message =
    user.status === "unauthenticated"
      ? "Redirection vers la connexion..."
      : "Ouverture de tes séances...";
  return <FantasyLoader message={message} />;
}
