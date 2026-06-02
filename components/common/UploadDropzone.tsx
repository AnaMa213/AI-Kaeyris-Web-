"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  accept: string;
  acceptedExtensions: string[];
  acceptedMimeTypes: string[];
  onFileSelected: (file: File) => void;
  onRejected: (reason: string) => void;
  label: string;
  rejectionMessage: string;
  ariaLabel?: string;
  disabled?: boolean;
}

function hasAcceptedExtension(
  filename: string,
  acceptedExtensions: string[],
): boolean {
  const lower = filename.toLowerCase();
  return acceptedExtensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

function hasAcceptedMime(
  mime: string,
  acceptedMimeTypes: string[],
): boolean {
  if (!mime) return false;
  return acceptedMimeTypes.includes(mime);
}

export function UploadDropzone({
  accept,
  acceptedExtensions,
  acceptedMimeTypes,
  onFileSelected,
  onRejected,
  label,
  rejectionMessage,
  ariaLabel,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragover, setIsDragover] = useState(false);

  const handleFile = (file: File) => {
    const extOk = hasAcceptedExtension(file.name, acceptedExtensions);
    const mimeOk = hasAcceptedMime(file.type, acceptedMimeTypes);
    if (extOk || mimeOk) {
      onFileSelected(file);
    } else {
      onRejected(rejectionMessage);
    }
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragover(true);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragover(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Only flip the visual off when leaving the dropzone itself, not children.
    if (event.target !== event.currentTarget) return;
    setIsDragover(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragover(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? label}
      aria-disabled={disabled || undefined}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-dragover={isDragover ? "true" : undefined}
      className={cn(
        "bg-surface-card border-border-card flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed p-8 text-center shadow-(--shadow-card-inset) transition-colors duration-120",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-accent-gold/60",
        isDragover && !disabled && "border-accent-gold bg-accent-gold/5",
      )}
    >
      <Upload
        className="text-text-chrome-muted h-8 w-8"
        aria-hidden="true"
      />
      <p className="text-text-chrome text-sm font-medium">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          // Reset value so the same file can be picked again after Annuler.
          event.target.value = "";
        }}
      />
    </div>
  );
}
