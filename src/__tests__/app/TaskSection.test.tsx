// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskSection } from "@/app/points/TaskSection";
import { DEFAULT_TASKS } from "@/lib/points";

afterEach(cleanup);

describe("TaskSection task icons", () => {
  it("shows the mouthwash task with its picture instead of the bottle emoji", () => {
    const mouthwashTask = DEFAULT_TASKS.find(({ id }) => id === "seed-task-rinse");
    expect(mouthwashTask).toBeTruthy();

    const { container } = render(
      <TaskSection
        tasks={[{ ...mouthwashTask!, completedCount: 0 }]}
        readOnly={false}
        isUndoMode={false}
        onTap={vi.fn()}
      />,
    );

    const icon = container.querySelector('img[src="/icons/mouthwash.png"]');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("src")).toBe("/icons/mouthwash.png");
    expect(screen.queryByText("🧴")).toBeNull();
  });
});
