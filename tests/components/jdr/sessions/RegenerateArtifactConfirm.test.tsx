// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegenerateArtifactConfirm } from "@/components/jdr/sessions/RegenerateArtifactConfirm";

function renderConfirm(
  overrides: {
    open?: boolean;
    artifactLabel?: string;
    onConfirm?: () => void;
    onOpenChange?: (open: boolean) => void;
  } = {},
) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <RegenerateArtifactConfirm
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
      artifactLabel={overrides.artifactLabel ?? "le Résumé"}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("<RegenerateArtifactConfirm>", () => {
  test("renders the title with the artifact label and the replacement warning", () => {
    renderConfirm({ artifactLabel: "le Récit" });
    expect(
      screen.getByRole("heading", { name: "Régénérer le Récit ?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Le contenu actuel sera remplacé/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aucun historique de versions/i),
    ).toBeInTheDocument();
  });

  test("clicking Régénérer fires onConfirm", async () => {
    const { onConfirm } = renderConfirm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Régénérer" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("clicking Annuler closes the dialog without confirming", async () => {
    const { onConfirm, onOpenChange } = renderConfirm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("renders nothing actionable when closed", () => {
    renderConfirm({ open: false });
    expect(
      screen.queryByRole("button", { name: "Régénérer" }),
    ).not.toBeInTheDocument();
  });
});
