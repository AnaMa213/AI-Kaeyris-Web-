"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import SessionProvider from "@/lib/core/session/SessionProvider";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";
import { isCampaignPlayer } from "@/lib/core/session/helpers";

function LauncherGateway() {
  const router = useRouter();
  const user = useCurrentUser();
  const isPlayer = isCampaignPlayer(user);

  useEffect(() => {
    if (user.status === "authenticated") {
      // Story 8.4 — players land on their read-only area, GMs on the campaigns.
      router.push(isPlayer ? "/me" : "/jdr/campaigns");
    } else if (user.status === "unauthenticated") {
      router.push("/login");
    }
  }, [user.status, isPlayer, router]);

  return <FantasyLoader message="Ouverture du grimoire..." />;
}

export default function LauncherPage() {
  return (
    <SessionProvider>
      <LauncherGateway />
    </SessionProvider>
  );
}
