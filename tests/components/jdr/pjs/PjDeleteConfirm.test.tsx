// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PjDeleteConfirm } from "@/components/jdr/pjs/PjDeleteConfirm";

const samplePj = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Eldrin",
  created_at: "2026-05-30T10:00:00Z",
};

type RenderOverrides = Partial<Parameters<typeof PjDeleteConfirm>[0]>;

const renderConfirm = (overrides: RenderOverrides = {}) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PjDeleteConfirm
      open
      onOpenChange={onOpenChange}
      pj={samplePj}
      onConfirm={onConfirm}
      submitting={false}
      errorMessage={null}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange };
};

describe("<PjDeleteConfirm>", () => {
  test("does NOT render content when pj is null", () => {
    render(
      <PjDeleteConfirm
        open
        onOpenChange={vi.fn()}
        pj={null}
        onConfirm={vi.fn()}
        submitting={false}
        errorMessage={null}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: /Supprimer/i }),
    ).not.toBeInTheDocument();
  });

  test("renders the title with the PJ name and the destructive button", () => {
    renderConfirm();
    expect(
      screen.getByRole("heading", { name: "Supprimer Eldrin ?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer le PJ" }),
    ).toBeInTheDocument();
  });

  test("Supprimer button stays disabled until the typed name matches the PJ name", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderConfirm();
    const submit = screen.getByRole("button", { name: "Supprimer le PJ" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Tape/i), "Eldri");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Tape/i), "n");
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onConfirm).toHaveBeenCalledWith(samplePj.id);
  });

  test("trims surrounding whitespace before comparing the typed name", async () => {
    const user = userEvent.setup();
    renderConfirm();
    await user.type(screen.getByLabelText(/Tape/i), "  Eldrin  ");
    const submit = screen.getByRole("button", { name: "Supprimer le PJ" });
    expect(submit).toBeEnabled();
  });

  test("Annuler closes the dialog via onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderConfirm();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("Surfaces the description warning about the V1 mock state", () => {
    renderConfirm();
    expect(
      screen.getByText(/annulée au prochain rechargement/i),
    ).toBeInTheDocument();
  });

  test("Surfaces the errorMessage banner when provided", () => {
    renderConfirm({ errorMessage: "Suppression impossible (mock)" });
    expect(
      screen.getByText("Suppression impossible (mock)"),
    ).toBeInTheDocument();
  });

  test("Supprimer button shows 'Suppression...' while submitting", () => {
    renderConfirm({ submitting: true });
    expect(
      screen.getByRole("button", { name: /Suppression/ }),
    ).toBeDisabled();
  });
});
