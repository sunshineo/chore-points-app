import { describe, expect, it } from "vitest";
import {
  MAX_MANUAL_ADJUSTMENT_POINTS,
  isValidManualAdjustmentPoints,
} from "@/lib/points";

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
