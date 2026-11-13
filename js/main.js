// ══ SCREENS & BOOT ══
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { if (s.id !== id) s.classList.remove('active'); });
  $(id).classList.add('active');
  document.body.classList.toggle('ingame', id === 'game');
  if (typeof updateWakeLock === 'function') updateWakeLock();
}
function boot() {
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
