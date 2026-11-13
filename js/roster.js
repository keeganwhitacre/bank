// ══ PLAYERS MID-GAME ══
// Game menu > Players: someone shows up late or has to leave. Undoable.
function showRosterSheet() {
  if (G.phase !== 'play') { showToast('Change players between rolls'); return; }
  var s = makeSheet('rosterSheet', 'Players');
  var list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  G.players.forEach(function(p) {
    var row = document.createElement('div'); row.className = 'sh-player-row roster-row';
    var meta = p.out ? 'out' : p.banked ? 'banked' : (G.players[G.roller] === p ? 'rolling' : '');
    row.innerHTML = '<span>' + esc(p.name) + '</span><span class="sh-player-row-amt">' + fmt(p.score) + (meta ? ' · ' + meta : '') + '</span>';
    if (G.players.length > 2) {
      var rm = document.createElement('button'); rm.className = 'roster-rm'; rm.textContent = 'Remove';
      rm.onclick = function() {
        if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.textContent = 'Sure?'; rm.classList.add('armed'); return; }
        s.close(); removePlayerMidGame(p.name);
      };
      row.appendChild(rm);
    }
    list.appendChild(row);
  });
  s.sh.appendChild(list);
  if (G.players.length < 8) {
    var add = document.createElement('div'); add.className = 'roster-add';
    var late = G.mode === 'lms' ? 'Joins with ' + lateLives() + ' ' + (lateLives() === 1 ? 'life' : 'lives') + ' (the fewest anyone has).' : 'Joins with 0 points, next in the turn order.';
    add.innerHTML = '<input type="text" id="rosterName" maxlength="20" placeholder="Add a player" autocomplete="off" autocapitalize="words"><button class="roster-add-btn">' + ico('plus') + '</button><small>' + esc(late) + '</small>';
    add.querySelector('button').onclick = function() {
      var name = ($('rosterName').value || '').trim();
      if (!name) return;
      if (findP(name) || G.players.some(function(q) { return q.name.toLowerCase() === name.toLowerCase(); })) { showToast('Someone’s already called ' + name); return; }
      s.close(); addPlayerMidGame(name);
    };
    s.sh.appendChild(add);
  }
  addCancel(s);
}
function lateLives() {
  var act = activePlayers();
  return act.length ? Math.min.apply(null, act.map(function(p) { return p.lives; })) : (G.opts.lmsLives || 3);
}
function addPlayerMidGame(name) {
  pushSnap();
  Rules.addPlayer(G, name, { lives: G.mode === 'lms' ? lateLives() : 0 });
  STATS[name] = { sevens: 0, doubles: 0, bustSevens: 0, pointsLost: 0, banks: [], comebacks: 0, lastStanding: 0 };
  if (G.mode === 'sabotage') CARDS[name] = [randomCard()];
  showToast(name + ' joined the game');
  render();
}
function removePlayerMidGame(name) {
  pushSnap();
  if (!Rules.removePlayer(G, EFFECTS, name)) { HISTORY.pop(); return; }
  delete STATS[name]; delete CARDS[name];
  showToast(name + ' left the game');
  if (G.mode === 'lms' && activePlayers().length <= 1) { G.winners = activePlayers().map(function(p) { return p.name; }); render(); endGame(); return; }
  if (activeUnbanked().length === 0) { roundClear(); return; }
  render();
}
