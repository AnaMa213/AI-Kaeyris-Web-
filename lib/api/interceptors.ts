"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AuthError } from "@/lib/api/errors";

export function AuthInterceptor() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleError = (error: unknown) => {
      if (!(error instanceof AuthError)) return;
      // Loop prevention: never redirect the login route to itself.
      if (pathname.startsWith("/login")) return;
      const fromParam = encodeURIComponent(pathname);
      router.push(`/login?from=${fromParam}&expired=true`);
    };

    const unsubQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
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
