"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { ARTIFACT_JOB_LABELS } from "@/lib/jdr/sessions/artifactJobFlow";
import { RegenerateArtifactConfirm } from "@/components/jdr/sessions/RegenerateArtifactConfirm";

interface ArtifactRegenerateControlsProps {
  /** Étiquette accordée de l'artefact : « le Résumé », « les Éléments »… */
  artifactLabel: string;
  /** Id du job de régénération en vol (null au repos). */
  jobId: string | null;
  /** Vrai tant qu'un job de régénération est en file/en cours. */
  jobInFlight: boolean;
  /** Vrai entre `succeeded` et l'arrivée du contenu remplacé. */
  artifactSettling?: boolean;
  /** Vrai si la dernière régénération a échoué. */
  jobFailed: boolean;
  /** Story 4.10 — raison d'échec backend (`JobOut.failure_reason`), si dispo. */
  failureReason?: string | null;
  /** Vrai pendant l'envoi du POST de régénération. */
  pending: boolean;
  /** Déclenché à la confirmation de l'utilisateur. */
  onConfirm: () => void;
  /**
   * Story 4.23 (AC6) — quelle partie rendre :
   * - `"trigger"` : le CTA compact « Régénérer » + le dialog de confirmation,
   *   destiné au coin haut-droit de l'en-tête du bloc.
   * - `"status"` : le badge d'état en vol + le message d'échec, gardés sous le
   *   contenu (associés à l'artefact, pas flottant dans l'en-tête).
   * - `"all"` (défaut) : bloc unique historique (les deux + bordure haute).
   */
  part?: "trigger" | "status" | "all";
}

/**
 * Story 4.5 — bloc de régénération partagé par les panneaux d'artefacts
 * (Résumé / Récit / Éléments / POVs). Story 4.23 (AC6) — scindable via `part` :
 * le déclencheur monte dans l'en-tête (top-right), le statut reste sous le
 * contenu. L'ancien contenu reste visible jusqu'au remplacement (pas de flash).
 */
export function ArtifactRegenerateControls({
  artifactLabel,
  jobId,
  jobInFlight,
  artifactSettling = false,
  jobFailed,
  failureReason,
  pending,
  onConfirm,
  part = "all",
}: ArtifactRegenerateControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = jobInFlight || artifactSettling;
  const fullLabel = `Régénérer ${artifactLabel}`;

  const handleConfirm = () => {
    setConfirmOpen(false);
    onConfirm();
  };

  const statusBlock = (
    <>
      {jobId && busy && (
        <div className="flex items-center gap-3">
          <JobStateBadge
            jobId={jobId}
            labels={ARTIFACT_JOB_LABELS}
            ariaLabelPrefix="État de la régénération"
          />
          <span className="text-text-chrome-muted text-sm">
            {artifactSettling
              ? "Remplacement du contenu…"
              : "Régénération en cours…"}
          </span>
        </div>
      )}

      {jobFailed && (
        <p className="text-state-error text-sm">
          {failureReason
            ? `La régénération a échoué : ${failureReason}`
            : "La régénération a échoué. Réessaie."}
        </p>
      )}
    </>
  );

  // Compact header trigger: visible "Régénérer", full accessible name kept for
  // a11y + selector stability. Confirm dialog travels with the trigger.
  const triggerBlock = (
    <>
      <Button
        type="button"
        variant="outline"
        size={part === "trigger" ? "sm" : undefined}
        aria-label={part === "trigger" ? fullLabel : undefined}
        onClick={() => setConfirmOpen(true)}
        disabled={busy || pending}
        className={pending ? "animate-pulse" : undefined}
      >
        {pending ? "Lancement…" : part === "trigger" ? "Régénérer" : fullLabel}
      </Button>
      <RegenerateArtifactConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        artifactLabel={artifactLabel}
        onConfirm={handleConfirm}
      />
    </>
  );

  if (part === "trigger") {
    return <div className="flex items-center">{triggerBlock}</div>;
  }

  if (part === "status") {
    // Nothing to show → render nothing (no stray header-adjacent gap/border).
    if (!((jobId && busy) || jobFailed)) return null;
    return <div className="mt-4 flex flex-col gap-2">{statusBlock}</div>;
  }

  return (
    <div className="border-border-card/60 mt-6 flex flex-col gap-2 border-t pt-4">
      {statusBlock}
      <div>{triggerBlock}</div>
    </div>
  );
}
