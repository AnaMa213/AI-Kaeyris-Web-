"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadDropzone } from "@/components/common/UploadDropzone";
import { shouldReduce } from "@/lib/audio/provider";
import { reduceAudio } from "@/lib/audio/reduce";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

interface SessionAudioUploadCardProps {
  session: SessionOut;
}

type Phase = "idle" | "reducing" | "preparing";

const ACCEPT_ATTR = ".m4a,audio/mp4,audio/x-m4a";
const ACCEPTED_EXTENSIONS = [".m4a"];
const ACCEPTED_MIME_TYPES = ["audio/mp4", "audio/x-m4a"];
const DROPZONE_LABEL = "Glisse ton M4A ici ou clique pour choisir";
const REJECTION_MESSAGE = "Format non supporté. Glisse un fichier .m4a.";
const REDUCE_ERROR_MESSAGE =
  "La réduction audio a échoué. Réessaie ou choisis un fichier plus petit.";
const SEND_HINT = "Disponible avec Story 3.3";

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function formatSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function SessionAudioUploadCard({
  session,
}: SessionAudioUploadCardProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);

  const resetToIdle = (operationId?: number) => {
    if (operationId === undefined || operationRef.current === operationId) {
      abortRef.current = null;
    }
    setPhase("idle");
    setSelectedFile(null);
    setOriginalSize(0);
    setProgress(0);
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

    setOriginalSize(file.size);
    setProgress(0);
    setPhase("reducing");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reduced = await reduceAudio(
        file,
        (percent) => {
          if (operationRef.current === operationId) setProgress(percent);
        },
        controller.signal,
      );
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

  if (phase === "reducing") {
    return (
      <section
        className={SECTION_CARD_CLASSES}
        aria-label="Réduction audio en cours"
        data-session-id={session.id}
      >
        <h2 className="font-display mb-3 text-xl">Réduction audio</h2>
        <p className="text-text-chrome mb-3 text-sm">
          Réduction en cours… <strong>{progress}%</strong>
        </p>
        <Progress value={progress} className="mb-3" />
        <p className="text-text-chrome-muted mb-4 text-xs">
          Fichier d&apos;origine : {formatSizeMB(originalSize)} MB
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={handleCancelReducing}
        >
          Annuler
        </Button>
      </section>
    );
  }

  if (phase === "preparing" && selectedFile) {
    return (
      <section
        className={SECTION_CARD_CLASSES}
        aria-label="Audio prêt à envoyer"
        data-session-id={session.id}
      >
        <h2 className="font-display mb-3 text-xl">Audio sélectionné</h2>
        <p className="text-text-chrome mb-4 text-sm">
          Fichier prêt : <strong>{selectedFile.name}</strong>{" "}
          <span className="text-text-chrome-muted">
            ({formatSizeMB(selectedFile.size)} MB)
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => resetToIdle()}
          >
            Annuler
          </Button>
          <Button type="button" disabled title={SEND_HINT}>
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
