"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { NarrativeReader } from "@/components/narrative/NarrativeReader";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useListCampaignPjs } from "@/lib/jdr/pjs/queries";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  isArtifactAbsentError,
  povArtifactSessionKey,
  useGeneratePovs,
  usePovArtifact,
} from "@/lib/jdr/sessions/artifacts";

interface PovArtifactPanelProps {
  sessionId: string;
  campaignId: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function writeSelectedPjUrl(pjId: string) {
  if (typeof window === "undefined") return;
  const next = new URLSearchParams(window.location.search);
  next.delete("tab");
  next.set("sub", "povs");
  next.set("pj", pjId);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}?${next.toString()}`,
  );
}

function PovShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASSES} aria-label={ariaLabel}>
      <h2 className="font-display mb-2 text-xl font-semibold">POVs</h2>
      {children}
    </section>
  );
}

export function PovArtifactPanel({ sessionId, campaignId }: PovArtifactPanelProps) {
  const searchParams = useSearchParams();
  const [selectedPjId, setSelectedPjId] = useState(
    () => searchParams.get("pj") ?? "",
  );
  const rosterQuery = useListCampaignPjs(campaignId);
  const playersQuery = useSessionPlayers(sessionId);
  const generate = useGeneratePovs(sessionId);
  const [povsWereReadable, setPovsWereReadable] = useState(false);

  const rosterById = useMemo(() => {
    const roster = rosterQuery.data?.items ?? [];
    return new Map(roster.map((pj) => [pj.id, pj]));
  }, [rosterQuery.data]);

  const declaredInRoster = useMemo(() => {
    const declared = playersQuery.data?.pj_ids ?? [];
    return declared.flatMap((id) => {
      const rosterPj = rosterById.get(id);
      return rosterPj ? [rosterPj] : [];
    });
  }, [playersQuery.data, rosterById]);

  const validSelectedPj = declaredInRoster.some((pj) => pj.id === selectedPjId);
  const activePjId = validSelectedPj
    ? selectedPjId
    : (declaredInRoster[0]?.id ?? "");
  const povQuery = usePovArtifact(sessionId, activePjId);
  const selectedPov = povQuery.data;
  const povPresent = Boolean(selectedPov?.text);
  const povAbsent = povQuery.isError && isArtifactAbsentError(povQuery.error);
  const povLoadFailed = povQuery.isError && !povAbsent;
  const povMissing = !povQuery.isPending && !povPresent && !povLoadFailed;
  const shouldKeepPjNavigation = povsWereReadable || povPresent;

  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: povPresent,
    keyFactory: povArtifactSessionKey,
    artifactVersion: selectedPov?.generated_at,
    artifactNoun: "des POVs",
  });

  const handleGenerate = () => {
    if (generate.isPending) return;
    generate.mutate(undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: () => toast.error("Impossible de lancer la génération des POVs."),
    });
  };

  const handleSelectPj = (pjId: string) => {
    if (!declaredInRoster.some((pj) => pj.id === pjId)) return;
    if (povPresent) setPovsWereReadable(true);
    setSelectedPjId(pjId);
    writeSelectedPjUrl(pjId);
  };

  const rosterLoading = rosterQuery.isPending || playersQuery.isPending;
  const rosterFailed = rosterQuery.isError || playersQuery.isError;
  const hasDeclaredPj = declaredInRoster.length > 0;

  const pjTabs = (
    <Tabs
      value={activePjId}
      onValueChange={handleSelectPj}
      className="mb-4 w-full"
    >
      <TabsList
        variant="line"
        className="bg-surface-raised/70 border-border-card/70 flex-wrap rounded-md border px-2 py-1"
      >
        {declaredInRoster.map((pj) => (
          <TabsTrigger
            key={pj.id}
            value={pj.id}
            aria-current={pj.id === activePjId ? "page" : undefined}
            className="after:bg-accent-gold data-active:text-accent-gold px-2 text-xs"
          >
            {pj.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  if (rosterLoading) {
    return (
      <PovShell ariaLabel="Chargement des POVs">
        <p className="text-text-chrome-muted text-sm">
          Vérification des PJs présents...
        </p>
      </PovShell>
    );
  }

  if (rosterFailed) {
    return (
      <PovShell ariaLabel="Erreur de chargement des POVs">
        <p className="text-state-error mb-4 text-sm">
          Impossible de vérifier les PJs présents. Réessaie plus tard.
        </p>
        <Button type="button" disabled>
          Générer les POVs
        </Button>
      </PovShell>
    );
  }

  if (!hasDeclaredPj) {
    return (
      <PovShell ariaLabel="Aucun PJ déclaré pour les POVs">
        <p className="text-text-chrome-muted mb-1 text-sm italic">
          Aucun PJ déclaré pour cette session.
        </p>
        <p className="text-text-chrome-muted mb-4 text-sm">
          Déclare les PJs présents pour générer les POVs.
        </p>
        <Button type="button" disabled>
          Générer les POVs
        </Button>
      </PovShell>
    );
  }

  if (shouldKeepPjNavigation) {
    const generatedAt = selectedPov?.generated_at
      ? parseBackendDate(selectedPov.generated_at)
      : null;
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="POVs de la sÃ©ance">
        <h2 className="font-display mb-3 text-xl font-semibold">POVs</h2>
        {pjTabs}

        {povQuery.isPending ? (
          <p className="text-text-chrome-muted text-sm">Chargement du POV...</p>
        ) : povLoadFailed ? (
          <p className="text-state-error text-sm">
            Impossible de charger le POV sÃ©lectionnÃ©. RÃ©essaie plus tard.
          </p>
        ) : povPresent && selectedPov && generatedAt ? (
          <>
            <NarrativeReader markdown={selectedPov.text} kind="pov" />
            <p className="text-text-chrome-muted mt-4 text-xs">
              GÃ©nÃ©rÃ© le {generatedAt.toLocaleString("fr-FR")} Â·{" "}
              {selectedPov.model_used}
            </p>
          </>
        ) : (
          <p className="text-text-chrome-muted text-sm italic">
            Aucun POV gÃ©nÃ©rÃ© pour le PJ sÃ©lectionnÃ©.
          </p>
        )}

        <ArtifactRegenerateControls
          artifactLabel="les POVs"
          jobId={flow.jobId}
          jobInFlight={flow.jobInFlight}
          artifactSettling={flow.artifactSettling}
          jobFailed={flow.jobFailed}
          failureReason={flow.failureReason}
          pending={generate.isPending}
          onConfirm={handleGenerate}
        />
      </section>
    );
  }

  if (povQuery.isPending) {
    return (
      <PovShell ariaLabel="Chargement du POV">
        <p className="text-text-chrome-muted text-sm">Chargement du POV...</p>
      </PovShell>
    );
  }

  if (povLoadFailed) {
    return (
      <PovShell ariaLabel="Erreur de chargement du POV">
        <p className="text-state-error text-sm">
          Impossible de charger le POV sélectionné. Réessaie plus tard.
        </p>
      </PovShell>
    );
  }

  if (povPresent && selectedPov) {
    const generatedAt = parseBackendDate(selectedPov.generated_at);
    return (
      <section className={SECTION_CARD_CLASSES} aria-label="POVs de la séance">
        <h2 className="font-display mb-3 text-xl font-semibold">POVs</h2>
        <Tabs
          value={activePjId}
          onValueChange={handleSelectPj}
          className="mb-4 w-full"
        >
          <TabsList
            variant="line"
            className="bg-surface-raised/70 border-border-card/70 flex-wrap rounded-md border px-2 py-1"
          >
            {declaredInRoster.map((pj) => (
              <TabsTrigger
                key={pj.id}
                value={pj.id}
                aria-current={pj.id === activePjId ? "page" : undefined}
                className="after:bg-accent-gold data-active:text-accent-gold px-2 text-xs"
              >
                {pj.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <NarrativeReader markdown={selectedPov.text} kind="pov" />
        <p className="text-text-chrome-muted mt-4 text-xs">
          Généré le {generatedAt.toLocaleString("fr-FR")} · {selectedPov.model_used}
        </p>

        <ArtifactRegenerateControls
          artifactLabel="les POVs"
          jobId={flow.jobId}
          jobInFlight={flow.jobInFlight}
          artifactSettling={flow.artifactSettling}
          jobFailed={flow.jobFailed}
          failureReason={flow.failureReason}
          pending={generate.isPending}
          onConfirm={handleGenerate}
        />
      </section>
    );
  }

  const jobPending = flow.jobId !== null && !flow.jobFailed && !flow.artifactUnavailable;

  return (
    <PovShell ariaLabel="Génération des POVs">
      <p className="text-text-chrome-muted mb-4 text-sm">
        Génère un point de vue par PJ présent à partir du résumé.
      </p>

      {flow.jobId && (
        <div className="mb-3 flex items-center gap-3">
          <JobStateBadge
            jobId={flow.jobId}
            labels={ARTIFACT_JOB_LABELS}
            ariaLabelPrefix="État de la génération"
          />
          {flow.jobActive && (
            <span className="text-text-chrome-muted text-sm">
              Les POVs sont en cours de génération...
            </span>
          )}
        </div>
      )}

      {flow.artifactUnavailable ? (
        <div className="flex flex-col gap-2">
          <p className="text-state-warning text-sm">
            La génération est terminée, mais les POVs ne sont pas encore
            disponibles.
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={flow.refreshArtifact}
              disabled={povQuery.isFetching}
            >
              Vérifier à nouveau
            </Button>
          </div>
        </div>
      ) : !jobPending && (
        <div className="flex flex-col gap-2">
          {povMissing && (
            <p className="text-text-chrome-muted text-sm italic">
              Aucun POV généré pour le PJ sélectionné.
            </p>
          )}
          {flow.jobFailed && (
            <p className="text-state-error text-sm">
              {flow.failureReason
                ? `La génération a échoué : ${flow.failureReason}`
                : "La génération a échoué. Réessaie."}
            </p>
          )}
          <div>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generate.isPending}
              className={generate.isPending ? "animate-pulse" : undefined}
            >
              {generate.isPending
                ? "Lancement..."
                : flow.jobFailed
                  ? "Réessayer"
                  : "Générer les POVs"}
            </Button>
          </div>
        </div>
      )}
    </PovShell>
  );
}
