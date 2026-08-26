export const OFFLINE_AUTH_KEY = "gemsteps-unlocked-until";
export const EXPLICIT_LOCK_KEY = "gemsteps-explicitly-locked";

type LocalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function isExplicitlyLocked(storage: LocalStorage): boolean {
  return storage.getItem(EXPLICIT_LOCK_KEY) === "1";
}

export function hasOfflineSession(storage: LocalStorage, now = Date.now()): boolean {
  if (isExplicitlyLocked(storage)) return false;
  const expiresAt = Number(storage.getItem(OFFLINE_AUTH_KEY));
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function markExplicitlyLocked(storage: LocalStorage): void {
  storage.setItem(EXPLICIT_LOCK_KEY, "1");
  storage.removeItem(OFFLINE_AUTH_KEY);
}

export function markUnlocked(storage: LocalStorage, expiresAt: number): void {
  storage.setItem(OFFLINE_AUTH_KEY, String(expiresAt));
  storage.removeItem(EXPLICIT_LOCK_KEY);
}
