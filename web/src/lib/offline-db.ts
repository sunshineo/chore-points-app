import Dexie, { type EntityTable } from "dexie";
import type { PointEvent, PointsState } from "@/lib/points";
import { applyPointEvent, deriveStateForDate } from "@/lib/offline-state";

type SnapshotRecord = {
  key: string;
  state: PointsState;
};

export type OutboxRecord = {
  id: string;
  order: number;
  event: PointEvent;
};

class OfflineDatabase extends Dexie {
  snapshots!: EntityTable<SnapshotRecord, "key">;
  outbox!: EntityTable<OutboxRecord, "id">;

  constructor() {
    super("gemsteps");
    this.version(1).stores({
      snapshots: "&key",
      outbox: "&id,order",
    });
  }
}

export const offlineDb = new OfflineDatabase();

const CURRENT_SNAPSHOT_KEY = "current";

function snapshotRecord(state: PointsState): SnapshotRecord {
  return { key: CURRENT_SNAPSHOT_KEY, state };
}

async function pendingEvents(): Promise<OutboxRecord[]> {
  return offlineDb.outbox.orderBy("order").toArray();
}

export async function loadSnapshot(dateKey: string): Promise<PointsState | null> {
  return offlineDb.transaction("rw", offlineDb.snapshots, async () => {
    const current = await offlineDb.snapshots.get(CURRENT_SNAPSHOT_KEY);
    if (current) {
      const selected = current.state.selectedDate === dateKey
        ? current.state
        : deriveStateForDate(current.state, dateKey);
      await offlineDb.snapshots.clear();
      await offlineDb.snapshots.put(snapshotRecord(selected));
      return selected;
    }

    const legacy = (await offlineDb.snapshots.toArray())
      .filter((record) => record.key !== CURRENT_SNAPSHOT_KEY)
      .sort((left, right) => left.key.localeCompare(right.key))
      .at(-1);
    if (!legacy) return null;

    const migrated = legacy.state.selectedDate === dateKey
      ? legacy.state
      : deriveStateForDate(legacy.state, dateKey);
    await offlineDb.snapshots.clear();
    await offlineDb.snapshots.put(snapshotRecord(migrated));
    return migrated;
  });
}

export async function storeRemoteState(state: PointsState): Promise<PointsState> {
  return offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    let merged = state;
    for (const record of await pendingEvents()) {
      merged = applyPointEvent(merged, record.event);
    }
    await offlineDb.snapshots.clear();
    await offlineDb.snapshots.put(snapshotRecord(merged));
    return merged;
  });
}

export async function enqueuePointEvent(event: PointEvent): Promise<PointsState> {
  return offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    const current = await offlineDb.snapshots.get(CURRENT_SNAPSHOT_KEY);
    if (!current) throw new Error("No local snapshot is available");

    const base = current.state.selectedDate === event.dateKey
      ? current.state
      : deriveStateForDate(current.state, event.dateKey);
    const optimistic = applyPointEvent(base, event);
    await offlineDb.snapshots.put(snapshotRecord(optimistic));

    const latestOutboxRecord = await offlineDb.outbox.orderBy("order").last();
    await offlineDb.outbox.add({
      id: event.id,
      order: (latestOutboxRecord?.order ?? 0) + 1,
      event,
    });

    return optimistic;
  });
}

export async function getOldestOutboxEvent(): Promise<OutboxRecord | null> {
  return (await offlineDb.outbox.orderBy("order").first()) ?? null;
}

export async function deleteOutboxEvent(id: string): Promise<void> {
  await offlineDb.outbox.delete(id);
}

export async function rejectOutboxEvent(record: OutboxRecord): Promise<void> {
  await offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    const current = await offlineDb.snapshots.get(CURRENT_SNAPSHOT_KEY);
    if (current) {
      await offlineDb.snapshots.put(
        snapshotRecord(applyPointEvent(current.state, record.event, -1)),
      );
    }
    await offlineDb.outbox.delete(record.id);
  });
}
