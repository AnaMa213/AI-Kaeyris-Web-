// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserForm } from "@/components/users/UserForm";
import type { UserOut } from "@/lib/users/queries";

const aliceUser: UserOut = {
  id: "u-1",
  username: "alice",
  profile: "user",
  status: "active",
  created_at: "2026-05-29T10:00:00Z",
  updated_at: "2026-05-29T10:00:00Z",
  last_login_at: null,
};

describe("<UserForm> create mode", () => {
  test("submits a valid create payload as { mode: 'create', values }", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <UserForm
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        submitting={false}
        errorMessage={null}
      />,
    );
    await user.type(screen.getByLabelText("Nom d'utilisateur"), "carol");
    await user.selectOptions(screen.getByLabelText("Profil"), "gm");
    await user.type(screen.getByLabelText("Mot de passe"), "secret");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      mode: "create",
      values: { username: "carol", profile: "gm", password: "secret" },
    });
  });

  test("rejects an empty username with the French zod error", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <UserForm
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        submitting={false}
        errorMessage={null}
      />,
    );
    await user.type(screen.getByLabelText("Mot de passe"), "secret");
    await user.click(screen.getByRole("button", { name: "Créer" }));
    expect(
      await screen.findByText("Nom d'utilisateur requis."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("<UserForm> edit mode", () => {
  test("pre-fills username (disabled) and exposes the status select", () => {
    render(
      <UserForm
        open
        onOpenChange={vi.fn()}
        mode="edit"
        user={aliceUser}
        onSubmit={vi.fn()}
        submitting={false}
        errorMessage={null}
      />,
    );
    const usernameInput = screen.getByLabelText(
      "Nom d'utilisateur",
    ) as HTMLInputElement;
    expect(usernameInput.value).toBe("alice");
    expect(usernameInput).toBeDisabled();
    expect(screen.getByLabelText("Statut")).toBeInTheDocument();
  });

  test("omits empty password from the patch payload", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <UserForm
        open
        onOpenChange={vi.fn()}
        mode="edit"
        user={aliceUser}
        onSubmit={onSubmit}
        submitting={false}
        errorMessage={null}
      />,
    );
    // Change the profile but leave password empty.
    await user.selectOptions(screen.getByLabelText("Profil"), "gm");
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.mode).toBe("edit");
    expect(payload.id).toBe("u-1");
    expect(payload.values).toEqual({ profile: "gm", status: "active" });
    expect(payload.values.password).toBeUndefined();
  });
});
