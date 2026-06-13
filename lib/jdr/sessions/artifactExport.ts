"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { createApiClient } from "@/lib/core/api/client";
import { ApiError } from "@/lib/core/api/errors";
import { slugifySessionTitle } from "@/lib/core/strings/slugify";

/**
 * Story 5.5 — kinds exportable en Markdown depuis les panneaux d'artefacts.
 * POV est exclu : son endpoint `.md` exige un `pj_id` (sélecteur par PJ = Story
 * 5.7), absent des surfaces actuelles.
 */
export type ArtifactExportKind = "summary" | "narrative" | "elements";

/**
 * Status-preserving unwrap (mirror lib/jdr/sessions/transcription.ts /
 * artifacts.ts). The error middleware throws an `ApiError` (status intact) on
 * >=400 before we reach here; this branch is the defensive fallback for a
 * returned (non-thrown) error and keeps the real HTTP status.
 */
function problemFromUnknown(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (typeof error === "object" && error !== null && !Array.isArray(error)) {
    const maybe = error as { status?: unknown; title?: unknown; type?: unknown };
    if (typeof maybe.status === "number") {
      throw new ApiError({
        ...(error as Record<string, unknown>),
        type: typeof maybe.type === "string" ? maybe.type : "about:blank",
        title: typeof maybe.title === "string" ? maybe.title : "Request failed",
        status: maybe.status,
      });
    }
  }
  throw new ApiError({ type: "about:blank", title: "Request failed", status: 0 });
}

function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) {
    problemFromUnknown(result.error);
  }
  return result.data as T;
}

/**
 * Story 5.5 — nom de fichier d'export d'un artefact : `session-{slug}-{kind}.md`
 * (slug du titre via `slugifySessionTitle`). Retombe sur `session-{kind}.md`
 * quand le titre n'a aucun caractère exploitable. Slug partagé avec
 * `transcriptionFileName` pour des règles cohérentes.
 */
export function artifactMarkdownFileName(
  sessionTitle: string,
  kind: ArtifactExportKind,
): string {
  const slug = slugifySessionTitle(sessionTitle);
  return slug ? `session-${slug}-${kind}.md` : `session-${kind}.md`;
}

/**
 * Story 5.5 — export impératif d'un artefact en Markdown
 * (`GET /artifacts/{kind}.md`, text/markdown). On fetch TOUJOURS le `.md`
 * canonique (et non le `.text` déjà affiché) : `elements` n'a aucun champ texte,
 * et le `.md` backend reste la source de vérité. Le corps 200 est typé
 * `content?: never` dans le contrat (FastAPI omet le schéma text/markdown), d'où
 * `parseAs:"text"` + `unwrap<string>` — même contrainte que
 * `useDownloadTranscriptionMarkdown`. Impératif (déclenché au clic) → mutation ;
 * le caller possède l'effet de sauvegarde du fichier.
 */
export function useDownloadArtifactMarkdown(
  sessionId: string,
  kind: ArtifactExportKind,
) {
  const apiClient = useMemo(() => createApiClient(), []);
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const params = { path: { session_id: sessionId } } as const;
      if (kind === "summary") {
        return unwrap<string>(
          await apiClient.GET(
            "/services/jdr/sessions/{session_id}/artifacts/summary.md",
            { params, parseAs: "text" },
          ),
        );
      }
      if (kind === "narrative") {
        return unwrap<string>(
          await apiClient.GET(
            "/services/jdr/sessions/{session_id}/artifacts/narrative.md",
            { params, parseAs: "text" },
          ),
        );
      }
      return unwrap<string>(
        await apiClient.GET(
          "/services/jdr/sessions/{session_id}/artifacts/elements.md",
          { params, parseAs: "text" },
        ),
      );
    },
  });
}
