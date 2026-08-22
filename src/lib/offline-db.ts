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

function snapshotRecord(state: PointsState): SnapshotRecord {
  return { key: state.selectedDate, state };
}

async function pendingEvents(): Promise<OutboxRecord[]> {
  return offlineDb.outbox.orderBy("order").toArray();
}

export async function loadSnapshot(dateKey: string): Promise<PointsState | null> {
  const exact = await offlineDb.snapshots.get(dateKey);
  if (exact) return exact.state;

  const snapshots = await offlineDb.snapshots.toArray();
  const latest = snapshots.sort((left, right) => left.key.localeCompare(right.key)).at(-1);
  if (!latest) return null;

  const derived = deriveStateForDate(latest.state, dateKey);
  await offlineDb.snapshots.put(snapshotRecord(derived));
  return derived;
}

export async function storeRemoteState(state: PointsState): Promise<PointsState> {
  return offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    let merged = state;
    for (const record of await pendingEvents()) {
      merged = applyPointEvent(merged, record.event);
    }
    await offlineDb.snapshots.put(snapshotRecord(merged));
    return merged;
  });
}

export async function enqueuePointEvent(event: PointEvent): Promise<PointsState> {
  return offlineDb.transaction("rw", offlineDb.snapshots, offlineDb.outbox, async () => {
    const snapshots = await offlineDb.snapshots.toArray();
    if (snapshots.length === 0) throw new Error("No local snapshot is available");

    let selectedState: PointsState | null = null;
    const updated = snapshots.map((record) => {
      const state = applyPointEvent(record.state, event);
      if (record.key === event.dateKey) selectedState = state;
      return snapshotRecord(state);
    });

    if (!selectedState) {
      const latest = snapshots.sort((left, right) => left.key.localeCompare(right.key)).at(-1);
      if (!latest) throw new Error("No local snapshot is available");
      selectedState = applyPointEvent(
        deriveStateForDate(latest.state, event.dateKey),
        event,
      );
      updated.push(snapshotRecord(selectedState));
    }

    await offlineDb.snapshots.bulkPut(updated);
    const latestOutboxRecord = await offlineDb.outbox.orderBy("order").last();
    await offlineDb.outbox.add({
      id: event.id,
      order: (latestOutboxRecord?.order ?? 0) + 1,
      event,
    });

    return selectedState;
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
    const snapshots = await offlineDb.snapshots.toArray();
    await offlineDb.snapshots.bulkPut(
      snapshots.map((snapshot) =>
        snapshotRecord(applyPointEvent(snapshot.state, record.event, -1)),
      ),
    );
    await offlineDb.outbox.delete(record.id);
  });
}
