"use client";

import { Button } from "@/components/ui/button";
import { useRotatingText } from "@/lib/jdr/sessions/useRotatingText";
import type { PipelineUIState } from "@/lib/jdr/sessions/pipelineState";
import {
  phaseToTranscribingAct,
  type TranscribingActVariant,
} from "@/lib/jdr/sessions/transcriptionPhase";
import type { JobOut } from "@/lib/jdr/jobs/queries";

interface RitualProgressProps {
  uiState: PipelineUIState;
  sessionTitle: string;
  /** % de transcription (Story 3.4). `null`/absent → barre indéterminée. */
  progress?: number | null;
  /**
   * Phase backend (BD-10, Story 3.6). Raffine l'habillage DANS l'acte
   * `transcribing` (`reducing` → préparation, sinon scribes). Ne pilote jamais
   * la FSM. `null`/absent → dégradation vers l'acte des scribes.
   */
  phase?: JobOut["phase"];
  queued?: boolean;
  /** Navigation vers le récit (Story 3.5). Bouton désactivé si absent. */
  onOpenStory?: () => void;
  /** Relancer la transcription (Story 3.4). Bouton inerte si absent. */
  onRetry?: () => void;
  /** Remplacer l'enregistrement (Story 3.6). Bouton inerte si absent. */
  onReplace?: () => void;
  /**
   * Story 4.15 (T2) : un job de transcription actif verrouille le remplacement.
   * Quand cet indice est fourni, le bouton « Remplacer » est rendu DÉSACTIVÉ
   * avec ce `title` (prioritaire sur `onReplace`) — empêche le MJ de lancer une
   * seconde transcription concurrente. Absent → comportement legacy (`onReplace`).
   */
  replaceDisabledHint?: string;
}

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

// Sous-textes rotatifs — vocabulaire fantasy définitif (UX spec §Acte I/II).
const UPLOADING_LINES = [
  "On déroule le vélin…",
  "L'encre se mêle à l'eau de pluie.",
  "Les voix de ta table rejoignent le grimoire.",
];
const TRANSCRIBING_LINES = [
  "Whisper écoute les voix de ta table…",
  "Chaque réplique trouve sa ligne.",
  "Le silence entre deux phrases est noté lui aussi.",
  "Les noms propres résistent encore un peu…",
];
// Phase `reducing` (BD-10) : on prépare le vélin avant que les scribes écrivent.
const REDUCING_LINES = [
  "On apprête le grimoire…",
  "Le vélin est lissé, l'encre chauffée.",
  "Les voix attendent leur tour d'être consignées.",
];

// Annonce concise pour lecteurs d'écran — distincte du titre décoratif.
const QUEUED_LINES = [
  "Le grimoire attend son tour...",
  "Les scribes rangent leurs plumes.",
  "La file avance doucement.",
];

const STATUS_ANNOUNCE: Record<
  Exclude<PipelineUIState, "idle">,
  string
> = {
  uploading: "Préparation de l'enregistrement en cours",
  transcribing: "Transcription en cours",
  transcribed: "Transcription terminée",
  failed: "La transcription a échoué",
};

/**
 * Tracker rituel fantasy (Story 3.3.1). Visualise la FSM `PipelineUIState`.
 * Le reduce ffmpeg est transparent (absorbé dans l'acte `uploading`) :
 * aucun vocabulaire technique ni pourcentage n'apparaît dans le DOM.
 */
export function RitualProgress({
  uiState,
  sessionTitle,
  progress,
  phase,
  queued = false,
  onOpenStory,
  onRetry,
  onReplace,
  replaceDisabledHint,
}: RitualProgressProps) {
  // Sous-acte de `transcribing` raffiné par la phase backend (Story 3.6).
  const transcribingVariant = phaseToTranscribingAct(phase);
  // Hooks appelés inconditionnellement (avant tout early-return).
  const lines =
    uiState === "uploading"
      ? UPLOADING_LINES
      : uiState === "transcribing"
        ? queued
          ? QUEUED_LINES
          : transcribingVariant === "reducing"
            ? REDUCING_LINES
            : TRANSCRIBING_LINES
        : [];
  const { current: rotatingSubtext } = useRotatingText(lines, {
    intervalMs: 4000,
  });

  if (uiState === "idle") return null;

  return (
    <section
      className={SECTION_CARD_CLASSES}
      aria-label="Rituel de transcription"
      data-ritual-state={uiState}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {uiState === "transcribing" && queued
          ? "Transcription en attente"
          : STATUS_ANNOUNCE[uiState]}{" "}
        — {sessionTitle}
      </p>

      {uiState === "uploading" && <UploadingAct subtext={rotatingSubtext} />}
      {uiState === "transcribing" && (
        <TranscribingAct
          variant={transcribingVariant}
          queued={queued}
          subtext={rotatingSubtext}
          progress={progress}
          onReplace={onReplace}
          replaceDisabledHint={replaceDisabledHint}
        />
      )}
      {uiState === "transcribed" && <TranscribedAct onOpenStory={onOpenStory} />}
      {uiState === "failed" && (
        <FailedAct
          onRetry={onRetry}
          onReplace={onReplace}
          replaceDisabledHint={replaceDisabledHint}
        />
      )}
    </section>
  );
}

/**
 * Bouton « Remplacer l'enregistrement » partagé par les actes `transcribing` et
 * `failed`. Story 4.15 : si `disabledHint` est fourni, le bouton est rendu
 * DÉSACTIVÉ avec ce `title` (prioritaire sur `onReplace`) — verrou anti-double
 * transcription. Sinon comportement legacy : actif si `onReplace`, absent sinon.
 */
function ReplaceAudioButton({
  onReplace,
  disabledHint,
}: {
  onReplace?: () => void;
  disabledHint?: string;
}) {
  if (!disabledHint && !onReplace) return null;
  const disabled = Boolean(disabledHint);
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onReplace}
      disabled={disabled}
      title={disabledHint}
    >
      Remplacer l&apos;enregistrement
    </Button>
  );
}

function ActShell({
  title,
  subtext,
  scene,
  tone = "chrome",
  children,
}: {
  title: string;
  subtext?: React.ReactNode;
  scene: React.ReactNode;
  tone?: "chrome" | "success" | "muted";
  children?: React.ReactNode;
}) {
  const titleColor =
    tone === "success"
      ? "text-state-success"
      : tone === "muted"
        ? "text-text-chrome-muted"
        : "text-text-chrome";
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="h-20 w-20" aria-hidden="true">
        {scene}
      </div>
      <div className="flex flex-col items-center gap-1">
        <h2 className={`font-display text-xl ${titleColor}`}>{title}</h2>
        {subtext !== undefined && (
          <p
            key={typeof subtext === "string" ? subtext : undefined}
            className="text-text-chrome-muted min-h-5 text-sm italic transition-opacity duration-300 motion-reduce:transition-none"
          >
            {subtext}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function CredibleBar() {
  // Barre "crédible" indéterminée — décorrélée du vrai avancement (UX spec).
  return (
    <div
      className="bg-surface-raised h-1.5 w-48 overflow-hidden rounded-full"
      aria-hidden="true"
    >
      <div className="bg-accent-gold h-full w-1/3 animate-[shimmer-bar_1.8s_ease-in-out_infinite] rounded-full motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  );
}

function DeterminateBar({ value }: { value: number }) {
  // Barre déterminée pilotée par le % estimé (Story 3.4).
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex w-48 flex-col items-center gap-1">
      <div
        className="bg-surface-raised h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progression de la transcription"
      >
        <div
          className="bg-accent-gold h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-text-chrome-muted text-xs tabular-nums">
        {clamped} %
      </span>
    </div>
  );
}

function ParchmentScene() {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="text-accent-gold h-full w-full drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* Parchemin qui se déroule */}
      <rect x="28" y="20" width="44" height="60" rx="3" strokeWidth="2.5" />
      <path d="M28 30 H72 M28 42 H64 M28 54 H68 M28 66 H58" strokeWidth="1.4" opacity="0.55" />
      <circle
        cx="50"
        cy="50"
        r="40"
        strokeWidth="1"
        opacity="0.25"
        className="animate-[spin_6s_linear_infinite] motion-reduce:animate-none"
        strokeDasharray="6 10"
      />
    </svg>
  );
}

function QuillScene() {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="text-accent-gold h-full w-full drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* Plume */}
      <path d="M70 22 L40 62 L34 70 L44 64 Z" strokeWidth="2.5" />
      <path d="M40 62 L48 54" strokeWidth="1.4" opacity="0.6" />
      {/* Lignes d'écriture, tracé animé (ink-writing) */}
      <path
        d="M22 76 H78"
        strokeWidth="2"
        strokeDasharray="56"
        className="animate-[ink-writing_2.2s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      <path d="M22 84 H64" strokeWidth="1.4" opacity="0.5" />
    </svg>
  );
}

function UploadingAct({ subtext }: { subtext: string }) {
  return (
    <ActShell
      title="Le parchemin se prépare"
      subtext={subtext}
      scene={<ParchmentScene />}
    >
      <CredibleBar />
    </ActShell>
  );
}

function TranscribingAct({
  variant,
  queued,
  subtext,
  progress,
  onReplace,
  replaceDisabledHint,
}: {
  variant: TranscribingActVariant;
  queued: boolean;
  subtext: string;
  progress?: number | null;
  onReplace?: () => void;
  replaceDisabledHint?: string;
}) {
  // Phase `reducing` (BD-10) : préparation du grimoire (réutilise le parchemin).
  // Sinon : les scribes écrivent (plume). La barre/% et le bouton remplacer
  // restent identiques dans les deux sous-actes.
  const isReducing = variant === "reducing";
  return (
    <ActShell
      title={
        queued
          ? "Le grimoire attend son tour"
          : isReducing
            ? "Le grimoire se prépare"
            : "Les scribes transcrivent"
      }
      subtext={queued ? "En attente dans la file..." : subtext}
      scene={queued || isReducing ? <ParchmentScene /> : <QuillScene />}
    >
      {queued ? (
        <CredibleBar />
      ) : typeof progress === "number" ? (
        <DeterminateBar value={progress} />
      ) : (
        <CredibleBar />
      )}
      <ReplaceAudioButton
        onReplace={onReplace}
        disabledHint={replaceDisabledHint}
      />
    </ActShell>
  );
}

function TranscribedAct({ onOpenStory }: { onOpenStory?: () => void }) {
  return (
    <ActShell
      tone="success"
      title="Ton récit est consigné."
      subtext="Ta session est gravée dans le grimoire."
      scene={
        <div className="relative h-full w-full">
          <svg
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="text-state-success h-full w-full animate-[wax-seal_0.9s_ease-out] drop-shadow-[0_0_10px_rgba(80,160,110,0.4)] motion-reduce:animate-none"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {/* Sceau de cire */}
            <circle cx="50" cy="50" r="30" strokeWidth="3" fill="currentColor" fillOpacity="0.12" />
            <path
              d="M50 34 L55 46 L68 46 L57 54 L61 67 L50 59 L39 67 L43 54 L32 46 L45 46 Z"
              strokeWidth="2"
            />
          </svg>
          {/* Particules dorées one-shot */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <svg
              key={i}
              viewBox="0 0 4 4"
              className="text-accent-gold absolute left-1/2 top-1/2 h-1 w-1 animate-[gold-particle_1s_ease-out] motion-reduce:hidden"
              style={{ animationDelay: `${i * 90}ms`, ["--angle" as string]: `${i * 60}deg` }}
              aria-hidden="true"
            >
              <circle cx="2" cy="2" r="2" fill="currentColor" />
            </svg>
          ))}
        </div>
      }
    >
      <Button
        type="button"
        onClick={onOpenStory}
        disabled={!onOpenStory}
        title={onOpenStory ? undefined : "Disponible bientôt"}
      >
        Ouvrir le récit
      </Button>
    </ActShell>
  );
}

function FailedAct({
  onRetry,
  onReplace,
  replaceDisabledHint,
}: {
  onRetry?: () => void;
  onReplace?: () => void;
  replaceDisabledHint?: string;
}) {
  return (
    <ActShell
      tone="muted"
      title="Le grimoire est resté muet"
      subtext="La transcription a échoué."
      scene={
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="text-text-chrome-muted h-full w-full opacity-70 saturate-50"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {/* Grimoire fermé / sceau brisé, sépia éteint */}
          <rect x="28" y="22" width="44" height="56" rx="3" strokeWidth="2.5" />
          <path d="M50 22 V78" strokeWidth="1" opacity="0.4" />
          <path d="M40 44 L60 56 M60 44 L40 56" strokeWidth="2" opacity="0.7" />
        </svg>
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Re-transcription endpoint is not built yet (Story 3.5 §5.4) — the
            retry CTA stays inert with a "coming soon" hint. */}
        <Button
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          title={onRetry ? undefined : "Disponible bientôt"}
        >
          Relancer la transcription
        </Button>
        {/* Replace ships in Story 3.5 and is gm-gated: hidden entirely when the
            caller can't replace. Story 4.15: an active job passes a disabled
            hint instead, locking the control rather than advertising it. */}
        <ReplaceAudioButton
          onReplace={onReplace}
          disabledHint={replaceDisabledHint}
        />
      </div>
    </ActShell>
  );
}
