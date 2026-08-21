import Dexie, { type EntityTable } from "dexie";
import type { DayApiPayload, DaySyncEvent } from "@/lib/day-kiosk";
import { applyDayEventToPayload, deriveDayPayload } from "@/lib/day-offline";

type DaySnapshotRecord = {
  key: string;
  payload: DayApiPayload;
};

export type DayOutboxRecord = {
  id: string;
  order: number;
  event: DaySyncEvent;
};

class DayOfflineDatabase extends Dexie {
  daySnapshots!: EntityTable<DaySnapshotRecord, "key">;
  outbox!: EntityTable<DayOutboxRecord, "id">;

  constructor() {
    super("gemsteps-day");
    this.version(3)
      .stores({
        daySnapshots: "&key",
        outbox: "&id,order",
      })
      .upgrade((transaction) => transaction.table("daySnapshots").clear());
  }
}

export const dayOfflineDb = new DayOfflineDatabase();

function snapshotRecord(payload: DayApiPayload): DaySnapshotRecord {
  return { key: payload.selectedDate, payload };
}

async function pendingEvents(): Promise<DayOutboxRecord[]> {
  return dayOfflineDb.outbox.orderBy("order").toArray();
}

export async function loadDaySnapshot(dateKey: string): Promise<DayApiPayload | null> {
  const exact = await dayOfflineDb.daySnapshots.get(dateKey);
  if (exact) return exact.payload;

  const snapshots = await dayOfflineDb.daySnapshots.toArray();
  const latest = snapshots.sort((left, right) => left.key.localeCompare(right.key)).at(-1);
  if (!latest) return null;

  const derived = deriveDayPayload(latest.payload, dateKey);
  await dayOfflineDb.daySnapshots.put(snapshotRecord(derived));
  return derived;
}

export async function storeRemoteDayPayload(payload: DayApiPayload): Promise<DayApiPayload> {
  return dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    let merged = payload;
    for (const record of await pendingEvents()) {
      merged = applyDayEventToPayload(merged, record.event);
    }
    await dayOfflineDb.daySnapshots.put(snapshotRecord(merged));
    return merged;
  });
}

export async function enqueueDayEvent(event: DaySyncEvent): Promise<DayApiPayload> {
  return dayOfflineDb.transaction("rw", dayOfflineDb.daySnapshots, dayOfflineDb.outbox, async () => {
    const snapshots = await dayOfflineDb.daySnapshots.toArray();
    if (snapshots.length === 0) throw new Error("No local day snapshot is available");

    let selectedPayload: DayApiPayload | null = null;
    const updated = snapshots.map((record) => {
      const payload = applyDayEventToPayload(record.payload, event);
      if (record.key === event.dateKey) selectedPayload = payload;
      return snapshotRecord(payload);
    });

    if (!selectedPayload) {
      const latest = snapshots.sort((left, right) => left.key.localeCompare(right.key)).at(-1);
      if (!latest) throw new Error("No local day snapshot is available");
      selectedPayload = applyDayEventToPayload(
        deriveDayPayload(latest.payload, event.dateKey),
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
        snapshotRecord(applyDayEventToPayload(snapshot.payload, record.event, -1)),
      ),
    );
    await dayOfflineDb.outbox.delete(record.id);
  });
}
