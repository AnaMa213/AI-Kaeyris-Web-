// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { default: SessionsPage } = await import(
  "@/app/(jdr)/jdr/sessions/page"
);

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

  test("CTA 'Nouvelle session' is enabled now that Story 2.3 ships the creation page", () => {
    render(<SessionsPage />);
    const button = screen.getByRole("button", { name: "Nouvelle session" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("title");
  });

  test("clicking 'Nouvelle session' navigates to /jdr/sessions/new", async () => {
    pushMock.mockClear();
    const user = userEvent.setup();
    render(<SessionsPage />);
    await user.click(screen.getByRole("button", { name: "Nouvelle session" }));
    expect(pushMock).toHaveBeenCalledWith("/jdr/sessions/new");
  });
});
