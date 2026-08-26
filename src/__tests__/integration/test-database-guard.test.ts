import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const wrapperPath = fileURLToPath(
  new URL("../../../scripts/run-with-test-database.mjs", import.meta.url),
);
const runtimeGuardUrl = new URL("./test-database.ts", import.meta.url).href;
const safeAuthority = "postgresql://postgres@127.0.0.1:54329/safe_test";
const overrideCases = [
  ["host", `${safeAuthority}?host=example.com`],
  ["hostaddr", `${safeAuthority}?hostaddr=203.0.113.10`],
  ["database", `${safeAuthority}?database=production`],
  ["dbname", `${safeAuthority}?dbname=production`],
] as const;

function outputOf(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`;
}

describe("test database URL guards", () => {
  it.each(overrideCases)("wrapper rejects the %s override without logging its URL", (_, url) => {
    const result = spawnSync(
      process.execPath,
      [wrapperPath, process.execPath, "--input-type=module", "--eval", "process.exit(0)"],
      {
        env: { ...process.env, GEMSTEPS_TEST_DATABASE_URL: url },
        encoding: "utf8",
      },
    );
    const output = outputOf(result);

    expect(result.status).not.toBe(0);
    expect(output).toContain("Refusing to use a non-local or non-test database");
    expect(output).not.toContain("postgresql://");
  });

  it.each(overrideCases)("runtime guard rejects the %s override without logging its URL", (_, url) => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(runtimeGuardUrl)})`,
      ],
      {
        env: { ...process.env, GEMSTEPS_TEST_DATABASE_URL: url },
        encoding: "utf8",
      },
    );
    const output = outputOf(result);

    expect(result.status).not.toBe(0);
    expect(output).toContain("Integration tests require a local *_test database");
    expect(output).not.toContain("postgresql://");
  });
});
