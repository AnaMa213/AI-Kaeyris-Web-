"use client";

import Link from "next/link";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useMySessions } from "@/lib/jdr/player/queries";

/**
 * Story 8.4 — the player's flat session list (read-only). Newest first.
 */
export default function MySessionsPage() {
  const sessionsQuery = useMySessions();

  if (sessionsQuery.isPending) {
    return <FantasyLoader message="Chargement de tes séances..." />;
  }

  if (sessionsQuery.isError) {
    return (
      <p className="text-state-error text-sm">
        Impossible de charger tes séances. Réessaie plus tard.
      </p>
    );
  }

  const sessions = sessionsQuery.data ?? [];

  if (sessions.length === 0) {
    return (
      <p className="text-text-chrome-muted text-sm">
        Aucune séance pour ton personnage pour l&apos;instant.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Mes séances">
      {sessions.map((session) => (
        <li key={session.session_id}>
          <Link
            href={`/me/sessions/${session.session_id}`}
            className="bg-surface-card border-border-card hover:border-accent-gold block rounded-lg border p-4 transition-colors"
          >
            <span className="font-display block text-base font-semibold">
              {session.title}
            </span>
            <span className="text-text-chrome-muted text-xs">
              {parseBackendDate(session.recorded_at).toLocaleDateString("fr-FR")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
