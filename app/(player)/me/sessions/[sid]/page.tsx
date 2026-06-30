"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";

import { NarrativeArtifact } from "@/components/narrative/NarrativeArtifact";
import { ElementsView } from "@/components/jdr/sessions/ElementsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isPlayerArtifactAbsentError,
  useMyElements,
  useMyNarrative,
  useMyPov,
  useMySummary,
} from "@/lib/jdr/player/queries";

/**
 * Story 8.4 — read-only player view of one session: Résumé / Récit / Éléments /
 * Mon POV only. No write affordances, no transcription/audio tooling.
 */
function ArtifactSection<T>({
  query,
  absentLabel,
  render,
}: {
  query: UseQueryResult<T>;
  absentLabel: string;
  render: (data: T) => React.ReactNode;
}) {
  if (query.isPending) {
    return (
      <p className="text-text-chrome-muted text-sm">Chargement…</p>
    );
  }
  if (query.isError) {
    return isPlayerArtifactAbsentError(query.error) ? (
      <p className="text-text-chrome-muted text-sm italic">{absentLabel}</p>
    ) : (
      <p className="text-state-error text-sm">
        Impossible de charger. Réessaie plus tard.
      </p>
    );
  }
  return <>{render(query.data as T)}</>;
}

export default function MySessionReadPage() {
  const params = useParams<{ sid: string }>();
  const sessionId = params.sid ?? "";

  const summary = useMySummary(sessionId);
  const narrative = useMyNarrative(sessionId);
  const elements = useMyElements(sessionId);
  const pov = useMyPov(sessionId);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/me"
        className="text-text-chrome-muted hover:text-accent-gold inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Mes séances
      </Link>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="narrative">Récit</TabsTrigger>
          <TabsTrigger value="elements">Éléments</TabsTrigger>
          <TabsTrigger value="pov">Mon POV</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="pt-4">
          <ArtifactSection
            query={summary}
            absentLabel="Le résumé n'est pas encore disponible."
            render={(data) => (
              <NarrativeArtifact markdown={data.text} kind="summary" />
            )}
          />
        </TabsContent>

        <TabsContent value="narrative" className="pt-4">
          <ArtifactSection
            query={narrative}
            absentLabel="Le récit n'est pas encore disponible."
            render={(data) => (
              <NarrativeArtifact markdown={data.text} kind="narrative" />
            )}
          />
        </TabsContent>

        <TabsContent value="elements" className="pt-4">
          <ArtifactSection
            query={elements}
            absentLabel="Les éléments ne sont pas encore disponibles."
            render={(data) => <ElementsView elements={data.elements ?? []} />}
          />
        </TabsContent>

        <TabsContent value="pov" className="pt-4">
          <ArtifactSection
            query={pov}
            absentLabel="Ton POV n'est pas encore disponible."
            render={(data) => (
              <NarrativeArtifact markdown={data.text} kind="pov" />
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
