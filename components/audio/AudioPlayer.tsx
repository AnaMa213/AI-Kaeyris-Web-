"use client";

import { useRef, type KeyboardEvent } from "react";

import { env } from "@/lib/core/env";

const DEFAULT_ARIA_LABEL = "Lecteur audio de la séance";
const MOCK_AUDIO_LABEL = "Mock audio démo · audio réel en V2";

interface AudioPlayerProps {
  src: string;
  "aria-label"?: string;
  label?: string;
}

export function AudioPlayer({
  src,
  "aria-label": ariaLabel,
  label,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLAudioElement>) {
    if (event.code !== "Space" && event.key !== " ") return;

    event.preventDefault();
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  }

  return (
    <div className="border-border-chrome bg-surface-raised rounded-md border p-3">
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={src}
        aria-label={ariaLabel ?? label ?? DEFAULT_ARIA_LABEL}
        className="w-full"
        onKeyDown={handleKeyDown}
      />
      {env.NEXT_PUBLIC_MOCK_AUDIO && (
        <p className="text-text-chrome-muted mt-1 text-xs">
          {MOCK_AUDIO_LABEL}
        </p>
      )}
    </div>
  );
}
