// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PjForm } from "@/components/jdr/pjs/PjForm";

type RenderOverrides = Partial<Parameters<typeof PjForm>[0]>;

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

const alice = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  username: "alice",
  system_role: "user" as const,
  status: "active" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
};
const bob = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  username: "bob",
  system_role: "user" as const,
  status: "active" as const,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
};

const eldrin = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Eldrin",
  campaign_id: CAMPAIGN_ID,
  created_at: "2026-05-30T10:00:00Z",
  user_id: alice.id,
};

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

describe("<PjForm> create mode", () => {
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

  test("does NOT render the user picker in create mode", () => {
    renderForm();
    expect(screen.queryByLabelText("Joueur lié")).not.toBeInTheDocument();
  });

  test("submits the typed name as a create payload on Créer click", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nom du PJ"), "Eldrin");
    await user.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "create",
      values: { name: "Eldrin" },
    });
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

describe("<PjForm> edit mode", () => {
  const editProps: RenderOverrides = {
    mode: "edit",
    pj: eldrin,
    users: [alice, bob],
  };

  test("renders the edit heading, prefilled name, and the user picker", () => {
    renderForm(editProps);
    expect(
      screen.getByRole("heading", { name: "Modifier le PJ" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nom du PJ")).toHaveValue("Eldrin");
    const picker = screen.getByLabelText("Joueur lié") as HTMLSelectElement;
    expect(picker).toBeInTheDocument();
    // Prefilled with the currently linked user.
    expect(picker.value).toBe(alice.id);
    expect(
      screen.getByRole("option", { name: "Aucun (non lié)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "alice" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "bob" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mettre à jour" }),
    ).toBeInTheDocument();
  });

  test("submits an edit payload with the renamed name + linked user_id", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(editProps);
    const nameInput = screen.getByLabelText("Nom du PJ");
    await user.clear(nameInput);
    await user.type(nameInput, "Aragorn");
    await user.selectOptions(screen.getByLabelText("Joueur lié"), bob.id);
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "edit",
      id: eldrin.id,
      values: { name: "Aragorn", user_id: bob.id },
    });
  });

  test("sends user_id: null when 'Aucun' is selected (unlink)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(editProps);
    await user.selectOptions(screen.getByLabelText("Joueur lié"), "");
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "edit",
      id: eldrin.id,
      values: { name: "Eldrin", user_id: null },
    });
  });

  test("preserves an unresolved current user link on rename-only submit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ mode: "edit", pj: eldrin, users: [] });
    const picker = screen.getByLabelText("Joueur lié") as HTMLSelectElement;
    expect(picker.value).toBe(alice.id);
    expect(
      screen.getByRole("option", { name: "Joueur lié (non résolu)" }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Nom du PJ");
    await user.clear(nameInput);
    await user.type(nameInput, "Eldrin relu");
    await user.click(screen.getByRole("button", { name: "Mettre à jour" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "edit",
      id: eldrin.id,
      values: { name: "Eldrin relu", user_id: alice.id },
    });
  });

  test("defaults the picker to 'Aucun' when the PJ has no linked user", () => {
    renderForm({ mode: "edit", pj: { ...eldrin, user_id: null }, users: [alice] });
    const picker = screen.getByLabelText("Joueur lié") as HTMLSelectElement;
    expect(picker.value).toBe("");
  });

  test("Escape does not close the edit dialog (Story 4.6 inherited)", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm(editProps);
    await screen.findByRole("heading", { name: "Modifier le PJ" });
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
