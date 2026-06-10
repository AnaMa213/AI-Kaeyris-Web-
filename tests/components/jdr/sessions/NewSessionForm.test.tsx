// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewSessionForm } from "@/components/jdr/sessions/NewSessionForm";

type RenderOverrides = Partial<Parameters<typeof NewSessionForm>[0]>;

const renderForm = (overrides: RenderOverrides = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <NewSessionForm
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitting={false}
      errorMessage={null}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
};

describe("<NewSessionForm>", () => {
  test("renders the Titre + Date inputs and the Créer + Annuler buttons", () => {
    renderForm();
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
    expect(screen.getByLabelText("Date de la séance")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Créer la session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Annuler" }),
    ).toBeInTheDocument();
  });

  test("Date de la séance is pre-filled with today's local datetime", () => {
    renderForm();
    const dateInput = screen.getByLabelText(
      "Date de la séance",
    ) as HTMLInputElement;
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("submits the typed title + the date value on Créer click", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Titre"), "Session 7");
    await user.click(screen.getByRole("button", { name: "Créer la session" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [values] = onSubmit.mock.calls[0];
    expect(values.title).toBe("Session 7");
    expect(values.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("blocks submit with an inline error when title is empty", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole("button", { name: "Créer la session" }));
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

  test("Créer button is disabled while submitting", () => {
    renderForm({ submitting: true });
    expect(screen.getByRole("button", { name: /Création/ })).toBeDisabled();
  });

  test("disables fields + cancel and ignores submit while submitting", () => {
    const { onSubmit, onCancel } = renderForm({ submitting: true });
    const titleInput = screen.getByLabelText("Titre");
    const dateInput = screen.getByLabelText("Date de la séance");
    const form = titleInput.closest("form");
    if (!form) throw new Error("Form not found");

    expect(titleInput).toBeDisabled();
    expect(dateInput).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();

    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("exposes a 'Type de transcription' picker with functional labels, defaulting to non_diarised", () => {
    renderForm();
    const select = screen.getByLabelText(
      "Type de transcription",
    ) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // Functional French labels, never the raw enum codes.
    expect(
      screen.getByRole("option", {
        name: "Sans distinction des intervenants",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "Avec distinction des intervenants",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/non_diarised/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bdiarised\b/i)).not.toBeInTheDocument();
    // Default pre-selection.
    expect(select.value).toBe("non_diarised");
  });

  test("includes the default transcription_mode (non_diarised) in the submit payload", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Titre"), "Session 7");
    await user.click(screen.getByRole("button", { name: "Créer la session" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [values] = onSubmit.mock.calls[0];
    expect(values.transcription_mode).toBe("non_diarised");
  });

  test("submits the chosen transcription_mode when the GM selects diarised", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Titre"), "Session 7");
    await user.selectOptions(
      screen.getByLabelText("Type de transcription"),
      "diarised",
    );
    await user.click(screen.getByRole("button", { name: "Créer la session" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [values] = onSubmit.mock.calls[0];
    expect(values.transcription_mode).toBe("diarised");
  });

  test("disables the transcription picker while submitting", () => {
    renderForm({ submitting: true });
    expect(screen.getByLabelText("Type de transcription")).toBeDisabled();
  });
});
