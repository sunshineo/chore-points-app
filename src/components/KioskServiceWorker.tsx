"use client";

import { useEffect } from "react";

export default function KioskServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  }, []);

  return null;
}

