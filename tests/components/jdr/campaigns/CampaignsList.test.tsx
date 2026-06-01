// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignsList } from "@/components/jdr/campaigns/CampaignsList";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";

function makeCampaign(
  overrides: Partial<CampaignOut> & Pick<CampaignOut, "id" | "name">,
): CampaignOut {
  return {
    description: null,
    role: "gm",
    session_count: 0,
    last_session_at: null,
    created_at: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("<CampaignsList>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders one card per campaign", () => {
    const campaigns: CampaignOut[] = [
      makeCampaign({ id: "11111111-1111-1111-1111-111111111111", name: "Royaumes" }),
      makeCampaign({ id: "22222222-2222-2222-2222-222222222222", name: "Brumes" }),
    ];
    render(<CampaignsList campaigns={campaigns} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  test("orders by last_session_at desc (most recent first)", () => {
    const campaigns: CampaignOut[] = [
      makeCampaign({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Plus ancienne",
        last_session_at: "2026-04-01T10:00:00+00:00",
      }),
      makeCampaign({
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        name: "Plus récente",
        last_session_at: "2026-05-29T18:00:00+00:00",
      }),
    ];
    render(<CampaignsList campaigns={campaigns} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("Plus récente");
    expect(headings[1]).toHaveTextContent("Plus ancienne");
  });

  test("places null last_session_at at the end", () => {
    const campaigns: CampaignOut[] = [
      makeCampaign({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Sans séance",
        last_session_at: null,
      }),
      makeCampaign({
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        name: "Avec séance",
        last_session_at: "2026-05-29T18:00:00+00:00",
      }),
    ];
    render(<CampaignsList campaigns={campaigns} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("Avec séance");
    expect(headings[1]).toHaveTextContent("Sans séance");
  });
});
