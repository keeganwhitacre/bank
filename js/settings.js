// ══ SETTINGS SCREEN ══
// PREFS = how the app behaves on this phone. HOUSE = default house rules for new games.
var SOUND_VOL = { off: 0, low: 0.35, med: 0.7, high: 1 };
var SETTING_DEFS = [
  { sec: 'Sound & feel' },
  { key: 'prefs.sound', label: 'Sound', opts: [['off', 'Off'], ['low', 'Low'], ['med', 'Med'], ['high', 'High']] },
  { key: 'prefs.haptics', label: 'Vibration', desc: 'Buzz on busts and big doubles (phones that support it)', opts: [[true, 'On'], [false, 'Off']] },
  { key: 'prefs.wake', label: 'Keep screen awake', desc: 'Stops the phone dimming mid-game', opts: [[true, 'On'], [false, 'Off']] },
  { key: 'prefs.motion', label: 'Motion', desc: 'Reduced turns off shaking, confetti and pulsing. Auto follows your phone’s setting.', opts: [['auto', 'Auto'], ['reduced', 'Reduced'], ['full', 'Full']] },
  { key: 'prefs.announce', label: 'Announcements', desc: 'Big only = records and comebacks', opts: [['all', 'All'], ['big', 'Big only'], ['off', 'Off']] },
  { key: 'prefs.roundSheet', label: 'Round summary', desc: 'Busts only = clean rounds roll straight on with a quick toast', opts: [['busts', 'Busts only'], ['every', 'Every round']] },
  { key: 'prefs.dice', label: 'Virtual dice', desc: 'Roll on the phone instead of tapping in totals', opts: [[false, 'Off'], [true, 'On']] },
  { sec: 'House rules', note: 'For new games' },
  { key: 'house.safeRolls', label: 'Safe rolls', desc: 'Rolls at the start of a round where a 7 is safe', opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] },
  { key: 'house.safe7', label: 'A safe 7 is worth', opts: [[50, '50'], [70, '70'], [100, '100']] },
  { key: 'house.doublesMult', label: 'Doubles multiply the pot', opts: [[2, '×2'], [3, '×3']] },
  { sec: 'Data' },
  { action: 'resetSettings', label: 'Reset settings & house rules', warn: false },
  { action: 'resetRecords', label: 'Reset all-time records & player stats', warn: true }
];
function getSetting(key) { var p = key.split('.'); return (p[0] === 'prefs' ? PREFS : HOUSE)[p[1]]; }
function setSetting(key, val) {
  var p = key.split('.'); (p[0] === 'prefs' ? PREFS : HOUSE)[p[1]] = val;
  saveSettings(); applyPrefs(); renderSettings();
}
function openSettings() { showScreen('settings'); renderSettings(); $('settingsList').scrollTop = 0; }
function closeSettings() { updateHomeLabels(); showScreen(SETTINGS_RETURN || 'home'); SETTINGS_RETURN = null; }
var SETTINGS_RETURN = null;
function renderSettings() {
  var h = '';
  SETTING_DEFS.forEach(function(d, i) {
    if (d.sec) { h += '<div class="set-h">' + esc(d.sec) + (d.note ? '<span>' + esc(d.note) + '</span>' : '') + '</div>'; return; }
    if (d.action) { h += '<button class="set-action' + (d.warn ? ' warn' : '') + '" onclick="settingAction(\'' + d.action + '\', this)">' + esc(d.label) + '</button>'; return; }
    if (d.key === 'prefs.haptics' && !('vibrate' in navigator)) return;   // iPhones can't vibrate from the web
    var cur = getSetting(d.key);
    h += '<div class="set-row"><div class="set-label">' + esc(d.label) + (d.desc ? '<small>' + esc(d.desc) + '</small>' : '') + '</div><div class="set-seg">';
    d.opts.forEach(function(o, j) {
      h += '<button class="' + (String(cur) === String(o[0]) ? 'on' : '') + '" onclick="pickSetting(' + i + ',' + j + ')">' + esc(o[1]) + '</button>';
    });
    h += '</div></div>';
  });
  h += '<div class="set-foot">Bank · house rules apply to games you start from now on<br><span class="set-diag">Display check: ' + esc(displayCheck()) + '</span><br><a class="set-diag-link" href="viewport-test.html">Open screen-edge test \u2192</a></div>';
  $('settingsList').innerHTML = h;
}
function pickSetting(i, j) { var d = SETTING_DEFS[i]; setSetting(d.key, d.opts[j][0]); if (d.key === 'prefs.sound' && PREFS.sound !== 'off') later(function() { SFX.bank(0); }, 30); }
function settingAction(name, btn) {
  if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Tap again to confirm'; return; }
  if (name === 'resetSettings') {
    PREFS = JSON.parse(JSON.stringify(PREFS_DEFAULTS)); HOUSE = JSON.parse(JSON.stringify(Rules.HOUSE_DEFAULTS));
    saveSettings(); applyPrefs(); renderSettings(); showToast('Settings reset');
  } else if (name === 'resetRecords') {
    RECORDS = { bestBank: 0, bestBankBy: '', biggestBust: 0, biggestPot: 0 }; lsSet(LS_RECORDS, RECORDS);
    if (typeof resetLifetime === 'function') resetLifetime();
    renderSettings(); showToast('Records and stats cleared');
  }
}

// ── Applying preferences ──
function reducedMotion() {
  if (PREFS.motion === 'reduced') return true;
  if (PREFS.motion === 'full') return false;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function applyPrefs() {
  document.body.classList.toggle('reduce-motion', reducedMotion());
  USE_DICE = !!PREFS.dice;
  if (PREFS.sound === 'off') SFX.stopDrone();
  if (SFX._master) SFX._master.gain.value = SOUND_VOL[PREFS.sound] || 0;
  updateWakeLock();
}
try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyPrefs); } catch (e) {}

// Keep the screen on during a game (Screen Wake Lock API, where the browser supports it)
var WAKE = null, WAKE_PENDING = false;
function updateWakeLock() {
  var want = PREFS.wake && document.body.classList.contains('ingame') && document.visibilityState === 'visible';
  if (want && !WAKE && !WAKE_PENDING && navigator.wakeLock) {
    WAKE_PENDING = true;
    navigator.wakeLock.request('screen').then(function(lock) {
      WAKE_PENDING = false; WAKE = lock;
      lock.addEventListener('release', function() { WAKE = null; });
      if (!document.body.classList.contains('ingame')) updateWakeLock();
    }).catch(function() { WAKE_PENDING = false; });
  } else if (!want && WAKE) { try { WAKE.release(); } catch (e) {} WAKE = null; }
}
// The browser drops the lock when the app is backgrounded; take it back on return
document.addEventListener('visibilitychange', updateWakeLock);

// ── Chaos deck editor ──
function chaosPoolList() { return OPTS.chaosPool && OPTS.chaosPool.length ? OPTS.chaosPool.slice() : Object.keys(MODS); }
function chaosPoolLabel() { var n = chaosPoolList().length, t = Object.keys(MODS).length; return n === t ? 'All ' + t + ' rules' : n + ' of ' + t + ' rules'; }
function showChaosPool() {
  var s = makeSheet('chaosPool', 'Rules in the chaos deck');
  var list = document.createElement('div'); list.className = 'pool-list';
  function draw() {
    var pool = chaosPoolList();
    list.innerHTML = Object.keys(MODS).map(function(k) {
      var d = MODS[k], on = pool.indexOf(k) !== -1;
      return '<button class="pool-row' + (on ? ' on' : '') + '" data-k="' + k + '">' + ico(d.icon) + '<span><b>' + esc(d.name) + '</b>' + esc(d.short) + '</span><i>' + (on ? 'On' : 'Off') + '</i></button>';
    }).join('');
  }
  list.addEventListener('click', function(e) {
    var b = e.target.closest('.pool-row'); if (!b) return;
    var pool = chaosPoolList(), k = b.dataset.k, i = pool.indexOf(k);
    if (i !== -1) { if (pool.length <= 2) { showToast('Keep at least 2 rules in the deck'); return; } pool.splice(i, 1); }
    else pool.push(k);
    OPTS.chaosPool = pool.length === Object.keys(MODS).length ? [] : pool;
    saveSettings(); draw(); syncModeExtras();
  });
  draw();
  s.sh.appendChild(list);
  var done = document.createElement('button'); done.className = 'sh-done'; done.textContent = 'Done'; done.onclick = s.close;
  s.sh.appendChild(done);
  document.body.appendChild(s.bd);
}
function syncModeExtras() { var b = $('chaosPoolBtn'); if (b) b.textContent = chaosPoolLabel() + ' — edit'; }
