import type { DayApiPayload, DaySyncEvent } from "@/lib/day-kiosk";

export type DayKioskPayload = DayApiPayload;

function safeNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function normalizeDayPayload(payload: DayApiPayload): DayKioskPayload {
  return {
    ...payload,
    tasks: payload.tasks.map((task) => ({
      ...task,
      completed: Boolean(task.completed),
      completedCount: safeNumber(task.completedCount),
      defaultPoints: safeNumber(task.defaultPoints),
    })),
    rewards: payload.rewards.map((reward) => ({
      ...reward,
      cost: safeNumber(reward.cost),
      redeemedCount: safeNumber(reward.redeemedCount),
    })),
    totals: {
      totalEarned: safeNumber(payload.totals?.totalEarned),
      totalSpent: safeNumber(payload.totals?.totalSpent),
      totalNet: safeNumber(payload.totals?.totalNet),
    },
    selectedDay: {
      earned: safeNumber(payload.selectedDay?.earned),
      spent: safeNumber(payload.selectedDay?.spent),
      net: safeNumber(payload.selectedDay?.net),
    },
  };
}

export function applyDayEventToPayload(
  base: DayKioskPayload,
  event: DaySyncEvent,
  multiplier = 1,
): DayKioskPayload {
  const next: DayKioskPayload = {
    ...base,
    tasks: base.tasks.map((task) => ({ ...task })),
    rewards: base.rewards.map((reward) => ({ ...reward })),
    totals: { ...base.totals },
    selectedDay: { ...base.selectedDay },
  };

  const deltaPoints = safeNumber(event.points) * multiplier;
  if (deltaPoints === 0) return next;

  if (deltaPoints > 0) {
    next.totals.totalEarned += deltaPoints;
    if (event.dateKey === next.selectedDate) next.selectedDay.earned += deltaPoints;
  } else {
    next.totals.totalSpent += Math.abs(deltaPoints);
    if (event.dateKey === next.selectedDate) next.selectedDay.spent += Math.abs(deltaPoints);
  }

  next.totals.totalNet += deltaPoints;
  if (event.dateKey === next.selectedDate) next.selectedDay.net += deltaPoints;

  if (event.dateKey !== next.selectedDate) return next;

  if (event.type === "task") {
    const index = next.tasks.findIndex((task) => task.id === event.itemId);
    if (index >= 0) {
      const task = next.tasks[index];
      const pointsPerCompletion = safeNumber(task.defaultPoints);
      const countDelta = pointsPerCompletion > 0 ? deltaPoints / pointsPerCompletion : 0;
      task.completedCount = Math.max(0, Math.round(safeNumber(task.completedCount) + countDelta));
      task.completed = task.completedCount > 0;
    }
  } else {
    const index = next.rewards.findIndex((reward) => reward.id === event.itemId);
    if (index >= 0) {
      const reward = next.rewards[index];
      const redeemedDelta = deltaPoints < 0 ? 1 : -1;
      reward.redeemedCount = Math.max(0, safeNumber(reward.redeemedCount) + redeemedDelta);
    }
  }

  return next;
}

export function deriveDayPayload(base: DayKioskPayload, dateKey: string): DayKioskPayload {
  return {
    ...base,
    selectedDate: dateKey,
    selectedDay: { earned: 0, spent: 0, net: 0 },
    tasks: base.tasks.map((task) => ({ ...task, completed: false, completedCount: 0 })),
    rewards: base.rewards.map((reward) => ({ ...reward, redeemedCount: 0 })),
    totals: { ...base.totals },
  };
}
