// ══ CARD SYSTEM (Sabotage) ══
var CARDS = {};
function blankEffects() { return Rules.blankEffects(); }
var EFFECTS = blankEffects();
var FREEZE_DEALT = false;
var CARD_DEFS = {
  retire:     { icon: ico('retire'), name: 'Early Retirement', desc: 'Pay 25 from your score to force a player to bank the current pot and sit out the rest of the round.', tag: 'danger', tagLabel: 'costs 25 pts · forces bank', needsTarget: true },
  insurance:  { icon: ico('shield'), name: 'Insurance', desc: 'If the round busts while you’re still in, you keep half the pot.', tag: 'safe', tagLabel: 'half the pot on bust', needsTarget: false },
  doubledown: { icon: ico('bolt'), name: 'Double Down', desc: 'From roll 4: the next roll doubles the pot if it’s even, halves it if odd. A 7 still busts.', tag: 'danger', tagLabel: 'gamble — even doubles, odd halves', needsTarget: false },
  freeze:     { icon: ico('snowflake'), name: 'Freeze', desc: 'Pick a player. They can’t bank this round.', tag: 'danger', tagLabel: 'one per game · blocks banking', needsTarget: true },
  tax:        { icon: ico('coins'), name: 'Tax', desc: 'The next player who banks this round pays you 20% of their take.', tag: 'gold', tagLabel: 'skims the next banker', needsTarget: false },
  bounty:     { icon: ico('bounty'), name: 'Bounty', desc: 'Pick a player. If they bust, everyone else still in splits the pot (or you take it all if nobody else is). Fizzles if they bank.', tag: 'gold', tagLabel: 'bet against a player', needsTarget: true }
};
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
  var ov = document.createElement('div'); ov.className = 'card-deal-overlay';
  var sh = document.createElement('div'); sh.className = 'card-deal-sheet';
  sh.innerHTML = '<div class="card-deal-title">New Cards Dealt</div><div class="card-deal-sub">Round ' + G.round + ' — everyone gets a card</div>';
  var rows = document.createElement('div'); rows.className = 'card-deal-rows';
  G.players.forEach(function(p) {
    var cardKey = dealt[p.name], def = CARD_DEFS[cardKey];
    var hand = CARDS[p.name].slice(); hand.splice(hand.lastIndexOf(cardKey), 1);
    var row = document.createElement('div'); row.className = 'card-deal-row';
    row.innerHTML = '<div class="card-deal-player">' + esc(p.name) + '</div><div class="card-deal-card">' + (hand.length ? hand.map(function(c) { return CARD_DEFS[c] ? CARD_DEFS[c].icon : ''; }).join('') + ' + ' : '') + '<span class="card-deal-new">' + (def ? def.icon + ' ' + def.name : cardKey) + '</span></div>';
    rows.appendChild(row);
  });
  sh.appendChild(rows);
  var btn = document.createElement('button'); btn.className = 'card-deal-btn'; btn.textContent = 'Got it';
  btn.onclick = function() { ov.remove(); };
  sh.appendChild(btn); ov.appendChild(sh); document.body.appendChild(ov);
}
function cardBlockReason(cardKey, roller) {
  if (cardKey === 'retire' && roller.score < 25) return 'need 25+ pts (' + roller.score + ')';
  if (cardKey === 'bounty' && EFFECTS.bounty) return 'bounty already active';
  if (cardKey === 'doubledown' && !nextRollDanger()) return 'playable from roll ' + (safeRollCount() + 1);
  if (cardKey === 'doubledown' && EFFECTS.doubledown) return 'double down already active';
  return '';
}
function showCardPicker() {
  if (G.phase !== 'play' || anyOverlay()) return;
  var roller = G.players[G.roller], hand = CARDS[roller.name] || [];
  if (!hand.length) return;
  var s = makeSheet('cardPicker', roller.name + '’s hand');
  var list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  hand.forEach(function(cardKey, idx) {
    var def = CARD_DEFS[cardKey]; if (!def) return;
    var reason = cardBlockReason(cardKey, roller);
    var item = document.createElement('div'); item.className = 'card-sheet-item' + (reason ? ' card-disabled' : '');
    item.innerHTML = '<div class="card-sheet-icon">' + def.icon + '</div><div class="card-sheet-info"><div class="card-sheet-name">' + def.name + '</div><div class="card-sheet-desc">' + def.desc + '</div><span class="card-sheet-tag ' + def.tag + '">' + def.tagLabel + '</span>' + (reason ? '<div class="card-sheet-disabled-reason">' + esc(reason) + '</div>' : '') + '</div>';
    if (!reason) item.addEventListener('click', function() { s.close(); if (def.needsTarget) showCardTargetPicker(cardKey, idx); else playCard(cardKey, idx, null); });
    list.appendChild(item);
  });
  s.sh.appendChild(list);
  addCancel(s);
}
function showCardTargetPicker(cardKey, cardIdx) {
  var def = CARD_DEFS[cardKey], roller = G.players[G.roller];
  var reason = cardBlockReason(cardKey, roller); if (reason) { showToast(reason); return; }
  var targets = G.players.filter(function(p) { return p.name !== roller.name && !p.banked && !p.out; });
  if (!targets.length) { showToast('No valid targets'); return; }
  var s = makeSheet('cardTargetPicker', 'Target who?');
  var pg = document.createElement('div'); pg.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  targets.forEach(function(p) {
    var b = document.createElement('button'); b.className = 'sh-player-row';
    b.innerHTML = '<span>' + esc(p.name) + '</span><span class="sh-player-row-amt">' + def.icon + ' ' + def.name + '</span>';
    b.addEventListener('click', function() { s.close(); playCard(cardKey, cardIdx, p.name); });
    pg.appendChild(b);
  });
  s.sh.appendChild(pg);
  addCancel(s);
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
      roller.score -= 25;
      var amt = G.pot;
      tp.score += amt; tp.banked = true; tp.bankedAmt = amt;
      G.bankedThisRound.push({ name: tp.name, amt: amt });
      STATS[tp.name].banks.push(amt);
      SFX.bank(amt);
      showToast(roller.name + ' retired ' + target + '! (−25 pts, ' + target + ' banks ' + fmt(amt) + ')');
      if (activeUnbanked().length === 0) { roundClear(); return; }
      break;
    case 'insurance':
      if (EFFECTS.insurance.indexOf(roller.name) === -1) EFFECTS.insurance.push(roller.name);
      showToast(roller.name + ' is insured: half the pot on a bust'); break;
    case 'doubledown':
      EFFECTS.doubledown = true; showToast('Double Down! Even doubles, odd halves'); break;
    case 'freeze':
      EFFECTS.freeze = target; showToast(target + ' is frozen! Can’t bank this round.'); break;
    case 'tax':
      EFFECTS.tax = roller.name; showToast(roller.name + ' played Tax! Next banker pays 20%'); break;
    case 'bounty':
      EFFECTS.bounty = { by: roller.name, target: target }; showToast(roller.name + ' put a bounty on ' + target + '!'); break;
  }
  render();
}
function renderEffectBanner() {
  var banner = $('gEffectBanner');
  if (G.mode !== 'sabotage') { banner.innerHTML = ''; return; }
  var parts = [];
  if (EFFECTS.insurance.length) parts.push('<span class="eff-safe">' + ico('shield', 'ico-sm') + ' ' + esc(EFFECTS.insurance.join(', ')) + ' insured</span>');
  if (EFFECTS.doubledown) parts.push('<span class="eff-danger">' + ico('bolt', 'ico-sm') + ' double down active</span>');
  if (EFFECTS.freeze) parts.push('<span class="eff-danger">' + ico('snowflake', 'ico-sm') + ' ' + esc(EFFECTS.freeze) + ' frozen</span>');
  if (EFFECTS.tax) parts.push('<span class="eff-gold">' + ico('coins', 'ico-sm') + ' tax → ' + esc(EFFECTS.tax) + '</span>');
  if (EFFECTS.bounty) parts.push('<span class="eff-danger">' + ico('bounty', 'ico-sm') + ' bounty on ' + esc(EFFECTS.bounty.target) + '</span>');
  banner.innerHTML = parts.join('');
}
