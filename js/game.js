// ══ ROLLING ══
function submitRoll(isDbl, total, keyEl, dice) {
  if (G.phase !== 'play' || anyOverlay()) return;
  pushSnap();
  if (keyEl) {
    var rip = document.createElement('div'); rip.className = 'key-ripple';
    keyEl.appendChild(rip); setTimeout(function() { if (rip.parentNode) rip.remove(); }, 400);
  }
  var roller = G.players[G.roller], name = roller.name, st = STATS[name];
  var prev = G.pot, prevRoll = G.lastRoll;
  var heat = computeHeat();
  G.rolls++;
  G.lastRoll = total; G.lastDice = dice || null;
  var danger = G.rolls > safeRollCount();
  if (isDbl) st.doubles++;
  if (total === 7) st.sevens++;

  if (danger && (total === 7 || (total === 2 && hasMod('snakeEyes')))) { resolveBust(name, total, prev); return; }

  var msg = [], kind = 'roll', mult = hasMod('doubleTrouble') ? 2 : 1, add;
  if (!danger) {
    if (total === 7) {
      add = hasMod('goldenSeven') ? 140 : 70; G.pot += add; kind = 'seven';
      msg.push(name + ' rolled 7 → +' + add + (hasMod('goldenSeven') ? ' golden' : ''));
    } else {
      add = total * mult; G.pot += add;
      msg.push(name + ': ' + total + ' → +' + add);
    }
  } else if (EFFECTS.doubledown) {
    EFFECTS.doubledown = false;
    if (isDbl || total % 2 === 0) { G.pot *= 2; kind = 'double'; msg.push('Double Down hit! Pot doubled'); }
    else { G.pot = Math.floor(G.pot / 2); kind = 'halve'; msg.push('Double Down backfired! Pot halved'); }
  } else if (G.mode === 'cutthroat' && (total === 2 || total === 12)) {
    G.pot = Math.floor(G.pot / 2); kind = 'halve';
    msg.push(name + ' rolled ' + total + '! Pot halved');
  } else if (isDbl) {
    var m = hasMod('hotHand') ? 3 : 2; G.pot *= m; kind = 'double';
    msg.push(name + ' doubles! Pot ×' + m);
  } else if (hasMod('copycat') && prevRoll != null && prevRoll === total) {
    G.pot *= 2; kind = 'double';
    msg.push('Copycat! ' + total + ' again → pot ×2');
  } else {
    add = total * mult; G.pot += add;
    msg.push(name + ': ' + total + ' → +' + add);
  }
  if (hasMod('highStakes') && (total === 10 || total === 11)) { G.pot += 50; msg.push('High Stakes +50'); }
  // Roller's Cut: 20% of what this roll added (it used to be 20% of the whole pot, compounding every roll)
  if (G.mode === 'rollerscut' && activeUnbanked().length === 1) {
    var gain = G.pot - prev;
    if (gain > 0) { var bonus = Math.max(1, Math.round(gain * 0.2)); G.pot += bonus; msg.push("Roller's Cut +" + bonus); }
  }
  if (G.pot > G.peakPot) G.peakPot = G.pot;

  var jump = G.pot - prev;
  var newHeat = computeHeat();
  if (kind === 'seven') { doFlash(hasMod('goldenSeven') ? 'rgba(255,210,63,.25)' : 'rgba(255,255,255,.15)'); potPulse(); SFX.safeSeven(hasMod('goldenSeven')); }
  else if (kind === 'double') {
    animatePot(prev, G.pot); SFX.doubles(newHeat);
    var mag = clamp(jump / 900, 0, 1);
    doFlash('rgba(255,255,255,' + (0.12 + mag * 0.2).toFixed(2) + ')');
    if (jump >= 120) potSlam(mag);
    if (jump >= 250 && !potHidden()) addMoment('double', name + ' doubled the pot to ' + fmt(G.pot), jump);
    if (jump >= 400) { spawnConfetti(30 + Math.round(mag * 40), false); buzz(30); }
  }
  else if (kind === 'halve') { animatePot(prev, G.pot); doFlash('rgba(255,100,0,.25)'); SFX.halve(); }
  else { animatePot(prev, G.pot); SFX.roll(heat); }

  showToast(msg.join(' · '));
  nextRoller();
  render();
}

function resolveBust(name, total, prev) {
  G.bustPot = prev;
  STATS[name].bustSevens++;
  var victims = activeUnbanked();
  var shares = {}, payouts = [];
  function pay(p, amt, why) { if (amt <= 0) return; p.score += amt; shares[p.name] = (shares[p.name] || 0) + amt; payouts.push({ name: p.name, amt: amt, why: why }); }

  // Bounty: everyone else still in splits the pot; if nobody else is in, the bounty-setter takes it
  var bounty = EFFECTS.bounty;
  if (bounty && victims.some(function(v) { return v.name === bounty.target; })) {
    var rec = victims.filter(function(v) { return v.name !== bounty.target; });
    if (!rec.length) { var by = findP(bounty.by); if (by) rec = [by]; }
    if (rec.length) { var share = Math.floor(prev / rec.length); rec.forEach(function(r) { pay(r, share, 'bounty'); }); }
  }
  // Insurance: half the pot to insured players still in
  EFFECTS.insurance.forEach(function(n) {
    var p = findP(n); if (p && !p.banked && !p.out) pay(p, Math.floor(prev / 2), 'insurance');
  });

  var lost = 0;
  victims.forEach(function(v) {
    var l = Math.max(0, prev - (shares[v.name] || 0));
    STATS[v.name].pointsLost += l;
    G.cumMiss[v.name] = (G.cumMiss[v.name] || 0) + l;
    lost += l;
  });

  // Last Man Standing: lives
  var lifeLost = [], elims = [], spared = [];
  if (G.mode === 'lms') {
    var alive = activePlayers();
    var dying = victims.filter(function(v) { return v.lives <= 1; });
    if (dying.length && dying.length === alive.length) {
      // Everyone left would go out: the highest score survives (ties all survive)
      var top = Math.max.apply(null, dying.map(function(v) { return v.score; }));
      spared = dying.filter(function(v) { return v.score === top; }).map(function(v) { return v.name; });
    }
    victims.forEach(function(v) {
      var before = v.lives;
      if (spared.indexOf(v.name) !== -1) { lifeLost.push({ name: v.name, before: before, after: before, spared: true }); return; }
      v.lives = Math.max(0, v.lives - 1);
      var out = v.lives === 0;
      if (out) { v.out = true; v.outRound = G.round; G.elimOrder.push(v.name); elims.push(v.name); }
      lifeLost.push({ name: v.name, before: before, after: v.lives, out: out });
    });
    var left = activePlayers();
    if (left.length === 1) G.winners = [left[0].name];
  }

  var biggest = lost >= 150 && lost > G.biggestBust && G.biggestBust > 0;
  var record = lost >= 300 && RECORDS.biggestBust > 0 && lost > RECORDS.biggestBust && lost > G.biggestBust;
  if (lost > G.biggestBust) G.biggestBust = lost;
  if (lost >= 150) addMoment('bust', name + ' rolled a ' + total + ' on a ' + fmt(prev) + ' pot. ' + fmt(lost) + ' points gone.', lost);

  G.result = { bust: true, pot: prev, roller: name, total: total, lost: lost, victims: victims.map(function(v) { return v.name; }), payouts: payouts, lifeLost: lifeLost, elims: elims, spared: spared, biggest: biggest, record: record };
  G.phase = 'roundEnd';

  var mag = clamp(prev / 800, 0, 1);
  SFX.bust(mag);
  buzz(mag > 0.4 ? [80, 40, 160] : 60);
  shakeScreen(mag);
  doFlash('rgba(255,51,0,' + (0.2 + mag * 0.2).toFixed(2) + ')');
  render();
  playBustSequence(G.result, showRoundEnd);
}

function nextRoller() {
  var n = G.players.length, tries = 0;
  do { G.roller = (G.roller + 1) % n; tries++; }
  while ((G.players[G.roller].banked || G.players[G.roller].out) && tries < n);
}

// ══ BANKING ══
// What a bank would pay right now (before the Tax card)
function previewBank(idx) {
  var amt = G.pot, notes = [];
  if (hasMod('firstIn') && !G.firstBankDone) { var b = Math.round(amt * 0.25); amt += b; notes.push('First In +' + b); }
  if (hasMod('finalStand') && activeUnbanked().length === 1 && activePlayers().length > 1) { amt += 100; notes.push('Final Stand +100'); }
  if (hasMod('taxman')) { var t = Math.floor(amt * 0.10); amt -= t; notes.push('Taxman −' + t); }
  return { amt: amt, notes: notes };
}
function bankPlayer(idx) {
  if (G.phase !== 'play') return;
  var p = G.players[idx]; if (!p || p.banked || p.out) return;
  if (EFFECTS.freeze === p.name) { showToast(p.name + ' is frozen and can’t bank!'); return; }
  if (bankLockedByMin()) { showToast('The pot needs ' + fmt(lmsMinBank()) + ' before anyone can bank'); return; }
  if (hasMod('lockdown') && idx !== G.roller) { showToast('Lockdown: only the roller can bank'); return; }
  pushSnap();
  var hidden = potHidden();
  var wasSolo = activeUnbanked().length === 1 && activePlayers().length > 1;
  var leaderBefore = leaderName();
  var hadScores = G.players.some(function(q) { return q.score > 0; });
  var pv = previewBank(idx), amt = pv.amt, notes = pv.notes.slice();
  if (EFFECTS.tax && EFFECTS.tax !== p.name) {
    var taxAmt = Math.floor(amt * 0.20), taxP = findP(EFFECTS.tax);
    if (taxP) { taxP.score += taxAmt; amt -= taxAmt; notes.push('taxed ' + taxAmt + ' → ' + EFFECTS.tax); }
    EFFECTS.tax = null;
  }
  G.firstBankDone = true;
  p.score += amt; p.banked = true; p.bankedAmt = amt;
  G.bankedThisRound.push({ name: p.name, amt: amt });
  STATS[p.name].banks.push(amt);
  if (wasSolo) STATS[p.name].lastStanding++;
  if (EFFECTS.bounty && EFFECTS.bounty.target === p.name) { notes.push('bounty fizzled'); EFFECTS.bounty = null; }

  showToast(p.name + ' banked' + (hidden ? '' : ' ' + fmt(amt)) + (notes.length && !hidden ? ' · ' + notes.join(' · ') : '') + '!');
  var big = clamp(amt / 600, 0, 1);
  spawnConfetti(40 + Math.round(big * 80), big > 0.5);
  SFX.bank(amt);
  if (amt >= 200 && !hidden) addMoment('bank', p.name + ' banked ' + fmt(amt) + ' in round ' + G.round, amt);
  if (!hidden) bankAnnouncements(p, amt, leaderBefore, hadScores);
  if (amt > G.bestBank) G.bestBank = amt;

  if (G.mode === 'race' && p.score >= G.raceTarget) {
    G.winners = [p.name]; G.winReason = 'race';
    G.phase = 'over';
    render();
    later(function() { endGame(); }, 1100);
    return;
  }
  if (idx === G.roller) nextRoller();
  if (activeUnbanked().length === 0) { roundClear(); return; }
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
  if (G.mode === 'lms' && activePlayers().length <= 1) { endGame(); return; }
  if (G.mode !== 'race' && G.mode !== 'lms' && G.round >= G.total) { endGame(); return; }
  G.players.forEach(function(p) { p.banked = false; p.bankedAmt = null; });
  G.pot = 0; G.rolls = 0; G.lastRoll = null; G.lastDice = null;
  G.bankedThisRound = []; G.bustPot = 0; G.result = null;
  G.firstBankDone = false; G.soloAnnounced = false; G.leaderAnnounced = false; G.heat = 0;
  G.round++;
  resetEffects();
  SFX.stopDrone(); SFX._state = 'none';
  var intro = [];
  if (G.mode === 'lms') {
    if (G.opts.lmsSuddenDeath && !G.suddenDeath && G.round > 10) {
      G.suddenDeath = true;
      activePlayers().forEach(function(p) { p.lives = 1; });
      intro.push('sudden');
    }
    if (activePlayers().length === 2 && !G.showdownShown) { G.showdownShown = true; intro.push('showdown'); }
  }
  // Next round starts with the player after whoever rolled last
  var n = G.players.length, tries = 0;
  do { G.roller = (G.roller + 1) % n; tries++; } while (G.players[G.roller].out && tries < n);
  G.roundStartLast = standingsLast();
  G.phase = 'play';
  maybeRoundDeal();
  if (G.mode === 'chaos') { rollMods(); intro.push('chaos'); }
  if (intro.length) { G.phase = 'reveal'; G.intro = intro; }
  render();
  if (G.phase === 'reveal') showRoundIntro();
}
function rollMods() {
  var count = G.opts.chaosCount === 2 ? 2 : 1;
  var keys = Object.keys(MODS).filter(function(k) { return G.prevMods.indexOf(k) === -1; });
  for (var i = keys.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = keys[i]; keys[i] = keys[j]; keys[j] = t; }
  var picked = [keys[0]];
  if (count === 2) { for (var k = 1; k < keys.length; k++) if (modsCompatible(picked[0], keys[k])) { picked.push(keys[k]); break; } }
  G.prevMods = picked.slice();
  G.mods = picked;
}
function endGame() {
  clearOverlays();
  if (!G.winners || !G.winners.length) {
    if (G.mode === 'lms') {
      var left = activePlayers();
      var pool = left.length ? left : G.players;
      var bestL = Math.max.apply(null, pool.map(function(p) { return p.lives; }));
      pool = pool.filter(function(p) { return p.lives === bestL; });
      var bestS = Math.max.apply(null, pool.map(function(p) { return p.score; }));
      G.winners = pool.filter(function(p) { return p.score === bestS; }).map(function(p) { return p.name; });
    } else {
      var top = Math.max.apply(null, G.players.map(function(p) { return p.score; }));
      G.winners = G.players.filter(function(p) { return p.score === top; }).map(function(p) { return p.name; });
    }
  }
  G.phase = 'over';
  commitRecords();
  saveGame();
  showEndScreen();
}
