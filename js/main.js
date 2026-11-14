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
  document.body.setAttribute('data-screen', id);
  Object.values(THEME_MAP).forEach(function(v) { document.body.classList.remove(v.cls); });
  if (themed) document.body.classList.add(THEME_MAP[T].cls);
  var bg = themed && id !== 'end' ? THEME_MAP[T].bg : MENU_BG;
  document.documentElement.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', bg);
}
// Shelf method: give the body an explicit height. In a home-screen app that's the screen's real
// height, which doesn't change when iOS shrinks the viewport (the keyboard bug); in a browser tab
// it's the window height. Re-run on resize and after the keyboard closes.
function isStandalone() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
function setViewportHeight() {
  var h = innerHeight;
  if (isStandalone()) {
    var sw = screen.width, sh = screen.height, portrait = innerHeight >= innerWidth;
    var screenW = portrait ? Math.min(sw, sh) : Math.max(sw, sh);
    if (Math.abs(innerWidth - screenW) < 2) h = portrait ? Math.max(sw, sh) : Math.min(sw, sh);
  }
  document.documentElement.style.setProperty('--vh', (h / 100) + 'px');
  if (typeof resizeCV === 'function') resizeCV();
}
addEventListener('resize', setViewportHeight);
addEventListener('orientationchange', function() { setTimeout(setViewportHeight, 100); });
document.addEventListener('focusout', function(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    setTimeout(function() { window.scrollTo(0, 0); document.body.scrollTop = 0; setViewportHeight(); }, 50);
  }
});
setViewportHeight();
function displayCheck() {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  var cs = getComputedStyle(probe), top = parseInt(cs.paddingTop) || 0, bot = parseInt(cs.paddingBottom) || 0;
  probe.remove();
  return 'view ' + innerWidth + '\u00d7' + innerHeight + ' \u00b7 screen ' + screen.width + '\u00d7' + screen.height +
         ' \u00b7 body ' + Math.round(document.body.getBoundingClientRect().height) + ' \u00b7 safe ' + top + '/' + bot +
         ' \u00b7 ' + (isStandalone() ? 'home screen' : 'browser');
}
function boot() {
  setViewportHeight();
  var s = loadSettings();
  var names = s && s.names && s.names.length >= 2 ? s.names : ['', '', ''];
  names.forEach(function(n) { addInput(n); });
  $('hIcoPlay').innerHTML = ico('play');
  $('hIcoPalette').innerHTML = ico('palette');
  $('hIcoSettings').innerHTML = ico('gear');
  $('hIcoHall').innerHTML = ico('trophy');
  $('shareBtn').innerHTML = ico('share') + ' Share results';
  $('hIcoResume').innerHTML = ico('play');
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
