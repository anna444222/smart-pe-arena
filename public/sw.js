const CACHE_NAME = 'smart-pe-arena-v2';
const ASSETS_TO_CACHE = [
  '/', '/index.html', '/css/style.css', '/js/app.js', '/js/ai-tracker.js',
  '/js/audio-engine.js', '/js/game-engine.js', '/js/api-client.js', '/manifest.json',
  '/ai/vision_bundle.mjs', '/ai/pose_landmarker_lite.task',
  '/ai/wasm/vision_wasm_internal.js', '/ai/wasm/vision_wasm_internal.wasm',
  '/ai/wasm/vision_wasm_nosimd_internal.js', '/ai/wasm/vision_wasm_nosimd_internal.wasm'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS_TO_CACHE).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/.netlify/functions/')) return;
  e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request)));
});