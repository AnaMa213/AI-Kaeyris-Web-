// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersTable } from "@/components/jdr/users/UsersTable";
import type { UserOut } from "@/lib/jdr/users/queries";

const users: UserOut[] = [
  {
    id: "u-1",
    username: "alice",
    profile: "gm",
    status: "active",
    created_at: "2026-05-29T10:00:00Z",
    updated_at: "2026-05-29T10:00:00Z",
    last_login_at: null,
  },
  {
    id: "u-2",
    username: "bob",
    profile: "user",
    status: "inactive",
    created_at: "2026-04-15T08:30:00Z",
    updated_at: "2026-04-15T08:30:00Z",
    last_login_at: null,
  },
];

describe("<UsersTable>", () => {
  test("renders one row per user with correct badge, status, and dd/MM/yyyy date", () => {
    render(
      <UsersTable users={users} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("MJ")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText("29/05/2026")).toBeInTheDocument();

    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("Joueur")).toBeInTheDocument();
    expect(screen.getByText("Inactif")).toBeInTheDocument();
    expect(screen.getByText("15/04/2026")).toBeInTheDocument();
  });

  test("clicking Modifier fires onEdit with the right user", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <UsersTable users={users} onEdit={onEdit} onDelete={vi.fn()} />,
    );
    const editButtons = screen.getAllByRole("button", { name: "Modifier" });
    await user.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(users[0]);
  });

  test("clicking Désactiver fires onDelete with the right user", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <UsersTable users={users} onEdit={vi.fn()} onDelete={onDelete} />,
    );
    const deleteButtons = screen.getAllByRole("button", { name: "Désactiver" });
    await user.click(deleteButtons[1]);
    expect(onDelete).toHaveBeenCalledWith(users[1]);
  });
});
