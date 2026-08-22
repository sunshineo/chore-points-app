import {
  deleteOutboxEvent,
  getOldestOutboxEvent,
  rejectOutboxEvent,
} from "@/lib/offline-db";

type OutboxDrainResult = {
  completed: boolean;
  rejected: number;
};

type DrainOptions = {
  fetchImpl?: typeof fetch;
};

let activeDrain: Promise<OutboxDrainResult> | null = null;

async function runDrain({ fetchImpl = fetch }: DrainOptions): Promise<OutboxDrainResult> {
  let rejected = 0;

  while (true) {
    const record = await getOldestOutboxEvent();
    if (!record) return { completed: true, rejected };

    let response: Response;
    try {
      response = await fetchImpl("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record.event),
      });
    } catch {
      return { completed: false, rejected };
    }

    if (response.status === 409 || response.status === 400) {
      await rejectOutboxEvent(record);
      rejected += 1;
      continue;
    }

    if (!response.ok) return { completed: false, rejected };
    await deleteOutboxEvent(record.id);
  }
}

export async function drainOutbox(options: DrainOptions = {}): Promise<OutboxDrainResult> {
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
