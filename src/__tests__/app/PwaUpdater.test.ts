import { describe, expect, it, vi } from "vitest";
import {
  createControllerChangeHandler,
  getReloadStorage,
} from "@/app/PwaUpdater";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("PWA controller changes", () => {
  it("returns no storage when localStorage access fails", () => {
    expect(getReloadStorage(() => {
      throw new Error("storage blocked");
    })).toBeNull();
  });

  it("does not reload for first installation and reloads once afterward", () => {
    const reload = vi.fn();
    const changed = createControllerChangeHandler(false, reload, createMemoryStorage());

    changed();
    changed();
    changed();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads once when an existing controller is replaced", () => {
    const reload = vi.fn();
    const changed = createControllerChangeHandler(true, reload, createMemoryStorage());

    changed();
    changed();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload again after the handler is recreated", () => {
    const reload = vi.fn();
    const storage = createMemoryStorage();

    createControllerChangeHandler(true, reload, storage)();
    createControllerChangeHandler(true, reload, storage)();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("allows a later update after the reload cooldown", () => {
    const reload = vi.fn();
    const storage = createMemoryStorage();
    let now = 1_000;

    createControllerChangeHandler(true, reload, storage, () => now)();
    now += 5 * 60 * 1_000;
    createControllerChangeHandler(true, reload, storage, () => now)();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("reloads when the persistent guard cannot be read", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: vi.fn(),
    };
    const changed = createControllerChangeHandler(true, reload, storage);

    expect(changed).not.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads when the persistent guard cannot be written", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage full");
      },
    };
    const changed = createControllerChangeHandler(true, reload, storage);

    expect(changed).not.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
