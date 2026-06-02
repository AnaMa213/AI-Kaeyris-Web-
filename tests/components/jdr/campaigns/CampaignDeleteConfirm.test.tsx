// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/core/api/errors";
import { CampaignDeleteConfirm } from "@/components/jdr/campaigns/CampaignDeleteConfirm";

const sampleCampaign = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire.",
  role: "gm" as const,
  session_count: 0,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

type OnOpenChange = (open: boolean) => void;

function renderConfirm(overrides: {
  campaign?: typeof sampleCampaign;
  submitting?: boolean;
  error?: unknown;
  onConfirm?: () => void;
  onOpenChange?: OnOpenChange;
} = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onOpenChange = (overrides.onOpenChange ?? vi.fn()) as OnOpenChange;
  render(
    <CampaignDeleteConfirm
      open
      onOpenChange={onOpenChange}
      campaign={overrides.campaign ?? sampleCampaign}
      onConfirm={onConfirm}
      submitting={overrides.submitting ?? false}
      error={overrides.error}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("<CampaignDeleteConfirm>", () => {
  test("renders the dialog title with the campaign name", () => {
    renderConfirm();
    expect(
      screen.getByRole("heading", {
        name: `Supprimer ${sampleCampaign.name} ?`,
      }),
    ).toBeInTheDocument();
  });

  test("confirm button is disabled until the user types the exact campaign name", async () => {
    renderConfirm();
    const confirmBtn = screen.getByRole("button", {
      name: "Supprimer la campagne",
    });
    expect(confirmBtn).toBeDisabled();

    const user = userEvent.setup();
    const input = screen.getByLabelText(/pour confirmer/i);
    await user.type(input, "Royaume");
    expect(confirmBtn).toBeDisabled();

    await user.type(input, "s Brisés");
    expect(confirmBtn).not.toBeDisabled();
  });

  test("trims surrounding whitespace before matching", async () => {
    renderConfirm();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/pour confirmer/i),
      "  Royaumes Brisés  ",
    );
    expect(
      screen.getByRole("button", { name: "Supprimer la campagne" }),
    ).not.toBeDisabled();
  });

  test("calls onConfirm() when the user confirms", async () => {
    const onConfirm = vi.fn();
    renderConfirm({ onConfirm });
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/pour confirmer/i),
      "Royaumes Brisés",
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer la campagne" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("shows the session_count blocker message on a 409 ApiError", () => {
    const campaign = { ...sampleCampaign, session_count: 3 };
    const error = new ApiError({
      type: "about:blank",
      title: "Cannot delete",
      status: 409,
    });
    renderConfirm({ campaign, error });
    expect(
      screen.getByText(
        /Impossible : cette campagne contient encore 3 sessions\. Supprime-les d'abord\./,
      ),
    ).toBeInTheDocument();
  });

  test("uses singular form when session_count is 1", () => {
    const campaign = { ...sampleCampaign, session_count: 1 };
    const error = new ApiError({
      type: "about:blank",
      title: "Cannot delete",
      status: 409,
    });
    renderConfirm({ campaign, error });
    expect(
      screen.getByText(
        /Impossible : cette campagne contient encore 1 session\. Supprime-les d'abord\./,
      ),
    ).toBeInTheDocument();
  });

  test("shows the permission message on a 403 ApiError", () => {
    const error = new ApiError({
      type: "about:blank",
      title: "Forbidden",
      status: 403,
    });
    renderConfirm({ error });
    expect(
      screen.getByText(
        /Tu n'as pas les permissions pour supprimer cette campagne/i,
      ),
    ).toBeInTheDocument();
  });

  test("both buttons are disabled while submitting", () => {
    renderConfirm({ submitting: true });
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Suppression/i }),
    ).toBeDisabled();
  });
});
