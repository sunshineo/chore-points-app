import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointEvent, PointsState } from "@/lib/points";
import {
  enqueuePointEvent,
  loadSnapshot,
  offlineDb,
  storeRemoteState,
} from "@/lib/offline-db";
import { drainOutbox } from "@/lib/sync-controller";

function state(dateKey = "2026-08-20"): PointsState {
  return {
    totalNet: 10,
    selectedDate: dateKey,
    selectedDateNet: 10,
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

function taskEvent(id = "event-1"): PointEvent {
  return {
    id,
    type: "task",
    itemId: "seed-task-face",
    points: 1,
    dateKey: "2026-08-20",
    date: "2026-08-20T16:00:00.000Z",
  };
}

function adjustmentEvent(points: number, id = "adjustment-1"): PointEvent {
  return {
    id,
    type: "adjustment",
    itemId: "manual-adjustment",
    points,
    dateKey: "2026-08-20",
    date: "2026-08-20T16:00:00.000Z",
  };
}

beforeEach(async () => {
  await offlineDb.delete();
  await offlineDb.open();
});

afterAll(() => {
  offlineDb.close();
});

describe("offline database", () => {
  it("stores and reads a remote snapshot", async () => {
    await storeRemoteState(state());

    const stored = await loadSnapshot("2026-08-20");

    expect(stored?.selectedDate).toBe("2026-08-20");
    expect(stored?.totalNet).toBe(10);
  });

  it("atomically updates the snapshot and adds an outbox event", async () => {
    await storeRemoteState(state());

    const optimistic = await enqueuePointEvent(taskEvent());

    expect(optimistic.totalNet).toBe(11);
    expect(optimistic.tasks[0]).toMatchObject({ completedCount: 1 });
    expect(await offlineDb.outbox.count()).toBe(1);
  });

  it("applies manual adjustments without changing task or reward counts", async () => {
    await storeRemoteState(state());

    const added = await enqueuePointEvent(adjustmentEvent(4));
    const subtracted = await enqueuePointEvent(adjustmentEvent(-3, "adjustment-2"));

    expect(added).toMatchObject({ totalNet: 14, selectedDateNet: 14 });
    expect(subtracted).toMatchObject({
      totalNet: 11,
      selectedDateNet: 11,
      tasks: [{ completedCount: 0 }],
      rewards: [{ redeemedCount: 0 }],
    });
  });

  it("derives a new date from the latest cached snapshot", async () => {
    await storeRemoteState(state());

    const nextDate = await loadSnapshot("2026-08-21");

    expect(nextDate).toMatchObject({
      selectedDate: "2026-08-21",
      selectedDateNet: 0,
    });
    expect(nextDate?.tasks[0]).toMatchObject({ completedCount: 0 });
    expect(nextDate?.totalNet).toBe(10);
  });
});

describe("outbox sync", () => {
  it("removes an event only after the server accepts it", async () => {
    await storeRemoteState(state());
    await enqueuePointEvent(taskEvent());
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));

    const result = await drainOutbox({ fetchImpl });

    expect(result).toEqual({ completed: true, rejected: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/points",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await offlineDb.outbox.count()).toBe(0);
  });

  it("submits events in the same order they were written", async () => {
    await storeRemoteState(state());
    await enqueuePointEvent(taskEvent("event-1"));
    await enqueuePointEvent(taskEvent("event-2"));
    const submitted: string[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const event = JSON.parse(String(init?.body)) as PointEvent;
      submitted.push(event.id);
      return new Response(null, { status: 204 });
    });

    await drainOutbox({ fetchImpl });

    expect(submitted).toEqual(["event-1", "event-2"]);
  });

  it("keeps an event when the network request fails", async () => {
    await storeRemoteState(state());
    await enqueuePointEvent(taskEvent());
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });

    const result = await drainOutbox({ fetchImpl });

    expect(result).toEqual({ completed: false, rejected: 0 });
    expect(await offlineDb.outbox.count()).toBe(1);
    expect((await loadSnapshot("2026-08-20"))?.totalNet).toBe(11);
  });

  it("rolls back and removes an event rejected by the server", async () => {
    await storeRemoteState(state());
    await enqueuePointEvent(taskEvent());
    const fetchImpl = vi.fn(async () => new Response(null, { status: 409 }));

    const result = await drainOutbox({ fetchImpl });

    expect(result).toEqual({ completed: true, rejected: 1 });
    expect(await offlineDb.outbox.count()).toBe(0);
    expect(await loadSnapshot("2026-08-20")).toMatchObject({
      totalNet: 10,
      tasks: [{ completedCount: 0 }],
    });
  });
});
