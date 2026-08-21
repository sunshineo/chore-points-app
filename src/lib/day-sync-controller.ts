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
  token: string;
  fetchImpl?: typeof fetch;
};

let activeDrain: Promise<DayOutboxDrainResult> | null = null;

async function runDrain({ token, fetchImpl = fetch }: DrainOptions): Promise<DayOutboxDrainResult> {
  let rejected = 0;

  while (true) {
    const record = await getOldestDayOutboxEvent();
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
    if (activeDrain) {
      await activeDrain;
      continue;
    }

    const task = runDrain(options);
    activeDrain = task;
    try {
      return await task;
    } finally {
      if (activeDrain === task) activeDrain = null;
    }
  }
}
