import { isValidDateKey } from "@/lib/point-event";
import { DEFAULT_REWARDS, DEFAULT_TASKS, type PointsState } from "@/lib/points";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function isBaseItem(value: unknown): value is Record<string, unknown> {
  return isRecord(value) &&
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.emoji === "string";
}

export function isPointsState(value: unknown): value is PointsState {
  if (!isRecord(value)) return false;
  if (!isFiniteInteger(value.totalNet) || !isFiniteInteger(value.selectedDateNet)) return false;
  if (value.totalNet < 0) return false;
  if (!isValidDateKey(value.selectedDate)) return false;
  if (!Array.isArray(value.tasks) || !Array.isArray(value.rewards)) return false;

  const validTasks = value.tasks.length === DEFAULT_TASKS.length &&
    value.tasks.every((task, index) => {
      const configured = DEFAULT_TASKS[index];
      return isBaseItem(task) &&
        task.id === configured.id && task.title === configured.title &&
        task.emoji === configured.emoji && task.defaultPoints === configured.defaultPoints &&
        isFiniteInteger(task.completedCount) && task.completedCount >= 0;
    });
  const validRewards = value.rewards.length === DEFAULT_REWARDS.length &&
    value.rewards.every((reward, index) => {
      const configured = DEFAULT_REWARDS[index];
      return isBaseItem(reward) &&
        reward.id === configured.id && reward.title === configured.title &&
        reward.emoji === configured.emoji && reward.cost === configured.cost &&
        isFiniteInteger(reward.redeemedCount) && reward.redeemedCount >= 0;
    });

  return validTasks && validRewards;
}
