/* Lift service worker: makes the app load and navigate fully offline.
 * All user data lives in IndexedDB, so only the app shell needs caching. */
const VERSION = "v1";
const CACHE = `lift-${VERSION}`;
const PAGES = ["/", "/workout", "/history", "/exercises", "/exercises/detail", "/progress", "/settings"];
const STATIC = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// Pull the JS/CSS each page references so they work offline before ever being visited.
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(STATIC);
  const assets = new Set();
  await Promise.all(
    PAGES.map(async (path) => {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return;
      await cache.put(path, res.clone());
      const html = await res.text();
      for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(m[1]);
    }),
  );
  await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lift-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Client-side navigation payloads (RSC): network-first, fall back to cache. If neither
  // works, the request errors and Next.js falls back to a full page load, served below.
  if (req.headers.get("RSC") === "1") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Page loads: network-first so updates land quickly, cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error()),
    );
  }
});
