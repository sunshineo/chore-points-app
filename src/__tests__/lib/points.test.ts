import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASKS,
  MAX_MANUAL_ADJUSTMENT_POINTS,
  isValidManualAdjustmentPoints,
} from "@/lib/points";

describe("default tasks", () => {
  it("uses the configured task points and bedtime order", () => {
    expect(
      Object.fromEntries(DEFAULT_TASKS.map(({ title, defaultPoints }) => [title, defaultPoints])),
    ).toMatchObject({
      自己穿衣服: 2,
      把早饭吃干净: 2,
      跟妈妈再见: 1,
      跟姥姥再见: 1,
      在学校吃完零食: 2,
      洗手: 1,
      跟姥姥问好: 1,
      跟妈妈问好: 1,
      晚饭吃干净: 2,
      用牙线: 2,
      上厕所: 1,
      晚上刷牙: 1,
      用漱口水: 1,
      自己换睡衣: 1,
      自己睡觉: 2,
    });

    const eveningTaskTitles = DEFAULT_TASKS.slice(17, 25).map(({ title }) => title);
    expect(eveningTaskTitles).toEqual([
      "用牙线",
      "上厕所",
      "晚上刷牙",
      "用漱口水",
      "自己换睡衣",
      "自己睡觉",
      "准时上床睡觉",
      "练钢琴",
    ]);
  });
});

describe("manual adjustment validation", () => {
  it("accepts non-zero integers within the supported range", () => {
    expect(isValidManualAdjustmentPoints(1)).toBe(true);
    expect(isValidManualAdjustmentPoints(-MAX_MANUAL_ADJUSTMENT_POINTS)).toBe(true);
  });

  it("rejects zero, fractions, and values outside the supported range", () => {
    expect(isValidManualAdjustmentPoints(0)).toBe(false);
    expect(isValidManualAdjustmentPoints(1.5)).toBe(false);
    expect(isValidManualAdjustmentPoints(MAX_MANUAL_ADJUSTMENT_POINTS + 1)).toBe(false);
  });
});
