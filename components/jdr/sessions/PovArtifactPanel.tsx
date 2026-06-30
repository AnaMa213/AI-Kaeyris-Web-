"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ArtifactRegenerateControls } from "@/components/jdr/sessions/ArtifactRegenerateControls";
import { ArtifactTextEditor } from "@/components/jdr/sessions/ArtifactTextEditor";
import { NarrativeReader } from "@/components/narrative/NarrativeReader";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { ApiError } from "@/lib/core/api/errors";
import { useListCampaignPjs } from "@/lib/jdr/pjs/queries";
import { useSessionPlayers } from "@/lib/jdr/sessions/players";
import {
  ARTIFACT_JOB_LABELS,
  useArtifactJobFlow,
} from "@/lib/jdr/sessions/artifactJobFlow";
import {
  isArtifactAbsentError,
  isArtifactBusyError,
  isArtifactEditedError,
  povArtifactSessionKey,
  useGeneratePovs,
  usePatchPov,
  usePovArtifact,
} from "@/lib/jdr/sessions/artifacts";

/** Story 8.2 — message for a failed synchronous POV edit (busy job vs other). */
function formatSaveError(error: unknown): string {
  if (isArtifactBusyError(error)) {
    return "Une génération est en cours pour cette séance. Réessaie une fois terminée.";
  }
  if (error instanceof ApiError && error.problem.status === 404) {
    return "Ce POV est introuvable. Recharge la page.";
  }
  return "Sauvegarde impossible. Réessaie.";
}

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

  const patch = usePatchPov(sessionId, activePjId);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);

  const flow = useArtifactJobFlow({
    sessionId,
    isPresent: povPresent,
    keyFactory: povArtifactSessionKey,
    artifactVersion: selectedPov?.generated_at,
    artifactNoun: "des POVs",
  });

  const runGenerate = (force: boolean) => {
    generate.mutate(force ? { force: true } : undefined, {
      onSuccess: (queued) => flow.onJobQueued(queued.id),
      onError: (error) => {
        if (!force && isArtifactEditedError(error)) {
          setForceConfirmOpen(true);
          return;
        }
        toast.error("Impossible de lancer la génération des POVs.");
      },
    });
  };

  const handleGenerate = () => {
    if (generate.isPending) return;
    runGenerate(false);
  };

  const handleSave = (text: string) => {
    setSaveError(null);
    patch.mutate(text, {
      onSuccess: () => setIsEditing(false),
      onError: (error) => setSaveError(formatSaveError(error)),
    });
  };

  const startEditing = () => {
    if (flow.jobInFlight) return;
    setSaveError(null);
    patch.reset();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setSaveError(null);
    patch.reset();
    setIsEditing(false);
  };

  const handleSelectPj = (pjId: string) => {
    if (!declaredInRoster.some((pj) => pj.id === pjId)) return;
    // Switching PJ discards an in-progress edit (it targets the previous PJ).
    setIsEditing(false);
    setSaveError(null);
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
      <section className={SECTION_CARD_CLASSES} aria-label="POVs de la séance">
        {/* Story 4.23 (AC6) — régénérer dans l'en-tête (POV n'a pas d'export).
            Story 8.2 — bouton « Modifier » par PJ. Contrôles masqués en édition. */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">POVs</h2>
          {!isEditing && (
            <div className="flex items-center gap-1">
              {povPresent && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={startEditing}
                  disabled={flow.jobInFlight}
                  title={
                    flow.jobInFlight
                      ? "Génération en cours — modification bloquée."
                      : undefined
                  }
                >
                  <Pencil />
                  Modifier
                </Button>
              )}
              <ArtifactRegenerateControls
                part="trigger"
                artifactLabel="les POVs"
                jobId={flow.jobId}
                jobInFlight={flow.jobInFlight}
                artifactSettling={flow.artifactSettling}
                jobFailed={flow.jobFailed}
                failureReason={flow.failureReason}
                pending={generate.isPending}
                onConfirm={handleGenerate}
              />
            </div>
          )}
        </div>
        {pjTabs}

        {isEditing && povPresent && selectedPov ? (
          <ArtifactTextEditor
            idPrefix={`pov-${sessionId}-${activePjId}`}
            initialMarkdown={selectedPov.text}
            kind="pov"
            onSave={handleSave}
            onCancel={cancelEditing}
            saving={patch.isPending}
            saveError={saveError}
          />
        ) : povQuery.isPending ? (
          <p className="text-text-chrome-muted text-sm">Chargement du POV...</p>
        ) : povLoadFailed ? (
          <p className="text-state-error text-sm">
            Impossible de charger le POV sélectionné. Réessaie plus tard.
          </p>
        ) : povPresent && selectedPov && generatedAt ? (
          <>
            <NarrativeReader markdown={selectedPov.text} kind="pov" />
            <p className="text-text-chrome-muted mt-4 text-xs">
              Généré le {generatedAt.toLocaleString("fr-FR")} ·{" "}
              {selectedPov.model_used}
              {selectedPov.is_edited ? " · modifié par le MJ" : ""}
            </p>
          </>
        ) : (
          <p className="text-text-chrome-muted text-sm italic">
            Aucun POV généré pour le PJ sélectionné.
          </p>
        )}

        {!isEditing && (
          <ArtifactRegenerateControls
            part="status"
            artifactLabel="les POVs"
            jobId={flow.jobId}
            jobInFlight={flow.jobInFlight}
            artifactSettling={flow.artifactSettling}
            jobFailed={flow.jobFailed}
            failureReason={flow.failureReason}
            pending={generate.isPending}
            onConfirm={handleGenerate}
          />
        )}

        <ConfirmDialog
          open={forceConfirmOpen}
          onOpenChange={setForceConfirmOpen}
          title="Régénérer les POVs ?"
          description="Un POV a été modifié manuellement. Régénérer remplacera ces modifications."
          confirmLabel="Régénérer"
          pendingLabel="Régénération…"
          submitting={generate.isPending}
          onConfirm={() => {
            setForceConfirmOpen(false);
            runGenerate(true);
          }}
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
        {/* Story 4.23 (AC6) — régénérer dans l'en-tête (POV n'a pas d'export, cf. Story 5.7). */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">POVs</h2>
          <ArtifactRegenerateControls
            part="trigger"
            artifactLabel="les POVs"
            jobId={flow.jobId}
            jobInFlight={flow.jobInFlight}
            artifactSettling={flow.artifactSettling}
            jobFailed={flow.jobFailed}
            failureReason={flow.failureReason}
            pending={generate.isPending}
            onConfirm={handleGenerate}
          />
        </div>
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
          part="status"
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
