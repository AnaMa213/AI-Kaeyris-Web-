"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampaignBreadcrumb } from "@/components/jdr/campaigns/CampaignBreadcrumb";
import { JobStateBadge } from "@/components/jdr/jobs/JobStateBadge";
import { RitualProgress } from "@/components/jdr/sessions/RitualProgress";
import { SessionAudioUploadCard } from "@/components/jdr/sessions/SessionAudioUploadCard";
import { PjPresenceForm } from "@/components/jdr/sessions/PjPresenceForm";
import { SessionEditDialog } from "@/components/jdr/sessions/SessionEditForm";
import { FantasyLoader } from "@/components/common/FantasyLoader";
import { ApiError } from "@/lib/core/api/errors";
import { env } from "@/lib/core/env";
import { parseBackendDate } from "@/lib/core/api/parseBackendDate";
import { useGetCampaign } from "@/lib/jdr/campaigns/queries";
import { useJob } from "@/lib/jdr/jobs/queries";
import {
  estimateJobProgress,
  resolveDisplayProgress,
  type DisplayProgressState,
} from "@/lib/jdr/jobs/progress";
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
import { useGetSession, type SessionOut } from "@/lib/jdr/sessions/queries";

const STATE_LABEL: Record<SessionOut["state"], string> = {
  created: "Créée",
  audio_uploaded: "Audio uploadé",
  transcribing: "Transcription en cours",
  transcription_failed: "Échec transcription",
  transcribed: "Transcrite",
};

const AUDIO_DISABLED_HINT = "Disponible avec Epic 3";

const VALID_RITUAL_OVERRIDES: PipelineUIState[] = [
  "uploading",
  "transcribing",
  "transcribed",
  "failed",
];

function hasAudio(state: SessionOut["state"]): boolean {
  return state !== "created";
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

export default function SessionDetailPage() {
  const params = useParams<{ campId: string; sid: string }>();
  const campId = typeof params.campId === "string" ? params.campId : "";
  const sid = typeof params.sid === "string" ? params.sid : "";
  const sessionQuery = useGetSession(sid);
  const campaignQuery = useGetCampaign(campId);
  const [editing, setEditing] = useState(false);
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

  // Notification de fin, dédupliquée par job.id terminal.
  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded" && notifiedJobRef.current !== job.id) {
      notifiedJobRef.current = job.id;
      toast.success("Transcription terminée — ton récit est consigné.");
    } else if (job.status === "failed" && notifiedJobRef.current !== job.id) {
      notifiedJobRef.current = job.id;
      toast.error(job.failure_reason ?? "La transcription a échoué.");
    }
  }, [job]);

  if (sessionQuery.isPending) {
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
  const audioReady = hasAudio(session.state);
  const canEdit = campaignQuery.data
    ? canEditCampaignSession(campaignQuery.data)
    : false;
  const canUploadAudio = canEdit && session.state === "created";
  // Story 3.5 : remplacement permis sur `audio_uploaded`/`transcription_failed`
  // (gaté sur l'état brut, pas l'uiState FSM). `replacing` monte la dropzone.
  const canReplace = canEdit && canReplaceAudio(session.state);
  const showReplaceCard = replacing && canReplace;
  const ritualState = readRitualOverride() ?? pipeline.uiState;
  // Le tracker page-level couvre les états ≥ audio_uploaded. L'acte `uploading`
  // (reduce + envoi) est porté par la card tant que la session est `created`.
  // Masqué pendant le remplacement (la dropzone prend le relais).
  const showRitual =
    !showReplaceCard && ritualState !== "idle" && ritualState !== "uploading";
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

  return (
    <section className="bg-background text-foreground min-h-full px-6 py-8 lg:px-12">
      <div className="mb-4">
        <CampaignBreadcrumb campaignId={campId} />
      </div>

      <header className="bg-surface-card border-border-card mb-7 rounded-[10px] border p-6 shadow-(--shadow-card-inset) lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold leading-tight">
                {session.title}
              </h1>
              <Badge variant="outline">{STATE_LABEL[session.state]}</Badge>
              {currentJobId && <JobStateBadge jobId={currentJobId} />}
            </div>
            <time
              dateTime={session.recorded_at}
              className="text-text-chrome-muted flex flex-col text-sm"
            >
              <span>{relativeDate}</span>
              <span className="text-xs">{absoluteDate}</span>
            </time>
          </div>

          <div className="flex shrink-0 gap-2">
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                Modifier
              </Button>
            )}
            {audioReady && (
              <Button
                type="button"
                variant="outline"
                disabled
                title={AUDIO_DISABLED_HINT}
                aria-label="Lire l'audio de la séance"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Lire l&apos;audio
              </Button>
            )}
          </div>
        </div>
      </header>

      {canUploadAudio && (
        <div className="mb-7">
          <SessionAudioUploadCard
            session={session}
            onUploadSuccess={(duration) => {
              setDurationSeconds(duration);
              writeAudioDuration(sid, duration);
            }}
          />
        </div>
      )}

      {/* Story 3.5 : la dropzone de remplacement remplace le tracker le temps
          de re-déposer un fichier (DELETE → POST avec confirmation). */}
      {showReplaceCard && (
        <div className="mb-7">
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
        </div>
      )}

      {showRitual && (
        <div className="mb-7">
          <RitualProgress
            uiState={ritualState}
            sessionTitle={session.title}
            progress={displayProgress}
            phase={job?.phase}
            // Story 3.5 : l'affordance de remplacement est portée par l'acte
            // affiché (`transcribing` pour `audio_uploaded`, `failed` pour un
            // échec). Gaté sur `ritualState` → masqué dès que le job est terminal
            // (transcribed/failed-handled), jamais dupliqué ni affiché sur un récit.
            onReplace={
              canReplace &&
              (ritualState === "failed" || ritualState === "transcribing")
                ? () => setReplacing(true)
                : undefined
            }
          />
        </div>
      )}

      {/* Story 4.1 : déclaration des PJs présents — GM, une fois la séance
          transcrite (prérequis aux artefacts / POVs). */}
      {canEdit && session.state === "transcribed" && (
        <div className="mb-7">
          <PjPresenceForm sessionId={session.id} campaignId={campId} />
        </div>
      )}

      <SessionEditDialog
        open={editing}
        onOpenChange={setEditing}
        session={session}
        campaignId={campId}
      />
    </section>
  );
}
