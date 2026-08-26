import { describe, expect, it, vi } from "vitest";
import { createControllerChangeHandler } from "@/app/PwaUpdater";

describe("PWA controller changes", () => {
  it("does not reload for first installation and reloads once afterward", () => {
    const reload = vi.fn();
    const changed = createControllerChangeHandler(false, reload);

    changed();
    changed();
    changed();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads once when an existing controller is replaced", () => {
    const reload = vi.fn();
    const changed = createControllerChangeHandler(true, reload);

    changed();
    changed();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
