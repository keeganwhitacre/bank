// ══ SCREENS & BOOT ══
// Screens that wear the theme. Menus stay neutral dark.
var THEMED_SCREENS = { game: true, setup: true, end: true };
var MENU_BG = '#0d0d0d';
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { if (s.id !== id) s.classList.remove('active'); });
  $(id).classList.add('active');
  syncPageChrome(id);
  setTimeout(measureViewportGap, 80);
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
// iOS home-screen apps have a WebKit bug: after the keyboard opens (typing names on setup), the
// viewport shrinks by the top inset (59pt on iPhone 16) and stays that way: fixed screens stop short
// and a dead band appears at the bottom. Hiding and re-showing a full-height element makes WebKit
// re-measure and restores it, which is why it used to come and go as you switched screens.
// So: detect the shrink, run that restore behind a brief blur, and if it still won't restore,
// fall back to ending screens flush against the band (html.ios-chin) so nothing is cut off.
var VIEW_GAP = 0, GAP_INFO = { probe: 0, full: 0, restores: 0 }, RESTORE_T = null, RESTORE_TRIES = 0;
function isStandalone() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
function isTyping() { var a = document.activeElement; return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')); }
function measureViewportGap() {
  var gap = 0, fullH = 0;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:1px;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe); var probeH = probe.getBoundingClientRect().height; probe.remove();
  if (ios && isStandalone()) {
    var sw = screen.width, sh = screen.height, portrait = innerHeight >= innerWidth;
    var screenH = portrait ? Math.max(sw, sh) : Math.min(sw, sh), screenW = portrait ? Math.min(sw, sh) : Math.max(sw, sh);
    fullH = Math.max(screenH, innerHeight);
    // Only for a full-screen app window, and never while the keyboard is up
    if (Math.abs(innerWidth - screenW) < 2 && !isTyping()) { gap = Math.round(fullH - probeH); if (gap < 4 || gap > 140) gap = 0; }
  }
  GAP_INFO.probe = Math.round(probeH); GAP_INFO.full = Math.round(fullH);
  VIEW_GAP = gap;
  document.documentElement.classList.toggle('ios-chin', gap > 0);
  if (typeof resizeCV === 'function') resizeCV();
  if (gap > 0) scheduleViewportRestore(); else RESTORE_TRIES = 0;
}
function scheduleViewportRestore() {
  if (RESTORE_T || RESTORE_TRIES >= 3) return;
  RESTORE_T = setTimeout(function() { RESTORE_T = null; restoreViewport(); }, 160 + RESTORE_TRIES * 400);
}
function restoreViewport() {
  if (isTyping()) return;
  RESTORE_TRIES++; GAP_INFO.restores++;
  var flip = function() {
    var el = document.querySelector('.screen.active') || document.body;
    el.style.display = 'none'; void el.offsetHeight;          // forced reflow, nothing painted in between
    el.style.display = '';
    document.body.style.display = 'none'; void document.body.offsetHeight; document.body.style.display = '';
  };
  var reduce = typeof reducedMotion === 'function' && reducedMotion();
  if (reduce) { flip(); setTimeout(measureViewportGap, 120); return; }
  // Hide the one-frame flicker behind a quick blur veil
  var veil = document.createElement('div'); veil.className = 'vp-veil';
  document.documentElement.appendChild(veil);
  requestAnimationFrame(function() { veil.classList.add('on'); });
  setTimeout(function() { flip(); }, 170);
  setTimeout(function() { veil.classList.remove('on'); measureViewportGap(); }, 300);
  setTimeout(function() { veil.remove(); }, 800);
}
// Re-check whenever the viewport might have changed: keyboard closing, returning to the app, rotating
document.addEventListener('focusout', function() { setTimeout(measureViewportGap, 180); });
document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') { RESTORE_TRIES = 0; setTimeout(measureViewportGap, 250); } });
addEventListener('pageshow', function() { setTimeout(measureViewportGap, 250); });
function displayCheck() {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  var cs = getComputedStyle(probe), top = parseInt(cs.paddingTop) || 0, bot = parseInt(cs.paddingBottom) || 0;
  probe.remove();
  return 'view ' + innerWidth + '\u00d7' + innerHeight + ' \u00b7 screen ' + screen.width + '\u00d7' + screen.height +
         ' \u00b7 fixed ' + GAP_INFO.probe + ' \u00b7 screenEl ' + Math.round((document.querySelector('.screen.active') || document.body).getBoundingClientRect().bottom) +
         ' \u00b7 safe ' + top + '/' + bot + ' \u00b7 gap ' + VIEW_GAP + ' \u00b7 restores ' + GAP_INFO.restores + ' \u00b7 ' + (isStandalone() ? 'home screen' : 'browser');
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
