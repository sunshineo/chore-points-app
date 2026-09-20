import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPointEvent } from "@/lib/point-event";
import { applyPointEventToLedger, readPointsState } from "@/lib/server/point-ledger";
import {
  closeTestDatabase,
  testPool,
  testPrisma,
} from "@/__tests__/integration/test-database";

const now = new Date("2026-08-25T16:00:00.000Z");
const baselineMigration = new URL(
  "../../../prisma/migrations/00000000000000_baseline/migration.sql",
  import.meta.url,
);
const balanceMigration = new URL(
  "../../../prisma/migrations/20260825000000_add_point_balance/migration.sql",
  import.meta.url,
);

const rawTestDatabaseUrl = process.env.GEMSTEPS_TEST_DATABASE_URL;
if (!rawTestDatabaseUrl) throw new Error("GEMSTEPS_TEST_DATABASE_URL is required");

async function withMigratedSchema<T>(run: (schema: string) => Promise<T>): Promise<T> {
  const schema = `hardened_${randomUUID().replaceAll("-", "")}`;
  const client = await testPool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(await readFile(baselineMigration, "utf8"));
    await client.query(await readFile(balanceMigration, "utf8"));
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.query("SET search_path TO public");
    client.release();
  }

  try {
    return await run(schema);
  } finally {
    await testPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}

function createSchemaPool(schema: string, applicationName: string): pg.Pool {
  return new pg.Pool({
    connectionString: rawTestDatabaseUrl,
    application_name: applicationName,
    options: `-c search_path=${schema}`,
    max: 3,
  });
}

async function waitForDatabaseWait(applicationName: string, waitEvent: string | null): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const result = await testPool.query<{ wait_event: string | null }>(
      `SELECT wait_event FROM pg_stat_activity WHERE application_name = $1`,
      [applicationName],
    );
    if (result.rows.some((row) => waitEvent === null ? row.wait_event !== null : row.wait_event === waitEvent)) {
      return;
    }
    await delay(20);
  }
  throw new Error(`Timed out waiting for ${applicationName} to block`);
}

function errorCode(result: PromiseSettledResult<unknown>): string | undefined {
  if (result.status === "fulfilled") return undefined;
  const reason = result.reason as { code?: string; cause?: { code?: string } };
  return reason.code ?? reason.cause?.code;
}

beforeEach(async () => {
  await testPrisma.$executeRawUnsafe('TRUNCATE TABLE "PointEntry"');
  await testPrisma.pointBalance.update({
    where: { id: "singleton" },
    data: { totalNet: 0 },
  });
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("serialized point ledger", () => {
  it("runs trigger tests under PostgreSQL Read Committed", async () => {
    const result = await testPool.query<{ default_transaction_isolation: string }>(
      "SHOW default_transaction_isolation",
    );
    expect(result.rows[0]?.default_transaction_isolation).toBe("read committed");
  });

  it("backfills the actual migration from historical entries", async () => {
    const client = await testPool.connect();
    const schema = `migration_${randomUUID().replaceAll("-", "")}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(await readFile(baselineMigration, "utf8"));
      await client.query(`
        INSERT INTO "PointEntry"
          ("id", "type", "itemId", "points", "dateKey", "date")
        VALUES
          ('history-task', 'task', 'seed-task-face', 1, '2026-08-25', NOW()),
          ('history-adjustment', 'adjustment', 'manual-adjustment', 7, '2026-08-25', NOW()),
          ('history-reward', 'reward', 'reward-ice-stick', -5, '2026-08-25', NOW())
      `);
      await client.query(await readFile(balanceMigration, "utf8"));

      const result = await client.query<{ totalNet: number }>(
        'SELECT "totalNet" FROM "PointBalance" WHERE "id" = \'singleton\'',
      );
      expect(result.rows).toEqual([{ totalNet: 3 }]);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  });

  it("allows only one of two concurrent redemptions", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "adjustment", itemId: "manual-adjustment", points: 5 },
      { id: "seed-balance", now },
    ));

    const outcomes = await Promise.all([
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "reward", itemId: "reward-ice-stick", points: -5 },
        { id: "redeem-a", now },
      )),
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "reward", itemId: "reward-ice-stick", points: -5 },
        { id: "redeem-b", now },
      )),
    ]);

    expect(outcomes.sort()).toEqual(["applied", "rejected"]);
    expect(await testPrisma.pointBalance.findUnique({ where: { id: "singleton" } }))
      .toMatchObject({ totalNet: 0 });
  });

  it("allows only one of two concurrent task undos", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "task-credit", now },
    ));

    const outcomes = await Promise.all([
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "task", itemId: "seed-task-face", points: -1 },
        { id: "undo-a", now },
      )),
      applyPointEventToLedger(testPrisma, createPointEvent(
        { type: "task", itemId: "seed-task-face", points: -1 },
        { id: "undo-b", now },
      )),
    ]);

    expect(outcomes.sort()).toEqual(["applied", "rejected"]);
  });

  it("rejects a reward undo when no redemption exists", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "adjustment", itemId: "manual-adjustment", points: 5 },
      { id: "seed-balance", now },
    ));
    expect(await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "reward", itemId: "reward-ice-stick", points: 5 },
      { id: "invalid-reward-undo", now },
    ))).toBe("rejected");
  });

  it("protects invariants for an old-writer direct insert", async () => {
    await testPrisma.pointEntry.create({
      data: {
        id: "seed-adjustment",
        type: "adjustment",
        itemId: "manual-adjustment",
        points: 5,
        dateKey: "2026-08-25",
        date: now,
      },
    });
    await testPrisma.pointEntry.create({
      data: {
        id: "task-credit",
        type: "task",
        itemId: "seed-task-face",
        points: 1,
        dateKey: "2026-08-25",
        date: now,
      },
    });

    const outcomes = await Promise.allSettled(["old-undo-a", "old-undo-b"].map((id) =>
      testPrisma.pointEntry.create({
        data: {
          id,
          type: "task",
          itemId: "seed-task-face",
          points: -1,
          dateKey: "2026-08-25",
          date: now,
        },
      }),
    ));

    expect(outcomes.map((outcome) => outcome.status).sort())
      .toEqual(["fulfilled", "rejected"]);
    expect(await testPrisma.pointBalance.findUnique({ where: { id: "singleton" } }))
      .toMatchObject({ totalNet: 5 });
  });

  it("rejects direct updates and preserves the ledger and balance", async () => {
    await withMigratedSchema(async (schema) => {
      const pool = createSchemaPool(schema, `mutation-update-${schema.slice(-8)}`);
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
      try {
        await prisma.pointEntry.createMany({
          data: [
            {
              id: "seed-adjustment",
              type: "adjustment",
              itemId: "manual-adjustment",
              points: 10,
              dateKey: "2026-08-25",
              date: now,
            },
            {
              id: "reward-redemption",
              type: "reward",
              itemId: "reward-ice-stick",
              points: -5,
              dateKey: "2026-08-25",
              date: now,
            },
          ],
        });

        await expect(prisma.pointEntry.update({
          where: { id: "reward-redemption" },
          data: { points: 5 },
        })).rejects.toThrow();
        await expect(prisma.pointEntry.findUniqueOrThrow({
          where: { id: "reward-redemption" },
          select: { points: true },
        })).resolves.toEqual({ points: -5 });
        await expect(prisma.pointBalance.findUniqueOrThrow({
          where: { id: "singleton" },
          select: { totalNet: true },
        })).resolves.toEqual({ totalNet: 5 });
      } finally {
        await prisma.$disconnect();
        await pool.end();
      }
    });
  });

  it("rejects direct deletes and preserves the ledger and balance", async () => {
    await withMigratedSchema(async (schema) => {
      const pool = createSchemaPool(schema, `mutation-delete-${schema.slice(-8)}`);
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
      try {
        await prisma.pointEntry.create({
          data: {
            id: "seed-adjustment",
            type: "adjustment",
            itemId: "manual-adjustment",
            points: 5,
            dateKey: "2026-08-25",
            date: now,
          },
        });

        await expect(prisma.pointEntry.delete({
          where: { id: "seed-adjustment" },
        })).rejects.toThrow();
        await expect(prisma.pointEntry.count({
          where: { id: "seed-adjustment" },
        })).resolves.toBe(1);
        await expect(prisma.pointBalance.findUniqueOrThrow({
          where: { id: "singleton" },
          select: { totalNet: true },
        })).resolves.toEqual({ totalNet: 5 });
      } finally {
        await prisma.$disconnect();
        await pool.end();
      }
    });
  });

  it("serializes an old and new writer with the same event ID without deadlock", async () => {
    await withMigratedSchema(async (schema) => {
      const suffix = schema.slice(-8);
      const newApplicationName = `mixed-new-${suffix}`;
      const oldApplicationName = `mixed-old-${suffix}`;
      const barrierKey = Number.parseInt(suffix, 16) & 0x7fffffff;
      const newPool = createSchemaPool(schema, newApplicationName);
      const oldPool = createSchemaPool(schema, oldApplicationName);
      const newPrisma = new PrismaClient({ adapter: new PrismaPg(newPool, { schema }) });
      const controller = await testPool.connect();
      let barrierHeld = false;
      try {
        await oldPool.query(`
          CREATE FUNCTION "pause_new_writer"() RETURNS TRIGGER AS $$
          BEGIN
            IF current_setting('application_name') = '${newApplicationName}' THEN
              PERFORM pg_advisory_xact_lock(${barrierKey});
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql VOLATILE;

          CREATE TRIGGER "PointEntry_pause_new_writer"
          BEFORE INSERT ON "PointEntry"
          FOR EACH ROW EXECUTE FUNCTION "pause_new_writer"();
        `);
        await controller.query("SELECT pg_advisory_lock($1)", [barrierKey]);
        barrierHeld = true;

        await expect(newPrisma.$queryRaw<Array<{ app: string; schema: string }>>`
          SELECT current_setting('application_name') AS app, current_schema AS schema
        `).resolves.toEqual([{ app: newApplicationName, schema }]);

        const event = createPointEvent(
          { type: "adjustment", itemId: "manual-adjustment", points: 5 },
          { id: "mixed-version-event", now },
        );
        const newWrite = applyPointEventToLedger(newPrisma, event);
        const newWriterState = await Promise.race([
          waitForDatabaseWait(newApplicationName, "advisory")
            .then(() => ({ kind: "blocked" as const })),
          newWrite.then(
            (value) => ({ kind: "fulfilled" as const, value }),
            (reason: unknown) => ({ kind: "rejected" as const, reason }),
          ),
        ]);
        expect(newWriterState).toEqual({ kind: "blocked" });

        const oldWrite = oldPool.query(`
          INSERT INTO "PointEntry"
            ("id", "type", "itemId", "points", "dateKey", "date")
          VALUES
            ('mixed-version-event', 'adjustment', 'manual-adjustment', 5, '2026-08-25', NOW())
        `);
        await waitForDatabaseWait(oldApplicationName, null);

        await controller.query("SELECT pg_advisory_unlock($1)", [barrierKey]);
        barrierHeld = false;
        const [newResult, oldResult] = await Promise.allSettled([newWrite, oldWrite]);

        expect(newResult).toEqual({ status: "fulfilled", value: "applied" });
        expect(oldResult.status).toBe("rejected");
        expect(errorCode(oldResult)).toBe("23505");
        expect([errorCode(newResult), errorCode(oldResult)]).not.toContain("40P01");
        await expect(newPrisma.pointEntry.count({
          where: { id: event.id },
        })).resolves.toBe(1);
        await expect(newPrisma.pointBalance.findUniqueOrThrow({
          where: { id: "singleton" },
          select: { totalNet: true },
        })).resolves.toEqual({ totalNet: 5 });
      } finally {
        if (barrierHeld) {
          await controller.query("SELECT pg_advisory_unlock($1)", [barrierKey])
            .catch(() => undefined);
        }
        controller.release();
        await newPrisma.$disconnect();
        await Promise.all([newPool.end(), oldPool.end()]);
      }
    });
  });

  it("treats a repeated event ID as idempotent", async () => {
    const event = createPointEvent(
      { type: "adjustment", itemId: "manual-adjustment", points: 5 },
      { id: "same-event", now },
    );

    expect(await applyPointEventToLedger(testPrisma, event)).toBe("applied");
    expect(await applyPointEventToLedger(testPrisma, event)).toBe("duplicate");
    expect(await testPrisma.pointEntry.count({ where: { id: event.id } })).toBe(1);
    expect(await testPrisma.pointBalance.findUnique({ where: { id: "singleton" } }))
      .toMatchObject({ totalNet: 5 });
  });

  it("reads the projection and selected-day aggregates together", async () => {
    await applyPointEventToLedger(testPrisma, createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "task-1", now },
    ));

    const state = await readPointsState(testPrisma, "2026-08-25");

    expect(state).toMatchObject({ totalNet: 1, selectedDateNet: 1 });
    expect(state.tasks.find((task) => task.id === "seed-task-face"))
      .toMatchObject({ completedCount: 1 });
  });
});
