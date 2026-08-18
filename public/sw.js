const CACHE_NAME = "kiosk-offline-v2";
const CORE_ASSETS = [
  "/",
  "/kiosk/local",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.debug("skip pre-cache asset", asset, error);
        }
      }
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          void cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (isNavigationRequest(request)) {
          const fallback = await cache.match("/kiosk/local");
          if (fallback) return fallback;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
        });
      }
    })(),
  );
});
