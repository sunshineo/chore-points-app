"use client";

import { useEffect } from "react";

const UPDATE_INTERVAL_MS = 60 * 60 * 1_000;

export function createControllerChangeHandler(
  hasExistingController: boolean,
  reload: () => void,
): () => void {
  let hasController = hasExistingController;
  let reloading = false;

  return () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    reload();
  };
}

export default function PwaUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const reloadForNewVersion = createControllerChangeHandler(
      navigator.serviceWorker.controller !== null,
      () => window.location.reload(),
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
