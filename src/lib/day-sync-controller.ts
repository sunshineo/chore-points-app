import {
  deleteDayOutboxEvent,
  getOldestDayOutboxEvent,
  rejectDayOutboxEvent,
} from "@/lib/day-offline-db";

type DayOutboxDrainResult = {
  completed: boolean;
  rejected: number;
};

type DrainOptions = {
  fetchImpl?: typeof fetch;
};

let activeDrain: Promise<DayOutboxDrainResult> | null = null;

async function runDrain({ fetchImpl = fetch }: DrainOptions): Promise<DayOutboxDrainResult> {
  let rejected = 0;

  while (true) {
    const record = await getOldestDayOutboxEvent();
    if (!record) return { completed: true, rejected };

    let response: Response;
    try {
      response = await fetchImpl("/api/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record.event),
      });
    } catch {
      return { completed: false, rejected };
    }

    if (response.status === 409 || response.status === 400) {
      await rejectDayOutboxEvent(record);
      rejected += 1;
      continue;
    }

    if (!response.ok) return { completed: false, rejected };
    await deleteDayOutboxEvent(record.id);
  }
}

export async function drainDayOutbox(options: DrainOptions = {}): Promise<DayOutboxDrainResult> {
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
