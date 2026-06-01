// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CampaignForm } from "@/components/jdr/campaigns/CampaignForm";

type RenderOverrides = Partial<Parameters<typeof CampaignForm>[0]>;

const renderForm = (overrides: RenderOverrides = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <CampaignForm
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitting={false}
      errorMessage={null}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
};

describe("<CampaignForm>", () => {
  test("renders Nom + Description fields and the Créer + Annuler buttons", () => {
    renderForm();
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Description (optionnelle)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Créer la campagne" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Annuler" }),
    ).toBeInTheDocument();
  });

  test("submits with name and an empty-string description when description is left empty", async () => {
    // The form layer keeps the textarea controlled with "" — the queries layer
    // (useCreateCampaign) normalises empty-string to "omit from body".
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nom"), "Royaumes Brisés");
    await user.click(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [values] = onSubmit.mock.calls[0];
    expect(values.name).toBe("Royaumes Brisés");
    expect(values.description).toBe("");
  });

  test("submits with name + description when both filled", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nom"), "Royaumes Brisés");
    await user.type(
      screen.getByLabelText("Description (optionnelle)"),
      "Une intro narrative.",
    );
    await user.click(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [values] = onSubmit.mock.calls[0];
    expect(values).toEqual({
      name: "Royaumes Brisés",
      description: "Une intro narrative.",
    });
  });

  test("blocks submit with an inline error when name is empty", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(
      screen.getByRole("button", { name: "Créer la campagne" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText((content) => /requis/i.test(content)),
      ).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("renders the errorMessage banner when provided", () => {
    renderForm({ errorMessage: "Création impossible. Réessaie." });
    expect(
      screen.getByText("Création impossible. Réessaie."),
    ).toBeInTheDocument();
  });

  test("Annuler calls onCancel", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("disables fields + buttons and ignores submit while submitting", () => {
    const { onSubmit, onCancel } = renderForm({ submitting: true });
    const nameInput = screen.getByLabelText("Nom");
    const descInput = screen.getByLabelText("Description (optionnelle)");
    const form = nameInput.closest("form");
    if (!form) throw new Error("Form not found");

    expect(nameInput).toBeDisabled();
    expect(descInput).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Création/ })).toBeDisabled();

    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
