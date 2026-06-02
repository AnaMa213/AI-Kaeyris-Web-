// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { CampaignEditDialog } = await import(
  "@/components/jdr/campaigns/CampaignEditDialog"
);

const sampleCampaign = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Les Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire.",
  role: "gm" as const,
  session_count: 0,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const updatedCampaign = {
  ...sampleCampaign,
  name: "Les Royaumes Brisés V2",
};

type OnOpenChange = (open: boolean) => void;
type PatchBody = { name?: string; description?: string | null };

function renderDialog(opts: {
  fetchImpl?: (
    input: Request | string,
    init?: RequestInit,
  ) => Promise<Response>;
  onOpenChange?: OnOpenChange;
} = {}) {
  const onOpenChange = (opts.onOpenChange ?? vi.fn()) as OnOpenChange;
  if (opts.fetchImpl) {
    vi.stubGlobal("fetch", vi.fn(opts.fetchImpl));
  } else {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(updatedCampaign), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CampaignEditDialog
        open
        onOpenChange={onOpenChange}
        campaign={sampleCampaign}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("<CampaignEditDialog>", () => {
  test("pre-fills the form with the current name and description", () => {
    renderDialog();
    expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe(
      sampleCampaign.name,
    );
    expect(
      (screen.getByLabelText(/Description/i) as HTMLTextAreaElement).value,
    ).toBe(sampleCampaign.description);
  });

  test("submits PATCH with the new name and closes the dialog on success", async () => {
    let patchBody: PatchBody | null = null;
    const onOpenChange = vi.fn();
    renderDialog({
      onOpenChange,
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          if (typeof input !== "string") {
            patchBody = await input.clone().json();
          }
          return new Response(JSON.stringify(updatedCampaign), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    const nameInput = screen.getByLabelText("Nom") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Les Royaumes Brisés V2");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect((patchBody as PatchBody | null)?.name).toBe(
      "Les Royaumes Brisés V2",
    );
    expect(patchBody).not.toHaveProperty("description");
  });

  test("clearing the description sends description: null in the PATCH body", async () => {
    let patchBody: PatchBody | null = null;
    renderDialog({
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          if (typeof input !== "string") {
            patchBody = await input.clone().json();
          }
          return new Response(
            JSON.stringify({ ...sampleCampaign, description: null }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/Description/i));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
    });
    expect((patchBody as PatchBody | null)?.description).toBeNull();
  });

  test("rejects an empty name with the French zod error", async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nom"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Nom requis.")).toBeInTheDocument();
  });

  test("Annuler closes the dialog without submitting", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("surfaces the 403 message on a forbidden response", async () => {
    renderDialog({
      fetchImpl: async (input, init) => {
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (method?.toUpperCase() === "PATCH") {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Forbidden",
              status: 403,
            }),
            {
              status: 403,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      },
    });

    const user = userEvent.setup();
    const nameInput = screen.getByLabelText("Nom") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Les Royaumes BrisÃ©s interdits");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText(
        /Tu n'as pas les permissions pour modifier cette campagne/i,
      ),
    ).toBeInTheDocument();
  });
});
