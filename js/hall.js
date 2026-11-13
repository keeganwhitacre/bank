// ══ LIFETIME STATS & HALL OF FAME ══
// Every finished game adds to per-player totals (keyed by name, case-insensitive)
// and to a log of recent games. All stored on the phone.
var LS_LIFE = 'bank.lifetime.v1';
function loadLife() { var l = lsGet(LS_LIFE) || {}; l.players = l.players || {}; l.games = l.games || []; return l; }
function resetLifetime() { lsDel(LS_LIFE); }

function recordGameLifetime() {
  if (G.lifetimeRecorded) return;
  G.lifetimeRecorded = true;
  // Skip games abandoned before anything happened
  if (!G.players.some(function(p) { return p.score > 0; }) && G.round < 2) return;
  var L = loadLife(), winners = G.winners || [];
  G.players.forEach(function(p) {
    var k = p.name.toLowerCase();
    var s = L.players[k] || (L.players[k] = { name: p.name, games: 0, wins: 0, points: 0, banks: 0, bankTotal: 0, bestBank: 0, busts: 0, doubles: 0, pointsLost: 0, comebacks: 0, lmsGames: 0, lmsWins: 0, best: 0 });
    var st = STATS[p.name] || { banks: [] };
    // Keep a capitalized spelling if we've seen one ("Keegan" over "keegan")
    if (p.name !== p.name.toLowerCase() || s.name === s.name.toLowerCase()) s.name = p.name;
    s.games++;
    if (winners.indexOf(p.name) !== -1) s.wins++;
    if (G.mode === 'lms') { s.lmsGames++; if (winners.indexOf(p.name) !== -1) s.lmsWins++; }
    s.points += p.score;
    if (p.score > s.best) s.best = p.score;
    s.banks += st.banks.length;
    st.banks.forEach(function(a) { s.bankTotal += a; if (a > s.bestBank) s.bestBank = a; });
    s.busts += st.bustSevens || 0;
    s.doubles += st.doubles || 0;
    s.pointsLost += st.pointsLost || 0;
    s.comebacks += st.comebacks || 0;
    s.lastPlayed = Date.now();
  });
  L.games.unshift({ at: Date.now(), mode: G.mode, rounds: G.round, winners: winners.slice(),
    players: G.players.map(function(p) { return { name: p.name, score: p.score, out: !!p.out }; }) });
  if (L.games.length > 100) L.games.length = 100;
  lsSet(LS_LIFE, L);
}

var HALL_TAB = 'players';
function openHall() { HALL_TAB = 'players'; renderHall(); showScreen('hall'); }
function hallTab(t) { HALL_TAB = t; renderHall(); }
function renderHall() {
  var L = loadLife();
  document.querySelectorAll('#hallTabs button').forEach(function(b) { b.classList.toggle('on', b.dataset.t === HALL_TAB); });
  var el = $('hallBody'), h = '';
  var players = Object.keys(L.players).map(function(k) { return L.players[k]; });
  if (!L.games.length) { el.innerHTML = '<div class="hall-empty">' + ico('trophy') + '<b>Nothing here yet</b>Finish a game and it shows up here: wins, best banks, records and recent games.</div>'; return; }
  if (HALL_TAB === 'players') {
    players.sort(function(a, b) { return b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games) || b.points - a.points; });
    h += '<div class="hall-thead"><span></span><span>Player</span><span>W</span><span>GP</span><span>Win%</span></div>';
    players.forEach(function(p, i) {
      h += '<button class="hall-row" data-k="' + esc(p.name.toLowerCase()) + '"><span class="hr-rank">' + (i + 1) + '</span><span class="hr-name">' + esc(p.name) + '</span><span class="hr-num">' + p.wins + '</span><span class="hr-num dim">' + p.games + '</span><span class="hr-num dim">' + Math.round(100 * p.wins / Math.max(1, p.games)) + '%</span></button>';
    });
    h += '<div class="hall-note">Tap a player for their full stats</div>';
  } else if (HALL_TAB === 'records') {
    function top(fn, min) { var best = null; players.forEach(function(p) { if (min && p.games < min) return; var v = fn(p); if (best == null || v > best.v) best = { p: p, v: v }; }); return best; }
    var recs = [
      ['gem', 'Best bank ever', RECORDS.bestBank ? fmt(RECORDS.bestBank) : '—', RECORDS.bestBankBy || ''],
      ['skull', 'Biggest bust', RECORDS.biggestBust ? fmt(RECORDS.biggestBust) + ' lost' : '—', ''],
      ['flame', 'Biggest pot', RECORDS.biggestPot ? fmt(RECORDS.biggestPot) : '—', '']
    ];
    var t;
    if ((t = top(function(p) { return p.wins; })) && t.v > 0) recs.push(['crown', 'Most wins', t.v + (t.v === 1 ? ' win' : ' wins'), t.p.name]);
    if ((t = top(function(p) { return p.wins / p.games; }, 3)) && t.v > 0) recs.push(['trophy', 'Best win rate (3+ games)', Math.round(t.v * 100) + '%', t.p.name]);
    if ((t = top(function(p) { return p.best; })) && t.v > 0) recs.push(['star', 'Highest final score', fmt(t.v), t.p.name]);
    if ((t = top(function(p) { return p.doubles; })) && t.v > 0) recs.push(['dice', 'Most doubles', t.v, t.p.name]);
    if ((t = top(function(p) { return p.busts; })) && t.v > 0) recs.push(['devil', 'Most busts rolled', t.v, t.p.name]);
    if ((t = top(function(p) { return p.pointsLost; })) && t.v > 0) recs.push(['skull', 'Most points lost to busts', fmt(t.v), t.p.name]);
    if ((t = top(function(p) { return p.lmsWins; })) && t.v > 0) recs.push(['heart', 'Last Man Standing wins', t.v, t.p.name]);
    h += recs.map(function(r) { return '<div class="rec-row">' + ico(r[0]) + '<div><small>' + esc(r[1]) + '</small><b>' + esc(String(r[2])) + '</b>' + (r[3] ? '<span>' + esc(r[3]) + '</span>' : '') + '</div></div>'; }).join('');
  } else {
    L.games.slice(0, 30).forEach(function(gm) {
      var d = new Date(gm.at);
      var when = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      var scores = gm.players.slice().sort(function(a, b) { return b.score - a.score; }).map(function(p) { return esc(p.name) + ' ' + fmt(p.score); }).join(' · ');
      h += '<div class="game-row"><div class="gr-top"><b>' + esc(gm.winners.join(' & ') || '—') + '</b><span>' + esc(MODE_LABELS[gm.mode] || gm.mode) + '</span></div><div class="gr-scores">' + scores + '</div><div class="gr-when">' + when + ' · ' + gm.rounds + ' rounds</div></div>';
    });
  }
  el.innerHTML = h;
  el.scrollTop = 0;
}
// Rows carry the player key in data-k (safe for any name, apostrophes included)
document.addEventListener('click', function(e) {
  var row = e.target.closest && e.target.closest('#hallBody .hall-row');
  if (row) showPlayerCard(row.dataset.k);
});
function showPlayerCard(key) {
  var p = loadLife().players[key]; if (!p) return;
  var s = makeSheet('playerCard', '');
  var avgBank = p.banks ? Math.round(p.bankTotal / p.banks) : 0;
  var rows = [
    ['Games', p.games], ['Wins', p.wins + ' (' + Math.round(100 * p.wins / Math.max(1, p.games)) + '%)'],
    ['Total points', fmt(p.points)], ['Average score', fmt(p.points / Math.max(1, p.games))], ['Highest final score', fmt(p.best)],
    ['Banks', p.banks], ['Average bank', fmt(avgBank)], ['Best bank', fmt(p.bestBank)],
    ['Doubles rolled', p.doubles], ['Busts rolled', p.busts], ['Points lost to busts', fmt(p.pointsLost)], ['Comebacks', p.comebacks]
  ];
  if (p.lmsGames) rows.push(['Last Man Standing', p.lmsWins + ' wins in ' + p.lmsGames]);
  var div = document.createElement('div');
  div.innerHTML = '<div class="pc-name">' + esc(p.name) + '</div><div class="pc-grid">' + rows.map(function(r) { return '<div><small>' + esc(r[0]) + '</small><b>' + esc(String(r[1])) + '</b></div>'; }).join('') + '</div>';
  s.sh.appendChild(div);
  var ok = document.createElement('button'); ok.className = 'sh-done'; ok.textContent = 'Close'; ok.onclick = s.close;
  s.sh.appendChild(ok);
  document.body.appendChild(s.bd);
}
