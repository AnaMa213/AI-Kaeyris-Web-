// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilePicker } from "@/components/auth/ProfilePicker";

type RenderOverrides = Omit<
  Partial<Parameters<typeof ProfilePicker>[0]>,
  "onSubmit"
>;

const renderPicker = (overrides: RenderOverrides = {}) => {
  const onSubmit = vi.fn();
  render(
    <ProfilePicker
      onSubmit={onSubmit}
      submitting={false}
      errorMessage={null}
      errorDetail={null}
      {...overrides}
    />,
  );
  return { onSubmit };
};

describe("<ProfilePicker>", () => {
  test("renders both cards; Player card is aria-disabled", () => {
    renderPicker();
    expect(screen.getByText("MJ")).toBeInTheDocument();
    expect(screen.getByText("Joueur")).toBeInTheDocument();
    const playerCard = screen.getByText("Joueur").closest("[aria-disabled]");
    expect(playerCard).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Bientôt/)).toBeInTheDocument();
  });

  test("password input is hidden until the GM card is selected", () => {
    renderPicker();
    expect(screen.queryByLabelText("Mot de passe")).not.toBeInTheDocument();
  });

  test("clicking the GM card reveals the password input", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByText("MJ"));
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
  });

  test("submitting an empty password (with username) surfaces the zod validation error", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPicker();
    await user.click(screen.getByText("MJ"));
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
    const { onSubmit } = renderPicker();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(
      await screen.findByText("Nom d'utilisateur requis."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Mot de passe requis.")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("submitting a valid username + password calls onSubmit with profile=gm", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPicker();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "alice");
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      username: "alice",
      profile: "gm",
      password: "hunter2",
    });
  });

  test("clearPasswordTrigger resets the password field but preserves username", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ProfilePicker
        onSubmit={vi.fn()}
        submitting={false}
        errorMessage={null}
        clearPasswordTrigger={0}
      />,
    );
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "alice");
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    expect(
      (screen.getByLabelText("Nom d'utilisateur") as HTMLInputElement).value,
    ).toBe("alice");
    expect(
      (screen.getByLabelText("Mot de passe") as HTMLInputElement).value,
    ).toBe("hunter2");

    rerender(
      <ProfilePicker
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

  test("inline error message renders with role=alert after GM selection", async () => {
    const user = userEvent.setup();
    renderPicker({ errorMessage: "Identifiants invalides." });
    await user.click(screen.getByText("MJ"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Identifiants invalides.",
    );
  });
});
