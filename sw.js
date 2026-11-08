// 每次改任何檔案都要把版本 +1，iPhone 才會更新快取
const CACHE = 'cc-v8';
const SHARDS = [1, 2, 3, 4, 5].map((i) => `vendor/model/ssdlite_mobilenet_v2/group1-shard${i}of5`);
const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/quota.js',
  'js/image.js',
  'js/detect.js',
  'js/share.js',
  'js/csv.js',
  'js/places.js',
  'js/gate.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/tf.min.js',
  'vendor/coco-ssd.min.js',
  'vendor/model/ssdlite_mobilenet_v2/model.json',
  ...SHARDS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)));
});
