// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ElementsEditor } from "@/components/jdr/sessions/ElementsEditor";

const sample = [
  { category: "PNJ", name: "Grom", description: "Forgeron." },
  { category: "Lieux", name: "La crypte", description: "" },
];

describe("<ElementsEditor> (Story 8.3)", () => {
  test("seeds editable rows from the initial elements", () => {
    render(
      <ElementsEditor
        initialElements={sample}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        saving={false}
      />,
    );
    expect(screen.getByLabelText("Catégorie de l'élément 1")).toHaveValue("PNJ");
    expect(screen.getByLabelText("Nom de l'élément 1")).toHaveValue("Grom");
    expect(screen.getByLabelText("Nom de l'élément 2")).toHaveValue("La crypte");
  });

  test("Enregistrer emits the cleaned, trimmed element list", async () => {
    const onSave = vi.fn();
    render(
      <ElementsEditor
        initialElements={sample}
        onSave={onSave}
        onCancel={vi.fn()}
        saving={false}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(onSave).toHaveBeenCalledWith([
      { category: "PNJ", name: "Grom", description: "Forgeron." },
      { category: "Lieux", name: "La crypte", description: "" },
    ]);
  });

  test("a row with a blank category or name blocks the save", async () => {
    const onSave = vi.fn();
    render(
      <ElementsEditor
        initialElements={[{ category: "PNJ", name: "Grom", description: "x" }]}
        onSave={onSave}
        onCancel={vi.fn()}
        saving={false}
      />,
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Catégorie de l'élément 1"));
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/catégorie et un nom/i);
  });

  test("adding and deleting rows works", async () => {
    render(
      <ElementsEditor
        initialElements={[{ category: "PNJ", name: "Grom", description: "" }]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        saving={false}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Ajouter un élément/ }));
    expect(screen.getByLabelText("Nom de l'élément 2")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Supprimer l'élément 2" }),
    );
    expect(screen.queryByLabelText("Nom de l'élément 2")).not.toBeInTheDocument();
  });

  test("an all-empty editor saves as an empty list (clear)", async () => {
    const onSave = vi.fn();
    render(
      <ElementsEditor
        initialElements={[]}
        onSave={onSave}
        onCancel={vi.fn()}
        saving={false}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  test("Annuler calls onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <ElementsEditor
        initialElements={sample}
        onSave={vi.fn()}
        onCancel={onCancel}
        saving={false}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Annuler/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
