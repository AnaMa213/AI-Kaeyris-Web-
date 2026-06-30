// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Story 7.3 (#4) — color UX norm: the primary/creation button (default variant)
 * uses the gold accent, NOT the red `accent-action`; red stays reserved for
 * destructive/error affordances (the `destructive` variant).
 */
describe("<Button> color variants (Story 7.3)", () => {
  test("default (creation/primary) variant uses the gold accent, not red", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes).toContain("bg-accent-gold");
    expect(classes).toContain("text-accent-gold-fg");
    // Must NOT fall back to the red primary/action token.
    expect(classes).not.toContain("bg-primary");
  });

  test("destructive variant keeps the red destructive token", () => {
    const classes = buttonVariants({ variant: "destructive" });
    expect(classes).toContain("destructive");
    expect(classes).not.toContain("bg-accent-gold");
  });

  test("a default Button renders with the gold class in the DOM", () => {
    render(<Button>Créer une session</Button>);
    const button = screen.getByRole("button", { name: "Créer une session" });
    expect(button.className).toContain("bg-accent-gold");
  });
});
