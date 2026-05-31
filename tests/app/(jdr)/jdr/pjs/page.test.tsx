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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TooltipProvider } from "@/components/ui/tooltip";

const { default: PjsPage } = await import("@/app/(jdr)/jdr/pjs/page");

const samplePj = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Eldrin",
  created_at: "2026-05-30T10:00:00Z",
};

const setupFetch = (
  handler: (url: string, method: string) => Response | Promise<Response>,
) =>
  vi.fn(async (input: Request | string) => {
    const url = typeof input === "string" ? input : input.url;
    const method =
      typeof input === "string" ? "GET" : (input.method ?? "GET");
    return handler(url, method.toUpperCase());
  });

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={0}>
        <PjsPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return queryClient;
};

describe("/jdr/pjs page", () => {
  test("renders the FantasyLoader while the list is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the EmptyState with the 'Nouveau PJ' CTA when items is empty", async () => {
    vi.stubGlobal(
      "fetch",
      setupFetch((url, method) => {
        if (url.endsWith("/services/jdr/pjs") && method === "GET") {
          return new Response(JSON.stringify({ items: [], total: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );
    renderPage();
    expect(
      await screen.findByText("Aucun PJ dans le grimoire."),
    ).toBeInTheDocument();
    // The EmptyState CTA is enabled (no tooltip on it).
    const ctaButtons = screen.getAllByRole("button", { name: "Nouveau PJ" });
    expect(ctaButtons.length).toBeGreaterThanOrEqual(2); // header + EmptyState
    expect(ctaButtons[0]).toBeEnabled();
  });

  test("renders the PjsTable when items is non-empty", async () => {
    vi.stubGlobal(
      "fetch",
      setupFetch((url, method) => {
        if (url.endsWith("/services/jdr/pjs") && method === "GET") {
          return new Response(
            JSON.stringify({ items: [samplePj], total: 1 }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );
    renderPage();
    expect(await screen.findByText("Eldrin")).toBeInTheDocument();
    expect(
      screen.queryByText("Aucun PJ dans le grimoire."),
    ).not.toBeInTheDocument();
  });

  test("clicking 'Nouveau PJ' opens the Dialog", async () => {
    vi.stubGlobal(
      "fetch",
      setupFetch((url, method) => {
        if (url.endsWith("/services/jdr/pjs") && method === "GET") {
          return new Response(JSON.stringify({ items: [], total: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Aucun PJ dans le grimoire.");

    const headerCta = screen.getAllByRole("button", { name: "Nouveau PJ" })[0];
    await user.click(headerCta);
    expect(
      await screen.findByRole("heading", { name: "Nouveau PJ" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nom du PJ")).toBeInTheDocument();
  });

  test("submitting a new PJ POSTs the body and closes the Dialog on success", async () => {
    const fetchMock = setupFetch((url, method) => {
      if (url.endsWith("/services/jdr/pjs") && method === "GET") {
        return new Response(JSON.stringify({ items: [], total: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/services/jdr/pjs") && method === "POST") {
        return new Response(JSON.stringify(samplePj), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Aucun PJ dans le grimoire.");

    const headerCta = screen.getAllByRole("button", { name: "Nouveau PJ" })[0];
    await user.click(headerCta);
    await user.type(screen.getByLabelText("Nom du PJ"), "Eldrin");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find((args) => {
        const request = args[0] as Request;
        return (
          request.url.endsWith("/services/jdr/pjs") &&
          request.method === "POST"
        );
      });
      expect(postCall).toBeDefined();
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Nouveau PJ" }),
      ).not.toBeInTheDocument();
    });
  });

  test("surfaces 'Ce nom de PJ existe déjà' on 409 duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      setupFetch((url, method) => {
        if (url.endsWith("/services/jdr/pjs") && method === "GET") {
          return new Response(JSON.stringify({ items: [], total: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/services/jdr/pjs") && method === "POST") {
          return new Response(
            JSON.stringify({
              type: "https://kaeyris.local/errors/duplicate-pj",
              title: "Duplicate PJ",
              status: 409,
            }),
            {
              status: 409,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Aucun PJ dans le grimoire.");

    const headerCta = screen.getAllByRole("button", { name: "Nouveau PJ" })[0];
    await user.click(headerCta);
    await user.type(screen.getByLabelText("Nom du PJ"), "Eldrin");
    await user.click(screen.getByRole("button", { name: "Créer" }));

    expect(
      await screen.findByText("Ce nom de PJ existe déjà"),
    ).toBeInTheDocument();
  });

  test("clicking 'Supprimer' on a row opens the PjDeleteConfirm dialog with that PJ's name", async () => {
    vi.stubGlobal(
      "fetch",
      setupFetch((url, method) => {
        if (url.endsWith("/services/jdr/pjs") && method === "GET") {
          return new Response(
            JSON.stringify({ items: [samplePj], total: 1 }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(samplePj.name);

    await user.click(
      screen.getByRole("button", { name: `Supprimer le PJ ${samplePj.name}` }),
    );

    expect(
      await screen.findByRole("heading", {
        name: `Supprimer ${samplePj.name} ?`,
      }),
    ).toBeInTheDocument();
  });

  test("confirming deletion DELETE-s the PJ and removes it from the table", async () => {
    const fetchMock = setupFetch((url, method) => {
      if (url.endsWith("/services/jdr/pjs") && method === "GET") {
        return new Response(JSON.stringify({ items: [samplePj], total: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (
        url.endsWith(`/services/jdr/pjs/${samplePj.id}`) &&
        method === "DELETE"
      ) {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(samplePj.name);

    await user.click(
      screen.getByRole("button", { name: `Supprimer le PJ ${samplePj.name}` }),
    );
    await user.type(
      await screen.findByLabelText(/Tape/i),
      samplePj.name,
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer le PJ" }),
    );

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find((args) => {
        const request = args[0] as Request;
        return (
          request.url.endsWith(`/services/jdr/pjs/${samplePj.id}`) &&
          request.method === "DELETE"
        );
      });
      expect(deleteCall).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.queryByText(samplePj.name)).not.toBeInTheDocument();
    });
    // The empty state replaces the table once the only PJ is gone.
    expect(
      await screen.findByText("Aucun PJ dans le grimoire."),
    ).toBeInTheDocument();
  });

  test("Annuler closes the delete dialog without DELETE-ing", async () => {
    const fetchMock = setupFetch((url, method) => {
      if (url.endsWith("/services/jdr/pjs") && method === "GET") {
        return new Response(JSON.stringify({ items: [samplePj], total: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(samplePj.name);

    await user.click(
      screen.getByRole("button", { name: `Supprimer le PJ ${samplePj.name}` }),
    );
    await screen.findByRole("heading", {
      name: `Supprimer ${samplePj.name} ?`,
    });
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: `Supprimer ${samplePj.name} ?`,
        }),
      ).not.toBeInTheDocument();
    });
    // No DELETE issued
    const deleteCall = fetchMock.mock.calls.find((args) => {
      const request = args[0] as Request;
      return request.method === "DELETE";
    });
    expect(deleteCall).toBeUndefined();
  });
});
