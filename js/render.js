// ══ RENDER ══
function computeHeat() {
  if (G.phase !== 'play' && G.phase !== 'roundEnd') return 0;
  var v = potHidden() ? G.rolls * 45 : G.pot;
  var lv = v >= 1200 ? 4 : v >= 600 ? 3 : v >= 300 ? 2 : v >= 120 ? 1 : 0;
  if (G.rolls < safeRollCount()) lv = Math.min(lv, 1);
  return lv;
}
function render() {
  if (!G.players.length) return;
  var roller = G.players[G.roller];
  var danger = nextRollDanger();
  var hidden = potHidden();
  var labels = shortLabels();

  // Pot
  var potEl = $('gPotValue');
  potEl.textContent = fmt(G.pot);
  potEl.classList.toggle('pot-hidden', hidden);
  if (!hidden) potEl.style.opacity = '';
  var safeLeft = safeRollCount() - G.rolls;
  $('gPotSub').innerHTML = 'roll ' + (G.rolls + 1) + ' · ' + (danger ? '<span class="danger">' + (hasMod('snakeEyes') ? '7 · 2 · 12 bust' : '7 busts') + '</span>' : 'safe' + (safeLeft > 1 ? ' · ' + safeLeft + ' left' : ' · last one'));
  $('game').classList.toggle('danger-on', danger && G.phase === 'play');

  // Round counter
  var rndEl = $('gRnd'), pipsEl = $('gPips');
  pipsEl.innerHTML = '';
  if (G.mode === 'race' || G.mode === 'lms') {
    var sd = G.suddenDeath ? ' · SD' : '';
    if (T === 'sb') rndEl.innerHTML = 'RND <span class="rnd-num">' + pad(G.round) + '</span>' + sd;
    else rndEl.textContent = 'rnd ' + G.round + sd;
  } else {
    if (T === 'sb') rndEl.innerHTML = 'RND <span class="rnd-num">' + pad(G.round) + '</span>/' + G.total;
    else if (T === 'br') rndEl.textContent = 'roll_' + pad(G.round);
    else rndEl.textContent = G.round + '/' + G.total;
    for (var i = 1; i <= G.total; i++) {
      var pip = document.createElement('div');
      pip.className = 'g-pip' + (i < G.round ? ' done' : '') + (i === G.round ? ' current' : '');
      pipsEl.appendChild(pip);
    }
  }

  $('gInfo').innerHTML = infoHTML();
  $('gInfo').classList.toggle('gi-fixed', G.mode === 'sabotage');

  // Turn
  var turnEl = $('gTurn'), rn = roller ? esc(roller.name) : '—';
  if (T === 'sb') turnEl.innerHTML = '<span class="live-dot"></span>' + (roller ? rn.toUpperCase() + "'S ROLL" : rn);
  else if (T === 'br') turnEl.innerHTML = '<span class="arrow">→</span>' + (roller ? rn.toUpperCase() + "'S ROLL" : rn);
  else if (T === 'cas') turnEl.textContent = roller ? roller.name + "'s turn" : '—';
  else turnEl.textContent = roller ? roller.name + "'s roll" : '—';

  // Number pad / dice
  var grid = $('gGrid'); grid.innerHTML = '';
  var diceArea = $('gDiceArea');
  grid.style.display = USE_DICE ? 'none' : '';
  diceArea.style.display = USE_DICE ? '' : 'none';
  if (USE_DICE && !DICE_ROLLING) {
    var ld = G.lastDice;
    renderGameDie('gDie1', ld ? ld[0] : 0); renderGameDie('gDie2', ld ? ld[1] : 0);
    $('gDiceRollBtn').disabled = G.phase !== 'play';
  }
  if (!USE_DICE) {
    for (var t = 2; t <= 12; t++) (function(total) {
      var btn = document.createElement('button'); btn.className = 'g-key'; btn.textContent = total;
      var blocked = false;
      if (total === 7) btn.classList.add(danger ? 'k-seven-danger' : 'k-seven-safe');
      if (danger && (total === 2 || total === 12)) {
        if (G.mode === 'cutthroat') btn.classList.add('k-cut');
        else if (hasMod('snakeEyes')) btn.classList.add('k-seven-danger');
        else blocked = true;   // 2 and 12 are always doubles: use the ×2 key
      }
      if (blocked) btn.classList.add('k-blocked');
      else btn.addEventListener('click', function() { submitRoll(false, total, btn); });
      grid.appendChild(btn);
    })(t);
    var dblBtn = document.createElement('button');
    dblBtn.className = 'g-key k-doubles' + (danger ? ' k-p2' : '');
    if (T === 'br') dblBtn.innerHTML = '<span style="display:flex;align-items:baseline;gap:0"><span style="font-size:1.1rem;opacity:.6">×</span><span style="font-size:2.5rem">2</span></span>';
    else dblBtn.textContent = '×2';
    dblBtn.addEventListener('click', function() {
      if (nextRollDanger() && !needsDoublesTotal()) submitRoll(true, null, dblBtn);
      else showDblPicker();
    });
    grid.appendChild(dblBtn);
  }

  // Bank button
  var bankBtn = $('gBank'), base = THEME_MAP[T].bankText;
  var locked = bankLockedByMin();
  bankBtn.classList.toggle('bank-locked', locked);
  if (locked) bankBtn.textContent = base + ' · min ' + fmt(lmsMinBank());
  else if (hasMod('lockdown') && roller) bankBtn.textContent = base + ' · ' + labels[G.roller];
  else bankBtn.textContent = base;

  var undoEl = $('gUndo');
  undoEl.className = 'g-undo' + (HISTORY.length ? '' : ' dim');
  undoEl.textContent = THEME_MAP[T].undoText;


  // Score chips
  var scoresEl = $('gScores'); scoresEl.innerHTML = '';
  var activeChip = null;
  G.players.forEach(function(p, i) {
    var isRoller = i === G.roller && !p.banked && !p.out;
    var chip = document.createElement('button');
    chip.className = 'g-chip' + (isRoller ? ' rolling' : '') + (p.banked ? ' banked' : '') + (EFFECTS.freeze === p.name ? ' frozen' : '') + (p.out ? ' out' : '');
    chip.setAttribute('aria-label', p.banked ? p.name + ' banked' : 'Bank ' + p.name);
    var handCount = (CARDS[p.name] || []).length;
    var cardDots = G.mode === 'sabotage' ? '<div class="g-chip-cards">' + (handCount ? ico('card', 'ico-sm').repeat(Math.min(handCount, 3)) : '') + '</div>' : '';   // always present so chip height never changes
    var lives = G.mode === 'lms' ? '<div class="g-chip-lives">' + heartsHTML(p.lives, p.out ? (G.opts.lmsLives || 3) : Math.max(p.lives, G.suddenDeath ? 1 : (G.opts.lmsLives || 3))) + '</div>' : '';
    var tag = p.banked ? '<div class="g-chip-tag">\u2713 ' + (hidden || p.bankedAmt == null ? 'in' : '+' + fmt(p.bankedAmt)) + '</div>'
            : isRoller ? '<div class="g-chip-tag roll">rolling</div>' : '<div class="g-chip-tag"></div>';
    chip.innerHTML = '<div class="g-chip-name">' + esc(labels[i]) + '</div><div class="g-chip-pts">' + (p.out ? ico('skull') : fmt(displayScore(p))) + '</div>' + tag + lives + cardDots + (G.mode === 'sabotage' ? cardBadges(p.name) : '');
    // Tap a player's chip to bank them (the Bank button and its list still work too)
    chip.addEventListener('click', function() { chipTap(i); });
    scoresEl.appendChild(chip);
    if (isRoller) activeChip = chip;
  });
  // Scroll only the score strip horizontally (scrollIntoView can also shift parent containers vertically)
  if (activeChip) {
    var wrap = scoresEl.parentNode;
    var target = activeChip.offsetLeft - (wrap.clientWidth - activeChip.offsetWidth) / 2;
    try { wrap.scrollTo({ left: Math.max(0, target), behavior: 'smooth' }); } catch (e) { wrap.scrollLeft = target; }
  }

  // Trackers
  var names = G.players.map(function(p) { return p.name; });
  function topBy(fn) {
    var best = null, bestVal = -1;
    names.forEach(function(n) { var v = fn(n); if (v > bestVal) { bestVal = v; best = n; } });
    return bestVal > 0 ? esc(best) + ' (' + bestVal + ')' : '—';
  }
  $('trk7s').innerHTML = ico('target', 'ico-sm') + ' 7s: <span class="trk-val">' + topBy(function(n) { return STATS[n] ? STATS[n].sevens : 0; }) + '</span>';
  $('trkDbl').innerHTML = ico('dice', 'ico-sm') + ' Dbls: <span class="trk-val">' + topBy(function(n) { return STATS[n] ? STATS[n].doubles : 0; }) + '</span>';

  // Intensity (duel / last one standing). Sounds fire only when the state changes.
  var game = $('game');
  var act = activePlayers(), un = activeUnbanked();
  var on = G.phase === 'play' && G.rolls > 0 && act.length > 1;
  var stt = on && un.length === 2 && act.length > 2 ? 'duel' : on && un.length === 1 ? 'solo' : 'none';
  game.classList.toggle('state-duel', stt === 'duel'); document.body.classList.toggle('state-duel', stt === 'duel');
  game.classList.toggle('state-solo', stt === 'solo'); document.body.classList.toggle('state-solo', stt === 'solo');
  $('gIntensityLabel').textContent = stt === 'duel' ? 'duel' : stt === 'solo' ? 'last one standing' : '';
  if (stt !== SFX._state) {
    SFX._state = stt;
    if (stt === 'duel') { SFX.stopDrone(); SFX.startDrone(false); }
    else if (stt === 'solo') SFX.startDrone(true);
    else SFX.stopDrone();
  }
  if (stt === 'solo' && act.length >= 3 && !G.soloAnnounced) {
    G.soloAnnounced = true;
    announce('Last One Standing', un[0].name + (hidden ? ' is alone' : ' · ' + fmt(G.pot) + ' on the line'), '');
  }

  // Heat: the room warms up as the pot grows
  var h = computeHeat();
  if (h > (G.heat || 0) && h >= 3) SFX.heatUp(h);
  G.heat = h;
  document.body.setAttribute('data-heat', String(h));
  document.body.classList.toggle('lms-showdown', G.mode === 'lms' && act.length === 2 && G.phase !== 'over');

  saveGame();
}
function heartsHTML(lives, slots) {
  var s = '';
  for (var i = 0; i < slots; i++) s += i < lives ? ico('heart') : '<span class="dead">' + ico('heartO') + '</span>';
  return s;
}
function infoHTML() {
  var m = G.mode;
  if (m === 'standard') return '';
  if (m === 'lms' && activePlayers().length === 2) {
    var a = activePlayers();
    return '<div class="gi-showdown"><span>' + esc(a[0].name) + ' <span class="gi-hearts">' + heartsHTML(a[0].lives, a[0].lives) + '</span></span><i>vs</i><span><span class="gi-hearts">' + heartsHTML(a[1].lives, a[1].lives) + '</span> ' + esc(a[1].name) + '</span></div>';
  }
  var h = '<span class="gi-mode">' + esc(MODE_LABELS[m]) + '</span>';
  if (m === 'chaos') {
    return h + G.mods.map(function(k) { var d = MODS[k]; return '<button class="gi-mod" onclick="showRulesSheet()">' + ico(d.icon) + '<b>' + esc(d.name) + '</b><span class="gi-short">' + esc(d.short) + '</span></button>'; }).join('');
  }
  var txt = { race: 'First to ' + fmt(G.raceTarget) + ' wins', turbo: '7 busts every roll', blackout: 'Pot hidden after roll ' + safeRollCount(), cutthroat: '2 or 12 halves the pot', rollerscut: 'Last one in: +20% per roll', }[m];
  if (m === 'sabotage') return sabotageTrayHTML();
  if (m === 'lms') txt = 'Min bank ' + fmt(lmsMinBank()) + (G.suddenDeath ? '</span><span class="gi-txt gi-danger">Sudden death' : '');
  return h + '<span class="gi-txt">' + txt + '</span>';
}
