"use client";

import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/lib/core/session/queries";

export { SESSION_QUERY_KEY } from "@/lib/core/session/queries";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useQuery(sessionQueryOptions);

  return <>{children}</>;
}
