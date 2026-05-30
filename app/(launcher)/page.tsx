"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import SessionProvider from "@/lib/core/session/SessionProvider";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";

function LauncherGateway() {
  const router = useRouter();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.status === "authenticated") {
      router.push("/jdr/sessions");
    } else if (user.status === "unauthenticated") {
      router.push("/login");
    }
  }, [user.status, router]);

  return <FantasyLoader message="Ouverture du grimoire..." />;
}

export default function LauncherPage() {
  return (
    <SessionProvider>
      <LauncherGateway />
    </SessionProvider>
  );
}
