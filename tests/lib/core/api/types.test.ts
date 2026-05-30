import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");
const SPEC = join(REPO_ROOT, "docs/context/api/openapi.json");
const COMMITTED = join(REPO_ROOT, "types/api.ts");

const workDir = mkdtempSync(join(tmpdir(), "api-types-drift-test-"));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("api types drift", () => {
  test("generated types match committed types/api.ts byte-for-byte", () => {
    const tmpOut = join(workDir, "api.ts");

    execFileSync(
      process.execPath,
      [
        join(REPO_ROOT, "node_modules/openapi-typescript/bin/cli.js"),
        SPEC,
        "--output",
        tmpOut,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );

    const fresh = readFileSync(tmpOut);
    const committed = readFileSync(COMMITTED);

    expect(Buffer.compare(fresh, committed)).toBe(0);
  }, 15_000);
});
