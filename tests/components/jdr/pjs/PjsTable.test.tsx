// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PjsTable } from "@/components/jdr/pjs/PjsTable";

const samplePjs = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Eldrin le Sage",
    created_at: "2026-05-30T10:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Galadriel",
    created_at: "2026-04-15T14:30:00Z",
  },
];

function renderTable(
  overrides: Partial<Parameters<typeof PjsTable>[0]> = {},
) {
  const onDelete = vi.fn();
  render(
    <TooltipProvider delay={0}>
      <PjsTable pjs={samplePjs} onDelete={onDelete} {...overrides} />
    </TooltipProvider>,
  );
  return { onDelete };
}

describe("<PjsTable>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders one row per PJ with name and relative + absolute dates", () => {
    renderTable();
    expect(screen.getByText("Eldrin le Sage")).toBeInTheDocument();
    expect(screen.getByText("Galadriel")).toBeInTheDocument();
    expect(screen.getByText("il y a 1 jour")).toBeInTheDocument();
    expect(screen.getByText("30/05/2026")).toBeInTheDocument();
    expect(screen.getByText("15/04/2026")).toBeInTheDocument();
  });

  test("renders column headers Nom + Créé + Actions (with MockBadge)", () => {
    renderTable();
    expect(
      screen.getByRole("columnheader", { name: /Nom/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /Créé/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /Actions/i }),
    ).toBeInTheDocument();
    // The MockBadge inside the Actions header carries the explanatory tooltip
    // as aria-label.
    expect(
      screen.getByLabelText(
        "Suppression locale, non persistée — endpoint backend en attente (BD-3)",
      ),
    ).toBeInTheDocument();
  });

  test("never exposes the PJ id (UUID) in the DOM text", () => {
    renderTable();
    expect(
      screen.queryByText("00000000-0000-0000-0000-000000000001"),
    ).not.toBeInTheDocument();
  });

  test("renders an empty tbody when given no PJs", () => {
    renderTable({ pjs: [] });
    const rows = screen.queryAllByRole("row");
    // 1 header row only
    expect(rows).toHaveLength(1);
  });

  test("renders a 'Supprimer le PJ {name}' aria-labelled button per row", () => {
    renderTable();
    expect(
      screen.getByRole("button", { name: "Supprimer le PJ Eldrin le Sage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer le PJ Galadriel" }),
    ).toBeInTheDocument();
  });

  test("clicking 'Supprimer' on a row calls onDelete with that PJ", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { onDelete } = renderTable();
    await user.click(
      screen.getByRole("button", { name: "Supprimer le PJ Galadriel" }),
    );
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(samplePjs[1]);
  });
});
