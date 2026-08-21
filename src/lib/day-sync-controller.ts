import {
  deleteDayOutboxEvent,
  getOldestDayOutboxEvent,
  rejectDayOutboxEvent,
} from "@/lib/day-offline-db";

type DaySyncResponse = {
  failed?: string[];
  failedEvents?: string[];
  totalNet?: number;
  error?: string;
};

export type DayOutboxDrainResult = {
  completed: boolean;
  rejected: number;
};

type DrainOptions = {
  kidId: string;
  token: string;
  fetchImpl?: typeof fetch;
};

const activeDrains = new Map<string, Promise<DayOutboxDrainResult>>();

async function runDrain({ kidId, token, fetchImpl = fetch }: DrainOptions): Promise<DayOutboxDrainResult> {
  let rejected = 0;

  while (true) {
    const record = await getOldestDayOutboxEvent(kidId);
    if (!record) return { completed: true, rejected };

    let response: Response;
    try {
      response = await fetchImpl(
        `/api/day/sync?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: [record.event] }),
        },
      );
    } catch {
      return { completed: false, rejected };
    }

    const result = (await response.json().catch(() => null)) as DaySyncResponse | null;
    const failed = new Set([...(result?.failed ?? []), ...(result?.failedEvents ?? [])]);

    if (failed.has(record.id)) {
      await rejectDayOutboxEvent(record);
      rejected += 1;
      continue;
    }

    if (!response.ok || typeof result?.totalNet !== "number") {
      return { completed: false, rejected };
    }

    await deleteDayOutboxEvent(record.id);
  }
}

export async function drainDayOutbox(options: DrainOptions): Promise<DayOutboxDrainResult> {
  while (true) {
    const active = activeDrains.get(options.kidId);
    if (active) {
      await active;
      continue;
    }

    const task = runDrain(options);
    activeDrains.set(options.kidId, task);
    try {
      return await task;
    } finally {
      if (activeDrains.get(options.kidId) === task) activeDrains.delete(options.kidId);
    }
  }
}
