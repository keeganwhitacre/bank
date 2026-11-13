// Bank service worker: makes the game load offline / on bad bar wifi.
// Bump VERSION whenever you deploy so phones pick up the new build.
var VERSION = 'bank-v3.0.0';
var SHELL = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'css/base.css',
  'css/components.css',
  'css/ui.css',
  'css/themes/br.css',
  'css/themes/cas.css',
  'css/themes/dive.css',
  'css/themes/sb.css',
  'css/themes/term.css',
  'js/audio.js',
  'js/config.js',
  'js/core.js',
  'js/dice.js',
  'js/fx.js',
  'js/game.js',
  'js/groups.js',
  'js/hall.js',
  'js/main.js',
  'js/menus.js',
  'js/overlays.js',
  'js/render.js',
  'js/roster.js',
  'js/rules.js',
  'js/sabotage.js',
  'js/settings.js',
  'js/share.js',
  'js/sheets.js',
  'js/state.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(VERSION).then(function(c) { return c.addAll(SHELL); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== VERSION; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

// App files (page, JS, CSS) are fetched network-first so a deploy never mixes new HTML with
// old scripts. If the network is slow or gone (bar wifi), the cached copy answers after 2.5s.
function networkFirst(req, key) {
  return caches.open(VERSION).then(function(c) {
    var net = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then(function(res) { if (res && res.ok) c.put(key || req, res.clone()); return res; });
    var slow = new Promise(function(resolve) { setTimeout(resolve, 2500); }).then(function() { return c.match(key || req); });
    return Promise.race([net.catch(function() { return c.match(key || req); }), slow.then(function(hit) { return hit || net; })]);
  });
}

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, 'index.html')); return; }
  if (url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  // Google Fonts never change: cache-first
  if (url.hostname.indexOf('fonts.g') === 0) {
    e.respondWith(caches.open(VERSION).then(function(c) {
      return c.match(req).then(function(hit) {
        return hit || fetch(req).then(function(res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; });
      });
    }));
  }
});
