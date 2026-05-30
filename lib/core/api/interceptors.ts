"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AuthError } from "@/lib/core/api/errors";

export function AuthInterceptor() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleError = (error: unknown) => {
      if (!(error instanceof AuthError)) return;
      // Loop prevention: never redirect the login route to itself.
      if (pathname.startsWith("/login")) return;
      queryClient.clear();
      const fromParam = encodeURIComponent(pathname);
      router.push(`/login?from=${fromParam}&expired=true`);
    };

    const unsubQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        // Session probe errors are handled by <AuthGuard>, which redirects
        // without the &expired=true marker so an unauthenticated entry
        // doesn't trigger the misleading "Session expirée" banner.
        if (event.query.queryKey[0] === "session") return;
        handleError(event.action.error);
      }
    });

    const unsubMutation = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        handleError(event.action.error);
      }
    });

    return () => {
      unsubQuery();
      unsubMutation();
    };
  }, [router, pathname, queryClient]);

  return null;
}
