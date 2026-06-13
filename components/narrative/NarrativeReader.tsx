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
 * Layout (AC8) : sur `xl+` la TOC est un rail sticky à droite de l'article
 * `max-w-[68ch]` ; sous `xl` elle passe au-dessus du bloc (disclosure repliable).
 * La TOC est posée en premier dans l'ordre source → au-dessus sur petit écran, et
 * replacée en colonne 2 par la grille sur grand écran.
 */

interface NarrativeReaderProps {
  markdown: string;
  kind: NarrativeArtifactKind;
}

export function NarrativeReader({ markdown, kind }: NarrativeReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="xl:grid xl:grid-cols-[1fr_minmax(0,13rem)] xl:gap-8">
      <TocSidebar
        containerRef={contentRef}
        contentKey={markdown}
        className="mb-4 xl:col-start-2 xl:row-start-1 xl:mb-0"
      />
      <div ref={contentRef} className="xl:col-start-1 xl:row-start-1">
        <ArtifactReadingAids markdown={markdown} />
        <NarrativeArtifact markdown={markdown} kind={kind} />
      </div>
    </div>
  );
}
