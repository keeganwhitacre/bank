// ══ SCREENS & BOOT ══
// Screens that wear the theme. Menus stay neutral dark.
var THEMED_SCREENS = { game: true, setup: true, end: true };
var MENU_BG = '#0d0d0d';
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { if (s.id !== id) s.classList.remove('active'); });
  $(id).classList.add('active');
  syncPageChrome(id);
  document.body.classList.toggle('ingame', id === 'game');
  if (typeof updateWakeLock === 'function') updateWakeLock();
}
// iOS 26+ ignores theme-color and tints the status bar (and any gap the page fails to cover)
// from the html/body background, so it must always match the screen you're looking at.
function syncPageChrome(id) {
  var themed = !!THEMED_SCREENS[id];
  Object.values(THEME_MAP).forEach(function(v) { document.body.classList.remove(v.cls); });
  if (themed) document.body.classList.add(THEME_MAP[T].cls);
  var bg = themed && id !== 'end' ? THEME_MAP[T].bg : MENU_BG;
  document.documentElement.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', bg);
}
// iOS home-screen apps (with the black-translucent status bar) give fixed, full-screen
// elements a viewport that ends short of the real screen bottom (WebKit bug). Measure how much
// is missing and let CSS extend every full-screen layer by that much (--gap). 0 everywhere else.
var VIEW_GAP = 0;
function isStandalone() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
// Measure the problem directly: how tall is a fixed top:0/bottom:0 element really, compared
// with the full screen? (iOS may report a full innerHeight while fixed elements still stop short.)
var GAP_INFO = { probe: 0, full: 0 };
function measureViewportGap() {
  var gap = 0, probeH = 0, fullH = 0;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:1px;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe); probeH = probe.getBoundingClientRect().height; probe.remove();
  if (ios && isStandalone()) {
    var sw = screen.width, sh = screen.height, portrait = innerHeight >= innerWidth;
    var screenH = portrait ? Math.max(sw, sh) : Math.min(sw, sh);
    var screenW = portrait ? Math.min(sw, sh) : Math.max(sw, sh);
    fullH = Math.max(screenH, innerHeight, document.documentElement.clientHeight);
    // Only for a full-screen app window, and never while the keyboard is up
    if (Math.abs(innerWidth - screenW) < 2) { gap = Math.round(fullH - probeH); if (gap < 0 || gap > 140) gap = 0; }
  }
  GAP_INFO = { probe: Math.round(probeH), full: Math.round(fullH) };
  VIEW_GAP = gap;
  document.documentElement.style.setProperty('--gap', gap + 'px');
  if (typeof resizeCV === 'function') resizeCV();
}
function displayCheck() {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  var cs = getComputedStyle(probe), top = parseInt(cs.paddingTop) || 0, bot = parseInt(cs.paddingBottom) || 0;
  probe.remove();
  return 'view ' + innerWidth + '\u00d7' + innerHeight + ' \u00b7 screen ' + screen.width + '\u00d7' + screen.height +
         ' \u00b7 fixed ' + GAP_INFO.probe + ' \u00b7 screenEl ' + Math.round((document.querySelector('.screen.active') || document.body).getBoundingClientRect().bottom) +
         ' \u00b7 safe ' + top + '/' + bot + ' \u00b7 gap ' + VIEW_GAP + ' \u00b7 ' + (isStandalone() ? 'home screen' : 'browser');
}
['resize', 'orientationchange'].forEach(function(ev) { addEventListener(ev, function() { setTimeout(measureViewportGap, 60); }); });
function boot() {
  measureViewportGap();
  setTimeout(measureViewportGap, 400); setTimeout(measureViewportGap, 1500);   // iOS sometimes settles late
  var s = loadSettings();
  var names = s && s.names && s.names.length >= 2 ? s.names : ['', '', ''];
  names.forEach(function(n) { addInput(n); });
  $('hIcoPlay').innerHTML = ico('play');
  $('hIcoPalette').innerHTML = ico('palette');
  $('hIcoBolt').innerHTML = ico('bolt');
  $('hIcoSettings').innerHTML = ico('gear');
  $('hIcoHall').innerHTML = ico('trophy');
  $('shareBtn').innerHTML = ico('share') + ' Share results';
  $('hIcoResume').innerHTML = ico('play');
  $('gCardBtn').innerHTML = ico('card', 'ico-lg');
  $('gMenuBtn').innerHTML = ICONS.menu;
  syncThemeCards(); selectMode(MODE); syncOptButtons(); pickR(SEL_R); syncModeExtras();
  applyPrefs();
  updateHomeLabels();
  var saved = peekSaved();
  if (saved && saved.players && saved.players.length) {
    var age = Date.now() - (saved.updatedAt || 0);
    // Pick up exactly where you left off (reloads, iOS killing the app, accidental swipes)
    if (saved.phase !== 'over' && saved.phase !== 'idle' && age < 12 * 3600e3) { resumeGame(); return; }
    if (saved.phase === 'over' && age < 3600e3 && loadSavedGame()) { applyTheme($('game')); showEndScreen(); return; }
  }
  showScreen('home');
}
boot();

// Offline support
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', function() { navigator.serviceWorker.register('sw.js').catch(function() {}); });
}
