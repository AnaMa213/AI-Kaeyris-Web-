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

const workDir = mkdtempSync(join(tmpdir(), "api-types-drift-"));
const tmpOut = join(workDir, "api.ts");

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
      `   Run \`npm run gen:api\` and commit the result.\n`,
  );
  process.exit(1);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
