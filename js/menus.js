// ══ THEME / MODE / OPTIONS UI ══
function selectTheme(t) { T = t; syncThemeCards(); }
function syncThemeCards() {
  document.querySelectorAll('.pk-card').forEach(function(c) { c.classList.remove('sel'); });
  var c = $('card-' + T); if (c) c.classList.add('sel');
}
function applyTheme(el) {
  Object.values(THEME_MAP).forEach(function(v) { el.classList.remove(v.cls); });
  el.classList.add(THEME_MAP[T].cls);
}
function confirmTheme() { saveSettings(); updateHomeLabels(); showScreen('home'); }
function selectMode(m) {
  MODE = m;
  document.querySelectorAll('#modeList .mode-card').forEach(function(c) { c.classList.remove('sel'); });
  var el = $('mode-' + m); if (el) el.classList.add('sel');
  [['optsRace', 'race'], ['optsLms', 'lms'], ['optsChaos', 'chaos']].forEach(function(x) { var e = $(x[0]); if (e) e.classList.toggle('show', m === x[1]); });
}
function confirmMode() { saveSettings(); updateHomeLabels(); showScreen('home'); }
function pickRaceTarget(t) { RACE_TARGET = t; syncOptButtons(); }
function pickOpt(k, v) { OPTS[k] = v; syncOptButtons(); }
function syncOptButtons() {
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
  $('homeThemeSub').textContent = 'Theme: ' + tl;
  $('homeThemeSub2').textContent = tl;
  $('homeModeSub').textContent = modeSummary();
  var s = peekSaved(), rb = $('homeResumeBtn');
  if (s && s.players && s.players.length && s.phase !== 'over' && s.phase !== 'idle') {
    rb.style.display = '';
    $('homeResumeSub').textContent = (MODE_LABELS[s.mode] || '') + ' · Rnd ' + s.round + ' · ' + s.players.length + 'P';
  } else rb.style.display = 'none';
}
function goSetup() {
  applyTheme($('setup'));
  var noRounds = MODE === 'race' || MODE === 'lms';
  $('suRoundsSec').style.display = noRounds ? 'none' : '';
  $('suModeLine').textContent = 'Mode: ' + modeSummary() + houseSummary();
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
