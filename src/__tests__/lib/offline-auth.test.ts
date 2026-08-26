import { describe, expect, it } from "vitest";
import {
  hasOfflineSession,
  isExplicitlyLocked,
  markExplicitlyLocked,
  markUnlocked,
} from "@/lib/offline-auth";

function storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("offline auth state", () => {
  it("keeps an explicit lock until a successful unlock", () => {
    const local = storage();
    markUnlocked(local, 2_000);
    expect(hasOfflineSession(local, 1_000)).toBe(true);

    markExplicitlyLocked(local);
    expect(isExplicitlyLocked(local)).toBe(true);
    expect(hasOfflineSession(local, 1_000)).toBe(false);

    markUnlocked(local, 3_000);
    expect(isExplicitlyLocked(local)).toBe(false);
    expect(hasOfflineSession(local, 2_000)).toBe(true);
  });
});
