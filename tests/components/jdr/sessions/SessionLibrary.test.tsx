// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionLibrary } from "@/components/jdr/sessions/SessionLibrary";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const campId = "11111111-1111-1111-1111-111111111111";

function makeSession(overrides: Partial<SessionOut>): SessionOut {
  return {
    id: "id-x",
    title: "Session",
    recorded_at: "2026-05-01T20:00:00",
    mode: "batch",
    state: "transcribed",
    transcription_mode: "non_diarised",
    campaign_context: null,
    created_at: "2026-05-01T20:00:00",
    updated_at: "2026-05-01T20:00:00",
    ...overrides,
  } as SessionOut;
}

const recent = makeSession({
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00",
});
const older = makeSession({
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  title: "Session 11 — Le pacte rompu",
  recorded_at: "2026-04-24T20:00:00",
});

const sessions = [older, recent];

beforeEach(() => {
  pushMock.mockClear();
});

describe("<SessionLibrary>", () => {
  test("renders rows ordered by recorded_at desc by default", () => {
    render(
      <SessionLibrary
        sessions={sessions}
        campId={campId}
        canCreateSession
      />,
    );
    const titles = screen.getAllByRole("heading", { level: 3 });
    expect(titles[0]).toHaveTextContent("Session 12 — La cité engloutie");
    expect(titles[1]).toHaveTextContent("Session 11 — Le pacte rompu");
  });

  test("a row links to the session route and never exposes the UUID", () => {
    render(
      <SessionLibrary
        sessions={sessions}
        campId={campId}
        canCreateSession
      />,
    );
    const link = screen.getByRole("link", { name: /Session 12/ });
    expect(link).toHaveAttribute(
      "href",
      `/jdr/campaigns/${campId}/sessions/${recent.id}`,
    );
    expect(screen.queryByText(recent.id)).not.toBeInTheDocument();
  });

  test("search filters by title substring (accent/case-insensitive) after debounce", async () => {
    const user = userEvent.setup();
    render(
      <SessionLibrary
        sessions={sessions}
        campId={campId}
        canCreateSession
      />,
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Rechercher une session" }),
      "PACTE",
    );
    await waitFor(() => {
      expect(
        screen.queryByText("Session 12 — La cité engloutie"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Session 11 — Le pacte rompu"),
    ).toBeInTheDocument();
  });

  test("shows the 'no results' empty state when the search matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <SessionLibrary
        sessions={sessions}
        campId={campId}
        canCreateSession
      />,
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Rechercher une session" }),
      "zzzzz",
    );
    const emptyState = await screen.findByText(
      "Aucune session ne correspond à votre recherche.",
    );
    expect(emptyState).toBeInTheDocument();
    // The toolbar stays available so the GM can clear the search.
    expect(
      screen.getByRole("searchbox", { name: "Rechercher une session" }),
    ).toBeInTheDocument();
    // The empty-state card itself never offers a create CTA (only the
    // persistent toolbar affordance does).
    const emptyStateCard = emptyState.closest("[role='status']");
    expect(emptyStateCard).not.toBeNull();
    expect(
      within(emptyStateCard as HTMLElement).queryByRole("button"),
    ).not.toBeInTheDocument();
  });

  test("sorts by title A→Z when that option is chosen", async () => {
    const user = userEvent.setup();
    render(
      <SessionLibrary
        sessions={sessions}
        campId={campId}
        canCreateSession
      />,
    );
    await user.click(screen.getByLabelText("Trier les sessions"));
    await user.click(
      await screen.findByRole("option", { name: "Titre (A → Z)" }),
    );
    await waitFor(() => {
      const titles = screen.getAllByRole("heading", { level: 3 });
      // "Session 11…" sorts before "Session 12…"
      expect(titles[0]).toHaveTextContent("Session 11 — Le pacte rompu");
      expect(titles[1]).toHaveTextContent("Session 12 — La cité engloutie");
    });
  });

  test("renders the canonical empty Library with a CTA when there are no sessions (GM)", async () => {
    const user = userEvent.setup();
    render(
      <SessionLibrary sessions={[]} campId={campId} canCreateSession />,
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Aucune session dans cette campagne.",
      }),
    ).toBeInTheDocument();
    // No search/sort toolbar when there is nothing to filter.
    expect(
      screen.queryByRole("searchbox", { name: "Rechercher une session" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nouvelle session" }));
    expect(pushMock).toHaveBeenCalledWith(
      `/jdr/campaigns/${campId}/sessions/new`,
    );
  });

  test("hides the create CTA in the empty state for a player role", () => {
    render(
      <SessionLibrary
        sessions={[]}
        campId={campId}
        canCreateSession={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Nouvelle session" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Les sessions créées par le MJ apparaîtront ici."),
    ).toBeInTheDocument();
  });

  test("the toolbar create CTA navigates to the new-session route", async () => {
    const user = userEvent.setup();
    render(
      <SessionLibrary
        sessions={sessions}
        campId={campId}
        canCreateSession
      />,
    );
    const region = screen.getByText("2 sessions");
    expect(region).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nouvelle session" }));
    expect(pushMock).toHaveBeenCalledWith(
      `/jdr/campaigns/${campId}/sessions/new`,
    );
  });
});
