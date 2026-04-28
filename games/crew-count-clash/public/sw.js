const cacheName = "crew-count-clash-pwa-20260428";
const scopePath = new URL(self.registration.scope).pathname;
const appShell = [
  scopePath,
  `${scopePath}index.html`,
  `${scopePath}manifest.webmanifest`,
  `${scopePath}icon.svg`,
  `${scopePath}icon-192.png`,
  `${scopePath}icon-512.png`,
  `${scopePath}preview.svg`
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("crew-count-clash-pwa-") && key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, `${scopePath}index.html`));
    return;
  }

  if (url.pathname.includes("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    cache.put(fallbackUrl, response.clone());
    return response;
  } catch {
    return (await cache.match(fallbackUrl)) ?? (await cache.match(scopePath));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? update;
}
