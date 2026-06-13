"use client";

import { useRef } from "react";
import {
  NarrativeArtifact,
  type NarrativeArtifactKind,
} from "@/components/narrative/NarrativeArtifact";
import { ArtifactReadingAids } from "@/components/narrative/ArtifactReadingAids";
import { TocSidebar } from "@/components/narrative/TocSidebar";

/**
 * Story 5.2 — composition de lecture long-form : l'article (`NarrativeArtifact`,
 * Story 5.1) + son sommaire (`TocSidebar`). Le wrapper porte le `ref` du bloc de
 * contenu et le passe à la TocSidebar, qui en lit les titres — `NarrativeArtifact`
 * n'est donc PAS modifié (on l'enveloppe).
 *
 * Layout : le sommaire reste au-dessus du manuscrit pour ne jamais réserver une
 * colonne latérale ; le parchemin peut ainsi remplir toute la carte d'artefact.
 */

interface NarrativeReaderProps {
  markdown: string;
  kind: NarrativeArtifactKind;
}

export function NarrativeReader({ markdown, kind }: NarrativeReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <TocSidebar
        containerRef={contentRef}
        contentKey={markdown}
      />
      <div ref={contentRef} className="min-w-0">
        <ArtifactReadingAids markdown={markdown} />
        <NarrativeArtifact markdown={markdown} kind={kind} />
      </div>
    </div>
  );
}
