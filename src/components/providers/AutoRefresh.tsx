"use client";

import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;
const MIN_IDLE_MS = 10_000;

const REFRESHABLE_PATHS = [
  "/admin",
  "/badges",
  "/calendar",
  "/chores",
  "/dashboard",
  "/gallery",
  "/learn",
  "/ledger",
  "/meals",
  "/points",
  "/rewards",
  "/settings",
  "/sight-words",
  "/view-as",
];

function isRefreshablePath(pathname: string) {
  return REFRESHABLE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function shouldDeferRefresh() {
  if (document.hidden) return true;

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement &&
    (activeElement.matches("input, textarea, select") || activeElement.isContentEditable)
  ) {
    return true;
  }

  return Boolean(
    document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
  );
}

export default function AutoRefresh({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const lastInteractionAtRef = useRef(0);
  const lastRefreshAtRef = useRef(Date.now());

  const refresh = useCallback(() => {
    if (!isRefreshablePath(pathname) || shouldDeferRefresh()) return;

    const now = Date.now();
    if (now - lastInteractionAtRef.current < MIN_IDLE_MS) return;

    lastRefreshAtRef.current = now;
    router.refresh();
    setRefreshKey((key) => key + 1);
  }, [pathname, router]);

  useEffect(() => {
    if (!isRefreshablePath(pathname)) return;

    lastRefreshAtRef.current = Date.now();

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const refreshIfStale = () => {
      if (
        !document.hidden &&
        Date.now() - lastRefreshAtRef.current >= REFRESH_INTERVAL_MS
      ) {
        refresh();
      }
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    window.addEventListener("pointerdown", markInteraction, true);
    window.addEventListener("keydown", markInteraction, true);
    window.addEventListener("input", markInteraction, true);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
      window.removeEventListener("pointerdown", markInteraction, true);
      window.removeEventListener("keydown", markInteraction, true);
      window.removeEventListener("input", markInteraction, true);
    };
  }, [pathname, refresh]);

  return <Fragment key={refreshKey}>{children}</Fragment>;
}
