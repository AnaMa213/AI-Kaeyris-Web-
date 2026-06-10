// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CredentialsLogin } from "@/components/jdr/auth/CredentialsLogin";

type RenderOverrides = Omit<
  Partial<Parameters<typeof CredentialsLogin>[0]>,
  "onSubmit"
>;

const renderForm = (overrides: RenderOverrides = {}) => {
  const onSubmit = vi.fn();
  render(
    <CredentialsLogin
      onSubmit={onSubmit}
      submitting={false}
      errorMessage={null}
      errorDetail={null}
      {...overrides}
    />,
  );
  return { onSubmit };
};

describe("<CredentialsLogin>", () => {
  test("renders the credentials form directly — no MJ/Joueur profile picker", () => {
    renderForm();
    // The fields are visible immediately — no card-selection step.
    expect(screen.getByLabelText("Nom d'utilisateur")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).toBeInTheDocument();
    // The removed Profile Picker: no MJ/Joueur cards, no "Choisir un profil".
    expect(screen.queryByText("MJ")).not.toBeInTheDocument();
    expect(screen.queryByText("Joueur")).not.toBeInTheDocument();
    expect(screen.queryByText(/Bientôt/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Choisir un profil" }),
    ).not.toBeInTheDocument();
  });

  test("autofocuses the username field", () => {
    renderForm();
    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveFocus();
  });

  test("submitting an empty password (with username) surfaces the zod validation error", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "alice");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Mot de passe requis.")).toBeInTheDocument();
    expect(
      screen.queryByText("Nom d'utilisateur requis."),
    ).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submitting an empty username (with password) surfaces the zod validation error", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(
      await screen.findByText("Nom d'utilisateur requis."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Mot de passe requis.")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submitting a valid username + password calls onSubmit with { username, password } (no profile field — BD-7)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "alice");
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      username: "alice",
      password: "hunter2",
    });
  });

  test("clearPasswordTrigger resets the password field but preserves username", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CredentialsLogin
        onSubmit={vi.fn()}
        submitting={false}
        errorMessage={null}
        clearPasswordTrigger={0}
      />,
    );
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "alice");
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    expect(
      (screen.getByLabelText("Nom d'utilisateur") as HTMLInputElement).value,
    ).toBe("alice");
    expect(
      (screen.getByLabelText("Mot de passe") as HTMLInputElement).value,
    ).toBe("hunter2");

    rerender(
      <CredentialsLogin
        onSubmit={vi.fn()}
        submitting={false}
        errorMessage="Identifiants invalides."
        clearPasswordTrigger={1}
      />,
    );
    expect(
      (screen.getByLabelText("Mot de passe") as HTMLInputElement).value,
    ).toBe("");
    // Critical: username MUST be preserved — the user should not have to retype
    // their identity after a bad-password failure.
    expect(
      (screen.getByLabelText("Nom d'utilisateur") as HTMLInputElement).value,
    ).toBe("alice");
  });

  test("inline error message renders with role=alert", () => {
    renderForm({ errorMessage: "Identifiants invalides." });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Identifiants invalides.",
    );
  });

  test("inline error shows an optional detail in a <details> disclosure", () => {
    renderForm({
      errorMessage: "Connexion impossible. Réessaie dans quelques instants.",
      errorDetail: "Erreur réseau. Vérifie ta connexion ou la base URL.",
    });
    expect(
      screen.getByText("Erreur réseau. Vérifie ta connexion ou la base URL."),
    ).toBeInTheDocument();
  });
});
