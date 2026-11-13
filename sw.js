// Bank service worker: makes the game load offline / on bad bar wifi.
// Bump VERSION whenever you deploy so phones pick up the new build.
var VERSION = 'bank-v2.0.0';
var SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(VERSION).then(function(c) { return c.addAll(SHELL); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== VERSION; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // The page itself: try the network first so updates show up, fall back to cache offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function(res) {
      var copy = res.clone();
      caches.open(VERSION).then(function(c) { c.put('index.html', copy); });
      return res;
    }).catch(function() { return caches.match('index.html'); }));
    return;
  }

  // Google Fonts + app files: serve from cache, refresh in the background
  if (url.origin === location.origin || url.hostname.indexOf('fonts.g') === 0) {
    e.respondWith(caches.open(VERSION).then(function(c) {
      return c.match(req).then(function(hit) {
        var net = fetch(req).then(function(res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function() { return hit; });
        return hit || net;
      });
    }));
  }
});
