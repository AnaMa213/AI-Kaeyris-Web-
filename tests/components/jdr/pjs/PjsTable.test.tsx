// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("<PjsTable>", () => {
  test("renders one row per PJ with name and formatted date", () => {
    render(<PjsTable pjs={samplePjs} />);
    expect(screen.getByText("Eldrin le Sage")).toBeInTheDocument();
    expect(screen.getByText("Galadriel")).toBeInTheDocument();
    expect(screen.getByText("30/05/2026")).toBeInTheDocument();
    expect(screen.getByText("15/04/2026")).toBeInTheDocument();
  });

  test("renders column headers Nom + Créé", () => {
    render(<PjsTable pjs={samplePjs} />);
    expect(
      screen.getByRole("columnheader", { name: "Nom" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Créé" }),
    ).toBeInTheDocument();
  });

  test("never exposes the PJ id (UUID) in the DOM text", () => {
    render(<PjsTable pjs={samplePjs} />);
    expect(
      screen.queryByText("00000000-0000-0000-0000-000000000001"),
    ).not.toBeInTheDocument();
  });

  test("renders an empty tbody when given no PJs", () => {
    render(<PjsTable pjs={[]} />);
    const rows = screen.queryAllByRole("row");
    // 1 header row only
    expect(rows).toHaveLength(1);
  });
});
