import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayApiPayload, DaySyncEvent } from "@/lib/day-kiosk";
import {
  dayOfflineDb,
  enqueueDayEvent,
  loadDaySnapshot,
  storeRemoteDayPayload,
} from "@/lib/day-offline-db";
import { drainDayOutbox } from "@/lib/day-sync-controller";

function payload(dateKey = "2026-08-20"): DayApiPayload {
  return {
    totalNet: 10,
    selectedDate: dateKey,
    selectedDayNet: 10,
    tasks: [
      {
        id: "seed-task-face",
        title: "洗脸",
        emoji: "🚿",
        defaultPoints: 1,
        completedCount: 0,
      },
    ],
    rewards: [
      {
        id: "reward-ice-stick",
        title: "冰棍或棒棒糖",
        emoji: "🍭",
        cost: 5,
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
  it("stores and reads a remote snapshot", async () => {
    await storeRemoteDayPayload(payload());

    const stored = await loadDaySnapshot("2026-08-20");

    expect(stored?.selectedDate).toBe("2026-08-20");
    expect(stored?.totalNet).toBe(10);
  });

  it("atomically updates the snapshot and adds an outbox event", async () => {
    await storeRemoteDayPayload(payload());

    const optimistic = await enqueueDayEvent(taskEvent());

    expect(optimistic.totalNet).toBe(11);
    expect(optimistic.tasks[0]).toMatchObject({ completedCount: 1 });
    expect(await dayOfflineDb.outbox.count()).toBe(1);
  });

  it("derives a new day from the latest cached snapshot", async () => {
    await storeRemoteDayPayload(payload());

    const nextDay = await loadDaySnapshot("2026-08-21");

    expect(nextDay).toMatchObject({
      selectedDate: "2026-08-21",
      selectedDayNet: 0,
    });
    expect(nextDay?.tasks[0]).toMatchObject({ completedCount: 0 });
    expect(nextDay?.totalNet).toBe(10);
  });
});

describe("day outbox sync", () => {
  it("removes an event only after the server accepts it", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent());
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));

    const result = await drainDayOutbox({ fetchImpl });

    expect(result).toEqual({ completed: true, rejected: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/day/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await dayOfflineDb.outbox.count()).toBe(0);
  });

  it("submits events in the same order they were written", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent("event-1"));
    await enqueueDayEvent(taskEvent("event-2"));
    const submitted: string[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const event = JSON.parse(String(init?.body)) as DaySyncEvent;
      submitted.push(event.id);
      return new Response(null, { status: 204 });
    });

    await drainDayOutbox({ fetchImpl });

    expect(submitted).toEqual(["event-1", "event-2"]);
  });

  it("keeps an event when the network request fails", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent());
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });

    const result = await drainDayOutbox({ fetchImpl });

    expect(result).toEqual({ completed: false, rejected: 0 });
    expect(await dayOfflineDb.outbox.count()).toBe(1);
    expect((await loadDaySnapshot("2026-08-20"))?.totalNet).toBe(11);
  });

  it("rolls back and removes an event rejected by the server", async () => {
    await storeRemoteDayPayload(payload());
    await enqueueDayEvent(taskEvent());
    const fetchImpl = vi.fn(async () => new Response(null, { status: 409 }));

    const result = await drainDayOutbox({ fetchImpl });

    expect(result).toEqual({ completed: true, rejected: 1 });
    expect(await dayOfflineDb.outbox.count()).toBe(0);
    expect(await loadDaySnapshot("2026-08-20")).toMatchObject({
      totalNet: 10,
      tasks: [{ completedCount: 0 }],
    });
  });
});
