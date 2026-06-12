"use client";

import { useState } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/common/IconButton";
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

// Resolve a user_id to a short, human label. Never surface a raw UUID:
// a linked-but-unresolved user_id (still loading, or a user not in the list)
// degrades to a neutral "Joueur lié".
function linkLabelForUser(
  userId: string | null | undefined,
  users: UserOut[],
): string {
  if (!userId) return "Non lié";
  const linked = users.find((user) => user.id === userId);
  return linked ? `@${linked.username}` : "Joueur lié";
}

// Bug 3 (v2) — liaison joueur via une petite icône de liaison + dropdown compact
// (l'ancien Select pleine largeur mangeait toute la ligne). La ligne « @user · date »
// dessous reflète la sélection ; côté parent, un feedback optimiste évite l'attente
// du refetch.
function PjLinkControl({
  pj,
  users,
  pending,
  onLink,
}: {
  pj: PjOut;
  users: UserOut[];
  pending: boolean;
  onLink: (userId: string | null) => void;
}) {
  const linked = Boolean(pj.user_id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            disabled={pending}
            aria-label={
              linked
                ? `Modifier la liaison joueur de ${pj.name}`
                : `Lier ${pj.name} à un joueur`
            }
            title={linked ? "Modifier la liaison" : "Lier à un joueur"}
            className={linked ? "text-accent-gold" : "text-text-chrome-muted"}
          />
        }
      >
        <Link2 aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <p className="text-text-chrome-muted px-1.5 py-1 text-xs font-medium">
          Lier à un joueur
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={!pj.user_id}
          onCheckedChange={() => onLink(null)}
        >
          Non lié
        </DropdownMenuCheckboxItem>
        {users.map((user) => (
          <DropdownMenuCheckboxItem
            key={user.id}
            checked={pj.user_id === user.id}
            onCheckedChange={() => onLink(user.id)}
          >
            @{user.username}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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

  // Liaison joueur inline (dropdown icône) — réutilise la mutation de mise à
  // jour (le nom est conservé tel quel). Erreur surfacée en toast (pas de dialog).
  const handleLink = (pj: PjOut, userId: string | null) => {
    if ((pj.user_id ?? null) === userId) return;
    updateMutation.mutate(
      { pjId: pj.id, name: pj.name, userId },
      {
        onError: (error) =>
          toast.error(formatUpdateError(error) ?? "Modification impossible."),
      },
    );
  };

  return (
    <section className={SECTION_CARD_CLASSES}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">PJs</h2>
        {/* Bug 1 : sur roster vide, l'empty state porte déjà le CTA —
            on masque ici le doublon du header. */}
        {canManage && sorted.length > 0 && (
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
            // Feedback optimiste de la liaison : `mutation.variables` + `isPending`
            // → la ligne « @user » se met à jour avant le refetch ; au repli (échec)
            // `isPending` retombe et on revient à la valeur serveur.
            const pendingUserId =
              updateMutation.isPending &&
              updateMutation.variables?.pjId === pj.id
                ? updateMutation.variables.userId
                : undefined;
            const effectiveUserId =
              pendingUserId !== undefined ? pendingUserId : pj.user_id;
            return (
              <li
                key={pj.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate font-medium">{pj.name}</p>
                    {/* Item 2 : icône de liaison compacte → dropdown joueur. */}
                    {canManage && (
                      <PjLinkControl
                        pj={pj}
                        users={users}
                        pending={pendingUserId !== undefined}
                        onLink={(userId) => handleLink(pj, userId)}
                      />
                    )}
                  </div>
                  <p className="text-text-chrome-muted text-xs">
                    {linkLabelForUser(effectiveUserId, users)}
                    <span aria-hidden="true"> · </span>
                    <time dateTime={pj.created_at} title={absolute}>
                      {relative}
                    </time>
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label={`Éditer le PJ ${pj.name}`}
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => setEditingPj(pj)}
                    />
                    <IconButton
                      label={`Supprimer le PJ ${pj.name}`}
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={() => setDeletingPj(pj)}
                      className="text-state-error-strong hover:text-state-error-strong! hover:bg-state-error/10!"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PjForm
        open={creating}
        users={users}
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
