import type { DayApiPayload, DaySyncEvent } from "@/lib/day-kiosk";

export function applyDayEventToPayload(
  base: DayApiPayload,
  event: DaySyncEvent,
  multiplier = 1,
): DayApiPayload {
  const next: DayApiPayload = {
    ...base,
    tasks: base.tasks.map((task) => ({ ...task })),
    rewards: base.rewards.map((reward) => ({ ...reward })),
  };

  const deltaPoints = event.points * multiplier;
  next.totalNet += deltaPoints;
  if (event.dateKey !== next.selectedDate) return next;

  next.selectedDayNet += deltaPoints;
  if (event.type === "task") {
    const task = next.tasks.find((item) => item.id === event.itemId);
    if (task) {
      task.completedCount = Math.max(
        0,
        Math.round(task.completedCount + deltaPoints / task.defaultPoints),
      );
    }
  } else {
    const reward = next.rewards.find((item) => item.id === event.itemId);
    if (reward) {
      reward.redeemedCount = Math.max(
        0,
        reward.redeemedCount + (deltaPoints < 0 ? 1 : -1),
      );
    }
  }

  return next;
}

export function deriveDayPayload(base: DayApiPayload, dateKey: string): DayApiPayload {
  return {
    ...base,
    selectedDate: dateKey,
    selectedDayNet: 0,
    tasks: base.tasks.map((task) => ({ ...task, completedCount: 0 })),
    rewards: base.rewards.map((reward) => ({ ...reward, redeemedCount: 0 })),
  };
}
