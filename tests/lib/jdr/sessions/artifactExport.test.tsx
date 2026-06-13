// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { useDownloadArtifactMarkdown, artifactMarkdownFileName } = await import(
  "@/lib/jdr/sessions/artifactExport"
);
const { ApiError } = await import("@/lib/core/api/errors");

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

function wrapper(queryClient: QueryClient) {
  return function TestProvider({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

function stubFetch(handler: (input: Request | string) => Promise<Response>) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function markdown(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/markdown" },
  });
}

function problem(status: number) {
  return new Response(
    JSON.stringify({ type: "about:blank", title: "boom", status }),
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function calledUrl(fetchMock: ReturnType<typeof stubFetch>): string {
  const first = fetchMock.mock.calls[0]?.[0];
  return typeof first === "string" ? first : (first as Request).url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("artifactMarkdownFileName", () => {
  test("builds session-{slug}-{kind}.md for each kind", () => {
    expect(artifactMarkdownFileName("Ma Séance", "summary")).toBe(
      "session-ma-seance-summary.md",
    );
    expect(artifactMarkdownFileName("Ma Séance", "narrative")).toBe(
      "session-ma-seance-narrative.md",
    );
    expect(artifactMarkdownFileName("Ma Séance", "elements")).toBe(
      "session-ma-seance-elements.md",
    );
  });

  test("falls back to session-{kind}.md when the title has no usable characters", () => {
    expect(artifactMarkdownFileName("!!!", "summary")).toBe(
      "session-summary.md",
    );
  });
});

describe("useDownloadArtifactMarkdown", () => {
  test.each([
    ["summary", "/artifacts/summary.md"],
    ["narrative", "/artifacts/narrative.md"],
    ["elements", "/artifacts/elements.md"],
  ] as const)(
    "%s hits %s with parseAs:text and returns the raw markdown",
    async (kind, suffix) => {
      const fetchMock = stubFetch(async () => markdown(`# ${kind}\n\nBody.`));
      const { result } = renderHook(
        () => useDownloadArtifactMarkdown(SESSION_ID, kind),
        { wrapper: wrapper(makeClient()) },
      );
      const text = await result.current.mutateAsync();
      expect(text).toBe(`# ${kind}\n\nBody.`);
      expect(calledUrl(fetchMock).endsWith(suffix)).toBe(true);
    },
  );

  test("surfaces an ApiError on >=400", async () => {
    stubFetch(async () => problem(500));
    const { result } = renderHook(
      () => useDownloadArtifactMarkdown(SESSION_ID, "summary"),
      { wrapper: wrapper(makeClient()) },
    );
    await expect(result.current.mutateAsync()).rejects.toBeInstanceOf(ApiError);
  });
});
