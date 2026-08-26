import { describe, expect, it } from "vitest";
import { DEFAULT_REWARDS, DEFAULT_TASKS } from "@/lib/points";
import { isPointsState } from "@/lib/points-state";

const validState = {
  totalNet: 10,
  selectedDate: "2026-08-25",
  selectedDateNet: 1,
  tasks: DEFAULT_TASKS.map((task) => ({ ...task, completedCount: 0 })),
  rewards: DEFAULT_REWARDS.map((reward) => ({ ...reward, redeemedCount: 0 })),
};

describe("points state boundary", () => {
  it("accepts a complete finite state", () => {
    expect(isPointsState(validState)).toBe(true);
  });

  it("rejects missing arrays and non-finite numbers", () => {
    expect(isPointsState({ ...validState, tasks: undefined })).toBe(false);
    expect(isPointsState({ ...validState, totalNet: Number.NaN })).toBe(false);
    expect(isPointsState({ ...validState, rewards: [{ ...validState.rewards[0], cost: 0 }] }))
      .toBe(false);
    expect(isPointsState({ ...validState, selectedDate: "2026-02-31" })).toBe(false);
    expect(isPointsState({ ...validState, totalNet: -1 })).toBe(false);
  });

  it("rejects incomplete, unknown, duplicate, or altered configuration", () => {
    expect(isPointsState({ ...validState, tasks: [] })).toBe(false);
    expect(isPointsState({
      ...validState,
      tasks: validState.tasks.map((task, index) =>
        index === 0 ? { ...task, id: "unknown-task" } : task),
    })).toBe(false);
    expect(isPointsState({
      ...validState,
      tasks: validState.tasks.map((task, index) =>
        index === 1 ? { ...validState.tasks[0] } : task),
    })).toBe(false);
    expect(isPointsState({
      ...validState,
      rewards: validState.rewards.map((reward, index) =>
        index === 0 ? { ...reward, cost: reward.cost + 1 } : reward),
    })).toBe(false);
  });
});
