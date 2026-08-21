import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayApiPayload, DaySyncEvent } from "@/lib/day-kiosk";
import {
  countDayOutboxEvents,
  dayOfflineDb,
  enqueueDayEvent,
  loadDaySnapshot,
  storeRemoteDayPayload,
} from "@/lib/day-offline-db";
import { drainDayOutbox } from "@/lib/day-sync-controller";

function payload(dateKey = "2026-08-20"): DayApiPayload {
  return {
    earliestDate: "2026-08-01",
    totals: { totalEarned: 10, totalSpent: 0, totalNet: 10 },
    selectedDate: dateKey,
    selectedDay: { earned: 10, spent: 0, net: 10 },
    tasks: [
      {
        id: "seed-task-face",
        title: "洗脸",
        emoji: "🚿",
        defaultPoints: 1,
        completed: false,
        completedCount: 0,
      },
    ],
    rewards: [
      {
        id: "reward-ice-stick",
        title: "冰棍或棒棒糖",
        description: "冰棍或棒棒糖",
        emoji: "🍭",
        cost: 5,
        stock: null,
        redeemedCount: 0,
      },
    ],
  };
}

function taskEvent(id = "event-1"): DaySyncEvent {
  return {
    id,
    type: "task",
    itemId: "seed-task-face",
    points: 1,
    dateKey: "2026-08-20",
    date: "2026-08-20T16:00:00.000Z",
    note: "完成任务：洗脸",
  };
}

beforeEach(async () => {
  await dayOfflineDb.delete();
  await dayOfflineDb.open();
});

afterAll(() => {
  dayOfflineDb.close();
});

describe("day offline database", () => {
  it("upgrades the old child-keyed cache without losing queued work", async () => {
    await dayOfflineDb.delete();
    const legacyDb = new Dexie("gemsteps-day");
    legacyDb.version(1).stores({
      daySnapshots: "&key,kidId,dateKey",
      outbox: "&id,kidId,order",
    });
    await legacyDb.open();
    await legacyDb.table("daySnapshots").put({
      key: "kid-1:2026-08-20",
      kidId: "kid-1",
      dateKey: "2026-08-20",
      payload: payload(),
    });
    await legacyDb.table("outbox").put({
      id: "event-1",
      kidId: "kid-1",
      order: 1,
      event: taskEvent(),
    });
    legacyDb.close();

    await dayOfflineDb.open();

    expect((await loadDaySnapshot("2026-08-20"))?.totals.totalNet).toBe(10);
    expect(await countDayOutboxEvents()).toBe(1);
    expect(await dayOfflineDb.daySnapshots.toArray()).toEqual([
      expect.objectContaining({ key: "2026-08-20", dateKey: "2026-08-20" }),
    ]);
    expect(await dayOfflineDb.outbox.toArray()).toEqual([
      expect.not.objectContaining({ kidId: expect.anything() }),
    ]);
  });

  it("stores and reads a remote snapshot", async () => {
    await storeRemoteDayPayload(payload());

    const stored = await loadDaySnapshot("2026-08-20");

    expect(stored?.selectedDate).toBe("2026-08-20");
    expect(stored?.totals.totalNet).toBe(10);
  });

  it("atomically updates the snapshot and adds an outbox event", async () => {
    await storeRemoteDayPayload(payload());

    const optimistic = await enqueueDayEvent(taskEvent());

    expect(optimistic.totals.totalNet).toBe(11);
    expect(optimistic.tasks[0]).toMatchObject({ completed: true, completedCount: 1 });
    expect(await countDayOutboxEvents()).toBe(1);
  });

  it("derives a new day from the latest cached snapshot", async () => {
    await storeRemoteDayPayload(payload());

    const nextDay = await loadDaySnapshot("2026-08-21");

    expect(nextDay).toMatchObject({
      selectedDate: "2026-08-21",
      selectedDay: { earned: 0, spent: 0, net: 0 },
    });
    expect(nextDay?.tasks[0]).toMatchObject({ completed: false, completedCount: 0 });
    expect(nextDay?.totals.totalNet).toBe(10);
  });
});

describe("day outbox sync", () => {
  it("removes an event only after the server accepts it", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent());
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ applied: 1, totalNet: 11, failed: [], failedEvents: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await drainDayOutbox({ token: "token", fetchImpl });

    expect(result).toEqual({ completed: true, rejected: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/day/sync?token=token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await countDayOutboxEvents()).toBe(0);
  });

  it("submits events in the same order they were written", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent("event-1"));
    await enqueueDayEvent(taskEvent("event-2"));
    const submitted: string[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { events: DaySyncEvent[] };
      submitted.push(body.events[0].id);
      return new Response(JSON.stringify({ applied: 1, totalNet: 12, failed: [], failedEvents: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await drainDayOutbox({ token: "token", fetchImpl });

    expect(submitted).toEqual(["event-1", "event-2"]);
  });

  it("keeps an event when the network request fails", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent());
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });

    const result = await drainDayOutbox({ token: "token", fetchImpl });

    expect(result).toEqual({ completed: false, rejected: 0 });
    expect(await countDayOutboxEvents()).toBe(1);
    expect((await loadDaySnapshot("2026-08-20"))?.totals.totalNet).toBe(11);
  });

  it("rolls back and removes an event rejected by the server", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent());
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ totalNet: 10, failed: ["event-1"], failedEvents: ["event-1"] }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await drainDayOutbox({ token: "token", fetchImpl });

    expect(result).toEqual({ completed: true, rejected: 1 });
    expect(await countDayOutboxEvents()).toBe(0);
    expect(await loadDaySnapshot("2026-08-20")).toMatchObject({
      totals: { totalNet: 10 },
      tasks: [{ completed: false, completedCount: 0 }],
    });
  });
});
