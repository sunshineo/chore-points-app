import Dexie, { type EntityTable } from "dexie";
import type { DaySyncEvent } from "@/lib/day-kiosk";
import {
  applyDayEventToPayload,
  deriveDayPayload,
  normalizeDayPayload,
  type DayKioskPayload,
} from "@/lib/day-offline";

export type DaySnapshotRecord = {
  key: string;
  kidId: string;
  dateKey: string;
  payload: DayKioskPayload;
};

export type DayOutboxRecord = {
  id: string;
  kidId: string;
  order: number;
  event: DaySyncEvent;
};

class DayOfflineDatabase extends Dexie {
  daySnapshots!: EntityTable<DaySnapshotRecord, "key">;
  outbox!: EntityTable<DayOutboxRecord, "id">;

  constructor() {
    super("gemsteps-day");
    this.version(1).stores({
      daySnapshots: "&key,kidId,dateKey",
      outbox: "&id,kidId,order",
    });
  }
}

export const dayOfflineDb = new DayOfflineDatabase();

function snapshotKey(kidId: string, dateKey: string): string {
  return `${kidId}:${dateKey}`;
}

function snapshotRecord(kidId: string, payload: DayKioskPayload): DaySnapshotRecord {
  return {
    key: snapshotKey(kidId, payload.selectedDate),
    kidId,
    dateKey: payload.selectedDate,
    payload,
  };
}

async function pendingEventsForKid(kidId: string): Promise<DayOutboxRecord[]> {
  const records = await dayOfflineDb.outbox.where("kidId").equals(kidId).sortBy("order");
  return records.sort((left, right) => left.order - right.order);
}

export async function loadDaySnapshot(
  kidId: string,
  dateKey: string,
): Promise<DayKioskPayload | null> {
  const exact = await dayOfflineDb.daySnapshots.get(snapshotKey(kidId, dateKey));
  if (exact) return normalizeDayPayload(exact.payload);

  const snapshots = await dayOfflineDb.daySnapshots.where("kidId").equals(kidId).sortBy("dateKey");
  const latest = snapshots.at(-1);
  if (!latest) return null;

  const derived = deriveDayPayload(normalizeDayPayload(latest.payload), dateKey);
  await dayOfflineDb.daySnapshots.put(snapshotRecord(kidId, derived));
  return derived;
}

export async function storeRemoteDayPayload(
  kidId: string,
  payload: DayKioskPayload,
): Promise<DayKioskPayload> {
  return dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    let merged = normalizeDayPayload(payload);
    const pending = await pendingEventsForKid(kidId);
    for (const record of pending) {
      merged = applyDayEventToPayload(merged, record.event);
    }
    await dayOfflineDb.daySnapshots.put(snapshotRecord(kidId, merged));
    return merged;
  });
}

export async function enqueueDayEvent(
  kidId: string,
  event: DaySyncEvent,
): Promise<DayKioskPayload> {
  return dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    const snapshots = await dayOfflineDb.daySnapshots.where("kidId").equals(kidId).toArray();
    if (snapshots.length === 0) throw new Error("No local day snapshot is available");

    let selectedPayload: DayKioskPayload | null = null;
    const updated = snapshots.map((record) => {
      const payload = applyDayEventToPayload(normalizeDayPayload(record.payload), event);
      if (record.dateKey === event.dateKey) selectedPayload = payload;
      return snapshotRecord(kidId, payload);
    });

    if (!selectedPayload) {
      const latest = snapshots.sort((left, right) => left.dateKey.localeCompare(right.dateKey)).at(-1);
      if (!latest) throw new Error("No local day snapshot is available");
      selectedPayload = applyDayEventToPayload(
        deriveDayPayload(normalizeDayPayload(latest.payload), event.dateKey),
        event,
      );
      updated.push(snapshotRecord(kidId, selectedPayload));
    }

    await dayOfflineDb.daySnapshots.bulkPut(updated);
    const latestOutboxRecord = await dayOfflineDb.outbox.orderBy("order").last();
    await dayOfflineDb.outbox.add({
      id: event.id,
      kidId,
      order: (latestOutboxRecord?.order ?? 0) + 1,
      event,
    });

    return selectedPayload;
  });
}

export async function getOldestDayOutboxEvent(kidId: string): Promise<DayOutboxRecord | null> {
  return (await pendingEventsForKid(kidId))[0] ?? null;
}

export async function deleteDayOutboxEvent(id: string): Promise<void> {
  await dayOfflineDb.outbox.delete(id);
}

export async function rejectDayOutboxEvent(record: DayOutboxRecord): Promise<void> {
  await dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    const snapshots = await dayOfflineDb.daySnapshots.where("kidId").equals(record.kidId).toArray();
    await dayOfflineDb.daySnapshots.bulkPut(
      snapshots.map((snapshot) =>
        snapshotRecord(
          record.kidId,
          applyDayEventToPayload(normalizeDayPayload(snapshot.payload), record.event, -1),
        ),
      ),
    );
    await dayOfflineDb.outbox.delete(record.id);
  });
}

export async function countDayOutboxEvents(kidId: string): Promise<number> {
  return dayOfflineDb.outbox.where("kidId").equals(kidId).count();
}
