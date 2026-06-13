import { computeReadingAids } from "@/lib/markdown/readingAids";

interface ArtifactReadingAidsProps {
  markdown: string;
}

export function ArtifactReadingAids({ markdown }: ArtifactReadingAidsProps) {
  const { wordCount, readingMinutes } = computeReadingAids(markdown ?? "");

  if (wordCount === 0) {
    return null;
  }

  return (
    <p className="text-text-chrome-muted mb-3 text-sm">
      ~{wordCount} mots · ≈ {readingMinutes} min de lecture
    </p>
  );
}
