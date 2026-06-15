import { describe, expect, test } from "vitest";
import {
  SESSION_PAGE_SIZE,
  filterSessionsByTitle,
  paginateSessions,
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

describe("paginateSessions (Story 4.23 AC4)", () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    makeSession({ id: `s-${index}`, title: `Session ${index}` }),
  );

  test("default page size is 5", () => {
    expect(SESSION_PAGE_SIZE).toBe(5);
  });

  test("returns the 5-item slice for page 1", () => {
    const ids = paginateSessions(many, 1).map((s) => s.id);
    expect(ids).toEqual(["s-0", "s-1", "s-2", "s-3", "s-4"]);
  });

  test("returns the correct slice for a middle page", () => {
    const ids = paginateSessions(many, 2).map((s) => s.id);
    expect(ids).toEqual(["s-5", "s-6", "s-7", "s-8", "s-9"]);
  });

  test("last page returns the remainder only", () => {
    const ids = paginateSessions(many, 3).map((s) => s.id);
    expect(ids).toEqual(["s-10", "s-11"]);
  });

  test("an out-of-range page yields an empty slice", () => {
    expect(paginateSessions(many, 99)).toHaveLength(0);
  });

  test("does not mutate the input array", () => {
    const input = [...many];
    paginateSessions(input, 2);
    expect(input).toHaveLength(12);
    expect(input[0]?.id).toBe("s-0");
  });
});
