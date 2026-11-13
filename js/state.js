// ══ GAME STATE ══
function newGameState(selR) {
  return {
    mode: 'standard', opts: {}, raceTarget: 1500,
    players: [], roller: 0, pot: 0, rolls: 0, round: 1, total: selR || 10,
    bankedThisRound: [], bustPot: 0, cumMiss: {},
    phase: 'idle',          // idle | play | roundEnd | reveal | over
    result: null,           // data for the round-end sheet
    intro: null,            // pending round intro: ['chaos'|'showdown'|'sudden']
    mods: [], prevMods: [],
    lastRoll: null, lastDice: null,
    firstBankDone: false, soloAnnounced: false, leaderAnnounced: false,
    showdownShown: false, suddenDeath: false,
    roundStartLast: null, heat: 0,
    bestBank: 0, biggestBust: 0, peakPot: 0,
    moments: [], elimOrder: [], winners: [], winReason: '',
    recordsCommitted: false,
    startedAt: Date.now(), updatedAt: Date.now()
  };
}
var G = newGameState(10);
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

// ══ RULES HELPERS ══
function hasMod(id) { return G.mode === 'chaos' && G.mods.indexOf(id) !== -1; }
function safeRollCount() {
  if (G.mode === 'turbo' || hasMod('noMercy')) return 0;
  if (hasMod('shortFuse')) return 1;
  return 3;
}
function nextRollDanger() { return G.rolls >= safeRollCount(); }
function potHidden() { return (G.mode === 'blackout' || hasMod('blind')) && G.phase === 'play' && G.rolls >= safeRollCount() && G.rolls > 0; }
function activePlayers() { return G.players.filter(function(p) { return !p.out; }); }
function activeUnbanked() { return G.players.filter(function(p) { return !p.out && !p.banked; }); }
function lmsMinBank() {
  var base = (G.opts && G.opts.lmsMinBank) || 100;
  return G.suddenDeath ? base + 100 * Math.max(1, G.round - 10) : base;
}
function bankLockedByMin() { return G.mode === 'lms' && G.pot < lmsMinBank(); }
// Doubles need an exact total when a rule cares which doubles it was
function needsDoublesTotal() { return G.mode === 'cutthroat' || hasMod('snakeEyes') || hasMod('highStakes') || hasMod('copycat'); }
function leaderName() {
  var best = null, bestS = -1, tie = false;
  activePlayers().forEach(function(p) { if (p.score > bestS) { bestS = p.score; best = p.name; tie = false; } else if (p.score === bestS) tie = true; });
  return (tie || bestS <= 0) ? null : best;
}
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
