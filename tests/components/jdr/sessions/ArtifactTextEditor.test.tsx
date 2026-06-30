// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ArtifactTextEditor,
  applyMarkdownCommand,
} from "@/components/jdr/sessions/ArtifactTextEditor";

describe("applyMarkdownCommand (Story 8.2 — Markdown toolbar)", () => {
  test("bold wraps the selection and re-selects the inner text", () => {
    const out = applyMarkdownCommand("bold", { value: "abc", start: 0, end: 3 });
    expect(out.value).toBe("**abc**");
    expect(out.value.slice(out.start, out.end)).toBe("abc");
  });

  test("bold with no selection inserts a placeholder", () => {
    const out = applyMarkdownCommand("italic", { value: "", start: 0, end: 0 });
    expect(out.value).toBe("*texte*");
    expect(out.value.slice(out.start, out.end)).toBe("texte");
  });

  test('"taille" maps to heading level prefixes on the current line', () => {
    expect(applyMarkdownCommand("h1", { value: "hello", start: 0, end: 0 }).value).toBe("# hello");
    expect(applyMarkdownCommand("h2", { value: "hello", start: 2, end: 2 }).value).toBe("## hello");
    expect(applyMarkdownCommand("h3", { value: "a\nb", start: 2, end: 2 }).value).toBe("a\n### b");
  });

  test("list and quote prefix the current line", () => {
    expect(applyMarkdownCommand("ul", { value: "x", start: 1, end: 1 }).value).toBe("- x");
    expect(applyMarkdownCommand("quote", { value: "x", start: 0, end: 0 }).value).toBe("> x");
  });

  test("hr inserts a thematic-break block at the caret", () => {
    const out = applyMarkdownCommand("hr", { value: "ab", start: 1, end: 1 });
    expect(out.value).toBe("a\n\n---\n\nb");
    expect(out.start).toBe(out.end); // collapsed caret after the block
  });
});

describe("<ArtifactTextEditor>", () => {
  function setup() {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <ArtifactTextEditor
        idPrefix="test"
        initialMarkdown="hi"
        kind="summary"
        onSave={onSave}
        onCancel={onCancel}
        saving={false}
      />,
    );
    return { onSave, onCancel };
  }

  test("seeds the textarea with the initial markdown and previews it", () => {
    setup();
    expect(screen.getByLabelText("Éditeur Markdown")).toHaveValue("hi");
    // Live preview renders the same text through the production renderer.
    const preview = document.querySelector('article[data-kind="summary"]');
    expect(preview?.textContent).toContain("hi");
  });

  test("a toolbar button inserts Markdown into the draft", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Gras" }));
    const textarea = screen.getByLabelText("Éditeur Markdown") as HTMLTextAreaElement;
    expect(textarea.value).toContain("**texte**");
  });

  test("Enregistrer submits the current draft; Annuler discards", async () => {
    const { onSave, onCancel } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(onSave).toHaveBeenCalledWith("hi");
    await user.click(screen.getByRole("button", { name: /Annuler/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("a blank draft disables Enregistrer", () => {
    render(
      <ArtifactTextEditor
        idPrefix="blank"
        initialMarkdown="   "
        kind="narrative"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        saving={false}
      />,
    );
    expect(screen.getByRole("button", { name: /Enregistrer/ })).toBeDisabled();
  });
});
