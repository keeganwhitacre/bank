// ══ GAME STATE ══
var G = Rules.newGame([], 'standard', {}, 1500, 10);
var STATS = {};
function initStats(names) {
  STATS = {};
  names.forEach(function(n) { STATS[n] = { sevens: 0, doubles: 0, bustSevens: 0, pointsLost: 0, banks: [], comebacks: 0, lastStanding: 0 }; });
}
var HISTORY = [];

// ══ SNAPSHOT / UNDO / PERSISTENCE ══
function snap() { return JSON.stringify({ G: G, STATS: STATS, EFFECTS: EFFECTS, CARDS: CARDS, FREEZE_DEALT: FREEZE_DEALT }); }
function restoreSnap(str) {
  var s = JSON.parse(str);
  G = s.G; STATS = s.STATS || {}; EFFECTS = s.EFFECTS || blankEffects(); CARDS = s.CARDS || {}; FREEZE_DEALT = !!s.FREEZE_DEALT;
}
function pushSnap() { HISTORY.push(snap()); if (HISTORY.length > 30) HISTORY.shift(); }
function undoLast() {
  if (!HISTORY.length) return;
  restoreSnap(HISTORY.pop());
  clearOverlays();
  SFX._state = 'none';
  render();
  showToast('Undone');
}
function saveGame() {
  if (!G.players.length || G.phase === 'idle') return;
  G.updatedAt = Date.now();
  lsSet(LS_GAME, { v: 2, state: snap(), history: HISTORY.slice(-12) });
}
function clearSavedGame() { lsDel(LS_GAME); }
function peekSaved() {
  var s = lsGet(LS_GAME); if (!s || !s.state) return null;
  try { return JSON.parse(s.state).G; } catch (e) { return null; }
}
function loadSavedGame() {
  var s = lsGet(LS_GAME); if (!s || !s.state) return false;
  try { restoreSnap(s.state); } catch (e) { return false; }
  HISTORY = s.history || [];
  return true;
}
function commitRecords() {
  if (G.recordsCommitted) return;
  G.recordsCommitted = true;
  G.players.forEach(function(p) {
    (STATS[p.name] ? STATS[p.name].banks : []).forEach(function(a) {
      if (a > RECORDS.bestBank) { RECORDS.bestBank = a; RECORDS.bestBankBy = p.name; }
    });
  });
  if (G.biggestBust > RECORDS.biggestBust) RECORDS.biggestBust = G.biggestBust;
  if (G.peakPot > RECORDS.biggestPot) RECORDS.biggestPot = G.peakPot;
  lsSet(LS_RECORDS, RECORDS);
}

// Timers that belong to the current moment of play (cleared on undo/quit)
var PENDING = [];
function later(fn, ms) { var id = setTimeout(fn, ms); PENDING.push(id); return id; }
function clearPending() {
  PENDING.forEach(clearTimeout); PENDING = [];
  if (DICE_IV) { clearInterval(DICE_IV); DICE_IV = null; }
  DICE_ROLLING = false;
  ['gDie1', 'gDie2'].forEach(function(id) { var d = $(id); if (d) d.classList.remove('rolling'); });
}
function clearOverlays() {
  clearPending();
  document.querySelectorAll('.backdrop, .rnd-backdrop, .card-deal-overlay, .mod-reveal, .bust-ov, .announce').forEach(function(e) { e.remove(); });
  ANN_Q = []; ANN_BUSY = false;
  TQ = []; if (TOAST) TOAST.classList.remove('show');
}
function anyOverlay() { return !!document.querySelector('.backdrop, .rnd-backdrop, .card-deal-overlay, .mod-reveal, .bust-ov'); }

// ══ RULES HELPERS ══ (thin wrappers: the logic lives in rules.js)
function hasMod(id) { return Rules.hasMod(G, id); }
function safeRollCount() { return Rules.safeRollCount(G); }
function nextRollDanger() { return Rules.nextRollDanger(G); }
function potHidden() { return Rules.potHidden(G); }
function activePlayers() { return Rules.activePlayers(G); }
function activeUnbanked() { return Rules.activeUnbanked(G); }
function lmsMinBank() { return Rules.lmsMinBank(G); }
function bankLockedByMin() { return Rules.bankLockedByMin(G); }
function needsDoublesTotal() { return Rules.needsDoublesTotal(G); }
function leaderName() { return Rules.leaderName(G); }
function previewBank(idx) { return Rules.previewBank(G, idx); }
function nextRoller() { Rules.nextRoller(G); }
function displayScore(p) { return (potHidden() && p.banked && p.bankedAmt != null) ? p.score - p.bankedAmt : p.score; }
function shortLabels() {
  var names = G.players.map(function(p) { return p.name; });
  return names.map(function(n) {
    var up = n.toUpperCase();
    for (var L = 3; L <= Math.min(8, n.length); L++) {
      var pre = up.slice(0, L);
      if (names.every(function(o) { return o === n || o.toUpperCase().slice(0, L) !== pre; })) return pre;
    }
    return up.slice(0, 8);
  });
}
function addMoment(kind, text, value) {
  G.moments.push({ kind: kind, text: text, value: value, round: G.round });
  if (G.moments.length > 40) { G.moments.sort(function(a, b) { return b.value - a.value; }); G.moments.length = 30; }
}
function standingsLast() {
  var act = activePlayers(); if (act.length < 3) return null;
  var s = act.slice().sort(function(a, b) { return a.score - b.score; });
  var top = s[s.length - 1].score;
  if (s[0].score === s[1].score || top - s[0].score < 150) return null;
  return s[0].name;
}
