/**
 * Normalise a string for accent/case-insensitive substring search: strip
 * diacritics (NFD + combining-mark removal), lowercase, and trim. Unlike
 * `slugifySessionTitle`, spaces are preserved — substring matching on titles
 * needs word boundaries intact (e.g. "la cite" must still match "La Cité").
 *
 * Generic platform util (no domain imports). Shared by the Session Library
 * search and any future list filters.
 */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .trim();
}
