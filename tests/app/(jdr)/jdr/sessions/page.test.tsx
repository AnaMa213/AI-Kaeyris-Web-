// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionsPage from "@/app/(jdr)/jdr/sessions/page";

describe("/jdr/sessions page", () => {
  test("renders the page header", () => {
    render(<SessionsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sessions" }),
    ).toBeInTheDocument();
  });

  test("shows the EmptyState with the Library empty title", () => {
    render(<SessionsPage />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Aucune session encore.",
      }),
    ).toBeInTheDocument();
  });

  test("CTA 'Nouvelle session' is rendered but disabled with tooltip 'Disponible avec Epic 2'", () => {
    render(<SessionsPage />);
    const button = screen.getByRole("button", { name: "Nouvelle session" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Disponible avec Epic 2");
  });
});
