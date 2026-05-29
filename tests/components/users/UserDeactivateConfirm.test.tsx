// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserDeactivateConfirm } from "@/components/users/UserDeactivateConfirm";
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

describe("<UserDeactivateConfirm>", () => {
  test("the destructive button is disabled until the typed value matches the username exactly", async () => {
    const user = userEvent.setup();
    render(
      <UserDeactivateConfirm
        open
        onOpenChange={vi.fn()}
        user={aliceUser}
        onConfirm={vi.fn()}
        submitting={false}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Désactiver le compte",
    });
    expect(button).toBeDisabled();
    const input = screen.getByLabelText(/Tape.*alice.*pour confirmer/);
    await user.type(input, "ali");
    expect(button).toBeDisabled();
    await user.type(input, "ce");
    expect(button).toBeEnabled();
  });

  test("clicking the destructive button fires onConfirm with the user id", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <UserDeactivateConfirm
        open
        onOpenChange={vi.fn()}
        user={aliceUser}
        onConfirm={onConfirm}
        submitting={false}
      />,
    );
    await user.type(
      screen.getByLabelText(/Tape.*alice.*pour confirmer/),
      "alice",
    );
    await user.click(
      screen.getByRole("button", { name: "Désactiver le compte" }),
    );
    expect(onConfirm).toHaveBeenCalledWith("u-1");
  });
});
