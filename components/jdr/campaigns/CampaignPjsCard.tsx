"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { MockBadge } from "@/components/common/MockBadge";
import { PjDeleteConfirm } from "@/components/jdr/pjs/PjDeleteConfirm";
import { PjForm } from "@/components/jdr/pjs/PjForm";
import { ApiError } from "@/lib/core/api/errors";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { canManageCampaignPjs } from "@/lib/jdr/campaigns/permissions";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";
import {
  useCreateCampaignPj,
  useDeletePj,
  useListCampaignPjs,
  type PjOut,
} from "@/lib/jdr/pjs/queries";

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

interface CampaignPjsCardProps {
  campaign: CampaignOut;
}

function formatCreateError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    const haystack = `${error.problem.type ?? ""} ${error.problem.title ?? ""}`;
    if (haystack.toLowerCase().includes("duplicate")) {
      return "Ce nom de PJ existe déjà dans cette campagne.";
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

function sortByCreatedAtDesc(items: PjOut[]): PjOut[] {
  return [...items].sort(
    (a, b) =>
      parseBackendDate(b.created_at).getTime() -
      parseBackendDate(a.created_at).getTime(),
  );
}

export function CampaignPjsCard({ campaign }: CampaignPjsCardProps) {
  const pjsQuery = useListCampaignPjs(campaign.id);
  const createMutation = useCreateCampaignPj(campaign.id);
  const deleteMutation = useDeletePj(campaign.id);

  const [creating, setCreating] = useState(false);
  const [deletingPj, setDeletingPj] = useState<PjOut | null>(null);

  const canManage = canManageCampaignPjs(campaign);
  const createErrorMessage = formatCreateError(createMutation.error);
  const deleteErrorMessage = formatDeleteError(deleteMutation.error);

  const items = pjsQuery.data?.items ?? [];
  const sorted = sortByCreatedAtDesc(items);

  return (
    <section className={SECTION_CARD_CLASSES}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">PJs</h2>
        {canManage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCreating(true)}
          >
            Ajouter un PJ
          </Button>
        )}
      </header>

      {pjsQuery.isPending && (
        <p className="text-text-chrome-muted text-sm">
          Chargement des PJs...
        </p>
      )}

      {pjsQuery.isError && (
        <div
          role="alert"
          className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
        >
          <p className="font-medium">
            Les PJs de cette campagne n&apos;ont pas pu être chargés.
          </p>
          {pjsQuery.error instanceof ApiError && (
            <p className="text-text-chrome-muted mt-2 text-xs">
              {pjsQuery.error.problem.title}
            </p>
          )}
        </div>
      )}

      {pjsQuery.data && sorted.length === 0 && canManage && (
        <EmptyState
          title="Aucun PJ dans cette campagne."
          description="Ajoute le premier PJ pour démarrer ton roster narratif."
          action={{
            label: "Ajouter un PJ",
            onClick: () => setCreating(true),
          }}
        />
      )}

      {pjsQuery.data && sorted.length === 0 && !canManage && (
        <p className="text-text-chrome-muted text-sm italic">
          Aucun PJ dans cette campagne pour le moment.
        </p>
      )}

      {pjsQuery.data && sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((pj) => {
            const createdAt = parseBackendDate(pj.created_at);
            const relative = formatDistanceToNow(createdAt, {
              addSuffix: true,
              locale: fr,
            });
            const absolute = format(createdAt, "dd/MM/yyyy", { locale: fr });
            return (
              <li
                key={pj.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{pj.name}</p>
                  <time
                    dateTime={pj.created_at}
                    title={absolute}
                    className="text-text-chrome-muted text-xs"
                  >
                    {relative}
                  </time>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingPj(pj)}
                    aria-label={`Supprimer le PJ ${pj.name}`}
                    className="text-state-error hover:text-state-error! hover:bg-state-error/10!"
                  >
                    Supprimer
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <p className="text-text-chrome-muted mt-3 flex items-center gap-2 text-xs">
          <MockBadge tooltip="Suppression locale, non persistée — endpoint backend en attente (BD-3)" />
          <span>La suppression d&apos;un PJ est encore mockée localement.</span>
        </p>
      )}

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
