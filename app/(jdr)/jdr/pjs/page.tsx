"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { PjForm } from "@/components/jdr/pjs/PjForm";
import { PjDeleteConfirm } from "@/components/jdr/pjs/PjDeleteConfirm";
import { PjsTable } from "@/components/jdr/pjs/PjsTable";
import { ApiError } from "@/lib/core/api/errors";
import {
  useCreatePj,
  useDeletePj,
  useListPjs,
  type PjOut,
} from "@/lib/jdr/pjs/queries";

function formatCreateError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    const haystack = `${error.problem.type ?? ""} ${error.problem.title ?? ""}`;
    if (haystack.toLowerCase().includes("duplicate")) {
      return "Ce nom de PJ existe déjà";
    }
    return "Création impossible. Vérifie le nom saisi ou réessaie.";
  }
  if (error instanceof Error) return error.message;
  return null;
}

function formatDeleteError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return "Suppression impossible. Réessaie.";
  if (error instanceof Error) return error.message;
  return null;
}

export default function PjsPage() {
  const pjsQuery = useListPjs();
  const createMutation = useCreatePj();
  const deleteMutation = useDeletePj();

  const [creating, setCreating] = useState(false);
  const [deletingPj, setDeletingPj] = useState<PjOut | null>(null);

  const createErrorMessage = formatCreateError(createMutation.error);
  const deleteErrorMessage = formatDeleteError(deleteMutation.error);

  return (
    <section className="bg-background text-foreground min-h-full p-8">
      <header className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">PJs</h1>
          <p className="text-text-chrome-muted mt-1 text-sm">
            Les personnages joueurs de tes campagnes.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          Nouveau PJ
        </Button>
      </header>

      <section className="mx-auto max-w-5xl">
        {pjsQuery.isPending && (
          <FantasyLoader message="Consultation du grimoire des PJs..." />
        )}

        {pjsQuery.isError && (
          <div
            role="alert"
            className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
          >
            <p className="font-medium">Impossible de charger les PJs.</p>
            {pjsQuery.error instanceof ApiError && (
              <p className="text-text-chrome-muted mt-2 text-xs">
                {pjsQuery.error.problem.title}
              </p>
            )}
          </div>
        )}

        {pjsQuery.data && pjsQuery.data.items.length === 0 && (
          <EmptyState
            title="Aucun PJ dans le grimoire."
            description="Crée ton premier PJ pour démarrer une campagne."
            action={{
              label: "Nouveau PJ",
              onClick: () => setCreating(true),
            }}
          />
        )}

        {pjsQuery.data && pjsQuery.data.items.length > 0 && (
          <PjsTable pjs={pjsQuery.data.items} onDelete={setDeletingPj} />
        )}
      </section>

      <PjForm
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) createMutation.reset();
        }}
        submitting={createMutation.isPending}
        errorMessage={createErrorMessage}
        onSubmit={(values) => {
          createMutation.mutate(values, {
            onSuccess: () => {
              setCreating(false);
            },
          });
        }}
      />

      <PjDeleteConfirm
        open={deletingPj !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingPj(null);
            deleteMutation.reset();
          }
        }}
        pj={deletingPj}
        submitting={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        onConfirm={(pjId) => {
          deleteMutation.mutate(pjId, {
            onSuccess: () => setDeletingPj(null),
          });
        }}
      />
    </section>
  );
}
