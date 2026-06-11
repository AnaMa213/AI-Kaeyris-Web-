/**
 * Save a text payload to a file from the browser: wrap it in a `Blob`, create a
 * temporary object URL, click a transient `<a download>`, then revoke the URL.
 *
 * Generic browser util (no domain imports). Used by the transcription Markdown
 * export (Story 4.14) and reusable by future per-artifact exports (Story 5.5).
 * Must run client-side only — `URL.createObjectURL`/`document` are unavailable on
 * the server.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/markdown",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
