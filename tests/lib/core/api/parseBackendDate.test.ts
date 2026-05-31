import { describe, expect, test } from "vitest";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";

describe("parseBackendDate", () => {
  test("appends Z to a naive backend datetime so it is parsed as UTC", () => {
    const date = parseBackendDate("2026-05-31T18:00:00");
    expect(date.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  test("preserves microsecond precision strings (backend default)", () => {
    const date = parseBackendDate("2026-05-31T21:24:17.740107");
    // JS Date truncates to milliseconds, but the UTC anchor must be correct.
    expect(date.toISOString().startsWith("2026-05-31T21:24:17")).toBe(true);
    expect(date.toISOString().endsWith("Z")).toBe(true);
  });

  test("passes through a string that already ends with Z", () => {
    const date = parseBackendDate("2026-05-31T18:00:00.000Z");
    expect(date.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  test("passes through a string with a +HH:MM offset", () => {
    const date = parseBackendDate("2026-05-31T20:00:00+02:00");
    expect(date.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  test("passes through a string with a -HH:MM offset", () => {
    const date = parseBackendDate("2026-05-31T14:00:00-04:00");
    expect(date.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });

  test("passes through a string with a compact +HHMM offset", () => {
    const date = parseBackendDate("2026-05-31T20:00:00+0200");
    expect(date.toISOString()).toBe("2026-05-31T18:00:00.000Z");
  });
});
