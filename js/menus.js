// ══ THEME / MODE / OPTIONS UI ══
function selectTheme(t) { T = t; syncThemeCards(); }
function syncThemeCards() {
  document.querySelectorAll('.pk-card').forEach(function(c) { c.classList.remove('sel'); });
  var c = $('card-' + T); if (!c) return;
  c.classList.add('sel');
  // The hero shows the chosen theme large; the grid below is just swatches
  var prev = c.querySelector('.pk-preview'), desc = c.querySelector('.pk-foot-desc');
  $('pkHero').innerHTML = prev.outerHTML + '<div class="pk-hero-foot"><b>' + esc(THEME_LABELS[T]) + '</b><span>' + esc(desc ? desc.textContent.replace(/\s*\n\s*/g, ' ') : '') + '</span></div>';
}
function applyTheme(el) {
  Object.values(THEME_MAP).forEach(function(v) { el.classList.remove(v.cls); });
  el.classList.add(THEME_MAP[T].cls);
}
function confirmTheme() { saveSettings(); updateHomeLabels(); showScreen('home'); }
function optsSummary() {
  var bits = [];
  if (!MODE_INFO[MODE].premier) bits.push(MODE_LABELS[MODE]);
  if (MODE === 'race') bits.push('to ' + fmt(RACE_TARGET));
  else if (MODE === 'lms') bits.push(OPTS.lmsLives + (OPTS.lmsLives === 1 ? ' life' : ' lives'), 'min ' + OPTS.lmsMinBank);
  else bits.push(SEL_R + ' rounds');
  if (MODE === 'chaos') bits.push(OPTS.chaosCount === 2 ? '2 rules' : '1 rule');
  return bits.join(' · ');
}
function renderModeTiles() {
  function tile(k) {
    var i = MODE_INFO[k];
    return '<button class="su-mode' + (MODE === k ? ' on' : '') + '" onclick="selectMode(\'' + k + '\')"><b>' + esc(MODE_LABELS[k]) + '</b><span>' + esc(i.tag) + '</span></button>';
  }
  var keys = Object.keys(MODE_INFO);
  $('suModes').innerHTML = keys.filter(function(k) { return MODE_INFO[k].premier; }).map(tile).join('');
  $('suMoreModes').innerHTML = keys.filter(function(k) { return !MODE_INFO[k].premier; }).map(tile).join('');
  $('suModeDesc').innerHTML = '<b>' + esc(MODE_LABELS[MODE]) + '.</b> ' + esc(MODE_INFO[MODE].desc + houseSummary().replace(' · house: ', ' House rules: '));
  [['optsRace', 'race'], ['optsLms', 'lms'], ['optsChaos', 'chaos']].forEach(function(x) { var e = $(x[0]); if (e) e.classList.toggle('show', MODE === x[1]); });
  $('suRoundsSec').style.display = (MODE === 'race' || MODE === 'lms') ? 'none' : '';
  $('suOptsSum').textContent = optsSummary();
}
// Rounds, mode options and the other five modes live in one sheet so setup fits on a single screen
function showGameOptions() {
  var s = makeSheet('gameOpts', 'Game options'), panel = $('suOpts');
  var putBack = function() { $('suOptsHolder').appendChild(panel); renderModeTiles(); };
  s.sh.appendChild(panel);
  s.bd.addEventListener('click', function(e) { if (e.target === s.bd) putBack(); });
  var done = document.createElement('button'); done.className = 'sh-done'; done.textContent = 'Done';
  done.onclick = function() { putBack(); s.close(); };
  s.sh.appendChild(done);
  document.body.appendChild(s.bd);
}
function selectMode(m) {
  MODE = m;
  if ($('suModes')) renderModeTiles();
  saveSettings();
}
// Teach the table: the basics (with this phone's house rules) plus what this mode changes
function showHowToPlay() {
  var opts = JSON.parse(JSON.stringify(OPTS)); opts.house = JSON.parse(JSON.stringify(HOUSE));
  var g = Rules.newGame([], MODE, opts, RACE_TARGET, SEL_R);
  var S = Rules.safeRollCount(g);
  var basics = [
    'Take turns rolling two dice. Each roll adds to one shared pot.',
    S ? 'The first ' + S + ' rolls of a round are safe: a 7 adds ' + g.opts.house.safe7 + ', doubles just add their total.' : 'There are no safe rolls: a 7 busts from the first roll.',
    'After that, a 7 busts the round: anyone who hasn\u2019t banked scores nothing.',
    'Doubles after the safe rolls multiply the pot by ' + g.opts.house.doublesMult + '.',
    'Anyone can shout BANK at any time to lock in the pot and sit out the rest of the round. Tap their name to bank them.',
    MODE === 'race' ? 'First to bank ' + fmt(RACE_TARGET) + ' wins.' : MODE === 'lms' ? 'Last player with lives left wins.' : 'Most points after ' + SEL_R + ' rounds wins.'
  ];
  var s = makeSheet('howTo', '');
  var h = '<div class="rules-h">How to play</div><ul class="rules-list">' + basics.map(function(r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
  if (MODE !== 'standard') {
    h += '<div class="rules-h">' + esc(MODE_LABELS[MODE]) + '</div><ul class="rules-list">' + (MODE_RULES[MODE] || []).map(function(r) { return '<li>' + esc(ruleText(r, g)) + '</li>'; }).join('') + '</ul>';
  }
  if (MODE === 'sabotage') h += Object.keys(CARD_DEFS).map(function(k) { var c = CARD_DEFS[k]; return '<div class="rules-mod">' + c.icon + '<div><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span></div></div>'; }).join('');
  if (MODE === 'chaos') h += Rules.modPool(g).map(function(k) { var d = MODS[k]; return '<div class="rules-mod">' + ico(d.icon) + '<div><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></div></div>'; }).join('');
  var div = document.createElement('div'); div.style.cssText = 'display:flex;flex-direction:column;gap:12px;'; div.innerHTML = h;
  s.sh.appendChild(div);
  var ok = document.createElement('button'); ok.className = 'sh-done'; ok.textContent = 'Got it'; ok.onclick = s.close;
  s.sh.appendChild(ok);
  document.body.appendChild(s.bd);
}
function pickRaceTarget(t) { RACE_TARGET = t; syncOptButtons(); }
function pickOpt(k, v) { OPTS[k] = v; syncOptButtons(); }
function syncOptButtons() {
  var o = $('suOptsSum'); if (o && typeof optsSummary === 'function') o.textContent = optsSummary();
  document.querySelectorAll('[data-opt]').forEach(function(b) {
    var k = b.dataset.opt, cur = k === 'race' ? RACE_TARGET : OPTS[k];
    b.classList.toggle('on', String(cur) === b.dataset.val);
  });
}
function modeSummary(mode, opts, race) {
  mode = mode || MODE; opts = opts || OPTS; race = race || RACE_TARGET;
  var l = MODE_LABELS[mode] || mode;
  if (mode === 'race') return l + ' (' + fmt(race) + ')';
  if (mode === 'chaos') return l + ' · ' + (opts.chaosCount === 2 ? '2 rules' : '1 rule') + '/round' + (opts.chaosPool && opts.chaosPool.length ? ' · ' + opts.chaosPool.length + ' in deck' : '');
  if (mode === 'lms') return l + ' · ' + (opts.lmsLives || 3) + ' lives · min ' + fmt(opts.lmsMinBank) + (opts.lmsSuddenDeath ? ' · SD' : '');
  return l;
}
function houseSummary() {
  var d = Rules.HOUSE_DEFAULTS, bits = [];
  if (HOUSE.safeRolls !== d.safeRolls) bits.push(HOUSE.safeRolls + ' safe');
  if (HOUSE.safe7 !== d.safe7) bits.push('7 = ' + HOUSE.safe7);
  if (HOUSE.doublesMult !== d.doublesMult) bits.push('dbl \u00d7' + HOUSE.doublesMult);
  return bits.length ? ' \u00b7 house: ' + bits.join(', ') : '';
}
function updateHomeLabels() {
  var tl = THEME_LABELS[T] || T;
  $('homeThemeSub').textContent = modeSummary();
  $('homeThemeSub2').textContent = tl;
  var s = peekSaved(), rb = $('homeResumeBtn');
  if (s && s.players && s.players.length && s.phase !== 'over' && s.phase !== 'idle') {
    rb.style.display = '';
    $('homeResumeSub').textContent = (MODE_LABELS[s.mode] || '') + ' · Rnd ' + s.round + ' · ' + s.players.length + 'P';
  } else rb.style.display = 'none';
}
function goSetup() {
  applyTheme($('setup'));
  renderModeTiles(); syncOptButtons(); syncModeExtras();
  renderGroups();
  showScreen('setup');
}

function currentInputNames() { return Array.from($('suInputs').querySelectorAll('input')).map(function(i) { return i.value.trim(); }); }
function saveSettings() {
  lsSet(LS_SETTINGS, { T: T, MODE: MODE, RACE_TARGET: RACE_TARGET, PREFS: PREFS, HOUSE: HOUSE, OPTS: OPTS, selR: SEL_R, names: currentInputNames().filter(Boolean) });
}
function loadSettings() {
  var s = lsGet(LS_SETTINGS); if (!s) return null;
  if (s.T && THEME_MAP[s.T]) T = s.T;
  if (s.MODE && MODE_LABELS[s.MODE]) MODE = s.MODE;
  if (s.RACE_TARGET) RACE_TARGET = s.RACE_TARGET;
  var k;
  if (s.PREFS) { for (k in s.PREFS) if (k in PREFS) PREFS[k] = s.PREFS[k]; }
  else if (s.USE_DICE != null) PREFS.dice = !!s.USE_DICE;      // settings saved by v2.0
  if (s.HOUSE) for (k in s.HOUSE) if (k in HOUSE) HOUSE[k] = s.HOUSE[k];
  if (s.OPTS) for (k in s.OPTS) if (k in OPTS) OPTS[k] = s.OPTS[k];
  if (s.selR) SEL_R = s.selR;
  return s;
}

// ══ SETUP ══
function addInput(val) {
  var el = $('suInputs');
  if (el.children.length >= 8) return;
  var n = el.children.length + 1;
  var row = document.createElement('div'); row.className = 'su-row';
  row.innerHTML = '<input type="text" placeholder="Player ' + n + '" maxlength="20" autocomplete="off" autocapitalize="words"><button class="su-rm" onclick="rmInput(this)">&#215;</button>';
  if (typeof val === 'string') row.querySelector('input').value = val;
  el.appendChild(row);
  $('suAddBtn').style.display = el.children.length >= 8 ? 'none' : '';
}
function rmInput(btn) {
  var el = $('suInputs');
  if (el.children.length <= 2) return;
  btn.closest('.su-row').remove();
  $('suAddBtn').style.display = '';
}
function pickR(n) {
  SEL_R = clamp(Math.round(n), 3, 30);
  var v = $('suRoundsVal'); if (v) v.textContent = SEL_R + ' rounds';
  var o = $('suOptsSum'); if (o) o.textContent = optsSummary();
}
function stepR(d) { pickR(SEL_R + d); }
function startGame() {
  var names = currentInputNames().filter(Boolean);
  if (names.length < 2) { showToast('Need at least 2 players'); return; }
  var seen = {};
  for (var i = 0; i < names.length; i++) {
    var k = names[i].toLowerCase();
    if (seen[k]) { showToast('Two players can’t share the name “' + names[i] + '”'); return; }
    seen[k] = 1;
  }
  saveSettings();
  var opts = JSON.parse(JSON.stringify(OPTS)); opts.house = JSON.parse(JSON.stringify(HOUSE));
  beginGame(names, MODE, opts, RACE_TARGET, SEL_R);
}
function beginGame(names, mode, opts, raceTarget, selR) {
  clearOverlays();
  G = Rules.newGame(names, mode, opts, raceTarget, selR);
  HISTORY = [];
  initStats(names);
  if (mode === 'sabotage') initCards(names); else { CARDS = {}; resetEffects(); FREEZE_DEALT = false; }
  G.phase = 'play';
  if (mode === 'chaos') { Rules.pickMods(G); G.phase = 'reveal'; G.intro = ['chaos']; }
  enterGame();
  try { if (!localStorage.getItem('bank.tip.chips')) { localStorage.setItem('bank.tip.chips', '1'); later(function() { showToast('Tip: tap a player\u2019s score to bank them'); }, 900); } } catch (e) {}
}
function enterGame() {
  applyTheme($('game'));
  showScreen('game');
  SFX._state = 'none';
  render();
  if (G.phase === 'roundEnd') { if (G.result) showRoundEnd(); else { G.phase = 'play'; render(); } }
  else if (G.phase === 'reveal') showRoundIntro();
  else if (G.phase === 'over') showEndScreen();
}
function resumeGame() {
  if (!loadSavedGame()) { updateHomeLabels(); return; }
  enterGame();
}
function playAgain() {
  var names = G.players.map(function(p) { return p.name; });
  beginGame(names, G.mode, G.opts, G.raceTarget, G.total);
}
function newGameFromEnd() { clearSavedGame(); goSetup(); }
function menuFromEnd() { clearSavedGame(); updateHomeLabels(); showScreen('home'); }
