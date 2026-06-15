// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { ArtifactRegenerateControls } = await import(
  "@/components/jdr/sessions/ArtifactRegenerateControls"
);

const baseProps = {
  artifactLabel: "le Résumé",
  jobId: null,
  jobInFlight: false,
  jobFailed: false,
  failureReason: null,
  pending: false,
  onConfirm: vi.fn(),
};

describe("<ArtifactRegenerateControls> split (Story 4.23 AC6)", () => {
  test("part='trigger' renders the compact button with the full accessible name", () => {
    render(<ArtifactRegenerateControls {...baseProps} part="trigger" />);
    const button = screen.getByRole("button", { name: "Régénérer le Résumé" });
    // Visible label is compact; the artifact name lives in the accessible name.
    expect(button).toHaveTextContent("Régénérer");
    expect(button).not.toHaveTextContent("Régénérer le Résumé");
  });

  test("part='trigger' opens the confirm dialog and calls onConfirm", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtifactRegenerateControls
        {...baseProps}
        onConfirm={onConfirm}
        part="trigger"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Régénérer le Résumé" }),
    );
    // The confirm dialog exposes its own "Régénérer" confirm action.
    const confirm = await screen.findByRole("button", { name: "Régénérer" });
    await user.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  test("part='status' renders nothing when idle", () => {
    const { container } = render(
      <ArtifactRegenerateControls {...baseProps} part="status" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("part='status' surfaces the failure reason and no trigger button", () => {
    render(
      <ArtifactRegenerateControls
        {...baseProps}
        part="status"
        jobFailed
        failureReason="timeout"
      />,
    );
    expect(
      screen.getByText("La régénération a échoué : timeout"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Régénérer/ }),
    ).not.toBeInTheDocument();
  });
});
