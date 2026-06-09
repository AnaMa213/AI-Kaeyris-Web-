// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

/**
 * Story 4.6 — dialogs (Base UI primitive) must only close via the X or an
 * explicit cancel button, never via outside-click or Escape.
 */
function Harness({ onChange }: { onChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onChange(next);
        setOpen(next);
      }}
    >
      <DialogContent>
        <DialogTitle>Titre du dialog</DialogTitle>
        <p>Contenu du dialog</p>
      </DialogContent>
    </Dialog>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("<Dialog> dismissal (Story 4.6)", () => {
  test("Escape does not close the dialog", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(await screen.findByText("Contenu du dialog")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.keyboard("{Escape}");

    // The consumer's onOpenChange must not be asked to close on Escape.
    expect(onChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("Contenu du dialog")).toBeInTheDocument();
  });

  test("outside click does not close the dialog", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(await screen.findByText("Contenu du dialog")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(document.body);

    expect(onChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("Contenu du dialog")).toBeInTheDocument();
  });

  test("the X close button still closes the dialog", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(await screen.findByText("Contenu du dialog")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    await waitFor(() =>
      expect(screen.queryByText("Contenu du dialog")).not.toBeInTheDocument(),
    );
  });
});

/**
 * Story 4.6 — the explicit "Annuler" button closes via a programmatic
 * `onOpenChange(false)` that bypasses Base UI's event pipeline (no
 * `eventDetails`). The primitive's dismissal guard must NOT swallow it.
 */
function ConfirmHarness({ onChange }: { onChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onChange(next);
        setOpen(next);
      }}
      title="Confirmer l'action"
      confirmLabel="Confirmer"
      onConfirm={() => {}}
    />
  );
}

describe("<ConfirmDialog> explicit cancel (Story 4.6)", () => {
  test("the Annuler button closes the dialog", async () => {
    const onChange = vi.fn();
    render(<ConfirmHarness onChange={onChange} />);
    expect(await screen.findByText("Confirmer l'action")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    await waitFor(() =>
      expect(screen.queryByText("Confirmer l'action")).not.toBeInTheDocument(),
    );
  });
});
