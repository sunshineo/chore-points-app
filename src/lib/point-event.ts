import {
  DEFAULT_REWARDS,
  DEFAULT_TASKS,
  MANUAL_ADJUSTMENT_ITEM_ID,
  getDateKeyPT,
  isValidManualAdjustmentPoints,
  type PointEvent,
} from "@/lib/points";

const TASK_POINTS = new Map(DEFAULT_TASKS.map((task) => [task.id, task.defaultPoints]));
const REWARD_COSTS = new Map(DEFAULT_REWARDS.map((reward) => [reward.id, reward.cost]));
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PointEventDraft = Pick<PointEvent, "type" | "itemId" | "points">;
export type PointEventOptions = { id?: string; now?: Date };

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return normalized === value;
}

export function createPointEvent(
  draft: PointEventDraft,
  { id = globalThis.crypto.randomUUID(), now = new Date() }: PointEventOptions = {},
): PointEvent {
  return {
    id,
    ...draft,
    dateKey: getDateKeyPT(now),
    date: now.toISOString(),
  };
}

export function parsePointEvent(value: unknown): PointEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<PointEvent>;
  if (typeof event.id !== "string" || !EVENT_ID_PATTERN.test(event.id)) return null;
  if (typeof event.itemId !== "string" || typeof event.points !== "number") return null;
  if (!Number.isInteger(event.points) || event.points === 0) return null;
  if (typeof event.date !== "string" || !isValidDateKey(event.dateKey)) return null;

  const date = new Date(event.date);
  if (!Number.isFinite(date.getTime()) || getDateKeyPT(date) !== event.dateKey) return null;

  const validItem = event.type === "task"
    ? Math.abs(event.points) === TASK_POINTS.get(event.itemId)
    : event.type === "reward"
      ? Math.abs(event.points) === REWARD_COSTS.get(event.itemId)
      : event.type === "adjustment" &&
        event.itemId === MANUAL_ADJUSTMENT_ITEM_ID &&
        isValidManualAdjustmentPoints(event.points);

  return validItem ? event as PointEvent : null;
}
