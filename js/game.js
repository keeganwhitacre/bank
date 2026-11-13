// ══ ROLLING ══
// Game flow: ask Rules what happened, then do the stats, sound and animation.
function submitRoll(isDbl, total, keyEl, dice) {
  if (G.phase !== 'play' || anyOverlay()) return;
  pushSnap();
  if (keyEl) {
    var rip = document.createElement('div'); rip.className = 'key-ripple';
    keyEl.appendChild(rip); setTimeout(function() { if (rip.parentNode) rip.remove(); }, 400);
  }
  var roller = G.players[G.roller], name = roller.name, st = STATS[name];
  var heat = computeHeat();
  var r = Rules.applyRoll(G, EFFECTS, { total: total, isDbl: isDbl, dice: dice, name: name });
  if (isDbl) st.doubles++;
  if (total === 7) st.sevens++;
  if (r.bust) { resolveBust(name, total, r.prev); return; }

  var prev = r.prev, jump = r.jump, newHeat = computeHeat();
  if (r.kind === 'seven') { doFlash(hasMod('goldenSeven') ? 'rgba(255,210,63,.25)' : 'rgba(255,255,255,.15)'); potPulse(); SFX.safeSeven(hasMod('goldenSeven')); }
  else if (r.kind === 'double') {
    animatePot(prev, G.pot); SFX.doubles(newHeat);
    var mag = clamp(jump / 900, 0, 1);
    doFlash('rgba(255,255,255,' + (0.12 + mag * 0.2).toFixed(2) + ')');
    if (jump >= 120) potSlam(mag);
    if (jump >= 250 && !potHidden()) addMoment('double', name + ' doubled the pot to ' + fmt(G.pot), jump);
    if (jump >= 400) { spawnConfetti(30 + Math.round(mag * 40), false); buzz(30); }
  }
  else if (r.kind === 'halve') { animatePot(prev, G.pot); doFlash('rgba(255,100,0,.25)'); SFX.halve(); }
  else { animatePot(prev, G.pot); SFX.roll(heat); }

  showToast(r.msgs.join(' · '));
  nextRoller();
  render();
}

function resolveBust(name, total, prev) {
  STATS[name].bustSevens++;
  var res = Rules.applyBust(G, EFFECTS, name, total, prev);
  Object.keys(res.lostBy).forEach(function(n) { if (STATS[n]) STATS[n].pointsLost += res.lostBy[n]; });
  var lost = res.lost;
  res.biggest = lost >= 150 && lost > G.biggestBust && G.biggestBust > 0;
  res.record = lost >= 300 && RECORDS.biggestBust > 0 && lost > RECORDS.biggestBust && lost > G.biggestBust;
  if (lost > G.biggestBust) G.biggestBust = lost;
  if (lost >= 150) addMoment('bust', name + ' rolled a ' + total + ' on a ' + fmt(prev) + ' pot. ' + fmt(lost) + ' points gone.', lost);
  G.result = res;
  G.phase = 'roundEnd';

  var mag = clamp(prev / 800, 0, 1);
  SFX.bust(mag);
  buzz(mag > 0.4 ? [80, 40, 160] : 60);
  shakeScreen(mag);
  doFlash('rgba(255,51,0,' + (0.2 + mag * 0.2).toFixed(2) + ')');
  render();
  playBustSequence(G.result, showRoundEnd);
}

// ══ BANKING ══
var BANK_REFUSALS = {
  frozen: function(p) { return p.name + ' is frozen and can’t bank!'; },
  min: function() { return 'The pot needs ' + fmt(lmsMinBank()) + ' before anyone can bank'; },
  lockdown: function() { return 'Lockdown: only the roller can bank'; }
};
function bankPlayer(idx) {
  if (G.phase !== 'play') return;
  var p = G.players[idx];
  var why = Rules.canBank(G, EFFECTS, idx);
  if (why) { if (BANK_REFUSALS[why]) showToast(BANK_REFUSALS[why](p)); return; }
  pushSnap();
  var hidden = potHidden();
  var leaderBefore = leaderName();
  var hadScores = G.players.some(function(q) { return q.score > 0; });
  var r = Rules.applyBank(G, EFFECTS, idx), amt = r.amt;
  STATS[p.name].banks.push(amt);
  if (r.wasSolo) STATS[p.name].lastStanding++;

  showToast(p.name + ' banked' + (hidden ? '' : ' ' + fmt(amt)) + (r.notes.length && !hidden ? ' · ' + r.notes.join(' · ') : '') + '!');
  var big = clamp(amt / 600, 0, 1);
  spawnConfetti(40 + Math.round(big * 80), big > 0.5);
  SFX.bank(amt);
  if (amt >= 200 && !hidden) addMoment('bank', p.name + ' banked ' + fmt(amt) + ' in round ' + G.round, amt);
  if (!hidden) bankAnnouncements(p, amt, leaderBefore, hadScores);
  if (amt > G.bestBank) G.bestBank = amt;

  if (r.raceWin) { G.phase = 'over'; render(); later(function() { endGame(); }, 1100); return; }
  if (r.roundOver) { roundClear(); return; }
  render();
}
function bankAnnouncements(p, amt, leaderBefore, hadScores) {
  var leaderAfter = leaderName(), pick = null;
  var allBanks = []; Object.keys(STATS).forEach(function(n) { allBanks = allBanks.concat(STATS[n].banks); });
  var avg = allBanks.length ? allBanks.reduce(function(a, b) { return a + b; }, 0) / allBanks.length : 0;
  if (RECORDS.bestBank > 0 && amt >= 200 && amt > RECORDS.bestBank && amt > G.bestBank) {
    pick = ['New Record', p.name + ' · ' + fmt(amt) + ' · best bank ever', 'gold'];
    addMoment('record', p.name + ' set an all-time record bank: ' + fmt(amt), amt + 1000);
  } else if (G.roundStartLast === p.name && leaderAfter === p.name) {
    pick = ['Comeback', p.name + ' goes from last to first', 'gold'];
    STATS[p.name].comebacks++;
    addMoment('comeback', p.name + ' went from last place to the lead in round ' + G.round, amt + 500);
  } else if (leaderAfter && leaderAfter !== leaderBefore && hadScores && G.round >= 2 && !G.leaderAnnounced) {
    pick = ['New Leader', p.name + ' takes the lead · ' + fmt(p.score), ''];
    G.leaderAnnounced = true;
  } else if (amt >= 300 && allBanks.length >= 3 && amt >= avg * 2.2) {
    pick = ['Big Bank', p.name + ' · ' + fmt(amt), ''];
  }
  if (pick) announce(pick[0], pick[1], pick[2]);
}
function roundClear() {
  G.result = { bust: false, pot: G.pot };
  G.phase = 'roundEnd';
  SFX.roundClear();
  render();
  later(showRoundEnd, 800);
}

// ══ ROUND FLOW ══
function endRound() {
  if (G.phase !== 'roundEnd') return;
  if (Rules.isGameOverAtRoundEnd(G)) { endGame(); return; }
  var intro = Rules.startNextRound(G);
  resetEffects();
  SFX.stopDrone(); SFX._state = 'none';
  G.roundStartLast = standingsLast();
  G.phase = 'play';
  maybeRoundDeal();
  if (intro.length) { G.phase = 'reveal'; G.intro = intro; }
  render();
  if (G.phase === 'reveal') showRoundIntro();
}
function endGame() {
  clearOverlays();
  Rules.decideWinners(G);
  G.phase = 'over';
  commitRecords();
  saveGame();
  showEndScreen();
}
