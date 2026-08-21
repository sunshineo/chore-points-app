/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const apiMatcher = ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
  sameOrigin && url.pathname.startsWith("/api/");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    { matcher: apiMatcher, method: "GET", handler: new NetworkOnly() },
    { matcher: apiMatcher, method: "POST", handler: new NetworkOnly() },
  ],
});

serwist.addEventListeners();
