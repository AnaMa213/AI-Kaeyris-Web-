// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignCard } from "@/components/jdr/campaigns/CampaignCard";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

const baseCampaign: CampaignOut = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Les Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire sous le poids d'une trahison.",
  role: "gm",
  session_count: 12,
  last_session_at: "2026-05-29T10:00:00+00:00",
  created_at: "2026-01-12T18:00:00+00:00",
};

describe("<CampaignCard>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders the name in a level-2 heading", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Les Royaumes Brisés" }),
    ).toBeInTheDocument();
  });

  test("renders the italic description when present", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    expect(
      screen.getByText(/Un royaume autrefois uni/),
    ).toBeInTheDocument();
  });

  test("renders 'Sans description' italic fallback when description is null (Story 2.7)", () => {
    render(<CampaignCard campaign={{ ...baseCampaign, description: null }} />);
    expect(
      screen.queryByText(/Un royaume autrefois uni/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sans description")).toBeInTheDocument();
  });

  test("renders 'Sans description' fallback for empty-string description", () => {
    render(<CampaignCard campaign={{ ...baseCampaign, description: "   " }} />);
    expect(screen.getByText("Sans description")).toBeInTheDocument();
  });

  test("renders Lucide icons (ScrollText + Clock) in the meta row (Story 2.7)", () => {
    const { container } = render(<CampaignCard campaign={baseCampaign} />);
    const icons = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(2);
  });

  test("renders the session count with singular/plural", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("sessions")).toBeInTheDocument();

    const { unmount } = render(
      <CampaignCard campaign={{ ...baseCampaign, session_count: 1 }} />,
    );
    expect(screen.getAllByText("session")).toHaveLength(1);
    unmount();
  });

  test("renders relative + absolute last_session_at when set", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    expect(screen.getByText("il y a 2 jours")).toBeInTheDocument();
    expect(screen.getByText("29/05/2026")).toBeInTheDocument();
  });

  test("renders 'Aucune séance encore' when last_session_at is null", () => {
    render(
      <CampaignCard campaign={{ ...baseCampaign, last_session_at: null }} />,
    );
    expect(screen.getByText("Aucune séance encore")).toBeInTheDocument();
  });

  test("renders the role badge MJ for gm role", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    expect(screen.getByText("MJ")).toBeInTheDocument();
  });

  test("renders the role badge Joueur for player role", () => {
    render(<CampaignCard campaign={{ ...baseCampaign, role: "pj" }} />);
    expect(screen.getByText("Joueur")).toBeInTheDocument();
    expect(screen.queryByText("MJ")).not.toBeInTheDocument();
  });

  test("wraps the card in a Link pointing at /jdr/campaigns/{id}", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "/jdr/campaigns/11111111-1111-1111-1111-111111111111",
    );
  });

  test("never exposes the campaign id (UUID) in the visible DOM text", () => {
    render(<CampaignCard campaign={baseCampaign} />);
    expect(screen.queryByText(baseCampaign.id)).not.toBeInTheDocument();
  });
});
