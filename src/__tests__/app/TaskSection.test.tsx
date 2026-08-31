// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskSection } from "@/app/points/TaskSection";
import { DEFAULT_TASKS } from "@/lib/points";

afterEach(cleanup);

describe("TaskSection task icons", () => {
  it.each([
    {
      taskId: "seed-task-face",
      imageSrc: "/icons/face-wash.png",
      emoji: "🚿",
    },
    {
      taskId: "seed-task-floss",
      imageSrc: "/icons/floss-pick.png",
      emoji: "🦷",
    },
    {
      taskId: "seed-task-rinse",
      imageSrc: "/icons/mouthwash.png",
      emoji: "🧴",
    },
    {
      taskId: "seed-task-pyjamas",
      imageSrc: "/icons/pink-nightgown.png",
      emoji: "🩳",
    },
  ])("shows the approved picture for $taskId instead of its emoji", ({
    taskId,
    imageSrc,
    emoji,
  }) => {
    const task = DEFAULT_TASKS.find(({ id }) => id === taskId);
    expect(task).toBeTruthy();

    const { container } = render(
      <TaskSection
        tasks={[{ ...task!, completedCount: 0 }]}
        readOnly={false}
        isUndoMode={false}
        onTap={vi.fn()}
      />,
    );

    const icon = container.querySelector(`img[src="${imageSrc}"]`);
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("src")).toBe(imageSrc);
    expect(screen.queryByText(emoji)).toBeNull();
  });
});
