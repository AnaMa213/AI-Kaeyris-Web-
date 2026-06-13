export interface ReadingAids {
  wordCount: number;
  readingMinutes: number;
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>+\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/^-{3,}\s*$/gm, " ");
}

export function computeReadingAids(markdown: string): ReadingAids {
  const words = stripMarkdown(markdown)
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  const wordCount = words.length;
  const readingMinutes =
    wordCount > 0 ? Math.max(1, Math.round(wordCount / 250)) : 0;

  return { wordCount, readingMinutes };
}
