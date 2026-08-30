"use client";

import { useEffect } from "react";

const UPDATE_INTERVAL_MS = 60 * 60 * 1_000;
const CONTROLLER_RELOAD_COOLDOWN_MS = 5 * 60 * 1_000;
const CONTROLLER_RELOAD_GUARD_KEY = "gemsteps:pwa-controller-reload";

type ReloadStorage = Pick<Storage, "getItem" | "setItem">;

export function getReloadStorage(getStorage: () => ReloadStorage): ReloadStorage | null {
  try {
    return getStorage();
  } catch {
    return null;
  }
}

export function createControllerChangeHandler(
  hasExistingController: boolean,
  reload: () => void,
  storage: ReloadStorage | null,
  now: () => number = Date.now,
): () => void {
  let hasController = hasExistingController;
  let reloading = false;

  return () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloading) return;

    const currentTime = now();
    let lastReloadAt = Number.NaN;
    try {
      const storedReloadAt = storage?.getItem(CONTROLLER_RELOAD_GUARD_KEY) ?? null;
      lastReloadAt = storedReloadAt === null ? Number.NaN : Number(storedReloadAt);
    } catch {
      // Continue with the in-memory guard when persistent storage is unavailable.
    }
    if (
      Number.isFinite(lastReloadAt) &&
      currentTime - lastReloadAt < CONTROLLER_RELOAD_COOLDOWN_MS
    ) return;
    reloading = true;
    try {
      storage?.setItem(CONTROLLER_RELOAD_GUARD_KEY, String(currentTime));
    } catch {
      // Continue with the in-memory guard when persistent storage is unavailable.
    }
    reload();
  };
}

export default function PwaUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const reloadForNewVersion = createControllerChangeHandler(
      navigator.serviceWorker.controller !== null,
      () => window.location.reload(),
      getReloadStorage(() => window.localStorage),
    );
    let checkInProgress = false;

    const checkForUpdate = async () => {
      if (!window.navigator.onLine || checkInProgress) return;
      checkInProgress = true;

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        await registration?.update();
      } catch {
        // A later foreground or online event will retry the update check.
      } finally {
        checkInProgress = false;
      }
    };

    const checkWhenVisible = () => {
      if (!document.hidden) void checkForUpdate();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadForNewVersion);
    window.addEventListener("focus", checkWhenVisible);
    window.addEventListener("online", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);
    void checkForUpdate();
    const interval = window.setInterval(checkWhenVisible, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadForNewVersion);
      window.removeEventListener("focus", checkWhenVisible);
      window.removeEventListener("online", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  return null;
}
