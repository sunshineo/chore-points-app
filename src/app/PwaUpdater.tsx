"use client";

import { useEffect } from "react";

export default function PwaUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let hasExistingController = navigator.serviceWorker.controller !== null;
    let reloading = false;

    const reloadForNewVersion = () => {
      if (!hasExistingController) {
        hasExistingController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const checkForUpdate = async () => {
      if (!window.navigator.onLine) return;

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        await registration?.update();
      } catch {
        // A later foreground or online event will retry the update check.
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

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadForNewVersion);
      window.removeEventListener("focus", checkWhenVisible);
      window.removeEventListener("online", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  return null;
}
