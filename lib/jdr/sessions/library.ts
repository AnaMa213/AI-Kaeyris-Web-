import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { normalizeForSearch } from "@/lib/core/strings/normalizeForSearch";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

/**
 * Session Library sort modes. `date_desc` is the default (preserves the
 * Story 2.4 listing order).
 */
export type SessionSortMode = "date_desc" | "date_asc" | "title_alpha";

/** Single source of truth for the sort dropdown labels (FR). */
export const SORT_LABELS: Record<SessionSortMode, string> = {
  date_desc: "Date (récent → ancien)",
  date_asc: "Date (ancien → récent)",
  title_alpha: "Titre (A → Z)",
};

/**
 * Pure sort — returns a NEW array, never mutates the input. `date_*` compares
 * `recorded_at` via `parseBackendDate` (UTC-safe); `title_alpha` uses a
 * locale-aware, accent-insensitive compare.
 */
export function sortSessions(
  sessions: SessionOut[],
  mode: SessionSortMode,
): SessionOut[] {
  const copy = [...sessions];
  switch (mode) {
    case "date_asc":
      return copy.sort(
        (a, b) =>
          parseBackendDate(a.recorded_at).getTime() -
          parseBackendDate(b.recorded_at).getTime(),
      );
    case "title_alpha":
      return copy.sort((a, b) =>
        a.title.localeCompare(b.title, "fr", { sensitivity: "base" }),
      );
    case "date_desc":
    default:
      return copy.sort(
        (a, b) =>
          parseBackendDate(b.recorded_at).getTime() -
          parseBackendDate(a.recorded_at).getTime(),
      );
  }
}

/**
 * Pure filter — case/accent-insensitive substring match on `title`. An empty
 * or whitespace-only query returns the original list (no filtering).
 */
export function filterSessionsByTitle(
  sessions: SessionOut[],
  query: string,
): SessionOut[] {
  const needle = normalizeForSearch(query);
  if (needle === "") return sessions;
  return sessions.filter((session) =>
    normalizeForSearch(session.title).includes(needle),
  );
}
