import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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
