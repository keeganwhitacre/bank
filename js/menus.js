// ══ THEME / MODE / OPTIONS UI ══
function selectTheme(t) { T = t; syncThemeCards(); }
function syncThemeCards() {
  document.querySelectorAll('.pk-card').forEach(function(c) { c.classList.remove('sel'); });
  var c = $('card-' + T); if (c) c.classList.add('sel');
}
function applyTheme(el) {
  Object.values(THEME_MAP).forEach(function(v) { el.classList.remove(v.cls); document.body.classList.remove(v.cls); });
  el.classList.add(THEME_MAP[T].cls);
  document.body.classList.add(THEME_MAP[T].cls);
  document.body.style.backgroundColor = THEME_MAP[T].bg;
  document.documentElement.style.backgroundColor = THEME_MAP[T].bg;
  var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', THEME_MAP[T].bg);
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
  if (mode === 'chaos') return l + ' · ' + (opts.chaosCount === 2 ? '2 rules' : '1 rule') + '/round';
  if (mode === 'lms') return l + ' · min ' + fmt(opts.lmsMinBank) + (opts.lmsSuddenDeath ? ' · SD' : '');
  return l;
}
function updateHomeLabels() {
  var tl = THEME_LABELS[T] || T;
  $('homeThemeSub').textContent = 'Theme: ' + tl;
  $('homeThemeSub2').textContent = tl;
  $('homeModeSub').textContent = modeSummary();
  $('homeDiceSub').textContent = USE_DICE ? 'On' : 'Off';
  $('homeDiceBtn').classList.toggle('active', USE_DICE);
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
  $('suModeLine').textContent = 'Mode: ' + modeSummary();
  showScreen('setup');
}
function toggleDiceHome() { USE_DICE = !USE_DICE; saveSettings(); updateHomeLabels(); }

function currentInputNames() { return Array.from($('suInputs').querySelectorAll('input')).map(function(i) { return i.value.trim(); }); }
function saveSettings() {
  lsSet(LS_SETTINGS, { T: T, MODE: MODE, RACE_TARGET: RACE_TARGET, USE_DICE: USE_DICE, OPTS: OPTS, selR: SEL_R, names: currentInputNames().filter(Boolean) });
}
function loadSettings() {
  var s = lsGet(LS_SETTINGS); if (!s) return null;
  if (s.T && THEME_MAP[s.T]) T = s.T;
  if (s.MODE && MODE_LABELS[s.MODE]) MODE = s.MODE;
  if (s.RACE_TARGET) RACE_TARGET = s.RACE_TARGET;
  USE_DICE = !!s.USE_DICE;
  if (s.OPTS) for (var k in s.OPTS) if (k in OPTS) OPTS[k] = s.OPTS[k];
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
  SEL_R = n;
  document.querySelectorAll('.su-rbtn[data-r]').forEach(function(b) { b.classList.toggle('on', +b.dataset.r === n); });
}
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
  beginGame(names, MODE, OPTS, RACE_TARGET, SEL_R);
}
function beginGame(names, mode, opts, raceTarget, selR) {
  clearOverlays();
  G = newGameState(selR);
  G.mode = mode; G.opts = JSON.parse(JSON.stringify(opts)); G.raceTarget = raceTarget;
  G.players = names.map(function(n) { return { name: n, score: 0, banked: false, bankedAmt: null, lives: mode === 'lms' ? LIVES_START : 0, out: false, outRound: 0 }; });
  names.forEach(function(n) { G.cumMiss[n] = 0; });
  HISTORY = [];
  initStats(names);
  if (mode === 'sabotage') initCards(names); else { CARDS = {}; resetEffects(); FREEZE_DEALT = false; }
  G.showdownShown = names.length <= 2;   // a 2-player game is a showdown from the start
  G.phase = 'play';
  if (mode === 'chaos') { rollMods(); G.phase = 'reveal'; G.intro = ['chaos']; }
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
