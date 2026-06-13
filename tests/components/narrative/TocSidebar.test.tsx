// @vitest-environment jsdom

import { act } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NarrativeReader } from "@/components/narrative/NarrativeReader";

// jsdom (v28) n'implémente NI IntersectionObserver, NI scrollIntoView, NI
// matchMedia, et le setup partagé (tests/setup-jsdom.ts) ne les stubbe pas.
// On les fournit ici pour piloter le scrollspy et observer le scroll au clic.

type IOEntry = { target: Element; isIntersecting: boolean };

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: (entries: IOEntry[], observer: MockIntersectionObserver) => void;
  elements: Element[] = [];

  constructor(
    callback: (entries: IOEntry[], observer: MockIntersectionObserver) => void,
  ) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.elements.push(el);
  }
  unobserve(el: Element) {
    this.elements = this.elements.filter((e) => e !== el);
  }
  disconnect() {
    this.elements = [];
  }
  takeRecords() {
    return [];
  }

  /** Helper de test : déclenche le callback avec un titre marqué visible. */
  emitActive(id: string) {
    const target = this.elements.find((el) => el.id === id);
    if (!target) throw new Error(`Aucun titre observé avec l'id ${id}`);
    act(() => this.callback([{ target, isIntersecting: true }], this));
  }
}

const scrollIntoViewMock = vi.fn();

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  scrollIntoViewMock.mockClear();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Markdown long-form : 1 h1, 2 h2, 1 h3 imbriqué. rehype-slug (Story 5.1) produit
// les ids déterministes "chapitre-un" / "sous-section-a" / "chapitre-deux".
const MARKDOWN = [
  "# Titre principal",
  "",
  "Une introduction posée.",
  "",
  "## Chapitre Un",
  "",
  "Le voyage commence.",
  "",
  "### Sous section A",
  "",
  "Un détail.",
  "",
  "## Chapitre Deux",
  "",
  "La suite du récit.",
].join("\n");

async function getToc() {
  return screen.findByRole("navigation", { name: "Sommaire" });
}

describe("<TocSidebar> (Story 5.2)", () => {
  test("liste uniquement les titres h2/h3, dans l'ordre, avec leurs ancres", async () => {
    render(<NarrativeReader markdown={MARKDOWN} kind="narrative" />);
    const nav = await getToc();
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "Chapitre Un",
      "Sous section A",
      "Chapitre Deux",
    ]);
    // pas de h1 dans le sommaire
    expect(
      within(nav).queryByRole("link", { name: "Titre principal" }),
    ).toBeNull();
    // les cibles sont les ids déterministes de la Story 5.1
    expect(
      within(nav).getByRole("link", { name: "Chapitre Un" }),
    ).toHaveAttribute("href", "#chapitre-un");
    expect(
      within(nav).getByRole("link", { name: "Sous section A" }),
    ).toHaveAttribute("href", "#sous-section-a");
  });

  test("ne rend rien quand l'article a moins de 2 titres (garde AC6)", async () => {
    render(
      <NarrativeReader
        markdown={"## Seul chapitre\n\nUn paragraphe."}
        kind="summary"
      />,
    );
    // Laisse passer l'effet d'extraction puis vérifie l'absence de sommaire.
    await waitFor(() =>
      expect(screen.getByText("Un paragraphe.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation", { name: "Sommaire" })).toBeNull();
  });

  test("clic sur une entrée scrolle en douceur jusqu'à la section", async () => {
    render(<NarrativeReader markdown={MARKDOWN} kind="narrative" />);
    const nav = await getToc();
    const user = userEvent.setup();
    await user.click(within(nav).getByRole("link", { name: "Chapitre Deux" }));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  test("respecte prefers-reduced-motion : scroll instantané (behavior auto)", async () => {
    stubMatchMedia(true);
    render(<NarrativeReader markdown={MARKDOWN} kind="narrative" />);
    const nav = await getToc();
    const user = userEvent.setup();
    await user.click(within(nav).getByRole("link", { name: "Chapitre Un" }));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  test("scrollspy : le titre visible reçoit aria-current=location", async () => {
    render(<NarrativeReader markdown={MARKDOWN} kind="narrative" />);
    const nav = await getToc();
    // L'observer est créé une fois les titres extraits.
    const observer = MockIntersectionObserver.instances.at(-1);
    expect(observer).toBeDefined();
    observer!.emitActive("chapitre-deux");

    expect(
      within(nav).getByRole("link", { name: "Chapitre Deux" }),
    ).toHaveAttribute("aria-current", "location");
    expect(
      within(nav).getByRole("link", { name: "Chapitre Un" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("le sommaire est repliable (UX-DR4)", async () => {
    render(<NarrativeReader markdown={MARKDOWN} kind="narrative" />);
    const nav = await getToc();
    const user = userEvent.setup();
    const toggle = within(nav).getByRole("button", { name: /Sommaire/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getAllByRole("link")).toHaveLength(3);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryAllByRole("link")).toHaveLength(0);
  });
});
