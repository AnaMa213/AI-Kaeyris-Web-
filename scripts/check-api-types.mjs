#!/usr/bin/env node
/**
 * check-api-types — drift detection for types/api.ts vs docs/context/api/openapi.json.
 *
 * Regenerates the types into a temp file using openapi-typescript and
 * compares byte-for-byte with the committed types/api.ts. Exits 0 on
 * match, 1 on drift. Used locally and by CI (Story 6.2).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const COMMITTED = "types/api.ts";
const SPEC = "docs/context/api/openapi.json";
const DIFF_CONTEXT_LINES = 3;

const workDir = mkdtempSync(join(tmpdir(), "api-types-drift-"));
const tmpOut = join(workDir, "api.ts");

function firstDifferingLine(left, right) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }

  return -1;
}

function formatDiffLine(prefix, lineNumber, line) {
  return `${prefix} ${String(lineNumber).padStart(5, " ")} | ${line ?? ""}`;
}

function formatFirstDiff(committedText, freshText) {
  const committedLines = committedText.split(/\r?\n/);
  const freshLines = freshText.split(/\r?\n/);
  const diffLine = firstDifferingLine(committedLines, freshLines);

  if (diffLine === -1) {
    return "Files differ at byte level only (for example line endings).\n";
  }

  const start = Math.max(0, diffLine - DIFF_CONTEXT_LINES);
  const end = Math.min(
    Math.max(committedLines.length, freshLines.length),
    diffLine + DIFF_CONTEXT_LINES + 1,
  );
  const lines = [
    `First differing generated line: ${diffLine + 1}`,
    "--- committed types/api.ts",
    "+++ regenerated from openapi.json",
  ];

  for (let index = start; index < end; index += 1) {
    if (committedLines[index] === freshLines[index]) {
      lines.push(formatDiffLine(" ", index + 1, committedLines[index]));
      continue;
    }

    lines.push(formatDiffLine("-", index + 1, committedLines[index]));
    lines.push(formatDiffLine("+", index + 1, freshLines[index]));
  }

  return `${lines.join("\n")}\n`;
}

try {
  execFileSync(
    process.execPath,
    [
      "node_modules/openapi-typescript/bin/cli.js",
      SPEC,
      "--output",
      tmpOut,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  const fresh = readFileSync(tmpOut);
  const committed = readFileSync(COMMITTED);

  if (Buffer.compare(fresh, committed) === 0) {
    process.stdout.write(`✅ API types are up to date (${COMMITTED}).\n`);
    process.exit(0);
  }

  process.stderr.write(
    `❌ ${COMMITTED} is out of sync with ${SPEC}.\n` +
      formatFirstDiff(committed.toString("utf8"), fresh.toString("utf8")) +
      `   Run \`npm run gen:api\` and commit the result.\n`,
  );
  process.exit(1);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
