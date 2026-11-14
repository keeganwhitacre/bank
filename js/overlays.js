// ══ BUST SEQUENCE: the pot collapses ══
function playBustSequence(res, done) {
  var lms = G.mode === 'lms' && res.lifeLost && res.lifeLost.length;
  var small = res.pot < 60;
  if (small && !lms) { later(done, 520); return; }
  var ov = document.createElement('div'); ov.className = 'bust-ov' + (small ? ' small' : '');
  var mult = res.victims.length;
  var sub = res.total === 2 ? 'Snake eyes' : 'Seven';
  sub += ' · ' + fmt(res.pot) + (mult > 1 ? ' × ' + mult + ' players' : ' pot');
  var payNote = res.payouts.map(function(p) { return esc(p.name) + ' +' + fmt(p.amt) + ' (' + p.why + ')'; }).join(' · ');
  var h = '<div class="bo-stage"><div class="bo-pot">' + fmt(res.pot) + '</div><div class="bo-word">Bust</div></div>';
  if (res.lost > 0) h += '<div class="bo-lost">−<span class="bo-count">0</span></div>';
  h += '<div class="bo-sub">' + esc(sub) + (payNote ? '<br>' + payNote : '') + '</div>';
  if (res.record) h += '<div class="bo-tag">All-time biggest bust</div>';
  else if (res.biggest) h += '<div class="bo-tag">Biggest bust of the night</div>';
  var extra = 0;
  if (lms) {
    h += '<div class="bo-lives">';
    res.lifeLost.forEach(function(l, i) {
      var d = 1.15 + i * 0.32;
      var hearts = '';
      for (var k = 0; k < l.before; k++) {
        var breaking = !l.spared && k === l.before - 1;
        hearts += '<span class="hslot"><span class="ico hempty">' + ICONS.heartO + '</span>' + '<span class="ico hfull' + (breaking ? ' heart-break' : '') + '" style="animation-delay:' + (d + 0.25).toFixed(2) + 's">' + ICONS.heart + '</span></span>';
      }
      var tail = l.out ? '<span class="bo-out" style="animation-delay:' + (d + 0.55).toFixed(2) + 's">Out</span>' : l.spared ? '<span class="bo-spared">spared · top score</span>' : '<span class="bo-hearts">' + hearts + '</span>';
      h += '<div class="bo-life-row" style="animation-delay:' + d.toFixed(2) + 's"><span class="nm">' + esc(l.name) + '</span>' + tail + '</div>';
      later(function() { if (l.out) SFX.elim(); else if (!l.spared) SFX.heartbreak(); }, (d + (l.out ? 0.55 : 0.25)) * 1000);
    });
    h += '</div>';
    extra = res.lifeLost.length * 320 + (res.elims.length ? 600 : 0);
  }
  h += '<div class="bo-tap">tap to continue</div>';
  ov.innerHTML = h;
  document.body.appendChild(ov);
  var potY = innerHeight * 0.42;
  later(function() { spawnConfetti(small ? 18 : 46, false, { y: potY, colors: ['#777', '#999', '#ff3b30', '#555', '#bbb'], shape: 'shard', up: 2 }); }, small ? 320 : 520);
  var cnt = ov.querySelector('.bo-count');
  if (cnt) later(function() { countUp(cnt, res.lost, 650); }, 900);
  var finished = false, ready = false;
  function finish() { if (finished) return; finished = true; ov.remove(); done(); }
  later(function() { ready = true; }, 350);
  ov.addEventListener('click', function() { if (ready) finish(); });
  later(finish, (small ? 1700 : 2700) + extra);
}
function countUp(el, to, dur) {
  var start = performance.now();
  function step(now) {
    var t = Math.min((now - start) / dur, 1); t = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(to * t);
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ══ ROUND END SHEET ══
function showRoundEnd() {
  var res = G.result; if (!res || G.phase !== 'roundEnd') return;
  document.querySelectorAll('.rnd-backdrop').forEach(function(e) { e.remove(); });
  var lms = G.mode === 'lms';
  var ov = document.createElement('div'); ov.className = 'rnd-backdrop';
  var sh = document.createElement('div'); sh.className = 'rnd-sheet';
  var h = '<div class="rnd-handle"></div>';
  h += '<div class="rnd-header"><div class="rnd-label">Round ' + G.round + '</div><div class="rnd-status ' + (res.bust ? 'bust' : 'clear') + '">' + (res.bust ? 'Bust' : 'Clear') + '</div></div>';
  if (G.mode === 'chaos' && G.mods.length) h += '<div class="rnd-mods">' + G.mods.map(function(k) { return '<span>' + esc(MODS[k].name) + '</span>'; }).join('') + '</div>';
  if (res.bust) {
    h += '<div class="rnd-bust-msg">' + esc(res.roller) + ' rolled ' + (res.total === 2 ? 'snake eyes' : 'a 7') + ' — pot was ' + fmt(res.pot) + (res.lost ? ' · ' + fmt(res.lost) + ' lost' : '') + '</div>';
  }
  G.bankedThisRound.slice().sort(function(a, b) { return b.amt - a.amt; }).forEach(function(b, i) {
    h += '<div class="rnd-row"><div class="rnd-rank">' + (i + 1) + '</div><div class="rnd-name">' + esc(b.name) + '</div><div class="rnd-earn">+' + fmt(b.amt) + '</div></div>';
  });
  if (res.bust) {
    // One row per player: a card payout replaces their "+0" line instead of adding a second row
    var paid = {};
    (res.payouts || []).forEach(function(p) { (paid[p.name] = paid[p.name] || []).push(p); });
    var payRow = function(n) {
      var ps = paid[n], amt = ps.reduce(function(s, p) { return s + p.amt; }, 0);
      return '<div class="rnd-row"><div class="rnd-rank">' + ico(ps[0].why === 'insurance' ? 'shield' : 'bounty', 'ico-sm') + '</div><div class="rnd-name">' + esc(n) + '</div><div class="rnd-earn rnd-pay">+' + fmt(amt) + ' ' + ps.map(function(p) { return p.why; }).join(' + ') + '</div></div>';
    };
    Object.keys(paid).forEach(function(n) { if (res.victims.indexOf(n) === -1) h += payRow(n); });
    res.victims.forEach(function(n) {
      if (paid[n]) { h += payRow(n); return; }
      var cum = G.cumMiss[n] || 0;
      var cumStr = cum > res.pot ? '<span class="rnd-miss-total">(' + fmt(cum) + ' total)</span>' : '';
      var ll = lms ? (res.lifeLost || []).filter(function(l) { return l.name === n; })[0] : null;
      var lifeStr = ll ? (ll.out ? '<span class="rnd-out">out</span>' : ll.spared ? '<span class="rnd-out" style="color:#ffd23f">spared</span>' : '<span class="rnd-hearts">−1 ' + ico('heart') + '</span>') : '';
      h += '<div class="rnd-row"><div class="rnd-rank">—</div><div class="rnd-name">' + esc(n) + lifeStr + '</div><div class="rnd-zero">+0</div><div class="rnd-miss">left ' + fmt(res.pot) + cumStr + '</div></div>';
    });
  }
  h += '<div class="rnd-stand-head">Standings</div>';
  var order = G.players.slice();
  if (lms) order.sort(function(a, b) { return (a.out - b.out) || (b.lives - a.lives) || (b.score - a.score); });
  else order.sort(function(a, b) { return b.score - a.score; });
  order.forEach(function(p, i) {
    var lives = lms ? (p.out ? '<span class="rnd-out">out rd ' + p.outRound + '</span>' : '<span class="rnd-hearts">' + heartsHTML(p.lives, p.lives) + '</span>') : '';
    h += '<div class="rnd-stand-row' + (i === 0 ? ' lead' : '') + '"><div class="rnd-stand-pos">' + (i + 1) + '</div><div class="rnd-stand-name">' + esc(p.name) + lives + '</div><div class="rnd-stand-pts">' + fmt(p.score) + '</div></div>';
  });
  sh.innerHTML = h;
  var btns = document.createElement('div'); btns.className = 'rnd-btns';
  var undo = document.createElement('button'); undo.className = 'rnd-undo'; undo.textContent = 'Undo';
  undo.onclick = function() { undoLast(); };
  var next = document.createElement('button'); next.className = 'rnd-next';
  var over = (lms && activePlayers().length <= 1) || (G.mode !== 'race' && !lms && G.round >= G.total);
  next.textContent = over ? (lms ? 'See the winner →' : 'See Final Scores') : 'Next Round →';
  next.onclick = function() { ov.remove(); endRound(); };
  if (HISTORY.length) btns.appendChild(undo);
  btns.appendChild(next);
  sh.appendChild(btns);
  ov.appendChild(sh);
  document.body.appendChild(ov);
}

// ══ ROUND INTRO: chaos card, showdown, sudden death ══
function showRoundIntro() {
  if (G.phase !== 'reveal' || !G.intro) { G.phase = 'play'; render(); return; }
  document.querySelectorAll('.mod-reveal').forEach(function(e) { e.remove(); });
  var ov = document.createElement('div'); ov.className = 'mod-reveal';
  var h = '', intro = G.intro;
  if (intro.indexOf('showdown') !== -1) {
    var a = activePlayers();
    h += '<div class="mr-label">Last Man Standing · Round ' + G.round + '</div><div class="sd-title">Final Two</div><div class="sd-vs">';
    a.forEach(function(p, i) {
      if (i) h += '<div class="sd-x">VS</div>';
      h += '<div class="sd-player"><div class="sd-name">' + esc(p.name) + '</div><div class="gi-hearts" style="font-size:1.4rem">' + heartsHTML(p.lives, p.lives) + '</div><div class="sd-meta">' + fmt(p.score) + ' pts</div></div>';
    });
    h += '</div>';
    if (intro.indexOf('sudden') !== -1) h += '<div class="mr-desc" style="text-align:center;color:#ff3b30">Sudden death: one life each. Minimum bank ' + fmt(lmsMinBank()) + '.</div>';
    later(function() { SFX.showdown(); }, 60);
  } else if (intro.indexOf('sudden') !== -1) {
    h += '<div class="mr-label">Round ' + G.round + '</div><div class="mr-cards"><div class="mr-card danger">' + '<div class="mr-icon">' + ico('skull') + '</div><div class="mr-name">Sudden Death</div><div class="mr-desc">Everyone left is down to one life. The minimum bank is now ' + fmt(lmsMinBank()) + ' and climbs every round.</div></div></div>';
    later(function() { SFX.showdown(); }, 60);
  }
  if (intro.indexOf('chaos') !== -1) {
    var two = G.mods.length > 1;
    h += '<div class="mr-label">Round ' + G.round + ' · ' + (two ? 'Double Chaos' : 'This round’s rule') + '</div><div class="mr-cards">';
    G.mods.forEach(function(k) {
      var d = MODS[k];
      h += '<div class="mr-card ' + d.tag + (two ? ' compact' : '') + '"><div class="mr-icon">' + ico(d.icon) + '</div><div class="mr-name">' + esc(d.name) + '</div><div class="mr-desc">' + esc(d.desc) + '</div></div>';
    });
    h += '</div>';
    later(function() { SFX.reveal(); }, 60);
  }
  h += '<button class="mr-go">Let’s roll →</button>';
  ov.innerHTML = h;
  ov.querySelector('.mr-go').onclick = function() {
    ov.remove();
    G.phase = 'play'; G.intro = null;
    render();
  };
  document.body.appendChild(ov);
}

// ══ END SCREEN ══
function showEndScreen() {
  clearIntensity();
  var lms = G.mode === 'lms';
  var winners = (G.winners || []).map(findP).filter(Boolean);
  var order;
  if (lms) {
    var survivors = G.players.filter(function(p) { return !p.out; }).sort(function(a, b) { return (winners.indexOf(b) !== -1) - (winners.indexOf(a) !== -1) || b.lives - a.lives || b.score - a.score; });
    var outs = G.elimOrder.slice().reverse().map(findP).filter(Boolean);
    order = survivors.concat(outs);
  } else order = G.players.slice().sort(function(a, b) { return b.score - a.score; });

  // Hero
  var kicker = lms ? 'Last one standing' : G.winReason === 'race' ? 'Race to ' + fmt(G.raceTarget) : 'Final score';
  var wn = winners.map(function(p) { return esc(p.name); });
  var head = winners.length > 1 ? wn.join(' &amp; ') + ' <em>tie</em>' : (wn[0] || '—') + ' <em>wins</em>';
  var sub = '';
  if (winners.length === 1) {
    var w = winners[0];
    sub = lms ? '<span class="gi-hearts">' + heartsHTML(w.lives, w.lives) + '</span> &nbsp;' + fmt(w.score) + ' pts · survived ' + G.round + ' rounds'
              : fmt(w.score) + ' points' + (order[1] && !lms ? ' · by ' + fmt(w.score - order[1].score) : '');
  }
  $('endHero').innerHTML = '<div class="end-crown">' + ico('crown') + '</div><div class="end-kicker">' + esc(kicker) + '</div><div class="end-winner">' + head + '</div><div class="end-winsub">' + sub + '</div>';

  // Podium (top 3), then everyone else
  var pod = $('endPodium'); pod.innerHTML = '';
  var podN = Math.min(3, order.length);
  var slots = podN === 3 ? [1, 0, 2] : podN === 2 ? [1, 0] : [0];
  slots.forEach(function(idx) {
    var p = order[idx]; if (!p) return;
    var val = lms ? (p.out ? 'out rd ' + p.outRound : heartsHTML(p.lives, p.lives)) : fmt(p.score);
    var d = document.createElement('div'); d.className = 'pod p' + (idx + 1);
    d.innerHTML = '<div class="pod-name">' + esc(p.name) + '</div><div class="pod-pts' + (lms && !p.out ? ' gi-hearts' : '') + '">' + val + '</div><div class="pod-block">' + (idx + 1) + '</div>';
    pod.appendChild(d);
  });
  var list = $('endList'); list.innerHTML = '';
  order.slice(podN).forEach(function(p, i) {
    var row = document.createElement('div'); row.className = 'end-row';
    row.innerHTML = '<div class="end-rank">' + (i + podN + 1) + '</div><div class="end-name">' + esc(p.name) + (lms && p.out ? '<span class="end-sub">out rd ' + p.outRound + '</span>' : '') + '</div><div class="end-pts">' + fmt(p.score) + '</div>';
    list.appendChild(row);
  });

  // Biggest moments: best few, max 2 of a kind
  var mom = $('endMoments'); mom.innerHTML = '';
  var titles = { bank: 'Big bank', bust: 'Biggest bust', double: 'Huge double', comeback: 'Comeback', record: 'New record' };
  var perKind = {}, picks = [];
  G.moments.slice().sort(function(a, b) { return b.value - a.value; }).forEach(function(m) {
    if (picks.length >= 4) return;
    perKind[m.kind] = (perKind[m.kind] || 0) + 1;
    if (perKind[m.kind] <= 2) picks.push(m);
  });
  if (lms && G.elimOrder.length) picks.push({ kind: 'elim', text: 'Knocked out, in order: ' + G.elimOrder.join(' → ') });
  if (picks.length) {
    mom.innerHTML = '<div class="end-section-h">Biggest moments</div>' + picks.map(function(m) { return '<div class="moment-row"><b>' + esc(titles[m.kind] || 'Eliminations') + (m.round ? ' · rd ' + m.round : '') + '</b>' + esc(m.text) + '</div>'; }).join('');
  }

  // Awards
  var awards = $('endAwards'); awards.innerHTML = '';
  var pnames = G.players.map(function(p) { return p.name; });
  function best(fn, min) {
    var bn = null, bv = min ? Infinity : -Infinity;
    pnames.forEach(function(n) { var v = fn(n); if (v == null) return; if (min ? v < bv : v > bv) { bv = v; bn = n; } });
    return { name: bn, val: bv };
  }
  function S(n) { return STATS[n] || { banks: [] }; }
  var defs = [
    { icon: 'devil', title: 'The Menace', fn: function(n) { return S(n).bustSevens; }, fmt: function(v) { return v + ' bust' + (v === 1 ? '' : 's') + ' rolled'; } },
    { icon: 'dice', title: 'The High Roller', fn: function(n) { return S(n).doubles; }, fmt: function(v) { return v + ' double' + (v === 1 ? '' : 's'); } },
    { icon: 'chicken', title: 'The Coward', min: true, fn: function(n) { var b = S(n).banks; return b.length ? b.reduce(function(a, c) { return a + c; }, 0) / b.length : null; }, fmt: function(v) { return 'avg ' + fmt(v) + ' per bank'; } },
    { icon: 'gem', title: 'Diamond Hands', fn: function(n) { var b = S(n).banks; return b.length ? Math.max.apply(null, b) : 0; }, fmt: function(v) { return 'banked ' + fmt(v) + ' at once'; } },
    { icon: 'skull', title: 'The Unlucky', fn: function(n) { return S(n).pointsLost; }, fmt: function(v) { return fmt(v) + ' lost to busts'; } },
    { icon: 'trend', title: 'Comeback Kid', fn: function(n) { return S(n).comebacks; }, fmt: function(v) { return v + ' comeback' + (v === 1 ? '' : 's'); } },
    { icon: 'target', title: 'Ice Cold', fn: function(n) { return S(n).lastStanding; }, fmt: function(v) { return 'banked last ' + v + ' time' + (v === 1 ? '' : 's'); } }
  ];
  var aw = '';
  defs.forEach(function(d) {
    var r = best(d.fn, d.min);
    if (!r.name || !(r.val > 0) || r.val === Infinity) return;
    aw += '<div class="award-row"><div class="award-icon">' + ico(d.icon) + '</div><div class="award-info"><div class="award-title">' + d.title + '</div><div class="award-name">' + esc(r.name) + '</div><div class="award-detail">' + d.fmt(r.val) + '</div></div></div>';
  });
  if (aw) awards.innerHTML = '<div class="end-section-h" style="margin-bottom:-2px">Game-night awards</div>' + aw;

  showScreen('end');
  $('end').scrollTop = 0;
  later(function() { SFX.victory(); }, 250);
  if (lms) {
    spawnConfetti(120, true, { colors: ['#ff3b5c', '#ff6b81', '#ffd23f', '#fff'], shape: 'heart' });
    later(function() { spawnConfetti(90, true, {}); }, 700);
  } else spawnConfetti(180, true);
}
function clearIntensity() {
  ['state-duel', 'state-solo', 'lms-showdown'].forEach(function(c) { document.body.classList.remove(c); $('game').classList.remove(c); });
  document.body.setAttribute('data-heat', '0');
  $('gIntensityLabel').textContent = '';
  SFX._state = 'none';
  SFX.stopDrone();
}
