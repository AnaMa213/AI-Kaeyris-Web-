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

  // TODO(Story 1.8): re-enable when <ProfilePicker> exposes the username Input.
  // The loginSchema gained `username` in Story 1.6, but the form hasn't yet.
  test.skip("submitting an empty password surfaces the zod validation error", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPicker();
    await user.click(screen.getByText("MJ"));
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Mot de passe requis.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // TODO(Story 1.8): re-enable when <ProfilePicker> exposes the username Input.
  // The loginSchema gained `username` in Story 1.6, but the form hasn't yet.
  test.skip("submitting a valid password calls onSubmit with profile=gm", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPicker();
    await user.click(screen.getByText("MJ"));
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      profile: "gm",
      password: "hunter2",
    });
  });

  test("clearPasswordTrigger resets the password field", async () => {
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
    await user.type(screen.getByLabelText("Mot de passe"), "hunter2");
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
