"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/common/UploadDropzone";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

interface SessionAudioUploadCardProps {
  session: SessionOut;
}

const ACCEPT_ATTR = ".m4a,audio/mp4,audio/x-m4a";
const ACCEPTED_EXTENSIONS = [".m4a"];
const ACCEPTED_MIME_TYPES = ["audio/mp4", "audio/x-m4a"];
const DROPZONE_LABEL = "Glisse ton M4A ici ou clique pour choisir";
const REJECTION_MESSAGE = "Format non supporté. Glisse un fichier .m4a.";
const SEND_HINT = "Disponible avec Story 3.3";

const SECTION_CARD_CLASSES =
  "bg-surface-card border-border-card rounded-[10px] border p-6 shadow-(--shadow-card-inset)";

function formatSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function SessionAudioUploadCard({
  session,
}: SessionAudioUploadCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (selectedFile) {
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
            onClick={() => setSelectedFile(null)}
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
        onFileSelected={setSelectedFile}
        onRejected={(reason) => toast.error(reason)}
        label={DROPZONE_LABEL}
        rejectionMessage={REJECTION_MESSAGE}
      />
    </section>
  );
}
