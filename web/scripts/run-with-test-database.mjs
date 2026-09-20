import { spawn } from "node:child_process";

const rawUrl = process.env.GEMSTEPS_TEST_DATABASE_URL;
if (!rawUrl) {
  throw new Error("GEMSTEPS_TEST_DATABASE_URL is required");
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  throw new Error("GEMSTEPS_TEST_DATABASE_URL must be a valid URL");
}
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const connectionOverrideParams = ["host", "hostaddr", "database", "dbname"];
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !allowedHosts.has(parsed.hostname) ||
  !databaseName.endsWith("_test") ||
  connectionOverrideParams.some((name) => parsed.searchParams.has(name))
) {
  throw new Error("Refusing to use a non-local or non-test database");
}

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required");

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl },
});
child.on("error", (error) => {
  console.error(error.name);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
