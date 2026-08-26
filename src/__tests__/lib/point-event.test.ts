import { describe, expect, it } from "vitest";
import { createPointEvent, isValidDateKey, parsePointEvent } from "@/lib/point-event";

describe("point event boundary", () => {
  it("constructs an event with a supplied ID and Pacific date", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "event-1", now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(event).toEqual({
      id: "event-1",
      type: "task",
      itemId: "seed-task-face",
      points: 1,
      dateKey: "2026-08-25",
      date: "2026-08-25T16:00:00.000Z",
    });
  });

  it("generates a UUID when no ID is supplied", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("accepts a configured event and rejects forged points", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "event-1", now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(parsePointEvent(event)).toEqual(event);
    expect(parsePointEvent({ ...event, points: 99 })).toBeNull();
  });

  it("rejects impossible or mismatched Pacific dates", () => {
    const event = createPointEvent(
      { type: "task", itemId: "seed-task-face", points: 1 },
      { id: "event-1", now: new Date("2026-08-25T16:00:00.000Z") },
    );

    expect(parsePointEvent({ ...event, dateKey: "2026-02-31" })).toBeNull();
    expect(parsePointEvent({ ...event, dateKey: "2026-08-24" })).toBeNull();
  });

  it("validates real calendar date keys", () => {
    expect(isValidDateKey("2026-08-25")).toBe(true);
    expect(isValidDateKey("2026-02-31")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
  });
});
