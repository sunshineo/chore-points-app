import type { PointEvent, PointsState } from "@/lib/points";

export function applyPointEvent(
  base: PointsState,
  event: PointEvent,
  multiplier = 1,
): PointsState {
  const next: PointsState = {
    ...base,
    tasks: base.tasks.map((task) => ({ ...task })),
    rewards: base.rewards.map((reward) => ({ ...reward })),
  };

  const deltaPoints = event.points * multiplier;
  next.totalNet += deltaPoints;
  if (event.dateKey !== next.selectedDate) return next;

  next.selectedDateNet += deltaPoints;
  if (event.type === "task") {
    const task = next.tasks.find((item) => item.id === event.itemId);
    if (task) {
      task.completedCount = Math.max(
        0,
        Math.round(task.completedCount + deltaPoints / task.defaultPoints),
      );
    }
  } else if (event.type === "reward") {
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

export function deriveStateForDate(base: PointsState, dateKey: string): PointsState {
  return {
    ...base,
    selectedDate: dateKey,
    selectedDateNet: 0,
    tasks: base.tasks.map((task) => ({ ...task, completedCount: 0 })),
    rewards: base.rewards.map((reward) => ({ ...reward, redeemedCount: 0 })),
  };
}
