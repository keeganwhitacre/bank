// ══════════════════════════════════════════════════════════════
//  RULES — every scoring and turn rule in the game, with no DOM and
//  no globals. Functions take the game state `g` (and the Sabotage
//  card effects `fx`) explicitly, change them, and return what happened
//  so the UI layer can animate it. Runs in the browser and in Node:
//    node --test tests/
// ══════════════════════════════════════════════════════════════
var Rules = (function() {

  var HOUSE_DEFAULTS = { safeRolls: 3, safe7: 70, doublesMult: 2 };
  var LMS_DEFAULTS = { lmsLives: 3, lmsMinBank: 100, lmsSuddenDeath: true, lmsSuddenRound: 10 };

  var MODS = {
    noMercy:       { name: 'No Mercy',       icon: 'skull',  tag: 'danger', short: 'No safe rolls',        desc: 'No safe rolls this round. A 7 busts from the very first roll.', weight: 2 },
    doubleTrouble: { name: 'Double Trouble', icon: 'dice',   tag: 'gold',   short: 'Rolls add ×2',    desc: 'Normal rolls add double their value. Doubles still double the pot.' },
    goldenSeven:   { name: 'Golden Seven',   icon: 'star',   tag: 'gold',   short: 'Safe 7 ×2',       desc: 'A 7 during the safe rolls is worth double.' },
    lockdown:      { name: 'Lockdown',       icon: 'lock',   tag: 'danger', short: 'Bank on your turn',    desc: 'You can only bank when it’s your turn to roll. The Bank button banks the roller.', weight: 2 },
    snakeEyes:     { name: 'Snake Eyes',     icon: 'snake',  tag: 'danger', short: '2 or 12 also bust',     desc: 'After the safe rolls, a 2 or a 12 busts the round just like a 7.', weight: 1.5 },
    highStakes:    { name: 'High Stakes',    icon: 'trend',  tag: 'gold',   short: '10 or 11 = +50',       desc: 'Any roll that totals 10 or 11 adds a 50-point bonus to the pot.' },
    finalStand:    { name: 'Final Stand',    icon: 'target', tag: 'gold',   short: 'Last one in +25%',     desc: 'The last player still in gets 25% extra when they bank.' },
    taxman:        { name: 'Taxman',         icon: 'coins',  tag: 'danger', short: 'Banks lose 10%',       desc: 'Every bank this round loses 10% off the top.' },
    hotHand:       { name: 'Hot Hand',       icon: 'flame',  tag: 'gold',   short: 'Doubles ×3',      desc: 'Doubles triple the pot instead of doubling it.', weight: 2 },
    shortFuse:     { name: 'Short Fuse',     icon: 'fuse',   tag: 'danger', short: '1 safe roll',          desc: 'Only the first roll is safe. A 7 busts from roll 2.', weight: 1.5 },
    firstIn:       { name: 'First In',       icon: 'flag',   tag: 'gold',   short: 'First bank +25%',      desc: 'The first player to bank this round gets 25% extra.' },
    blind:         { name: 'Blind Round',    icon: 'eyeOff', tag: 'danger', short: 'Pot hidden',           desc: 'The pot goes dark after the safe rolls. Keep count in your heads.', weight: 2 },
    copycat:       { name: 'Copycat',        icon: 'copy',   tag: 'gold',   short: 'Repeat a roll = ×2', desc: 'After the safe rolls, rolling the same total as the roll before doubles the pot.', weight: 1.5 }
  };
  // Pairs that would cancel out or make each other pointless
  var MOD_CONFLICTS = [['noMercy', 'shortFuse'], ['noMercy', 'goldenSeven']];

  // ── State ──
  function newGame(names, mode, opts, raceTarget, rounds) {
    opts = opts || {};
    var house = {}, k;
    for (k in HOUSE_DEFAULTS) house[k] = (opts.house && opts.house[k] != null) ? opts.house[k] : HOUSE_DEFAULTS[k];
    var o = JSON.parse(JSON.stringify(opts)); o.house = house;
    for (k in LMS_DEFAULTS) if (o[k] == null) o[k] = LMS_DEFAULTS[k];
    var g = {
      mode: mode || 'standard', opts: o, raceTarget: raceTarget || 1500,
      players: [], roller: 0, pot: 0, rolls: 0, round: 1, total: rounds || 10,
      bankedThisRound: [], bustPot: 0, cumMiss: {},
      phase: 'idle', result: null, intro: null, mods: [], prevMods: [],
      lastRoll: null, lastDice: null,
      firstBankDone: false, soloAnnounced: false, leaderAnnounced: false,
      showdownShown: (names || []).length <= 2, suddenDeath: false,
      roundStartLast: null, heat: 0, bestBank: 0, biggestBust: 0, peakPot: 0,
      moments: [], elimOrder: [], winners: [], winReason: '', recordsCommitted: false,
      startedAt: Date.now(), updatedAt: Date.now()
    };
    (names || []).forEach(function(n) { addPlayer(g, n); });
    return g;
  }
  function addPlayer(g, name, opt) {
    opt = opt || {};
    var lives = g.mode === 'lms' ? (opt.lives != null ? opt.lives : g.opts.lmsLives) : 0;
    g.players.push({ name: name, score: opt.score || 0, banked: false, bankedAmt: null, lives: lives, out: false, outRound: 0 });
    g.cumMiss[name] = 0;
  }
  function blankEffects() { return { insurance: [], doubledown: false, freeze: null, tax: null, bounty: null }; }

  // ── Queries ──
  function house(g) { return (g.opts && g.opts.house) || HOUSE_DEFAULTS; }
  function hasMod(g, id) { return g.mode === 'chaos' && g.mods.indexOf(id) !== -1; }
  function safeRollCount(g) {
    var n = house(g).safeRolls;
    if (g.mode === 'turbo' || hasMod(g, 'noMercy')) return 0;
    if (hasMod(g, 'shortFuse')) return Math.min(1, n);
    return n;
  }
  function nextRollDanger(g) { return g.rolls >= safeRollCount(g); }
  function potHidden(g) { return (g.mode === 'blackout' || hasMod(g, 'blind')) && g.phase === 'play' && g.rolls >= safeRollCount(g) && g.rolls > 0; }
  function activePlayers(g) { return g.players.filter(function(p) { return !p.out; }); }
  function activeUnbanked(g) { return g.players.filter(function(p) { return !p.out && !p.banked; }); }
  function findP(g, name) { for (var i = 0; i < g.players.length; i++) if (g.players[i].name === name) return g.players[i]; return null; }
  function lmsMinBank(g) {
    var base = g.opts.lmsMinBank || 100, sr = g.opts.lmsSuddenRound || 10;
    return g.suddenDeath ? base + 100 * Math.max(1, g.round - sr) : base;
  }
  function bankLockedByMin(g) { return g.mode === 'lms' && g.pot < lmsMinBank(g); }
  function safeSevenValue(g) { return house(g).safe7 * (hasMod(g, 'goldenSeven') ? 2 : 1); }
  // Doubles need an exact total when a rule cares which doubles it was
  function needsDoublesTotal(g) { return g.mode === 'cutthroat' || hasMod(g, 'snakeEyes') || hasMod(g, 'highStakes') || hasMod(g, 'copycat'); }
  function isBustTotal(g, total) { return total === 7 || ((total === 2 || total === 12) && hasMod(g, 'snakeEyes')); }
  function leaderName(g) {
    var best = null, bestS = -1, tie = false;
    activePlayers(g).forEach(function(p) { if (p.score > bestS) { bestS = p.score; best = p.name; tie = false; } else if (p.score === bestS) tie = true; });
    return (tie || bestS <= 0) ? null : best;
  }
  function roundLimited(g) { return g.mode !== 'race' && g.mode !== 'lms'; }

  // ── Turn order ──
  function nextRoller(g) {
    var n = g.players.length, tries = 0;
    do { g.roller = (g.roller + 1) % n; tries++; }
    while ((g.players[g.roller].banked || g.players[g.roller].out) && tries < n);
  }

  // ── Rolling ──
  // roll = { total, isDbl, dice, name }. total may be null for "doubles, value not needed".
  function applyRoll(g, fx, roll) {
    var total = roll.total, isDbl = !!roll.isDbl, name = roll.name || '';
    var prev = g.pot, prevRoll = g.lastRoll;
    g.rolls++;
    g.lastRoll = total; g.lastDice = roll.dice || null;
    var danger = g.rolls > safeRollCount(g);
    var out = { prev: prev, danger: danger, kind: 'roll', msgs: [], bust: false, jump: 0 };
    if (danger && total != null && isBustTotal(g, total)) { out.bust = true; out.kind = 'bust'; return out; }

    var mult = hasMod(g, 'doubleTrouble') ? 2 : 1, add;
    if (!danger) {
      if (total === 7) {
        add = safeSevenValue(g); g.pot += add; out.kind = 'seven';
        out.msgs.push(name + ' rolled 7 → +' + add + (hasMod(g, 'goldenSeven') ? ' golden' : ''));
      } else {
        add = (total || 0) * mult; g.pot += add;
        out.msgs.push(name + ': ' + total + ' → +' + add);
      }
    } else if (fx && fx.doubledown) {
      fx.doubledown = false;
      if (isDbl || total % 2 === 0) { g.pot *= 2; out.kind = 'double'; out.msgs.push('Double Down hit! Pot doubled'); }
      else { g.pot = Math.floor(g.pot / 2); out.kind = 'halve'; out.msgs.push('Double Down backfired! Pot halved'); }
    } else if (g.mode === 'cutthroat' && (total === 2 || total === 12)) {
      g.pot = Math.floor(g.pot / 2); out.kind = 'halve';
      out.msgs.push(name + ' rolled ' + total + '! Pot halved');
    } else if (isDbl) {
      var m = hasMod(g, 'hotHand') ? 3 : house(g).doublesMult; g.pot *= m; out.kind = 'double';
      out.msgs.push(name + ' doubles! Pot ×' + m);
    } else if (hasMod(g, 'copycat') && prevRoll != null && prevRoll === total) {
      g.pot *= 2; out.kind = 'double';
      out.msgs.push('Copycat! ' + total + ' again → pot ×2');
    } else {
      add = total * mult; g.pot += add;
      out.msgs.push(name + ': ' + total + ' → +' + add);
    }
    if (hasMod(g, 'highStakes') && (total === 10 || total === 11)) { g.pot += 50; out.msgs.push('High Stakes +50'); }
    // Roller's Cut: 20% of what this roll added
    if (g.mode === 'rollerscut' && activeUnbanked(g).length === 1) {
      var gain = g.pot - prev;
      if (gain > 0) { var bonus = Math.max(1, Math.round(gain * 0.2)); g.pot += bonus; out.msgs.push("Roller's Cut +" + bonus); }
    }
    if (g.pot > g.peakPot) g.peakPot = g.pot;
    out.jump = g.pot - prev;
    return out;
  }

  // ── Busting ──
  // Pays insurance/bounty, takes LMS lives. Returns the round result.
  function applyBust(g, fx, rollerName, total, prev) {
    fx = fx || blankEffects();
    g.bustPot = prev;
    var victims = activeUnbanked(g);
    var shares = {}, payouts = [];
    function pay(p, amt, why) { if (amt <= 0) return; p.score += amt; shares[p.name] = (shares[p.name] || 0) + amt; payouts.push({ name: p.name, amt: amt, why: why }); }

    // Bounty: everyone else still in splits the pot; if nobody else is in, the bounty-setter takes it
    var bounty = fx.bounty;
    if (bounty && victims.some(function(v) { return v.name === bounty.target; })) {
      var rec = victims.filter(function(v) { return v.name !== bounty.target; });
      if (!rec.length) { var by = findP(g, bounty.by); if (by) rec = [by]; }
      if (rec.length) { var share = Math.floor(prev / rec.length); rec.forEach(function(r) { pay(r, share, 'bounty'); }); }
    }
    // Insurance: half the pot to insured players still in
    fx.insurance.forEach(function(n) { var p = findP(g, n); if (p && !p.banked && !p.out) pay(p, Math.floor(prev / 2), 'insurance'); });

    var lost = 0, lostBy = {};
    victims.forEach(function(v) {
      var l = Math.max(0, prev - (shares[v.name] || 0));
      lostBy[v.name] = l; lost += l;
      g.cumMiss[v.name] = (g.cumMiss[v.name] || 0) + l;
    });

    var lifeLost = [], elims = [], spared = [];
    if (g.mode === 'lms') {
      var alive = activePlayers(g);
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
        var isOut = v.lives === 0;
        if (isOut) { v.out = true; v.outRound = g.round; g.elimOrder.push(v.name); elims.push(v.name); }
        lifeLost.push({ name: v.name, before: before, after: v.lives, out: isOut });
      });
      var left = activePlayers(g);
      if (left.length === 1) g.winners = [left[0].name];
    }
    return { bust: true, pot: prev, roller: rollerName, total: total, lost: lost, lostBy: lostBy,
             victims: victims.map(function(v) { return v.name; }), payouts: payouts, lifeLost: lifeLost, elims: elims, spared: spared };
  }

  // ── Banking ──
  function canBank(g, fx, idx) {
    var p = g.players[idx];
    if (!p || p.banked || p.out) return 'not in';
    if (fx && fx.freeze === p.name) return 'frozen';
    if (bankLockedByMin(g)) return 'min';
    if (hasMod(g, 'lockdown') && idx !== g.roller) return 'lockdown';
    return '';
  }
  // What a bank would pay right now (before the Tax card)
  function previewBank(g, idx) {
    var amt = g.pot, notes = [];
    if (hasMod(g, 'firstIn') && !g.firstBankDone) { var b = Math.round(amt * 0.25); amt += b; notes.push('First In +' + b); }
    if (hasMod(g, 'finalStand') && activeUnbanked(g).length === 1 && activePlayers(g).length > 1) { var fs = Math.round(g.pot * 0.25); amt += fs; notes.push('Final Stand +' + fs); }
    if (hasMod(g, 'taxman')) { var t = Math.floor(amt * 0.10); amt -= t; notes.push('Taxman −' + t); }
    return { amt: amt, notes: notes };
  }
  function applyBank(g, fx, idx) {
    var why = canBank(g, fx, idx);
    if (why) return { ok: false, reason: why };
    var p = g.players[idx];
    var wasSolo = activeUnbanked(g).length === 1 && activePlayers(g).length > 1;
    var pv = previewBank(g, idx), amt = pv.amt, notes = pv.notes.slice();
    if (fx && fx.tax && fx.tax !== p.name) {
      var taxAmt = Math.floor(amt * 0.20), taxP = findP(g, fx.tax);
      if (taxP) { taxP.score += taxAmt; amt -= taxAmt; notes.push('taxed ' + taxAmt + ' → ' + fx.tax); }
      fx.tax = null;
    }
    g.firstBankDone = true;
    p.score += amt; p.banked = true; p.bankedAmt = amt;
    g.bankedThisRound.push({ name: p.name, amt: amt });
    if (fx && fx.bounty && fx.bounty.target === p.name) { notes.push('bounty fizzled'); fx.bounty = null; }
    var raceWin = g.mode === 'race' && p.score >= g.raceTarget;
    if (raceWin) { g.winners = [p.name]; g.winReason = 'race'; }
    if (!raceWin && idx === g.roller) nextRoller(g);
    return { ok: true, amt: amt, notes: notes, wasSolo: wasSolo, raceWin: raceWin, roundOver: !raceWin && activeUnbanked(g).length === 0 };
  }

  // ── Rounds ──
  function isGameOverAtRoundEnd(g) {
    if (g.mode === 'lms') return activePlayers(g).length <= 1;
    return roundLimited(g) && g.round >= g.total;
  }
  // Resets for the next round; returns which intros to show
  function startNextRound(g, rng) {
    g.players.forEach(function(p) { p.banked = false; p.bankedAmt = null; });
    g.pot = 0; g.rolls = 0; g.lastRoll = null; g.lastDice = null;
    g.bankedThisRound = []; g.bustPot = 0; g.result = null;
    g.firstBankDone = false; g.soloAnnounced = false; g.leaderAnnounced = false; g.heat = 0;
    g.round++;
    var intro = [];
    if (g.mode === 'lms') {
      if (g.opts.lmsSuddenDeath && !g.suddenDeath && g.round > (g.opts.lmsSuddenRound || 10)) {
        g.suddenDeath = true;
        activePlayers(g).forEach(function(p) { p.lives = 1; });
        intro.push('sudden');
      }
      if (activePlayers(g).length === 2 && !g.showdownShown) { g.showdownShown = true; intro.push('showdown'); }
    }
    // Next round starts with the player after whoever rolled last
    var n = g.players.length, tries = 0;
    do { g.roller = (g.roller + 1) % n; tries++; } while (g.players[g.roller].out && tries < n);
    if (g.mode === 'chaos') { pickMods(g, rng); intro.push('chaos'); }
    return intro;
  }
  function decideWinners(g) {
    if (g.winners && g.winners.length) return g.winners;
    var pool;
    if (g.mode === 'lms') {
      pool = activePlayers(g); if (!pool.length) pool = g.players.slice();
      var bestL = Math.max.apply(null, pool.map(function(p) { return p.lives; }));
      pool = pool.filter(function(p) { return p.lives === bestL; });
    } else pool = g.players.slice();
    var top = Math.max.apply(null, pool.map(function(p) { return p.score; }));
    g.winners = pool.filter(function(p) { return p.score === top; }).map(function(p) { return p.name; });
    return g.winners;
  }

  // ── Chaos ──
  function modsCompatible(a, b) {
    if (a === b) return false;
    return !MOD_CONFLICTS.some(function(c) { return (c[0] === a && c[1] === b) || (c[0] === b && c[1] === a); });
  }
  function modPool(g) {
    var pool = g.opts.chaosPool && g.opts.chaosPool.length ? g.opts.chaosPool : Object.keys(MODS);
    return pool.filter(function(k) { return MODS[k]; });
  }
  function pickMods(g, rng) {
    rng = rng || Math.random;
    var count = g.opts.chaosCount === 2 ? 2 : 1;
    var all = modPool(g);
    var keys = all.filter(function(k) { return g.prevMods.indexOf(k) === -1; });
    if (!keys.length) keys = all.slice();             // tiny pools may have to repeat
    var score = {};
    keys.forEach(function(k) { score[k] = Math.pow(rng(), 1 / (MODS[k].weight || 1)); });
    keys.sort(function(a, b) { return score[b] - score[a]; });
    var picked = keys.length ? [keys[0]] : [];
    if (count === 2) {
      var rest = keys.slice(1).concat(all.filter(function(k) { return keys.indexOf(k) === -1; }));
      for (var k = 0; k < rest.length; k++) if (modsCompatible(picked[0], rest[k])) { picked.push(rest[k]); break; }
    }
    g.prevMods = picked.slice();
    g.mods = picked;
    return picked;
  }

  // ── Roster changes mid-game ──
  function removePlayer(g, fx, name) {
    var idx = -1; g.players.forEach(function(p, i) { if (p.name === name) idx = i; });
    if (idx < 0 || g.players.length <= 2) return false;
    var wasRoller = idx === g.roller;
    g.players.splice(idx, 1);
    if (g.roller > idx) g.roller--;
    if (g.roller >= g.players.length) g.roller = 0;
    if (wasRoller && (g.players[g.roller].banked || g.players[g.roller].out)) { g.roller = (g.roller - 1 + g.players.length) % g.players.length; nextRoller(g); }
    if (fx) {
      fx.insurance = fx.insurance.filter(function(n) { return n !== name; });
      if (fx.freeze === name) fx.freeze = null;
      if (fx.tax === name) fx.tax = null;
      if (fx.bounty && (fx.bounty.target === name || fx.bounty.by === name)) fx.bounty = null;
    }
    g.bankedThisRound = g.bankedThisRound.filter(function(b) { return b.name !== name; });
    return true;
  }

  return {
    HOUSE_DEFAULTS: HOUSE_DEFAULTS, MODS: MODS, MOD_CONFLICTS: MOD_CONFLICTS,
    newGame: newGame, addPlayer: addPlayer, removePlayer: removePlayer, blankEffects: blankEffects,
    hasMod: hasMod, safeRollCount: safeRollCount, nextRollDanger: nextRollDanger, potHidden: potHidden,
    activePlayers: activePlayers, activeUnbanked: activeUnbanked, findP: findP,
    lmsMinBank: lmsMinBank, bankLockedByMin: bankLockedByMin, safeSevenValue: safeSevenValue,
    needsDoublesTotal: needsDoublesTotal, isBustTotal: isBustTotal, leaderName: leaderName, roundLimited: roundLimited,
    nextRoller: nextRoller, applyRoll: applyRoll, applyBust: applyBust,
    canBank: canBank, previewBank: previewBank, applyBank: applyBank,
    isGameOverAtRoundEnd: isGameOverAtRoundEnd, startNextRound: startNextRound, decideWinners: decideWinners,
    modsCompatible: modsCompatible, modPool: modPool, pickMods: pickMods
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Rules;
