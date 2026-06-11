"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { PjDeleteConfirm } from "@/components/jdr/pjs/PjDeleteConfirm";
import { PjForm, type PjFormSubmitPayload } from "@/components/jdr/pjs/PjForm";
import { ApiError } from "@/lib/core/api/errors";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { canManageCampaignPjs } from "@/lib/jdr/campaigns/permissions";
import type { CampaignOut } from "@/lib/jdr/campaigns/queries";
import {
  useCreateCampaignPj,
  useDeleteCampaignPj,
  useListCampaignPjs,
  useUpdateCampaignPj,
  type PjOut,
} from "@/lib/jdr/pjs/queries";
import { useUsers, type UserOut } from "@/lib/jdr/users/queries";

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

function formatUpdateError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    const { status, type, title } = error.problem;
    const haystack = `${type ?? ""} ${title ?? ""}`.toLowerCase();
    if (status === 409 || haystack.includes("duplicate")) {
      return "Ce nom de PJ existe déjà dans cette campagne.";
    }
    if (status === 422 || haystack.includes("invalid-user")) {
      return "Utilisateur invalide ou introuvable.";
    }
    if (status === 404) {
      return "Ce PJ est introuvable. Recharge la page.";
    }
    return "Modification impossible. Réessaie.";
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

// Resolve a PJ's link to a short, human label. Never surface a raw UUID:
// a linked-but-unresolved user_id (still loading, or a user not in the list)
// degrades to a neutral "Joueur lié".
function linkLabel(pj: PjOut, users: UserOut[]): string {
  if (!pj.user_id) return "Non lié";
  const linked = users.find((user) => user.id === pj.user_id);
  return linked ? `Joueur : @${linked.username}` : "Joueur lié";
}

export function CampaignPjsCard({ campaign }: CampaignPjsCardProps) {
  const canManage = canManageCampaignPjs(campaign);
  const pjsQuery = useListCampaignPjs(campaign.id);
  const usersQuery = useUsers({ enabled: canManage });
  const createMutation = useCreateCampaignPj(campaign.id);
  const updateMutation = useUpdateCampaignPj(campaign.id);
  const deleteMutation = useDeleteCampaignPj(campaign.id);

  const [creating, setCreating] = useState(false);
  const [editingPj, setEditingPj] = useState<PjOut | null>(null);
  const [deletingPj, setDeletingPj] = useState<PjOut | null>(null);

  const createErrorMessage = formatCreateError(createMutation.error);
  const updateErrorMessage = formatUpdateError(updateMutation.error);
  const deleteErrorMessage = formatDeleteError(deleteMutation.error);

  const items = pjsQuery.data?.items ?? [];
  const sorted = sortByCreatedAtDesc(items);
  const users = usersQuery.data?.items ?? [];

  const handleSubmit = (payload: PjFormSubmitPayload) => {
    if (payload.mode === "create") {
      createMutation.mutate(payload.values, {
        onSuccess: () => setCreating(false),
      });
      return;
    }
    updateMutation.mutate(
      {
        pjId: payload.id,
        name: payload.values.name,
        userId: payload.values.user_id,
      },
      { onSuccess: () => setEditingPj(null) },
    );
  };

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
                  <p className="text-text-chrome-muted text-xs">
                    {linkLabel(pj, users)}
                    <span aria-hidden="true"> · </span>
                    <time dateTime={pj.created_at} title={absolute}>
                      {relative}
                    </time>
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingPj(pj)}
                      aria-label={`Éditer le PJ ${pj.name}`}
                    >
                      Éditer
                    </Button>
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
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PjForm
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) createMutation.reset();
        }}
        submitting={createMutation.isPending}
        errorMessage={createErrorMessage}
        onSubmit={handleSubmit}
      />

      <PjForm
        mode="edit"
        pj={editingPj}
        users={users}
        open={editingPj !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPj(null);
            updateMutation.reset();
          }
        }}
        submitting={updateMutation.isPending}
        errorMessage={updateErrorMessage}
        onSubmit={handleSubmit}
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
