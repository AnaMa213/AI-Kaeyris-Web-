"use client";

import { useEffect, useState } from "react";

interface UseRotatingTextOptions {
  intervalMs?: number;
  /**
   * Quand `false` (mouvement réduit), le consommateur doit afficher le swap
   * sans transition (cf. `motion-reduce:transition-none`). La cadence reste
   * identique pour préserver la dramaturgie textuelle (décision UX §spec).
   */
  enabled?: boolean;
}

export interface RotatingText {
  current: string;
  index: number;
}

/**
 * Fait défiler des lignes de texte à intervalle régulier (Story 3.3.1).
 * - Une seule ligne → aucun timer, valeur stable.
 * - Le changement du tableau `lines` (transition d'acte) remet l'index à 0.
 */
export function useRotatingText(
  lines: string[],
  { intervalMs = 4000 }: UseRotatingTextOptions = {},
): RotatingText {
  // Comparaison par contenu joint : évite de relancer si la prop `lines` est
  // recréée à chaque render avec le même contenu.
  const joined = lines.join(" ");
  const length = lines.length;

  const [index, setIndex] = useState(0);
  // Reset déclenché pendant le render (pattern React officiel "adjusting state
  // when a prop changes") : nouvel acte → repart de la première ligne.
  const [prevJoined, setPrevJoined] = useState(joined);
  if (joined !== prevJoined) {
    setPrevJoined(joined);
    setIndex(0);
  }

  useEffect(() => {
    if (length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);

  const safeIndex = length > 0 ? index % length : 0;
  return { current: lines[safeIndex] ?? "", index: safeIndex };
}
