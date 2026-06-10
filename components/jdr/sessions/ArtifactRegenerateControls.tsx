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
}

/**
 * Story 4.5 — bloc de régénération partagé par les panneaux d'artefacts
 * (Résumé / Récit / Éléments / POVs). Rendu sous le contenu déjà affiché : un
 * CTA « Régénérer … » derrière un `RegenerateArtifactConfirm`, le badge d'état
 * pendant la régénération, et un message d'échec sans toucher au contenu
 * existant. L'ancien contenu reste visible jusqu'au remplacement (pas de flash).
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
}: ArtifactRegenerateControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = jobInFlight || artifactSettling;

  const handleConfirm = () => {
    setConfirmOpen(false);
    onConfirm();
  };

  return (
    <div className="border-border-card/60 mt-6 flex flex-col gap-2 border-t pt-4">
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

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={busy || pending}
          className={pending ? "animate-pulse" : undefined}
        >
          {pending ? "Lancement…" : `Régénérer ${artifactLabel}`}
        </Button>
      </div>

      <RegenerateArtifactConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        artifactLabel={artifactLabel}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
