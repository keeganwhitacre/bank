// ══ CARD SYSTEM (Sabotage) ══
var CARDS = {};
function blankEffects() { return Rules.blankEffects(); }
var EFFECTS = blankEffects();
var FREEZE_DEALT = false;
var CARD_DEFS = {
  retire:     { icon: ico('retire'), short: 'Retire', name: 'Early Retirement', desc: 'Pay 10% of your score (at least 25) to force a player to bank the current pot and sit out the rest of the round.', tag: 'danger', tagLabel: 'costs 10% (min 25) · forces bank', needsTarget: true },
  insurance:  { icon: ico('shield'), short: 'Insure', name: 'Insurance', desc: 'If the round busts while you’re still in, you keep half the pot.', tag: 'safe', tagLabel: 'half the pot on bust', needsTarget: false },
  doubledown: { icon: ico('bolt'), short: 'Double Down', name: 'Double Down', desc: 'From roll 4: the next roll doubles the pot if it’s even, halves it if odd. A 7 still busts.', tag: 'danger', tagLabel: 'gamble — even doubles, odd halves', needsTarget: false },
  freeze:     { icon: ico('snowflake'), short: 'Freeze', name: 'Freeze', desc: 'Pick a player. They can’t bank this round.', tag: 'danger', tagLabel: 'one per game · blocks banking', needsTarget: true },
  tax:        { icon: ico('coins'), short: 'Tax', name: 'Tax', desc: 'The next player who banks this round pays you 20% of their take.', tag: 'gold', tagLabel: 'skims the next banker', needsTarget: false },
  bounty:     { icon: ico('bounty'), short: 'Bounty', name: 'Bounty', desc: 'Pick a player. If they bust, everyone else still in splits the pot (or you take it all if nobody else is). Fizzles if they bank.', tag: 'gold', tagLabel: 'bet against a player', needsTarget: true }
};
// Scales so a leader can't spam it for pocket change: 10% of your score, minimum 25, in 5s
function retireCost(p) { return Math.max(25, Math.round(p.score * 0.10 / 5) * 5); }
var ALL_CARDS = ['retire', 'insurance', 'doubledown', 'tax', 'bounty'];
function randomCard() {
  var pool = ALL_CARDS.slice();
  if (!FREEZE_DEALT) pool.push('freeze');
  var pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick === 'freeze') FREEZE_DEALT = true;
  return pick;
}
function initCards(names) {
  CARDS = {}; FREEZE_DEALT = false;
  names.forEach(function(n) { CARDS[n] = []; });
  resetEffects();
  names.forEach(function(n) { CARDS[n].push(randomCard()); });
}
function resetEffects() { EFFECTS = blankEffects(); }
function maybeRoundDeal() {
  if (G.mode !== 'sabotage' || G.round === 1) return;
  if ((G.round - 1) % 5 === 0) {
    var dealt = {};
    G.players.forEach(function(p) { var c = randomCard(); CARDS[p.name].push(c); dealt[p.name] = c; });
    showCardDealOverlay(dealt);
  }
}
function showCardDealOverlay(dealt) {
  var ov = document.createElement('div'); ov.className = 'mod-reveal card-reveal';
  var h = '<div class="mr-label">Round ' + G.round + ' · new cards</div><div class="cd-grid">';
  G.players.forEach(function(p) {
    var def = CARD_DEFS[dealt[p.name]]; if (!def) return;
    h += '<div class="cd-card ' + def.tag + '"><div class="cd-who">' + esc(p.name) + '</div><div class="cd-ico">' + def.icon + '</div><div class="cd-name">' + esc(def.name) + '</div><div class="cd-tag">' + esc(def.tagLabel) + '</div></div>';
  });
  h += '</div><button class="mr-go">Deal me in</button>';
  ov.innerHTML = h;
  ov.querySelector('.mr-go').onclick = function() { ov.remove(); };
  document.body.appendChild(ov);
}
function cardBlockReason(cardKey, roller) {
  if (cardKey === 'retire' && roller.score < retireCost(roller)) return 'need ' + retireCost(roller) + '+ pts';
  if (cardKey === 'bounty' && EFFECTS.bounty) return 'bounty already active';
  if (cardKey === 'doubledown' && !nextRollDanger()) return 'playable from roll ' + (safeRollCount() + 1);
  if (cardKey === 'doubledown' && EFFECTS.doubledown) return 'double down already active';
  return '';
}
function nextDealRound() { var r = G.round + 1; while ((r - 1) % 5) r++; return r; }
// Info strip in Sabotage: the current roller's hand, one tap from playing
function sabotageTrayHTML() {
  var roller = G.players[G.roller]; if (!roller) return '';
  var hand = CARDS[roller.name] || [];
  var h = EFFECTS.doubledown ? '<span class="gi-txt gi-danger">' + ico('bolt', 'ico-sm') + ' Double down</span>' : '';
  if (!hand.length) return h + '<span class="gi-txt">' + esc(roller.name) + ' has no cards · deal in round ' + nextDealRound() + '</span>';
  h += '<span class="gi-mode">Cards</span>';
  return h + hand.map(function(k, i) {
    var d = CARD_DEFS[k]; if (!d) return '';
    var blocked = G.phase !== 'play' || !!cardBlockReason(k, roller);
    return '<button class="gi-card ' + d.tag + (blocked ? ' blocked' : '') + '" onclick="showCardSheet(' + i + ')">' + d.icon + '<b>' + esc(d.short) + '</b></button>';
  }).join('');
}
function showCardPicker() { if ((CARDS[(G.players[G.roller] || {}).name] || []).length) showCardSheet(0); }
function showCardSheet(idx) {
  if (G.phase !== 'play' || anyOverlay()) return;
  var roller = G.players[G.roller], cardKey = (CARDS[roller.name] || [])[idx], def = CARD_DEFS[cardKey];
  if (!def) return;
  var reason = cardBlockReason(cardKey, roller);
  var s = makeSheet('cardSheet', '');
  var cost = cardKey === 'retire' ? ' (' + retireCost(roller) + ' pts for you)' : '';
  var box = document.createElement('div'); box.className = 'cs-card ' + def.tag;
  box.innerHTML = '<div class="cs-ico">' + def.icon + '</div><div class="cs-name">' + esc(def.name) + '</div><div class="cs-desc">' + esc(def.desc + cost) + '</div>' + (reason ? '<div class="cs-why">Can’t play yet: ' + esc(reason) + '</div>' : '');
  s.sh.appendChild(box);
  if (!reason) {
    if (def.needsTarget) {
      var targets = G.players.filter(function(p) { return p.name !== roller.name && !p.banked && !p.out; });
      var lab = document.createElement('div'); lab.className = 'cs-label'; lab.textContent = targets.length ? 'Play it on' : 'No one left to target';
      s.sh.appendChild(lab);
      targets.forEach(function(p) {
        var b = document.createElement('button'); b.className = 'sh-player-row';
        b.innerHTML = '<span>' + esc(p.name) + '</span><span class="sh-player-row-amt">' + fmt(p.score) + '</span>';
        b.addEventListener('click', function() { s.close(); playCard(cardKey, idx, p.name); });
        s.sh.appendChild(b);
      });
    } else {
      var go = document.createElement('button'); go.className = 'sh-done'; go.textContent = 'Play ' + def.short;
      go.onclick = function() { s.close(); playCard(cardKey, idx, null); };
      s.sh.appendChild(go);
    }
  }
  addCancel(s);
  document.body.appendChild(s.bd);
}
// Big moment for the table: who played what on whom. Auto-dismisses; tap to skip.
function showCardPlayReveal(by, cardKey, target, line) {
  var def = CARD_DEFS[cardKey];
  document.querySelectorAll('.mod-reveal').forEach(function(e) { e.remove(); });
  var ov = document.createElement('div'); ov.className = 'mod-reveal card-reveal';
  ov.innerHTML = '<div class="mr-label">' + esc(by) + ' plays</div><div class="mr-cards"><div class="mr-card ' + (def.tag === 'safe' ? '' : def.tag) + '"><div class="mr-icon">' + def.icon + '</div><div class="mr-name">' + esc(def.name) + '</div>' + (target ? '<div class="cr-on">on <b>' + esc(target) + '</b></div>' : '') + '<div class="mr-desc">' + esc(line) + '</div></div></div>';
  var done = function() { if (ov.parentNode) { ov.remove(); render(); } };
  ov.addEventListener('click', done);
  document.body.appendChild(ov);
  later(done, 2200);
}
function cardBadges(name) {
  var b = [];
  if (EFFECTS.freeze === name) b.push('<i class="fx-danger" title="frozen">' + ico('snowflake', 'ico-sm') + '</i>');
  if (EFFECTS.insurance.indexOf(name) !== -1) b.push('<i class="fx-safe" title="insured">' + ico('shield', 'ico-sm') + '</i>');
  if (EFFECTS.bounty && EFFECTS.bounty.target === name) b.push('<i class="fx-danger" title="bounty">' + ico('bounty', 'ico-sm') + '</i>');
  if (EFFECTS.tax === name) b.push('<i class="fx-gold" title="collecting tax">' + ico('coins', 'ico-sm') + '</i>');
  return b.length ? '<div class="g-chip-fx">' + b.join('') + '</div>' : '';
}
function playCard(cardKey, cardIdx, target) {
  if (G.phase !== 'play') return;
  var roller = G.players[G.roller];
  var reason = cardBlockReason(cardKey, roller); if (reason) { showToast(reason); return; }
  pushSnap();
  CARDS[roller.name].splice(cardIdx, 1);
  SFX.card();
  switch (cardKey) {
    case 'retire':
      var tp = findP(target); if (!tp) break;
      var cost = retireCost(roller); roller.score -= cost;
      var amt = G.pot;
      tp.score += amt; tp.banked = true; tp.bankedAmt = amt;
      G.bankedThisRound.push({ name: tp.name, amt: amt });
      STATS[tp.name].banks.push(amt);
      SFX.bank(amt);
      showCardPlayReveal(roller.name, 'retire', target, target + ' banks ' + fmt(amt) + ' and sits out. ' + roller.name + ' pays ' + cost + '.');
      if (activeUnbanked().length === 0) { roundClear(); return; }
      break;
    case 'insurance':
      if (EFFECTS.insurance.indexOf(roller.name) === -1) EFFECTS.insurance.push(roller.name);
      showCardPlayReveal(roller.name, 'insurance', null, 'If this round busts, ' + roller.name + ' keeps half the pot.'); break;
    case 'doubledown':
      EFFECTS.doubledown = true; showCardPlayReveal(roller.name, 'doubledown', null, 'Next roll: even doubles the pot, odd halves it. 7 still busts.'); break;
    case 'freeze':
      EFFECTS.freeze = target; showCardPlayReveal(roller.name, 'freeze', target, target + ' can\u2019t bank this round.'); break;
    case 'tax':
      EFFECTS.tax = roller.name; showCardPlayReveal(roller.name, 'tax', null, 'The next player to bank pays ' + roller.name + ' 20%.'); break;
    case 'bounty':
      EFFECTS.bounty = { by: roller.name, target: target }; showCardPlayReveal(roller.name, 'bounty', target, 'If ' + target + ' busts, the rest of the table splits the pot.'); break;
  }
  render();
}
