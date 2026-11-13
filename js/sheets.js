// ══ SHEETS ══
function makeSheet(id, title) {
  var ex = $(id); if (ex) ex.remove();
  var bd = document.createElement('div'); bd.id = id; bd.className = 'backdrop';
  var sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = '<div class="sh-handle"></div>' + (title ? '<div class="sh-title">' + esc(title) + '</div>' : '');
  bd.appendChild(sh);
  bd.addEventListener('click', function(e) { if (e.target === bd) bd.remove(); });
  return { bd: bd, sh: sh, close: function() { bd.remove(); } };
}
function addCancel(s) {
  var sc = document.createElement('button'); sc.className = 'sh-cancel'; sc.textContent = 'Cancel';
  sc.onclick = s.close; s.sh.appendChild(sc);
  document.body.appendChild(s.bd);
}
function showDblPicker() {
  if (G.phase !== 'play') return;
  var s = makeSheet('dblPicker', 'Which doubles?');
  var sg = document.createElement('div'); sg.className = 'sh-grid';
  [2, 4, 6, 8, 10, 12].forEach(function(total) {
    var b = document.createElement('button'); b.className = 'sh-btn'; b.textContent = total;
    b.addEventListener('click', function() { s.close(); submitRoll(true, total, b); });
    sg.appendChild(b);
  });
  s.sh.appendChild(sg);
  addCancel(s);
}
function showBankPicker() {
  if (G.phase !== 'play' || anyOverlay()) return;
  if (bankLockedByMin()) { showToast('The pot needs ' + fmt(lmsMinBank()) + ' before anyone can bank'); return; }
  if (hasMod('lockdown')) { bankPlayer(G.roller); return; }
  var unbanked = G.players.map(function(p, i) { return { p: p, i: i }; }).filter(function(x) { return !x.p.banked && !x.p.out; });
  if (!unbanked.length) { showToast('Everyone already banked'); return; }
  var s = makeSheet('bankPicker', 'Who’s banking?');
  var pg = document.createElement('div'); pg.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  var hidden = potHidden();
  unbanked.forEach(function(x) {
    var frozen = EFFECTS.freeze === x.p.name;
    var b = document.createElement('button'); b.className = 'sh-player-row' + (frozen ? ' disabled' : '');
    var amt = hidden ? '+???' : '+' + fmt(previewBank(x.i).amt);
    b.innerHTML = '<span>' + esc(x.p.name) + '</span><span class="sh-player-row-amt">' + (frozen ? ico('snowflake', 'ico-sm') + ' frozen' : amt) + '</span>';
    if (!frozen) b.addEventListener('click', function() { s.close(); bankPlayer(x.i); });
    pg.appendChild(b);
  });
  s.sh.appendChild(pg);
  addCancel(s);
}
function showGameMenu() {
  if (anyOverlay()) return;
  var s = makeSheet('gameMenu', 'Game');
  var rules = document.createElement('button'); rules.className = 'sh-menu-row'; rules.innerHTML = ico('rules') + 'Rules for this game';
  rules.onclick = function() { s.close(); showRulesSheet(); };
  var end = document.createElement('button'); end.className = 'sh-menu-row warn'; end.innerHTML = ico('stop') + '<span>End game &amp; see results</span>';
  end.onclick = function() {
    if (!end.dataset.armed) { end.dataset.armed = '1'; end.querySelector('span').textContent = 'Tap again to end the game'; return; }
    s.close(); endGame();
  };
  var quit = document.createElement('button'); quit.className = 'sh-menu-row'; quit.innerHTML = ico('exit') + 'Quit to menu (game is saved)';
  quit.onclick = function() { s.close(); quitToMenu(); };
  [rules, end, quit].forEach(function(b) { s.sh.appendChild(b); });
  addCancel(s);
}
function quitToMenu() {
  clearOverlays();
  saveGame();
  clearIntensity();
  updateHomeLabels();
  showScreen('home');
}
function showRulesSheet() {
  var s = makeSheet('rulesSheet', '');
  var h = '<div class="rules-h">' + esc(MODE_LABELS[G.mode]) + '</div>';
  if (G.mode === 'chaos' && G.mods.length) {
    h += G.mods.map(function(k) { var d = MODS[k]; return '<div class="rules-mod">' + ico(d.icon) + '<div><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></div></div>'; }).join('');
  }
  var list = (MODE_RULES[G.mode] || []).slice();
  if (G.mode === 'lms') list[2] = 'Nobody can bank until the pot reaches ' + fmt(lmsMinBank()) + '.';
  if (G.mode === 'race') list[1] = 'The first player whose banked total reaches ' + fmt(G.raceTarget) + ' wins instantly.';
  h += '<ul class="rules-list">' + list.map(function(r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
  var div = document.createElement('div'); div.style.cssText = 'display:flex;flex-direction:column;gap:12px;'; div.innerHTML = h;
  s.sh.appendChild(div);
  var ok = document.createElement('button'); ok.className = 'sh-cancel'; ok.textContent = 'Got it'; ok.onclick = s.close;
  s.sh.appendChild(ok);
  document.body.appendChild(s.bd);
}
