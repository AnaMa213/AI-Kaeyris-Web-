"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { useCurrentUser } from "@/lib/core/session/useCurrentUser";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.status === "unauthenticated") {
      const from = encodeURIComponent(pathname);
      router.replace(`/login?from=${from}&expired=true`);
    }
  }, [user.status, router, pathname]);

  if (user.status === "authenticated") {
    return <>{children}</>;
  }

  const message =
    user.status === "unauthenticated"
      ? "Redirection vers la connexion..."
      : "Ouverture du grimoire...";
  return <FantasyLoader message={message} />;
}
