/**
 * Slugify a session title into a filesystem-friendly token: strip diacritics
 * (NFD + combining-mark removal), lowercase, collapse every run of
 * non-alphanumerics into a single dash, and trim leading/trailing dashes.
 *
 * Generic platform util (no domain imports). Shared by the transcription
 * export (`transcriptionFileName`) and the per-artifact Markdown export
 * (`artifactMarkdownFileName`) so both stay in sync on slugging rules. Returns
 * an empty string when the title has no usable characters — callers decide the
 * fallback filename.
 */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugifySessionTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
