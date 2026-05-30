// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupWizard } from "@/components/jdr/auth/SetupWizard";

type RenderOverrides = Omit<
  Partial<Parameters<typeof SetupWizard>[0]>,
  "onSubmit"
>;

const renderWizard = (overrides: RenderOverrides = {}) => {
  const onSubmit = vi.fn();
  render(
    <SetupWizard
      onSubmit={onSubmit}
      submitting={false}
      errorMessage={null}
      errorDetail={null}
      {...overrides}
    />,
  );
  return { onSubmit };
};

describe("<SetupWizard>", () => {
  test("renders title, subtitle, both inputs, and submit button", () => {
    renderWizard();
    expect(
      screen.getByRole("heading", { name: "Créer le premier compte MJ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aucun compte n'existe encore/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nom d'utilisateur")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Créer le compte" }),
    ).toBeInTheDocument();
  });

  test("autofocuses the username input on mount", () => {
    renderWizard();
    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveFocus();
  });

  test("empty submission surfaces both French zod errors and does not call onSubmit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderWizard();
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(
      await screen.findByText("Nom d'utilisateur requis."),
    ).toBeInTheDocument();
    expect(screen.getByText("Mot de passe requis.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("valid submission calls onSubmit with the entered username + password", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderWizard();
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "admin");
    await user.type(screen.getByLabelText("Mot de passe"), "secret");
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      username: "admin",
      password: "secret",
    });
  });

  test("renders inline errorMessage with details when provided", () => {
    renderWizard({
      errorMessage: "Création impossible. Vérifie les informations saisies.",
      errorDetail: "Username already taken",
    });
    const alerts = screen.getAllByRole("alert");
    const errorAlert = alerts.find((node) =>
      node.textContent?.includes("Création impossible"),
    );
    expect(errorAlert).toBeInTheDocument();
    expect(screen.getByText("Détails")).toBeInTheDocument();
    expect(screen.getByText("Username already taken")).toBeInTheDocument();
  });
});
