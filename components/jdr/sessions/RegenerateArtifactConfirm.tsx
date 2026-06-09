"use client";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface RegenerateArtifactConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Étiquette de l'artefact, accordée : « le Résumé », « les Éléments »… */
  artifactLabel: string;
  onConfirm: () => void;
}

/**
 * Story 4.5 — confirmation avant de régénérer un artefact. Réutilise le
 * `ConfirmDialog` partagé (même chrome que `ReplaceAudioConfirm`). La
 * régénération remplace le contenu existant sans historique de versions (V1),
 * donc on prévient explicitement avant de relancer le `POST /artifacts/{kind}`.
 * Non destructif (pas de rouge) : c'est une action créative volontaire, pas une
 * suppression — cohérent avec le CTA « Régénérer » non-rouge des maquettes.
 */
export function RegenerateArtifactConfirm({
  open,
  onOpenChange,
  artifactLabel,
  onConfirm,
}: RegenerateArtifactConfirmProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Régénérer ${artifactLabel} ?`}
      description="Le contenu actuel sera remplacé par une nouvelle génération. Aucun historique de versions n'est conservé (V1)."
      confirmLabel="Régénérer"
      onConfirm={onConfirm}
    />
  );
}
