"use client";

import { useEffect, useRef, useState } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Ellipsis, Eye, Pencil, RotateCcw, Replace, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/common/IconButton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignBreadcrumb } from "@/components/jdr/campaigns/CampaignBreadcrumb";
import { SessionStateChip } from "@/components/jdr/sessions/SessionStateChip";
import { RitualProgress } from "@/components/jdr/sessions/RitualProgress";
import { SessionAudioUploadCard } from "@/components/jdr/sessions/SessionAudioUploadCard";
import { StuckTranscriptionCard } from "@/components/jdr/sessions/StuckTranscriptionCard";
import { PjPresenceDropdown } from "@/components/jdr/sessions/PjPresenceDropdown";
import { TranscriptionDialog } from "@/components/jdr/sessions/TranscriptionDialog";
import { SummaryArtifactPanel } from "@/components/jdr/sessions/SummaryArtifactPanel";
import { NarrativeArtifactPanel } from "@/components/jdr/sessions/NarrativeArtifactPanel";
import { ElementsArtifactPanel } from "@/components/jdr/sessions/ElementsArtifactPanel";
import { PovArtifactPanel } from "@/components/jdr/sessions/PovArtifactPanel";
import { SessionDeleteConfirm } from "@/components/jdr/sessions/SessionDeleteConfirm";
import { SessionEditDialog } from "@/components/jdr/sessions/SessionEditForm";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { ApiError } from "@/lib/core/api/errors";
import { env } from "@/lib/core/env";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";
import { isJobNotFound, useJob } from "@/lib/jdr/jobs/queries";
import {
  estimateJobProgress,
  resolveDisplayProgress,
  type DisplayProgressState,
} from "@/lib/jdr/jobs/progress";
import { resolveSessionAudioSrc } from "@/lib/jdr/sessions/audio";
import {
  readAudioDuration,
  writeAudioDuration,
} from "@/lib/jdr/sessions/audioDuration";
import {
  canEditCampaignSession,
  canReplaceAudio,
} from "@/lib/jdr/sessions/permissions";
import {
  useSessionPipelineState,
  type PipelineUIState,
} from "@/lib/jdr/sessions/pipelineState";
import {
  sessionQueryKey,
  useDeleteSession,
  useGetSession,
  useRecoverTranscription,
  useRetryTranscription,
} from "@/lib/jdr/sessions/queries";
import { useSummaryArtifact } from "@/lib/jdr/sessions/artifacts";

const ARTIFACT_DISABLED_HINT = "Génère cet artefact d'abord";
// Story 4.15 (T2) : indice porté par le déclencheur de remplacement quand un job
// de transcription est actif — verrou anti-double transcription concurrente.
const TRANSCRIPTION_ACTIVE_REPLACE_HINT =
  "Transcription en cours — patiente avant de remplacer l'enregistrement.";
const TRANSCRIPTION_SEEN_STORAGE_PREFIX =
  "kaeyris:jdr:session-transcription-seen:";
// Story 4.7 (S4) : flag DÉDIÉ pour le toast « terminée », distinct du flag
// tab-default ci-dessus (qui se pose juste en visitant l'onglet Transcription).
// Les coupler ferait taire le toast prématurément.
const TRANSCRIPTION_TOAST_SEEN_STORAGE_PREFIX =
  "kaeyris:jdr:session-transcription-toast-seen:";
type ArtifactSubTab = "summary" | "narrative" | "elements" | "povs";

const ARTIFACT_SUB_TABS: Array<{ value: ArtifactSubTab; label: string }> = [
  { value: "summary", label: "Résumé" },
  { value: "narrative", label: "Récit" },
  { value: "elements", label: "Éléments" },
  { value: "povs", label: "POVs" },
];

const VALID_RITUAL_OVERRIDES: PipelineUIState[] = [
  "uploading",
  "transcribing",
  "transcribed",
  "failed",
];

function isArtifactSubTab(value: string | null): value is ArtifactSubTab {
  return (
    value === "summary" ||
    value === "narrative" ||
    value === "elements" ||
    value === "povs"
  );
}

function transcriptionSeenKey(sessionId: string): string {
  return `${TRANSCRIPTION_SEEN_STORAGE_PREFIX}${sessionId}`;
}

function hasSeenCompletedTranscription(sessionId: string): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(transcriptionSeenKey(sessionId)) === "1";
}

function markCompletedTranscriptionSeen(sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(transcriptionSeenKey(sessionId), "1");
}

function transcriptionToastSeenKey(sessionId: string): string {
  return `${TRANSCRIPTION_TOAST_SEEN_STORAGE_PREFIX}${sessionId}`;
}

function hasNotifiedTranscriptionDone(sessionId: string): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.localStorage.getItem(transcriptionToastSeenKey(sessionId)) === "1"
  );
}

function markTranscriptionDoneNotified(sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(transcriptionToastSeenKey(sessionId), "1");
}

// Story 4.21 : plus d'onglet top-level. Seul `?sub` (sous-onglet artefacts)
// subsiste. Tout `?tab` legacy est purgé au passage.
function buildSessionSubSearchParams(
  current: URLSearchParams,
  sub: ArtifactSubTab,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  next.delete("tab");
  next.set("sub", sub);
  return next;
}

function writeSessionSubUrl(
  pathname: string,
  searchParams: URLSearchParams,
  sub: ArtifactSubTab,
  mode: "push" | "replace",
): void {
  if (typeof window === "undefined") return;
  const next = buildSessionSubSearchParams(searchParams, sub);
  const href = `${pathname}?${next.toString()}`;
  if (mode === "replace") {
    window.history.replaceState(null, "", href);
  } else {
    window.history.pushState(null, "", href);
  }
}

function resolveArtifactSub(searchParams: URLSearchParams): {
  sub: ArtifactSubTab;
  shouldNormalizeUrl: boolean;
} {
  const rawSub = searchParams.get("sub");
  const sub = isArtifactSubTab(rawSub) ? rawSub : "summary";
  const normalized = buildSessionSubSearchParams(searchParams, sub);
  return {
    sub,
    shouldNormalizeUrl: normalized.toString() !== searchParams.toString(),
  };
}

/**
 * Override dev (Story 3.3.1) : `?ritual=transcribed|failed|…` force un acte du
 * tracker pour démonstration locale. Strictement derrière `NEXT_PUBLIC_MOCK_AUDIO`,
 * aucun impact prod. Lecture non-réactive volontaire (dev only).
 */
function readRitualOverride(): PipelineUIState | null {
  if (!env.NEXT_PUBLIC_MOCK_AUDIO || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("ritual");
  return value && VALID_RITUAL_OVERRIDES.includes(value as PipelineUIState)
    ? (value as PipelineUIState)
    : null;
}

// Story 4.4 : pour un lecteur non-MJ, un sous-tab d'artefact déverrouillé affiche
// un cartouche en lecture seule (la lecture joueur arrive en Epic 5).
function ReadOnlyArtifactPlaceholder({ title }: { title: string }) {
  return (
    <section className="bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-text-chrome-muted mt-2 text-sm">
        Les artefacts de cette séance seront publiés ici.
      </p>
    </section>
  );
}

export default function SessionDetailPage() {
  const params = useParams<{ campId: string; sid: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campId = typeof params.campId === "string" ? params.campId : "";
  const sid = typeof params.sid === "string" ? params.sid : "";
  const queryClient = useQueryClient();
  const sessionQuery = useGetSession(sid);
  const campaignQuery = useGetCampaign(campId);
  const deleteMutation = useDeleteSession(sid, campId);
  const recoverMutation = useRecoverTranscription(sid, campId);
  const retryMutation = useRetryTranscription(sid, campId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Story 7.1 — re-running transcription on an already-transcribed session
  // overwrites the transcript (and stales its artifacts), so it is confirmed.
  const [confirmRetryTranscribed, setConfirmRetryTranscribed] = useState(false);
  const [urlRevision, setUrlRevision] = useState(0);
  // Story 4.21 : pop-up transcription RAW (ouverte via l'icône Eye header).
  const [transcriptionOpen, setTranscriptionOpen] = useState(false);
  // Story 3.5 : mode remplacement (dropzone re-montée) déclenché par le MJ.
  const [replacing, setReplacing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(() =>
    readAudioDuration(sid),
  );
  const [nowTick, setNowTick] = useState(() => Date.now());
  const notifiedJobRef = useRef<string | null>(null);
  // Story 3.6 : plancher monotone du % affiché (par job). State (et non ref)
  // pour rester pur en render — ajusté via le pattern « setState pendant le
  // render » avec garde d'égalité (cf. plus bas).
  const [progressFloor, setProgressFloor] = useState<DisplayProgressState>({
    jobId: null,
    value: 0,
  });

  // Story 3.4 : `current_job_id` est porté par SessionOut (BD-8). Plus aucun
  // useState local — au refresh, le polling reprend dès que la session arrive.
  const currentJobId = sessionQuery.data?.current_job_id ?? null;

  // Story 3.4 : polling live + back-off (stoppé à l'état terminal).
  const jobQuery = useJob(currentJobId, { live: true });
  const job = jobQuery.data;
  // Story 4.3 : un résumé existant ouvre les sous-tabs Récit/Éléments/POVs.
  // Requête uniquement sur séance transcrite ; `data != null` (et non `isSuccess`)
  // pour qu'une réponse 200/null d'un mock ne déverrouille pas par erreur.
  const summaryQuery = useSummaryArtifact(
    sessionQuery.data?.state === "transcribed" ? sid : "",
  );
  // Présence du `text` (et non `data != null`) : robuste à une réponse 200 vide.
  const summaryExists = Boolean(summaryQuery.data?.text);
  const searchParamsKey = `${urlRevision}:${searchParams.toString()}`;
  const canEditResolved = campaignQuery.data
    ? canEditCampaignSession(campaignQuery.data)
    : false;
  // Story 4.21 : sous-onglet artefacts piloté par `?sub` (plus de `?tab`).
  const { sub, shouldNormalizeUrl } = resolveArtifactSub(searchParams);
  // Story 4.21 : flag « récit ouvert » (one-shot, persistant). Lu en render (et
  // donc toujours à jour) ; le clic « Ouvrir le récit » pose le flag puis bump
  // `urlRevision`, ce qui re-render et relit la valeur sans flash.
  const storyOpened = hasSeenCompletedTranscription(sid);
  const pipeline = useSessionPipelineState({
    sessionState: sessionQuery.data?.state ?? "created",
    cardPhase: "idle",
    jobStatus: job?.status,
  });

  // Ticker 1 s pour faire avancer le % estimé entre deux polls (gated transcribing).
  useEffect(() => {
    if (pipeline.uiState !== "transcribing") return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pipeline.uiState]);

  // Notification de fin. Dédup en mémoire par job.id (intra-session) + flag
  // localStorage DÉDIÉ pour le succès (Story 4.7 S4) : le toast « terminée » ne
  // se déclenche qu'à la transition vers `succeeded`, une seule fois par séance,
  // jamais re-tiré à chaque rechargement tant que le poll renvoie `succeeded`.
  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded" && notifiedJobRef.current !== job.id) {
      notifiedJobRef.current = job.id;
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(sid) });
      if (!hasNotifiedTranscriptionDone(sid)) {
        toast.success("Transcription terminée — ton récit est consigné.");
        markTranscriptionDoneNotified(sid);
      }
    } else if (job.status === "failed" && notifiedJobRef.current !== job.id) {
      notifiedJobRef.current = job.id;
      toast.error(job.failure_reason ?? "La transcription a échoué.");
    }
  }, [job, queryClient, sid]);

  // Story 4.21 : normalise l'URL (purge `?tab` legacy, fixe `?sub`) UNIQUEMENT
  // quand la vue artefacts est la surface active — c.-à-d. séance transcrite et
  // soit lecteur, soit récit déjà ouvert. Le flag « récit ouvert » n'est plus
  // posé ici : il l'est seulement au clic explicite « Ouvrir le récit ».
  useEffect(() => {
    const data = sessionQuery.data;
    if (!data || campaignQuery.isPending) return;
    const artifactsActive =
      data.state === "transcribed" && (!canEditResolved || storyOpened);
    if (artifactsActive && shouldNormalizeUrl) {
      writeSessionSubUrl(
        pathname,
        new URLSearchParams(window.location.search),
        sub,
        "replace",
      );
    }
  }, [
    pathname,
    searchParamsKey,
    sessionQuery.data,
    campaignQuery.isPending,
    canEditResolved,
    storyOpened,
    shouldNormalizeUrl,
    sub,
  ]);

  // On attend aussi la campagne (rôle → surface) pour éviter un flash ; mais une
  // erreur de session prime sur l'attente.
  if (
    sessionQuery.isPending ||
    (campaignQuery.isPending && !sessionQuery.isError)
  ) {
    return <FantasyLoader message="Consultation du grimoire..." />;
  }

  if (sessionQuery.isError) {
    return (
      <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
        <div className="mb-4">
          <CampaignBreadcrumb campaignId={campId} />
        </div>
        <div
          role="alert"
          className="text-state-error border-state-error/30 bg-state-error/10 rounded-md border p-4 text-sm"
        >
          <p className="font-medium">Session introuvable.</p>
          {sessionQuery.error instanceof ApiError && (
            <p className="text-text-chrome-muted mt-2 text-xs">
              {sessionQuery.error.problem.title}
            </p>
          )}
        </div>
      </section>
    );
  }

  const session = sessionQuery.data;
  const recordedAt = parseBackendDate(session.recorded_at);
  const absoluteDate = format(recordedAt, "dd/MM/yyyy 'à' HH:mm", {
    locale: fr,
  });
  const relativeDate = formatDistanceToNow(recordedAt, {
    addSuffix: true,
    locale: fr,
  });
  const canEdit = canEditResolved;
  const canUploadAudio = canEdit && session.state === "created";
  // Story 3.5 : remplacement permis sur `audio_uploaded`/`transcription_failed`
  // (gaté sur l'état brut, pas l'uiState FSM). `replacing` monte la dropzone.
  const canReplace = canEdit && canReplaceAudio(session.state);
  const showReplaceCard = replacing && canReplace;
  const ritualState = readRitualOverride() ?? pipeline.uiState;
  const jobNotFound = isJobNotFound(jobQuery.error);
  // Story 4.21 : le tracker ne couvre plus que les actes en cours / échec.
  // L'acte `uploading` est porté par la card (séance `created`) ; l'acte
  // terminal `transcribed` est remplacé par le gate AC3 ci-dessous. Masqué
  // pendant le remplacement (la dropzone prend le relais).
  // Story 4.23 (AC10) — séance coincée sur `transcribing` dont le job a disparu
  // (worker crashé). On se base sur l'état BRUT `session.state` (et non l'uiState
  // dérivé) : un `audio_uploaded` avec un current_job_id périmé (Story 4.15) doit
  // garder l'acte transcribing + le remplacement, pas la carte d'interruption.
  // Quand bloqué, on masque l'acte « transcribing » (barre infinie) au profit
  // d'une carte « Transcription interrompue » (Réessayer + Débloquer).
  const stuckTranscription = session.state === "transcribing" && jobNotFound;
  const showRitual =
    !showReplaceCard &&
    !stuckTranscription &&
    (ritualState === "transcribing" || ritualState === "failed");
  // Story 4.21 — gate « Ouvrir le récit » : MJ, acte transcribed atteint, récit
  // jamais ouvert. Réutilise l'acte transcribed du RitualProgress (sceau + CTA).
  const showStoryGate =
    !showReplaceCard &&
    canEdit &&
    session.state === "transcribed" &&
    !storyOpened;
  // Story 4.21 — vue artefacts (sous-onglets) : séance transcrite ET (lecteur OU
  // récit déjà ouvert). Les panneaux conservent leur garde interne sur l'état.
  const showArtifacts =
    !showReplaceCard &&
    session.state === "transcribed" &&
    (!canEdit || storyOpened);
  // Story 4.15 (T2) : un job actif (acte « transcribing » + current_job_id)
  // verrouille le remplacement → pas de seconde transcription concurrente.
  // L'acte terminal `failed` n'est jamais bloqué (current_job_id nul → la
  // récupération reste offerte). On se base sur l'acte affiché et non sur le
  // `current_job_id` brut, qui peut rester en cache après un poll terminal.
  const replaceEligible =
    canReplace &&
    (ritualState === "failed" || ritualState === "transcribing");
  const jobLookupErrored = jobQuery.isError && !jobNotFound;
  const jobNonTerminal =
    job?.status === "queued" || job?.status === "running";
  const transcriptionActive =
    ritualState === "transcribing" &&
    Boolean(currentJobId) &&
    (jobQuery.isPending || jobNonTerminal || jobLookupErrored) &&
    !jobNotFound;
  const replaceBlocked = replaceEligible && transcriptionActive;
  // Story 4.17 (R3/T-d): an edited Markdown transcription must not be saved
  // while a transcription job is still active. Block pessimistically while the
  // job status is loading; release only on terminal statuses.
  const transcriptionEditBlocked =
    Boolean(currentJobId) &&
    (jobQuery.isPending || jobNonTerminal || jobLookupErrored) &&
    !jobNotFound;
  const ritualProgress = estimateJobProgress({
    job,
    durationSeconds,
    now: nowTick,
  });
  // Story 3.6 : barre monotone + jamais 100 % avant l'acte terminal. Le vrai
  // `progress_percent` (BD-10) est déjà prioritaire dans `estimateJobProgress`.
  const { value: displayProgress, floor: nextFloor } = resolveDisplayProgress(
    progressFloor,
    job?.id ?? null,
    ritualProgress,
    ritualState === "transcribed",
  );
  if (
    nextFloor.jobId !== progressFloor.jobId ||
    nextFloor.value !== progressFloor.value
  ) {
    // setState pendant le render : React ré-rend immédiatement sans flash. La
    // garde d'égalité ci-dessus garantit la convergence (pas de boucle).
    setProgressFloor(nextFloor);
  }

  // Story 4.21 — gate one-shot : pose le flag « récit ouvert » (persistant) et
  // atterrit par défaut sur Résumé. Le bloc d'accueil ne réapparaît plus jamais.
  function handleOpenStory() {
    markCompletedTranscriptionSeen(session.id);
    writeSessionSubUrl(
      pathname,
      new URLSearchParams(window.location.search),
      "summary",
      "replace",
    );
    setUrlRevision((revision) => revision + 1);
  }

  function handleArtifactSubTabChange(value: string) {
    if (!isArtifactSubTab(value)) return;
    writeSessionSubUrl(
      pathname,
      new URLSearchParams(window.location.search),
      value,
      "push",
    );
    setUrlRevision((revision) => revision + 1);
  }

  function handleConfirmDelete() {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setDeleting(false);
        toast.success("Séance supprimée.");
        router.push(`/jdr/campaigns/${campId}`);
      },
    });
  }

  // Story 4.23 (AC10) — débloque une séance coincée : le backend vérifie que le
  // job est bien mort puis bascule la séance en `transcription_failed`. Le cache
  // session est invalidé → la page repasse sur l'état échec (remplacer / supprimer).
  function handleRecover() {
    recoverMutation.mutate(undefined, {
      onSuccess: () =>
        toast.success("Séance débloquée. Tu peux relancer la transcription."),
      onError: () =>
        toast.error("Impossible de débloquer la séance pour l'instant."),
    });
  }

  // Story 7.1 / BD-21 — re-run transcription on the existing audio (no re-upload).
  // `transcription_failed`: direct (nothing valuable to lose). `transcribed`:
  // confirmed first (overwrites the current transcript), then runs.
  function runRetryTranscription() {
    retryMutation.mutate(undefined, {
      onSuccess: () =>
        toast.success("Transcription relancée — le rituel reprend."),
      onError: () =>
        toast.error("Impossible de relancer la transcription pour l'instant."),
    });
  }

  function handleConfirmRetryTranscribed() {
    setConfirmRetryTranscribed(false);
    runRetryTranscription();
  }

  return (
    <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
      <div className="mb-4">
        <CampaignBreadcrumb campaignId={campId} current={session.title} />
      </div>

      <header className="bg-surface-card border-border-card mb-7 rounded-[10px] border p-6 shadow-(--shadow-card-inset) lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-display text-3xl leading-tight font-semibold">
                {session.title}
              </h1>
              <SessionStateChip
                state={session.state}
                currentJobId={currentJobId}
              />
              {/* Story 4.21 — la transcription RAW n'est plus une surface de
                  premier plan : accès à la demande via cette icône (pop-up). */}
              {session.state === "transcribed" && (
                <IconButton
                  label="Afficher la transcription"
                  icon={<Eye aria-hidden="true" />}
                  onClick={() => setTranscriptionOpen(true)}
                />
              )}
              {/* Story 4.23 (AC1) — lecteur audio sur la même ligne que le titre,
                  sans cadre (variante `bare`). Largeur bornée pour ne pas pousser
                  les icônes Modifier/Supprimer ; passe à la ligne si l'espace
                  manque. Libellé distinct du lecteur de la pop-up de transcription. */}
              {session.state === "transcribed" && (
                <AudioPlayer
                  bare
                  src={resolveSessionAudioSrc(session.id)}
                  label="Écouter l'enregistrement de la séance"
                  className="w-full sm:w-80 lg:w-96"
                />
              )}
            </div>
            <time
              dateTime={session.recorded_at}
              className="text-text-chrome-muted flex flex-col text-sm"
            >
              <span>{relativeDate}</span>
              <span className="text-xs">{absoluteDate}</span>
            </time>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <IconButton
                label="Modifier la séance"
                icon={<Pencil aria-hidden="true" />}
                onClick={() => setEditing(true)}
              />
            )}
            {/* Story 7.1 — rare "redo from scratch" recovery actions for a
                transcribed séance (e.g. after a failed artifact), grouped in an
                overflow menu so they stay discoverable without crowding the
                reading flow. */}
            {canEdit && session.state === "transcribed" && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Plus d'actions sur la séance"
                    />
                  }
                >
                  <Ellipsis aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem
                    onClick={() => setConfirmRetryTranscribed(true)}
                  >
                    <RotateCcw aria-hidden="true" />
                    Relancer la transcription
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReplacing(true)}>
                    <Replace aria-hidden="true" />
                    Remplacer l&apos;enregistrement
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canEdit && (
              <IconButton
                label="Supprimer la séance"
                icon={<Trash2 aria-hidden="true" />}
                onClick={() => setDeleting(true)}
                className="text-state-error-strong hover:text-state-error-strong! hover:bg-state-error/10!"
              />
            )}
          </div>
        </div>
      </header>

      {/* Story 4.21 — flux narratif linéaire (plus d'onglets de premier niveau).
          La surface affichée est pilotée par l'état + le flag « récit ouvert ». */}
      <div className="mb-7 space-y-7">
        {canUploadAudio && (
          <SessionAudioUploadCard
            session={session}
            onUploadSuccess={(duration) => {
              setDurationSeconds(duration);
              writeAudioDuration(sid, duration);
            }}
          />
        )}

        {/* Story 3.5 : la dropzone de remplacement remplace le tracker le temps
            de re-déposer un fichier (DELETE → POST avec confirmation). */}
        {showReplaceCard && (
          <SessionAudioUploadCard
            session={session}
            variant="replace"
            onCancel={() => setReplacing(false)}
            onUploadSuccess={(duration) => {
              setDurationSeconds(duration);
              writeAudioDuration(sid, duration);
              setReplacing(false);
            }}
          />
        )}

        {/* Story 4.23 (AC10) — séance coincée sur `transcribing` (job 404) :
            message honnête + Réessayer (refetch) + Débloquer (recover). */}
        {stuckTranscription && (
          <StuckTranscriptionCard
            onRetry={() => void jobQuery.refetch()}
            onRecover={handleRecover}
            recovering={recoverMutation.isPending}
          />
        )}

        {showRitual && (
          <RitualProgress
            uiState={ritualState}
            sessionTitle={session.title}
            progress={displayProgress}
            phase={job?.phase}
            queued={job?.status === "queued"}
            // Story 3.5 : l'affordance de remplacement est portée par l'acte
            // affiché (`transcribing` pour `audio_uploaded`, `failed` pour un
            // échec). Gaté sur `ritualState` → masqué dès que le job est terminal,
            // jamais dupliqué ni affiché sur un récit.
            onReplace={
              replaceEligible && !replaceBlocked
                ? () => setReplacing(true)
                : undefined
            }
            replaceDisabledHint={
              replaceBlocked ? TRANSCRIPTION_ACTIVE_REPLACE_HINT : undefined
            }
            // Story 7.1 — re-run transcription from the existing audio on the
            // failure card (no re-upload). Only on the `failed` act.
            onRetry={
              ritualState === "failed" ? runRetryTranscription : undefined
            }
          />
        )}

        {/* Story 4.21 (AC3/AC4) — gate « Ton récit est consigné. » : réutilise
            l'acte transcribed du RitualProgress en câblant son CTA. Le clic pose
            le flag persistant et bascule vers les sous-onglets (Résumé par
            défaut) ; ce bloc ne réapparaît plus jamais. */}
        {showStoryGate && (
          <RitualProgress
            uiState="transcribed"
            sessionTitle={session.title}
            onOpenStory={handleOpenStory}
          />
        )}

        {showArtifacts && (
          <Tabs
            value={sub}
            onValueChange={handleArtifactSubTabChange}
            className="w-full space-y-6"
          >
            {/* Story 4.7 (S6) : la déclaration des présents est un dropdown
                compact sur la même ligne que les sous-onglets. */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <TabsList
                variant="line"
                className="bg-surface-raised border-border-chrome flex-wrap rounded-md border px-3"
              >
                {ARTIFACT_SUB_TABS.map((artifactTab) => {
                  // Story 4.3 : Résumé toujours ouvert ; les 3 autres se
                  // déverrouillent une fois le résumé généré (`summaryExists`).
                  const disabled =
                    artifactTab.value !== "summary" && !summaryExists;
                  return (
                    <TabsTrigger
                      key={artifactTab.value}
                      value={artifactTab.value}
                      disabled={disabled}
                      title={disabled ? ARTIFACT_DISABLED_HINT : undefined}
                      // Base UI rend `aria-disabled` (pas `disabled`) : on réactive
                      // les pointer-events pour que le tooltip natif `title` (UX-DR14)
                      // s'affiche au survol, et on porte le curseur sur `aria-disabled`.
                      className="after:bg-accent-gold data-active:text-accent-gold aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed"
                    >
                      {artifactTab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {canEdit && (
                <PjPresenceDropdown
                  sessionId={session.id}
                  campaignId={campId}
                />
              )}
            </div>

            <TabsContent value="summary" className="space-y-6">
              {/* Story 4.3 : génération + affichage du Résumé (MJ). `showArtifacts`
                  garantit déjà `session.state === "transcribed"`. */}
              {canEdit ? (
                <SummaryArtifactPanel
                  sessionId={session.id}
                  campaignId={campId}
                  sessionTitle={session.title}
                />
              ) : (
                <section className="bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)">
                  <h2 className="font-display text-xl font-semibold">Résumé</h2>
                  <p className="text-text-chrome-muted mt-2 text-sm">
                    Les artefacts de cette séance seront publiés ici.
                  </p>
                </section>
              )}
            </TabsContent>

            {/* Story 4.4 : déclencheurs indépendants Récit / Éléments / POVs
                (gate « résumé existant » porté par les sous-tabs → 409 no-summary
                impossible). `summaryExists` ajouté à la garde pour qu'un deep-link
                `?sub=…` sans résumé ne monte pas le déclencheur (AC3). */}
            <TabsContent value="narrative">
              {canEdit && summaryExists ? (
                <NarrativeArtifactPanel
                  sessionId={session.id}
                  campaignId={campId}
                  sessionTitle={session.title}
                />
              ) : (
                <ReadOnlyArtifactPlaceholder title="Récit" />
              )}
            </TabsContent>
            <TabsContent value="elements">
              {canEdit && summaryExists ? (
                <ElementsArtifactPanel
                  sessionId={session.id}
                  campaignId={campId}
                  sessionTitle={session.title}
                />
              ) : (
                <ReadOnlyArtifactPlaceholder title="Éléments" />
              )}
            </TabsContent>
            <TabsContent value="povs">
              {canEdit && summaryExists ? (
                <PovArtifactPanel sessionId={session.id} campaignId={campId} />
              ) : (
                <ReadOnlyArtifactPlaceholder title="POVs" />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <SessionEditDialog
        open={editing}
        onOpenChange={setEditing}
        session={session}
        campaignId={campId}
      />
      <SessionDeleteConfirm
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) deleteMutation.reset();
        }}
        session={session}
        onConfirm={handleConfirmDelete}
        submitting={deleteMutation.isPending}
        error={deleteMutation.error}
      />

      {/* Story 7.1 — re-running transcription on a transcribed séance overwrites
          the current transcript (and stales its artifacts), so it is confirmed. */}
      <ConfirmDialog
        open={confirmRetryTranscribed}
        onOpenChange={setConfirmRetryTranscribed}
        title="Relancer la transcription ?"
        description="La transcription actuelle sera écrasée et devra être régénérée. Les artefacts déjà produits resteront mais pourront être désynchronisés du nouveau texte."
        confirmLabel="Relancer"
        pendingLabel="Relancement…"
        onConfirm={handleConfirmRetryTranscribed}
        submitting={retryMutation.isPending}
      />

      {/* Story 4.21 — pop-up transcription RAW (lecture + édition + export
          JSON/.md), ouverte par l'icône Eye du header. */}
      {session.state === "transcribed" && (
        <TranscriptionDialog
          open={transcriptionOpen}
          onOpenChange={setTranscriptionOpen}
          sessionId={session.id}
          transcriptionMode={session.transcription_mode}
          sessionTitle={session.title}
          canEdit={canEdit}
          editingBlocked={transcriptionEditBlocked}
        />
      )}
    </section>
  );
}
