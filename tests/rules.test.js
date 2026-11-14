// Rules tests. Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');

const NAMES = ['Ana', 'Ben', 'Cal'];
function game(mode = 'standard', opts = {}, names = NAMES) {
  const g = R.newGame(names, mode, opts, 1500, 10);
  g.phase = 'play';
  return { g, fx: R.blankEffects() };
}
// Roll a list of plain totals (non-doubles) for whoever's turn it is
function rolls(g, fx, totals) { totals.forEach(t => { R.applyRoll(g, fx, { total: t }); R.nextRoller(g); }); }
function dbl(g, fx, total = null) { const r = R.applyRoll(g, fx, { total, isDbl: true }); R.nextRoller(g); return r; }
function chaos(mods, opts = {}, names) { const s = game('chaos', opts, names); s.g.mods = mods; return s; }

test('standard: three safe rolls, then 7 busts', () => {
  const { g, fx } = game();
  rolls(g, fx, [5, 7, 9]);
  assert.equal(g.pot, 5 + 70 + 9);
  const r = R.applyRoll(g, fx, { total: 7 });
  assert.equal(r.bust, true);
});
test('standard: doubles add face value when safe, double the pot when not', () => {
  const { g, fx } = game();
  R.applyRoll(g, fx, { total: 8, isDbl: true });
  assert.equal(g.pot, 8);
  rolls(g, fx, [6, 6]);
  dbl(g, fx);
  assert.equal(g.pot, 40);
});
test('house rules: safe roll count, safe 7 value and doubles multiplier', () => {
  const { g, fx } = game('standard', { house: { safeRolls: 1, safe7: 100, doublesMult: 3 } });
  R.applyRoll(g, fx, { total: 7 });
  assert.equal(g.pot, 100);
  dbl(g, fx);
  assert.equal(g.pot, 300);
  assert.equal(R.applyRoll(g, fx, { total: 7 }).bust, true);
});
test('house rules fill in missing values with defaults', () => {
  const { g } = game('standard', { house: { safeRolls: 2 } });
  assert.deepEqual(g.opts.house, { safeRolls: 2, safe7: 70, doublesMult: 2 });
});
test('turbo: 7 busts on the first roll', () => {
  const { g, fx } = game('turbo');
  assert.equal(R.applyRoll(g, fx, { total: 7 }).bust, true);
});
test('cutthroat: 2 and 12 halve the pot from roll 4, even as doubles', () => {
  const { g, fx } = game('cutthroat');
  rolls(g, fx, [10, 10, 10]);
  R.applyRoll(g, fx, { total: 12, isDbl: true });
  assert.equal(g.pot, 15);
});
test("roller's cut: 20% of what the roll added, only when one player is left", () => {
  const { g, fx } = game('rollerscut', {}, ['Ana', 'Ben']);
  rolls(g, fx, [10, 10, 10]);
  R.applyRoll(g, fx, { total: 5 });       // two players in: no bonus
  assert.equal(g.pot, 35);
  g.players[1].banked = true; g.roller = 0;
  R.applyRoll(g, fx, { total: 10 });
  assert.equal(g.pot, 35 + 10 + 2);
  R.applyRoll(g, fx, { total: null, isDbl: true });
  assert.equal(g.pot, 47 * 2 + Math.round(47 * 0.2));
});
test('double down: even doubles, odd halves, then it is used up', () => {
  const { g, fx } = game('sabotage');
  rolls(g, fx, [10, 10, 10]);
  fx.doubledown = true;
  R.applyRoll(g, fx, { total: 8 });
  assert.equal(g.pot, 60);
  assert.equal(fx.doubledown, false);
  fx.doubledown = true;
  R.applyRoll(g, fx, { total: 9 });
  assert.equal(g.pot, 30);
});

// ── Chaos rules ──
test('chaos: No Mercy busts on roll 1; Short Fuse busts on roll 2', () => {
  let s = chaos(['noMercy']);
  assert.equal(R.applyRoll(s.g, s.fx, { total: 7 }).bust, true);
  s = chaos(['shortFuse']);
  assert.equal(R.applyRoll(s.g, s.fx, { total: 7 }).bust, false);
  assert.equal(R.applyRoll(s.g, s.fx, { total: 7 }).bust, true);
});
test('chaos: Short Fuse never gives more safe rolls than the house rule', () => {
  const { g } = chaos(['shortFuse'], { house: { safeRolls: 0 } });
  assert.equal(R.safeRollCount(g), 0);
});
test('chaos: Double Trouble doubles normal rolls; Golden Seven doubles the safe 7', () => {
  const { g, fx } = chaos(['doubleTrouble', 'goldenSeven'], { house: { safe7: 70 } });
  R.applyRoll(g, fx, { total: 5 });
  R.applyRoll(g, fx, { total: 7 });
  assert.equal(g.pot, 10 + 140);
});
test('chaos: Snake Eyes busts on a 2 or 12 only after the safe rolls', () => {
  const { g, fx } = chaos(['snakeEyes']);
  assert.equal(R.applyRoll(g, fx, { total: 2, isDbl: true }).bust, false);
  assert.equal(R.applyRoll(g, fx, { total: 12, isDbl: true }).bust, false);
  rolls(g, fx, [6]);
  assert.equal(R.applyRoll(g, fx, { total: 12, isDbl: true }).bust, true);
  assert.equal(R.applyRoll(g, fx, { total: 2, isDbl: true }).bust, true);
});
test('chaos: weighted picks favour game-changers but never exclude a rule', () => {
  const g = R.newGame(['A', 'B'], 'chaos', {});
  const n = {}; let x = 7;
  const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  for (let i = 0; i < 4000; i++) { g.prevMods = []; const k = R.pickMods(g, rng)[0]; n[k] = (n[k] || 0) + 1; }
  assert.equal(Object.keys(n).length, Object.keys(R.MODS).length);
  assert.ok(n.noMercy > n.doubleTrouble * 1.4, JSON.stringify(n));
});
test('chaos: High Stakes adds 50 on 10 or 11, including doubles', () => {
  const { g, fx } = chaos(['highStakes']);
  R.applyRoll(g, fx, { total: 11 });
  assert.equal(g.pot, 61);
  rolls(g, fx, [3, 3]);
  R.applyRoll(g, fx, { total: 10, isDbl: true });
  assert.equal(g.pot, 67 * 2 + 50);
});
test('chaos: Hot Hand triples on doubles', () => {
  const { g, fx } = chaos(['hotHand']);
  rolls(g, fx, [10, 10, 10]);
  dbl(g, fx);
  assert.equal(g.pot, 90);
});
test('chaos: Copycat doubles on a repeated total after the safe rolls', () => {
  const { g, fx } = chaos(['copycat']);
  rolls(g, fx, [8, 8, 9]);                 // repeats during safe rolls just add
  assert.equal(g.pot, 25);
  R.applyRoll(g, fx, { total: 9 });
  assert.equal(g.pot, 50);
});
test('chaos: First In then Taxman, applied in that order', () => {
  const { g, fx } = chaos(['firstIn', 'taxman']);
  rolls(g, fx, [10, 10, 10, 10]);
  const first = R.applyBank(g, fx, 0);
  assert.equal(first.amt, 50 - 5);         // 40 +25% = 50, minus 10% = 45
  const second = R.applyBank(g, fx, 1);
  assert.equal(second.amt, 36);            // no First In for the second bank
});
test('chaos: Final Stand pays the last player in', () => {
  const { g, fx } = chaos(['finalStand']);
  rolls(g, fx, [10, 10, 10]);
  R.applyBank(g, fx, 0); R.applyBank(g, fx, 1);
  assert.equal(R.applyBank(g, fx, 2).amt, 30 + 8);   // +25% of 30, rounded
});
test('chaos: Lockdown only lets the roller bank', () => {
  const { g, fx } = chaos(['lockdown']);
  rolls(g, fx, [10, 10, 10]);
  const notRoller = (g.roller + 1) % 3;
  assert.equal(R.applyBank(g, fx, notRoller).reason, 'lockdown');
  assert.equal(R.applyBank(g, fx, g.roller).ok, true);
});
test('chaos: Blind Round hides the pot after the safe rolls', () => {
  const { g, fx } = chaos(['blind']);
  rolls(g, fx, [5, 5]);
  assert.equal(R.potHidden(g), false);
  rolls(g, fx, [5]);
  assert.equal(R.potHidden(g), true);
});
test('chaos: picking respects count, conflicts, the pool and no back-to-back repeats', () => {
  let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const { g } = chaos([], { chaosCount: 2 });
  for (let i = 0; i < 300; i++) {
    const before = g.mods.slice();
    const picked = R.pickMods(g, rng);
    assert.equal(picked.length, 2);
    assert.ok(R.modsCompatible(picked[0], picked[1]), picked.join('+'));
    assert.ok(!before.includes(picked[0]), 'first rule repeated');
  }
  const p = chaos([], { chaosCount: 1, chaosPool: ['taxman', 'hotHand'] }).g;
  for (let i = 0; i < 20; i++) assert.ok(['taxman', 'hotHand'].includes(R.pickMods(p, rng)[0]));
  const one = chaos([], { chaosPool: ['taxman'] }).g;
  assert.deepEqual(R.pickMods(one, rng), ['taxman']);   // a 1-rule pool repeats rather than breaking
  assert.deepEqual(R.pickMods(one, rng), ['taxman']);
});

// ── Sabotage cards ──
test('sabotage: Tax skims 20% of the next bank, then is used up', () => {
  const { g, fx } = game('sabotage');
  rolls(g, fx, [10, 10, 10, 10]);
  fx.tax = 'Cal';
  assert.equal(R.applyBank(g, fx, 0).amt, 32);
  assert.equal(g.players[2].score, 8);
  assert.equal(fx.tax, null);
  assert.equal(R.applyBank(g, fx, 1).amt, 40);
});
test('sabotage: Insurance pays half; Bounty splits among others still in', () => {
  const { g, fx } = game('sabotage');
  rolls(g, fx, [10, 10, 10, 10]);
  fx.insurance = ['Ben']; fx.bounty = { by: 'Cal', target: 'Ana' };
  const res = R.applyBust(g, fx, 'Ana', 7, 40);
  assert.deepEqual(g.players.map(p => p.score), [0, 40, 20]);
  assert.equal(res.lostBy.Ana, 40);
  assert.equal(res.lostBy.Ben, 0);
});
test('sabotage: Bounty pays the setter when the target is the only one in', () => {
  const { g, fx } = game('sabotage');
  rolls(g, fx, [10, 10, 10, 10]);
  R.applyBank(g, fx, 1); R.applyBank(g, fx, 2);
  fx.bounty = { by: 'Cal', target: 'Ana' };
  R.applyBust(g, fx, 'Ana', 7, 40);
  assert.equal(g.players[2].score, 80);
});
test('sabotage: frozen players cannot bank', () => {
  const { g, fx } = game('sabotage');
  fx.freeze = 'Ben';
  assert.equal(R.applyBank(g, fx, 1).reason, 'frozen');
});

// ── Last Man Standing ──
test('lms: banking is locked below the minimum', () => {
  const { g, fx } = game('lms', { lmsMinBank: 100 });
  rolls(g, fx, [10, 10]);
  assert.equal(R.applyBank(g, fx, 0).reason, 'min');
  g.pot = 100;
  assert.equal(R.applyBank(g, fx, 0).ok, true);
});
test('lms: a bust costs everyone still in a life and knocks out players at zero', () => {
  const { g, fx } = game('lms', { lmsLives: 2 });
  g.players[1].lives = 1;
  g.pot = 120; R.applyBank(g, fx, 2);
  const res = R.applyBust(g, fx, 'Ana', 7, 120);
  assert.deepEqual(g.players.map(p => [p.lives, p.out]), [[1, false], [0, true], [2, false]]);
  assert.deepEqual(res.elims, ['Ben']);
  assert.deepEqual(g.elimOrder, ['Ben']);
});
test('lms: if a bust would knock everyone out, the top score survives and wins', () => {
  const { g, fx } = game('lms', {}, ['Ana', 'Ben']);
  g.players.forEach(p => { p.lives = 1; });
  g.players[0].score = 300; g.players[1].score = 100;
  const res = R.applyBust(g, fx, 'Ben', 7, 50);
  assert.deepEqual(res.spared, ['Ana']);
  assert.deepEqual(g.winners, ['Ana']);
  assert.equal(R.isGameOverAtRoundEnd(g), true);
});
test('lms: sudden death after round 10 drops everyone to one life and raises the minimum', () => {
  const { g } = game('lms', { lmsMinBank: 100, lmsSuddenDeath: true });
  g.round = 10;
  const intro = R.startNextRound(g);
  assert.ok(intro.includes('sudden'));
  assert.deepEqual(g.players.map(p => p.lives), [1, 1, 1]);
  assert.equal(R.lmsMinBank(g), 200);
  R.startNextRound(g);
  assert.equal(R.lmsMinBank(g), 300);
});
test('lms: final-two showdown intro fires once', () => {
  const { g } = game('lms');
  g.players[2].out = true;
  assert.ok(R.startNextRound(g).includes('showdown'));
  assert.ok(!R.startNextRound(g).includes('showdown'));
});
test('lms: starting lives come from options', () => {
  const { g } = game('lms', { lmsLives: 5 });
  assert.deepEqual(g.players.map(p => p.lives), [5, 5, 5]);
});

// ── Flow ──
test('race: banking past the target wins and stops the turn', () => {
  const { g, fx } = game('race');
  g.players[0].score = 1490; rolls(g, fx, [10, 10]);
  const r = R.applyBank(g, fx, 0);
  assert.equal(r.raceWin, true);
  assert.deepEqual(g.winners, ['Ana']);
  assert.equal(R.isGameOverAtRoundEnd(g), false);   // race never ends on rounds
});
test('rounds: next round resets state and starts after the last roller', () => {
  const { g, fx } = game();
  rolls(g, fx, [5, 6]); R.applyBank(g, fx, 0);
  const last = g.roller;
  R.startNextRound(g);
  assert.equal(g.round, 2); assert.equal(g.pot, 0); assert.equal(g.rolls, 0);
  assert.ok(g.players.every(p => !p.banked));
  assert.equal(g.roller, (last + 1) % 3);
});
test('turn order skips banked and eliminated players', () => {
  const { g } = game('lms', {}, ['Ana', 'Ben', 'Cal', 'Dee']);
  g.players[1].banked = true; g.players[2].out = true; g.roller = 0;
  R.nextRoller(g);
  assert.equal(g.roller, 3);
});
test('winners: top score wins; ties are shared', () => {
  const { g } = game();
  g.players[0].score = 200; g.players[1].score = 200; g.players[2].score = 50;
  assert.deepEqual(R.decideWinners(g), ['Ana', 'Ben']);
});
test('leader: null on a tie or when nobody has scored', () => {
  const { g } = game();
  assert.equal(R.leaderName(g), null);
  g.players[1].score = 10;
  assert.equal(R.leaderName(g), 'Ben');
  g.players[2].score = 10;
  assert.equal(R.leaderName(g), null);
});

// ── Roster changes ──
test('removing a player keeps the turn and cleans up card effects', () => {
  const { g, fx } = game('sabotage', {}, ['Ana', 'Ben', 'Cal', 'Dee']);
  g.roller = 2; fx.freeze = 'Ben'; fx.bounty = { by: 'Ben', target: 'Cal' };
  assert.equal(R.removePlayer(g, fx, 'Ben'), true);
  assert.equal(g.players[g.roller].name, 'Cal');
  assert.equal(fx.freeze, null); assert.equal(fx.bounty, null);
});
test('removing the current roller passes the turn on', () => {
  const { g, fx } = game('standard', {}, ['Ana', 'Ben', 'Cal']);
  g.roller = 1;
  R.removePlayer(g, fx, 'Ben');
  assert.equal(g.players[g.roller].name, 'Cal');
});
test('cannot remove below two players', () => {
  const { g, fx } = game('standard', {}, ['Ana', 'Ben']);
  assert.equal(R.removePlayer(g, fx, 'Ben'), false);
});
test('adding a player mid-game', () => {
  const { g } = game('lms', { lmsLives: 3 });
  R.addPlayer(g, 'Dee', { lives: 1 });
  assert.equal(g.players.length, 4);
  assert.equal(g.players[3].lives, 1);
  assert.equal(g.cumMiss.Dee, 0);
});
