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
  dateKey: string;
  payload: DayKioskPayload;
};

export type DayOutboxRecord = {
  id: string;
  order: number;
  event: DaySyncEvent;
};

type LegacyDaySnapshotRecord = DaySnapshotRecord & { kidId?: string };
type LegacyDayOutboxRecord = DayOutboxRecord & { kidId?: string };

class DayOfflineDatabase extends Dexie {
  daySnapshots!: EntityTable<DaySnapshotRecord, "key">;
  outbox!: EntityTable<DayOutboxRecord, "id">;

  constructor() {
    super("gemsteps-day");
    this.version(1).stores({
      daySnapshots: "&key,kidId,dateKey",
      outbox: "&id,kidId,order",
    });
    this.version(2)
      .stores({
        daySnapshots: "&key,dateKey",
        outbox: "&id,order",
      })
      .upgrade(async (transaction) => {
        const snapshotTable = transaction.table<LegacyDaySnapshotRecord, string>("daySnapshots");
        const outboxTable = transaction.table<LegacyDayOutboxRecord, string>("outbox");
        const legacySnapshots = await snapshotTable.toArray();
        const legacyOutbox = await outboxTable.toArray();

        const snapshotsByDate = new Map<string, DaySnapshotRecord>();
        for (const record of legacySnapshots) {
          snapshotsByDate.set(record.dateKey, {
            key: record.dateKey,
            dateKey: record.dateKey,
            payload: record.payload,
          });
        }

        await snapshotTable.clear();
        await outboxTable.clear();
        await snapshotTable.bulkPut([...snapshotsByDate.values()]);
        await outboxTable.bulkPut(
          legacyOutbox.map(({ id, order, event }) => ({ id, order, event })),
        );
      });
  }
}

export const dayOfflineDb = new DayOfflineDatabase();

function snapshotRecord(payload: DayKioskPayload): DaySnapshotRecord {
  return {
    key: payload.selectedDate,
    dateKey: payload.selectedDate,
    payload,
  };
}

async function pendingEvents(): Promise<DayOutboxRecord[]> {
  return dayOfflineDb.outbox.orderBy("order").toArray();
}

export async function loadDaySnapshot(dateKey: string): Promise<DayKioskPayload | null> {
  const exact = await dayOfflineDb.daySnapshots.get(dateKey);
  if (exact) return normalizeDayPayload(exact.payload);

  const snapshots = await dayOfflineDb.daySnapshots.orderBy("dateKey").toArray();
  const latest = snapshots.at(-1);
  if (!latest) return null;

  const derived = deriveDayPayload(normalizeDayPayload(latest.payload), dateKey);
  await dayOfflineDb.daySnapshots.put(snapshotRecord(derived));
  return derived;
}

export async function storeRemoteDayPayload(payload: DayKioskPayload): Promise<DayKioskPayload> {
  return dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    let merged = normalizeDayPayload(payload);
    const pending = await pendingEvents();
    for (const record of pending) {
      merged = applyDayEventToPayload(merged, record.event);
    }
    await dayOfflineDb.daySnapshots.put(snapshotRecord(merged));
    return merged;
  });
}

export async function enqueueDayEvent(event: DaySyncEvent): Promise<DayKioskPayload> {
  return dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    const snapshots = await dayOfflineDb.daySnapshots.toArray();
    if (snapshots.length === 0) throw new Error("No local day snapshot is available");

    let selectedPayload: DayKioskPayload | null = null;
    const updated = snapshots.map((record) => {
      const payload = applyDayEventToPayload(normalizeDayPayload(record.payload), event);
      if (record.dateKey === event.dateKey) selectedPayload = payload;
      return snapshotRecord(payload);
    });

    if (!selectedPayload) {
      const latest = snapshots.sort((left, right) => left.dateKey.localeCompare(right.dateKey)).at(-1);
      if (!latest) throw new Error("No local day snapshot is available");
      selectedPayload = applyDayEventToPayload(
        deriveDayPayload(normalizeDayPayload(latest.payload), event.dateKey),
        event,
      );
      updated.push(snapshotRecord(selectedPayload));
    }

    await dayOfflineDb.daySnapshots.bulkPut(updated);
    const latestOutboxRecord = await dayOfflineDb.outbox.orderBy("order").last();
    await dayOfflineDb.outbox.add({
      id: event.id,
      order: (latestOutboxRecord?.order ?? 0) + 1,
      event,
    });

    return selectedPayload;
  });
}

export async function getOldestDayOutboxEvent(): Promise<DayOutboxRecord | null> {
  return (await dayOfflineDb.outbox.orderBy("order").first()) ?? null;
}

export async function deleteDayOutboxEvent(id: string): Promise<void> {
  await dayOfflineDb.outbox.delete(id);
}

export async function rejectDayOutboxEvent(record: DayOutboxRecord): Promise<void> {
  await dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    const snapshots = await dayOfflineDb.daySnapshots.toArray();
    await dayOfflineDb.daySnapshots.bulkPut(
      snapshots.map((snapshot) =>
        snapshotRecord(
          applyDayEventToPayload(normalizeDayPayload(snapshot.payload), record.event, -1),
        ),
      ),
    );
    await dayOfflineDb.outbox.delete(record.id);
  });
}

export async function countDayOutboxEvents(): Promise<number> {
  return dayOfflineDb.outbox.count();
}
