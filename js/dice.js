// ══ VIRTUAL DICE ══
var DICE_ROLLING = false, DICE_IV = null;
var DIE_PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]] };
function renderGameDie(id, val) {
  var grid = $(id + 'pips'); if (!grid) return;
  grid.innerHTML = '';
  grid.classList.toggle('idle', !val);
  var filled = DIE_PIPS[val] || [];
  for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
    var cell = document.createElement('span');
    if (filled.some(function(p) { return p[0] === r && p[1] === c; })) { var pip = document.createElement('div'); pip.className = 'g-die-pip'; cell.appendChild(pip); }
    grid.appendChild(cell);
  }
}
function rollInGameDice() {
  if (DICE_ROLLING || G.phase !== 'play' || anyOverlay()) return;
  DICE_ROLLING = true;
  var d1 = $('gDie1'), d2 = $('gDie2'), btn = $('gDiceRollBtn');
  d1.classList.add('rolling'); d2.classList.add('rolling');
  btn.disabled = true;
  var flashes = 0;
  DICE_IV = setInterval(function() {
    renderGameDie('gDie1', Math.ceil(Math.random() * 6));
    renderGameDie('gDie2', Math.ceil(Math.random() * 6));
    if (++flashes < 9) return;
    clearInterval(DICE_IV); DICE_IV = null;
    var v1 = Math.ceil(Math.random() * 6), v2 = Math.ceil(Math.random() * 6);
    renderGameDie('gDie1', v1); renderGameDie('gDie2', v2);
    d1.classList.remove('rolling'); d2.classList.remove('rolling');
    // Stay locked until the roll is actually submitted, so a second tap can't double-roll
    later(function() {
      DICE_ROLLING = false;
      submitRoll(v1 === v2, v1 + v2, null, [v1, v2]);
      if (G.phase === 'play') btn.disabled = false;
    }, 420);
  }, 55);
}
