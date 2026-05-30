// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/common/EmptyState";

describe("<EmptyState>", () => {
  test("renders title in a heading and description below", () => {
    render(
      <EmptyState
        title="Aucune session encore."
        description="Crée ta première session pour commencer."
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Aucune session encore." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Crée ta première session pour commencer."),
    ).toBeInTheDocument();
  });

  test("renders action button when provided and fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Vide"
        description="Rien à afficher"
        action={{ label: "Créer", onClick }}
      />,
    );
    const button = screen.getByRole("button", { name: "Créer" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("renders disabled action with tooltip-like hint when disabled", () => {
    render(
      <EmptyState
        title="Vide"
        description="Rien"
        action={{
          label: "Indisponible",
          onClick: vi.fn(),
          disabled: true,
          disabledHint: "Disponible avec Epic 2",
        }}
      />,
    );
    const button = screen.getByRole("button", { name: "Indisponible" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Disponible avec Epic 2");
  });

  test("uses role='status' on the container for assistive tech", () => {
    render(<EmptyState title="t" description="d" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
