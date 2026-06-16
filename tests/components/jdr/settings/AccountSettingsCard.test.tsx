// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccountSettingsCard } from "@/components/jdr/settings/AccountSettingsCard";

function renderCard(
  overrides: Partial<React.ComponentProps<typeof AccountSettingsCard>> = {},
) {
  const onSubmit = vi.fn();
  render(
    <AccountSettingsCard
      username="kenan"
      onSubmit={onSubmit}
      submitting={false}
      errorMessage={null}
      {...overrides}
    />,
  );
  return { onSubmit };
}

describe("<AccountSettingsCard>", () => {
  test("affiche le nom d'utilisateur en lecture seule (pas un champ éditable)", () => {
    renderCard();
    // Le username est rendu en texte, pas dans un <input> (lecture seule).
    expect(screen.getByText("kenan")).toBeInTheDocument();
    const passwordInputs = screen.getAllByLabelText(/mot de passe/i);
    passwordInputs.forEach((input) => expect(input).toHaveValue(""));
    expect(
      screen.queryByRole("textbox", { name: /nom d'utilisateur/i }),
    ).not.toBeInTheDocument();
  });

  test("bloque la soumission et affiche des erreurs quand les champs sont vides", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const errors = await screen.findAllByText("Mot de passe requis.");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("bloque la soumission quand les mots de passe ne correspondent pas", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "secret-123",
    );
    await user.type(
      screen.getByLabelText("Confirme le mot de passe"),
      "secret-999",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(
      await screen.findByText("Les mots de passe ne correspondent pas."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("appelle onSubmit avec les valeurs quand les mots de passe correspondent", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCard();

    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "secret-123",
    );
    await user.type(
      screen.getByLabelText("Confirme le mot de passe"),
      "secret-123",
    );
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      password: "secret-123",
      confirmPassword: "secret-123",
    });
  });

  test("affiche le message d'erreur fourni par le parent", () => {
    renderCard({ errorMessage: "Tu n'as pas les permissions." });
    expect(
      screen.getByText("Tu n'as pas les permissions."),
    ).toBeInTheDocument();
  });

  test("désactive le bouton et affiche l'état d'envoi pendant submitting", () => {
    renderCard({ submitting: true });
    const button = screen.getByRole("button", { name: "Enregistrement..." });
    expect(button).toBeDisabled();
  });
});
