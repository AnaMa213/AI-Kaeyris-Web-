import { describe, expect, test } from "vitest";
import {
  filterSessionsByTitle,
  sortSessions,
  type SessionSortMode,
} from "@/lib/jdr/sessions/library";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

function makeSession(overrides: Partial<SessionOut>): SessionOut {
  return {
    id: "id-x",
    title: "Session",
    recorded_at: "2026-05-01T20:00:00",
    mode: "batch",
    state: "created",
    transcription_mode: "non_diarised",
    campaign_context: null,
    created_at: "2026-05-01T20:00:00",
    updated_at: "2026-05-01T20:00:00",
    ...overrides,
  } as SessionOut;
}

const older = makeSession({
  id: "older",
  title: "Bravo — La cité engloutie",
  recorded_at: "2026-04-10T20:00:00",
});
const newer = makeSession({
  id: "newer",
  title: "alpha — Le pacte rompu",
  recorded_at: "2026-05-30T20:00:00",
});
const middle = makeSession({
  id: "middle",
  title: "Charlie — Cité des brumes",
  recorded_at: "2026-05-01T20:00:00",
});

const all = [older, newer, middle];

describe("sortSessions", () => {
  test("date_desc orders most recent first (default)", () => {
    const ids = sortSessions(all, "date_desc").map((s) => s.id);
    expect(ids).toEqual(["newer", "middle", "older"]);
  });

  test("date_asc orders oldest first", () => {
    const ids = sortSessions(all, "date_asc").map((s) => s.id);
    expect(ids).toEqual(["older", "middle", "newer"]);
  });

  test("title_alpha orders by title, accent/case-insensitive", () => {
    const ids = sortSessions(all, "title_alpha").map((s) => s.id);
    // "alpha…" < "Bravo…" < "Charlie…"
    expect(ids).toEqual(["newer", "older", "middle"]);
  });

  test("does not mutate the input array", () => {
    const input = [...all];
    sortSessions(input, "date_asc");
    expect(input.map((s) => s.id)).toEqual(["older", "newer", "middle"]);
  });

  test("falls back to date_desc for an unknown mode", () => {
    const ids = sortSessions(all, "bogus" as SessionSortMode).map((s) => s.id);
    expect(ids).toEqual(["newer", "middle", "older"]);
  });
});

describe("filterSessionsByTitle", () => {
  test("matches a case/accent-insensitive substring of the title", () => {
    const ids = filterSessionsByTitle(all, "CITE").map((s) => s.id);
    // "La cité engloutie" and "Cité des brumes" both match "cite".
    expect(ids.sort()).toEqual(["middle", "older"]);
  });

  test("returns all sessions for an empty query", () => {
    expect(filterSessionsByTitle(all, "")).toHaveLength(3);
  });

  test("returns all sessions for a whitespace-only query", () => {
    expect(filterSessionsByTitle(all, "   ")).toHaveLength(3);
  });

  test("returns an empty array when nothing matches", () => {
    expect(filterSessionsByTitle(all, "zzz")).toHaveLength(0);
  });
});
