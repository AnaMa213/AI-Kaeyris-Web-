import { describe, expect, test } from "vitest";
import { safeRedirectTarget } from "@/lib/core/auth/redirect";

const ORIGIN = "http://localhost:8000";

describe("safeRedirectTarget", () => {
  test("returns '/' on null input", () => {
    expect(safeRedirectTarget(null, ORIGIN)).toBe("/");
  });

  test("returns '/' on empty string", () => {
    expect(safeRedirectTarget("", ORIGIN)).toBe("/");
  });

  test("accepts a same-origin relative path with leading '/'", () => {
    expect(safeRedirectTarget("/jdr/sessions/abc", ORIGIN)).toBe(
      "/jdr/sessions/abc",
    );
  });

  test("preserves search and hash on same-origin relative path", () => {
    expect(
      safeRedirectTarget("/jdr/sessions/abc?tab=artefacts#summary", ORIGIN),
    ).toBe("/jdr/sessions/abc?tab=artefacts#summary");
  });

  test("rejects an absolute URL (different origin)", () => {
    expect(safeRedirectTarget("https://evil.com", ORIGIN)).toBe("/");
  });

  test("rejects a protocol-relative URL", () => {
    expect(safeRedirectTarget("//evil.com", ORIGIN)).toBe("/");
  });

  test("rejects a backslash-normalized external URL — the P1 review fix case", () => {
    // Production flow for the historical P1 (Story 1.6 review):
    //   URL bar:                ?from=/%5C%5Cevil.com
    //   URLSearchParams.get():  "/\\evil.com"  (URI-decoded once)
    //   safeRedirectTarget:     rejected by the raw-backslash check
    //                           (before URL parsing — browsers would
    //                           normalise "\\evil.com" to "//evil.com"
    //                           and the redirect would land off-origin).
    // We simulate the post-decode string the function actually receives.
    const decoded = decodeURIComponent("/%5C%5Cevil.com");
    expect(safeRedirectTarget(decoded, ORIGIN)).toBe("/");
  });

  test("rejects a path containing a raw backslash", () => {
    expect(safeRedirectTarget("/jdr\\evil", ORIGIN)).toBe("/");
  });

  test("rejects a path that does not start with '/'", () => {
    expect(safeRedirectTarget("jdr/sessions", ORIGIN)).toBe("/");
  });

  test("rejects an URL parser exception (returns '/' on throw)", () => {
    // Force a URL parser failure by passing a malformed origin
    expect(safeRedirectTarget("/path", "not-a-valid-origin")).toBe("/");
  });
});
