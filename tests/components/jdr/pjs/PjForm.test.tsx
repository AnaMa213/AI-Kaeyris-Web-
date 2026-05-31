// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PjForm } from "@/components/jdr/pjs/PjForm";

type RenderOverrides = Partial<Parameters<typeof PjForm>[0]>;

const renderForm = (overrides: RenderOverrides = {}) => {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PjForm
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      submitting={false}
      errorMessage={null}
      {...overrides}
    />,
  );
  return { onSubmit, onOpenChange };
};

describe("<PjForm>", () => {
  test("renders the heading + name input + submit + cancel buttons", () => {
    renderForm();
    expect(
      screen.getByRole("heading", { name: "Nouveau PJ" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nom du PJ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Annuler" }),
    ).toBeInTheDocument();
  });

  test("submits the typed name on Créer click", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nom du PJ"), "Eldrin");
    await user.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      { name: "Eldrin" },
      expect.anything(),
    );
  });

  test("blocks submit with an inline error when name is empty", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/requis/i),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("renders the errorMessage banner when provided", () => {
    renderForm({ errorMessage: "Ce nom de PJ existe déjà" });
    expect(
      screen.getByText("Ce nom de PJ existe déjà"),
    ).toBeInTheDocument();
  });

  test("calls onOpenChange(false) on Annuler click", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("Créer button is disabled while submitting", () => {
    renderForm({ submitting: true });
    const submitButton = screen.getByRole("button", { name: /Création/ });
    expect(submitButton).toBeDisabled();
  });
});
