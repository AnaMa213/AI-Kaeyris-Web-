"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/common/UploadDropzone";
import { RitualProgress } from "@/components/jdr/sessions/RitualProgress";
import { ApiError } from "@/lib/core/api/errors";
import { shouldReduce } from "@/lib/audio/provider";
import { reduceAudio } from "@/lib/audio/reduce";
import {
  useUploadSessionAudio,
  type SessionOut,
} from "@/lib/jdr/sessions/queries";

interface SessionAudioUploadCardProps {
  session: SessionOut;
  /**
   * Story 3.4 : le `job_id` n'est plus remonté — le polling se réarme depuis
   * `session.current_job_id` (cf. patch optimiste de `useUploadSessionAudio`).
   * Seule la durée audio reste un signal client-only (non exposé par le backend).
   */
  onUploadSuccess?: (durationSeconds: number | null) => void;
}

type Phase = "idle" | "reducing" | "preparing";

const ACCEPT_ATTR = ".m4a,audio/mp4,audio/x-m4a";
const ACCEPTED_EXTENSIONS = [".m4a"];
const ACCEPTED_MIME_TYPES = ["audio/mp4", "audio/x-m4a"];
const DROPZONE_LABEL = "Glisse ton M4A ici ou clique pour choisir";
const REJECTION_MESSAGE = "Format non supporté. Glisse un fichier .m4a.";
const REDUCE_ERROR_MESSAGE =
  "La réduction audio a échoué. Réessaie ou choisis un fichier plus petit.";

const SELECTED_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} Ko`;
  return `${(kb / 1024).toFixed(1)} Mo`;
}

function formatUploadError(error: unknown): string {
  if (error instanceof ApiError) {
    const status = error.problem.status;
    if (status === 403) {
      return "Tu n'as pas les permissions pour uploader l'audio.";
    }
    if (status === 413) {
      return "Fichier trop volumineux pour le backend actuel. La réduction côté serveur arrive (BD-9) ; en attendant, choisis un fichier plus court.";
    }
    if (status === 422) {
      return "Le fichier audio n'est pas valide. Vérifie le format M4A.";
    }
  }
  return "L'upload a échoué. Réessaie.";
}

export function SessionAudioUploadCard({
  session,
  onUploadSuccess,
}: SessionAudioUploadCardProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Nom affiché = celui choisi par le MJ. On le fige à la sélection pour ne pas
  // exposer un nom interne (`*.reduced.m4a`) si le reduce client se déclenche.
  const [selectedName, setSelectedName] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
  const uploadMutation = useUploadSessionAudio(session.id);
  const uploading = uploadMutation.isPending;

  const resetToIdle = (operationId?: number) => {
    if (operationId === undefined || operationRef.current === operationId) {
      abortRef.current = null;
    }
    setPhase("idle");
    setSelectedFile(null);
    setSelectedName("");
  };

  const handleFileSelected = async (file: File) => {
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    setSelectedName(file.name);

    if (!shouldReduce(file.size)) {
      abortRef.current = null;
      setSelectedFile(file);
      setPhase("preparing");
      return;
    }

    setPhase("reducing");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Le reduce est transparent (Story 3.3.1) : on ne remonte plus le % au
      // DOM (pas d'`onProgress`), pour ne pas fuiter de jargon technique.
      const reduced = await reduceAudio(file, undefined, controller.signal);
      if (controller.signal.aborted || operationRef.current !== operationId) {
        return;
      }
      setSelectedFile(reduced);
      setPhase("preparing");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (operationRef.current !== operationId) return;
      if (err instanceof Error) console.error("[audio-reduce]", err.message);
      toast.error(REDUCE_ERROR_MESSAGE);
      resetToIdle(operationId);
    } finally {
      if (operationRef.current === operationId) abortRef.current = null;
    }
  };

  const handleCancelReducing = () => {
    abortRef.current?.abort();
    operationRef.current += 1;
    resetToIdle();
  };

  const handleSend = () => {
    if (!selectedFile || uploading) return;
    uploadMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        onUploadSuccess?.(data.duration_seconds ?? null);
      },
      onError: (err) => {
        toast.error(formatUploadError(err));
      },
    });
  };

  // Acte I « Le parchemin se prépare » : réservé à un VRAI traitement —
  // le reduce client (transparent) ou l'envoi en cours. Jamais avant l'envoi.
  if (phase === "reducing" || uploading) {
    return (
      <div data-session-id={session.id}>
        <RitualProgress uiState="uploading" sessionTitle={session.title} />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {phase === "reducing" ? (
            <Button type="button" variant="ghost" onClick={handleCancelReducing}>
              Annuler
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" disabled>
                Annuler
              </Button>
              <Button type="button" disabled className="animate-pulse">
                Envoi en cours…
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Fichier sélectionné, pas encore envoyé : on montre le nom et on rend la main
  // au MJ. Le chargement ne démarre qu'au clic sur « Envoyer » (intention).
  if (phase === "preparing" && selectedFile) {
    return (
      <section
        aria-label="Fichier audio sélectionné"
        data-session-id={session.id}
        className={SELECTED_CARD_CLASSES}
      >
        <div className="flex items-center gap-3">
          <FileAudio
            className="text-accent-gold h-8 w-8 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={selectedName}>
              {selectedName}
            </p>
            <p className="text-text-chrome-muted text-xs">
              {formatFileSize(selectedFile.size)} · prêt à envoyer
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => resetToIdle()}>
            Changer de fichier
          </Button>
          <Button type="button" onClick={handleSend}>
            Envoyer
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Zone d'upload audio"
      data-session-id={session.id}
    >
      <UploadDropzone
        accept={ACCEPT_ATTR}
        acceptedExtensions={ACCEPTED_EXTENSIONS}
        acceptedMimeTypes={ACCEPTED_MIME_TYPES}
        onFileSelected={handleFileSelected}
        onRejected={(reason) => toast.error(reason)}
        label={DROPZONE_LABEL}
        rejectionMessage={REJECTION_MESSAGE}
      />
    </section>
  );
}
