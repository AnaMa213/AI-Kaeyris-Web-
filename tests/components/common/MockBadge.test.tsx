// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MockBadge } from "@/components/common/MockBadge";

const renderBadge = (
  props: Partial<Parameters<typeof MockBadge>[0]> = {
    tooltip: "Suppression locale, non persistée",
  },
) => {
  const tooltip = "tooltip" in props ? props.tooltip! : "default tip";
  return render(
    <TooltipProvider delay={0}>
      <MockBadge {...props} tooltip={tooltip} />
    </TooltipProvider>,
  );
};

describe("<MockBadge>", () => {
  test("renders the default 'Mock' label when no label is provided", () => {
    renderBadge({ tooltip: "Endpoint backend en attente" });
    expect(screen.getByText("Mock")).toBeInTheDocument();
  });

  test("renders a custom label when provided", () => {
    renderBadge({
      label: "BETA",
      tooltip: "Feature en bêta",
    });
    expect(screen.getByText("BETA")).toBeInTheDocument();
    expect(screen.queryByText("Mock")).not.toBeInTheDocument();
  });

  test("the trigger carries the tooltip text as aria-label for assistive tech", () => {
    renderBadge({ tooltip: "Suppression locale, non persistée" });
    expect(
      screen.getByLabelText("Suppression locale, non persistée"),
    ).toBeInTheDocument();
  });
});
