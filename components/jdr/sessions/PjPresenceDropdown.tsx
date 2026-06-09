"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/core/api/errors";
import { useListCampaignPjs } from "@/lib/jdr/pjs/queries";
import {
  useSessionPlayers,
  useSetSessionPlayers,
} from "@/lib/jdr/sessions/players";

interface PjPresenceDropdownProps {
  sessionId: string;
  campaignId: string;
}

function formatSaveError(error: unknown): string {
  if (error instanceof ApiError && error.problem.status === 403) {
    return "Tu n'as pas les permissions pour déclarer les présents.";
  }
  return "Impossible d'enregistrer les présents. Réessaie.";
}

/**
 * Story 4.7 (S6) — déclaration des PJs présents en dropdown checklist compact,
 * posé sur la ligne des sous-onglets d'artefacts (remplace la grande carte de la
 * Story 4.1). Conserve la **sémantique de remplacement total** (le POST envoie
 * l'ensemble complet, pas un delta) et le pattern de graine (`déclaré ∩ roster`,
 * semé une fois). Le menu reste ouvert pendant qu'on coche plusieurs PJs
 * (`closeOnClick={false}`).
 */
export function PjPresenceDropdown({
  sessionId,
  campaignId,
}: PjPresenceDropdownProps) {
  const rosterQuery = useListCampaignPjs(campaignId);
  const playersQuery = useSessionPlayers(sessionId);
  const mutation = useSetSessionPlayers(sessionId);

  const roster = useMemo(
    () => rosterQuery.data?.items ?? [],
    [rosterQuery.data],
  );
  const rosterIds = useMemo(() => new Set(roster.map((pj) => pj.id)), [roster]);

  // Graine = (déclaré ∩ roster), dès que le roster est chargé et que la requête
  // des présents a abouti (succès OU erreur → présélection vide, AC6 Story 4.1).
  const ready = rosterQuery.isSuccess && !playersQuery.isLoading;
  const declaredSeed = useMemo(() => {
    if (!ready) return null;
    const declared = playersQuery.data?.pj_ids ?? [];
    return new Set(declared.filter((id) => rosterIds.has(id)));
  }, [ready, playersQuery.data, rosterIds]);

  // Sélection locale semée UNE fois via « ajustement d'état pendant le render »
  // (pas d'effet) : la garde `selected === null` garantit la convergence et
  // n'écrase jamais une édition de l'utilisateur.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  if (selected === null && declaredSeed !== null) {
    setSelected(declaredSeed);
  }

  const toggle = (pjId: string) => {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(pjId)) next.delete(pjId);
      else next.add(pjId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!selected || selected.size === 0 || mutation.isPending) return;
    mutation.mutate([...selected], {
      onSuccess: () => toast.success("Présents enregistrés."),
      onError: (error) => toast.error(formatSaveError(error)),
    });
  };

  const selectedCount = selected?.size ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        Qui était présent ?{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <p className="text-text-chrome-muted px-1.5 py-1 text-xs font-medium">
          PJs présents à la séance
        </p>
        <DropdownMenuSeparator />

        {rosterQuery.isPending && (
          <p className="text-text-chrome-muted px-1.5 py-1 text-sm">
            Chargement des PJs...
          </p>
        )}

        {rosterQuery.isError && (
          <p
            role="alert"
            className="text-state-error px-1.5 py-1 text-sm font-medium"
          >
            Les PJs n&apos;ont pas pu être chargés.
          </p>
        )}

        {rosterQuery.isSuccess && roster.length === 0 && (
          <p className="text-text-chrome-muted px-1.5 py-1 text-sm italic">
            Ajoute d&apos;abord des PJs à la campagne pour déclarer leur
            présence.
          </p>
        )}

        {rosterQuery.isSuccess && roster.length > 0 && selected !== null && (
          <>
            {roster.map((pj) => (
              <DropdownMenuCheckboxItem
                key={pj.id}
                checked={selected.has(pj.id)}
                onCheckedChange={() => toggle(pj.id)}
                closeOnClick={false}
              >
                {pj.name}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            {selectedCount === 0 && (
              <p className="text-text-chrome-muted px-1.5 pb-1 text-xs italic">
                Sélectionne au moins un PJ présent.
              </p>
            )}
            <div className="px-1.5 py-1">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={handleSubmit}
                disabled={mutation.isPending || selectedCount === 0}
              >
                {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
