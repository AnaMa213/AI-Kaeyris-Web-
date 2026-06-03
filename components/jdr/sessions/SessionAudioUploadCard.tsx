"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
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
  onUploadSuccess?: (jobId: string, durationSeconds: number | null) => void;
}

type Phase = "idle" | "reducing" | "preparing";

const ACCEPT_ATTR = ".m4a,audio/mp4,audio/x-m4a";
const ACCEPTED_EXTENSIONS = [".m4a"];
const ACCEPTED_MIME_TYPES = ["audio/mp4", "audio/x-m4a"];
const DROPZONE_LABEL = "Glisse ton M4A ici ou clique pour choisir";
const REJECTION_MESSAGE = "Format non supporté. Glisse un fichier .m4a.";
const REDUCE_ERROR_MESSAGE =
  "La réduction audio a échoué. Réessaie ou choisis un fichier plus petit.";

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
  };

  const handleFileSelected = async (file: File) => {
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;

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
        onUploadSuccess?.(data.job_id, data.duration_seconds ?? null);
      },
      onError: (err) => {
        toast.error(formatUploadError(err));
      },
    });
  };

  if (phase === "reducing" || (phase === "preparing" && selectedFile)) {
    // Acte I « Le parchemin se prépare » : le reduce ffmpeg est transparent,
    // absorbé dans l'état `uploading` du tracker (aucun % ni jargon au DOM).
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => resetToIdle()}
                disabled={uploading}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={uploading}
                className={uploading ? "animate-pulse" : undefined}
              >
                {uploading ? "Envoi en cours…" : "Envoyer"}
              </Button>
            </>
          )}
        </div>
      </div>
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
