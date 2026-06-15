// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

vi.mock("@/lib/core/browser/downloadTextFile", () => ({
  downloadTextFile: vi.fn(),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastErrorMock(...a) },
}));

const { ArtifactExportButton } = await import(
  "@/components/jdr/sessions/ArtifactExportButton"
);
const { downloadTextFile } = await import(
  "@/lib/core/browser/downloadTextFile"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";

function stubFetch(handler: (input: Request | string) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(handler));
}

function markdown(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/markdown" },
  });
}

function renderButton(
  kind: "summary" | "narrative" | "elements" = "summary",
  variant?: "text" | "icon",
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ArtifactExportButton
        sessionId={SESSION_ID}
        sessionTitle="Ma Séance"
        kind={kind}
        variant={variant}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  toastErrorMock.mockClear();
  vi.mocked(downloadTextFile).mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<ArtifactExportButton> (Story 5.5)", () => {
  test("renders the 'Exporter .md' action", () => {
    stubFetch(async () => markdown("# x"));
    renderButton();
    expect(
      screen.getByRole("button", { name: /Exporter \.md/i }),
    ).toBeInTheDocument();
  });

  test("clicking fetches the artifact markdown and saves it with the kind filename", async () => {
    stubFetch(async () => markdown("# Résumé\n\nContenu."));
    renderButton("summary");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Exporter \.md/i }));
    await waitFor(() =>
      expect(downloadTextFile).toHaveBeenCalledWith(
        "session-ma-seance-summary.md",
        "# Résumé\n\nContenu.",
      ),
    );
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  test("an export failure surfaces a toast and does not save a file", async () => {
    stubFetch(async () =>
      new Response(
        JSON.stringify({ type: "about:blank", title: "boom", status: 500 }),
        { status: 500, headers: { "content-type": "application/problem+json" } },
      ),
    );
    renderButton("narrative");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Exporter \.md/i }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  test("Story 4.23 AC6 — the icon variant renders a download icon button with a descriptive label", async () => {
    stubFetch(async () => markdown("# Résumé\n\nContenu."));
    renderButton("summary", "icon");
    const user = userEvent.setup();
    const button = screen.getByRole("button", {
      name: "Exporter le résumé en Markdown",
    });
    // The icon variant drops the visible ".md" text label.
    expect(button).not.toHaveTextContent("Exporter .md");
    await user.click(button);
    await waitFor(() =>
      expect(downloadTextFile).toHaveBeenCalledWith(
        "session-ma-seance-summary.md",
        "# Résumé\n\nContenu.",
      ),
    );
  });
});
