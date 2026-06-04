"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/core/api/errors";
import { useListCampaignPjs } from "@/lib/jdr/pjs/queries";
import {
  useSessionPlayers,
  useSetSessionPlayers,
} from "@/lib/jdr/sessions/players";

interface PjPresenceFormProps {
  sessionId: string;
  campaignId: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function formatSaveError(error: unknown): string {
  if (error instanceof ApiError && error.problem.status === 403) {
    return "Tu n'as pas les permissions pour déclarer les présents.";
  }
  return "Impossible d'enregistrer les présents. Réessaie.";
}

/**
 * Story 4.1 — déclaration des PJs présents à une séance. Cases à cocher sur le
 * roster de campagne, pré-cochées depuis les PJs déjà déclarés. Le submit envoie
 * l'ensemble complet sélectionné (remplacement total, pas un delta). Le form
 * reste éditable après enregistrement.
 */
export function PjPresenceForm({ sessionId, campaignId }: PjPresenceFormProps) {
  const rosterQuery = useListCampaignPjs(campaignId);
  const playersQuery = useSessionPlayers(sessionId);
  const mutation = useSetSessionPlayers(sessionId);

  const roster = useMemo(
    () => rosterQuery.data?.items ?? [],
    [rosterQuery.data],
  );
  const rosterIds = useMemo(
    () => new Set(roster.map((pj) => pj.id)),
    [roster],
  );

  // Graine = (déclaré ∩ roster), disponible dès que le roster est chargé et que
  // la requête des présents a abouti (succès OU erreur → présélection vide, AC6).
  const ready = rosterQuery.isSuccess && !playersQuery.isLoading;
  const declaredSeed = useMemo(() => {
    if (!ready) return null;
    const declared = playersQuery.data?.pj_ids ?? [];
    return new Set(declared.filter((id) => rosterIds.has(id)));
  }, [ready, playersQuery.data, rosterIds]);

  // Sélection locale semée UNE fois, via le pattern « ajustement d'état pendant
  // le render » (pas d'effet) : la garde `selected === null` garantit la
  // convergence et n'écrase jamais une édition de l'utilisateur.
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

  return (
    <section className={SECTION_CARD_CLASSES} aria-label="Présence des PJs">
      <header className="mb-4">
        <h2 className="font-display text-xl">Qui était présent ?</h2>
        <p className="text-text-chrome-muted mt-1 text-sm">
          Coche les PJs présents à cette séance. Ils recevront un point de vue
          lors de la génération des artefacts.
        </p>
      </header>

      {(rosterQuery.isPending ||
        (rosterQuery.isSuccess && roster.length > 0 && selected === null)) && (
        <p className="text-text-chrome-muted text-sm">Chargement des PJs...</p>
      )}

      {rosterQuery.isError && (
        <div
          role="alert"
          className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
        >
          <p className="font-medium">Les PJs n&apos;ont pas pu être chargés.</p>
        </div>
      )}

      {rosterQuery.isSuccess && roster.length === 0 && (
        <p className="text-text-chrome-muted text-sm italic">
          Ajoute d&apos;abord des PJs à la campagne pour déclarer leur présence.
        </p>
      )}

      {rosterQuery.isSuccess && roster.length > 0 && selected !== null && (
        <>
          {selected.size === 0 && (
            <p className="text-text-chrome-muted mb-3 text-sm italic">
              Sélectionne au moins un PJ présent pour enregistrer.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {roster.map((pj) => {
              const inputId = `pj-present-${pj.id}`;
              return (
                <li key={pj.id} className="py-1">
                  <label
                    htmlFor={inputId}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      className="accent-accent-gold h-4 w-4"
                      checked={selected.has(pj.id)}
                      onChange={() => toggle(pj.id)}
                    />
                    <span className="font-medium">{pj.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending || selected.size === 0}
              className={mutation.isPending ? "animate-pulse" : undefined}
            >
              {mutation.isPending ? "Enregistrement..." : "Enregistrer les présents"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
