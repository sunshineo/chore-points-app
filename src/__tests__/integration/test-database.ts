import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const rawUrl = process.env.GEMSTEPS_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("GEMSTEPS_TEST_DATABASE_URL is required");

let parsed: URL;
try {
  parsed = new URL(rawUrl);
} catch {
  throw new Error("GEMSTEPS_TEST_DATABASE_URL must be a valid URL");
}
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
if (
  !["postgres:", "postgresql:"].includes(parsed.protocol) ||
  !new Set(["localhost", "127.0.0.1", "[::1]"]).has(parsed.hostname) ||
  !databaseName.endsWith("_test")
) {
  throw new Error("Integration tests require a local *_test database");
}

export const testPool = new pg.Pool({ connectionString: rawUrl, max: 5 });
export const testPrisma = new PrismaClient({ adapter: new PrismaPg(testPool) });

export async function closeTestDatabase(): Promise<void> {
  await testPrisma.$disconnect();
  await testPool.end();
}
