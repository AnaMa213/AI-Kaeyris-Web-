"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconButton } from "@/components/common/IconButton";
import { EmptyState } from "@/components/common/EmptyState";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useDebouncedValue } from "@/lib/core/hooks/useDebouncedValue";
import {
  SORT_LABELS,
  filterSessionsByTitle,
  sortSessions,
  type SessionSortMode,
} from "@/lib/jdr/sessions/library";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

const STATE_LABEL: Record<SessionOut["state"], string> = {
  created: "Créée",
  audio_uploaded: "Audio uploadé",
  transcribing: "Transcription en cours",
  transcription_failed: "Échec transcription",
  transcribed: "Transcrite",
};

const SORT_MODES = Object.keys(SORT_LABELS) as SessionSortMode[];

interface SessionLibraryProps {
  /** Already-loaded sessions. Reusable: the data source is a prop (FR-7/NFR-11). */
  sessions: SessionOut[];
  campId: string;
  canCreateSession: boolean;
}

/**
 * Searchable + sortable session list (Story 5.6). Receives its sessions as a
 * prop so the V2 campaign-grouping refactor can swap the data source without
 * touching the search/sort UI (FR-7, NFR-11). Loading/error states stay with
 * the data-fetching parent.
 */
export function SessionLibrary({
  sessions,
  campId,
  canCreateSession,
}: SessionLibraryProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SessionSortMode>("date_desc");
  const debouncedQuery = useDebouncedValue(query, 250);

  const visibleSessions = useMemo(
    () => sortSessions(filterSessionsByTitle(sessions, debouncedQuery), sortMode),
    [sessions, debouncedQuery, sortMode],
  );

  const goToNewSession = () =>
    router.push(`/jdr/campaigns/${campId}/sessions/new`);

  // No sessions at all → canonical empty Library (Story 1.12 / UX-DR10). The
  // search/sort toolbar is pointless here, so it is not rendered.
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Aucune session dans cette campagne."
        description={
          canCreateSession
            ? "Crée ta première session pour commencer un récit."
            : "Les sessions créées par le MJ apparaîtront ici."
        }
        action={
          canCreateSession
            ? { label: "Nouvelle session", onClick: goToNewSession }
            : undefined
        }
      />
    );
  }

  const isFiltering = debouncedQuery.trim() !== "";
  const countLabel = isFiltering
    ? `${visibleSessions.length} / ${sessions.length}`
    : `${sessions.length} ${sessions.length <= 1 ? "session" : "sessions"}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-text-chrome-muted text-xs tracking-wide uppercase">
          {countLabel}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label="Rechercher une session"
            placeholder="Rechercher…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full sm:w-56"
          />
          <Select
            items={SORT_LABELS}
            value={sortMode}
            onValueChange={(value) => setSortMode(value as SessionSortMode)}
          >
            <SelectTrigger aria-label="Trier les sessions">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {SORT_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreateSession && (
            <IconButton
              label="Nouvelle session"
              icon={<Plus aria-hidden="true" />}
              onClick={goToNewSession}
            />
          )}
        </div>
      </div>

      {visibleSessions.length === 0 ? (
        <EmptyState
          title="Aucune session ne correspond à votre recherche."
          description="Essayez un autre terme ou effacez la recherche."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {visibleSessions.map((session) => {
            const recordedAt = parseBackendDate(session.recorded_at);
            const relative = formatDistanceToNow(recordedAt, {
              addSuffix: true,
              locale: fr,
            });
            const absolute = format(recordedAt, "dd/MM/yyyy 'à' HH:mm", {
              locale: fr,
            });
            return (
              <li key={session.id}>
                <Link
                  href={`/jdr/campaigns/${campId}/sessions/${session.id}`}
                  className="group hover:bg-accent-gold/5 hover:border-accent-gold/20 -mx-3 flex flex-col gap-1 rounded-lg border border-transparent px-3 py-3 transition-all duration-120"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="font-display group-hover:text-accent-gold text-lg transition-colors">
                      {session.title}
                    </h3>
                    <Badge variant="outline">{STATE_LABEL[session.state]}</Badge>
                  </div>
                  <time
                    dateTime={session.recorded_at}
                    className="text-text-chrome-muted text-sm"
                  >
                    {relative} · {absolute}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
