// ══ ROLL IN THE APP: 3D dice, tap or shake ══
// The roll is the most-watched moment when the phone rolls, so it gets a proper tumble,
// a rattle, a beat to read the result, and only then goes into the game like a keypad tap.
var STAGE = { rolling: false, token: 0, rx: [0, 0], ry: [0, 0] };
// Rotation that brings each value to the front. Faces: front 1, top 2, right 3, left 4, bottom 5, back 6
var FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
var FACE_POS = [[1, 'rotateY(0deg)'], [6, 'rotateY(180deg)'], [3, 'rotateY(90deg)'], [4, 'rotateY(-90deg)'], [2, 'rotateX(90deg)'], [5, 'rotateX(-90deg)']];

function diceStyle() { return PREFS.diceStyle === 'legacy' ? 'legacy' : '3d'; }
function stageOn() { return USE_DICE && diceStyle() === '3d'; }

function buildStageDice() {
  ['stDie1', 'stDie2'].forEach(function(id) {
    var cube = $(id).querySelector('.st-cube'); if (cube.children.length) return;
    FACE_POS.forEach(function(f) {
      var face = document.createElement('div'); face.className = 'st-face';
      face.style.transform = f[1] + ' translateZ(var(--half))';
      var pips = DIE_PIPS[f[0]];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
        var cell = document.createElement('span');
        if (pips.some(function(p) { return p[0] === r && p[1] === c; })) cell.className = 'pip';
        face.appendChild(cell);
      }
      cube.appendChild(face);
    });
  });
}
function setCube(i, val, spins, instant) {
  var cube = $('stDie' + (i + 1)).querySelector('.st-cube');
  var base = FACE_ROT[val];
  // Always spin forward from where the die is now, plus whole turns for the tumble
  var nx = base[0] + 360 * Math.ceil((STAGE.rx[i] - base[0]) / 360) + 360 * spins;
  var ny = base[1] + 360 * Math.ceil((STAGE.ry[i] - base[1]) / 360) + 360 * spins * (i ? 1 : -1);
  if (spins === 0) { nx = base[0]; ny = base[1]; }
  STAGE.rx[i] = nx; STAGE.ry[i] = ny;
  cube.style.transition = instant ? 'none' : '';
  cube.style.transform = 'rotateX(' + nx + 'deg) rotateY(' + ny + 'deg)';
}
function renderStage() {
  var st = $('gStage'); if (!st) return;
  st.style.display = stageOn() ? '' : 'none';
  if (!stageOn()) return;
  buildStageDice();
  var roller = G.players[G.roller];
  if (!STAGE.rolling) {
    var ld = G.lastDice || [6, 6];
    setCube(0, ld[0], 0, true); setCube(1, ld[1], 0, true);
    $('stResult').className = 'st-result';
    $('stResult').textContent = '';
    var danger = nextRollDanger();
    $('stHint').innerHTML = G.phase === 'play' && roller
      ? '<b>' + esc(roller.name) + '</b> · ' + (SHAKE.on ? 'shake or tap to roll' : shakeWanted() && typeof DeviceMotionEvent !== 'undefined' ? 'tap to roll (shake works after one tap)' : 'tap to roll') + (danger ? ' · <span class="st-danger">7 busts</span>' : '')
      : '';
  }
  st.classList.toggle('idle', !G.lastDice);
}
function rollStage() {
  enableShake();                      // the first tap is a user gesture: the right moment to ask iOS
  if (STAGE.rolling || G.phase !== 'play' || anyOverlay()) return;
  STAGE.rolling = true;
  var token = ++STAGE.token;
  var v = [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)];
  var quick = reducedMotion();
  var st = $('gStage');
  st.classList.remove('landed'); st.classList.add('rolling');
  $('stResult').className = 'st-result'; $('stResult').textContent = '';
  $('stHint').textContent = '';
  setCube(0, v[0], quick ? 0 : 2 + Math.floor(Math.random() * 2));
  setCube(1, v[1], quick ? 0 : 2 + Math.floor(Math.random() * 2));
  var heat = computeHeat();
  if (!quick) { try { SFX.rattle(); } catch (e) {} buzz([10, 60, 10, 60, 10]); }
  later(function() {
    if (token !== STAGE.token) return;
    st.classList.remove('rolling'); st.classList.add('landed');
    var total = v[0] + v[1], dbl = v[0] === v[1];
    var bust = nextRollDanger() && Rules.isBustTotal(G, total);
    try { if (dbl) SFX.doubles(heat); else SFX.roll(heat); } catch (e) {}
    buzz(bust ? [40, 30, 60] : 18);
    var res = $('stResult');
    res.innerHTML = '<b>' + total + '</b>' + (dbl ? '<span>doubles</span>' : '');
    res.className = 'st-result show' + (bust ? ' bust' : dbl ? ' dbl' : '');
    // A beat to read it, then it counts exactly like a keypad tap
    later(function() {
      if (token !== STAGE.token) return;
      STAGE.rolling = false;
      submitRoll(dbl, total, null, v);
    }, quick ? 350 : 750);
  }, quick ? 120 : 1050);
}
function cancelStageRoll() { STAGE.token++; STAGE.rolling = false; var st = $('gStage'); if (st) st.classList.remove('rolling', 'landed'); }

// ── Shake to roll ──
var SHAKE = { on: false, asked: false, hits: 0, t: 0, last: 0, first: 0, dir: 0 };
// Tuning: how hard a jolt must be (m/s², gravity removed), how many back-and-forth jolts, and within how long
var SHAKE_G = 20, SHAKE_HITS = 3, SHAKE_WINDOW = 1000, SHAKE_GAP = 110, SHAKE_COOLDOWN = 2500;
var LS_MOTION = 'bank.motion.v1';
function shakeWanted() { return PREFS.dice && diceStyle() === '3d' && PREFS.shake !== false; }
function enableShake() {
  if (SHAKE.on || PREFS.shake === false || typeof DeviceMotionEvent === 'undefined') return;
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS: allowed only during a tap. The prompt shows once; after that it resolves silently,
    // but it still has to be asked again every time the app is relaunched.
    if (SHAKE.asked) return;
    SHAKE.asked = true;
    DeviceMotionEvent.requestPermission().then(function(s) {
      if (s === 'granted') { try { localStorage.setItem(LS_MOTION, 'granted'); } catch (e) {} attachShake(); }
      else { try { localStorage.removeItem(LS_MOTION); } catch (e) {} }
    }).catch(function() { SHAKE.asked = false; });
  } else attachShake();
}
function attachShake() {
  if (SHAKE.on) return;
  SHAKE.on = true;
  window.addEventListener('devicemotion', onShakeMotion);
  if ($('game').classList.contains('active')) renderStage();
}
// After a relaunch, renew motion access on the first tap anywhere (Resume, Play, a chip...)
// so shaking works without having to tap the dice first.
(function() {
  var renew = function() {
    if (SHAKE.on) { done(); return; }
    var had = false; try { had = localStorage.getItem(LS_MOTION) === 'granted'; } catch (e) {}
    if (shakeWanted() || had) enableShake();
    if (SHAKE.asked || SHAKE.on) done();
  };
  var done = function() { ['touchend', 'click'].forEach(function(ev) { document.removeEventListener(ev, renew, true); }); };
  ['touchend', 'click'].forEach(function(ev) { document.addEventListener(ev, renew, true); });
})();
function onShakeMotion(e) {
  if (!stageOn() || PREFS.shake === false || !$('game').classList.contains('active')) return;
  var a = e.acceleration, x, y, z;
  if (a && a.x != null) { x = a.x; y = a.y; z = a.z; }
  else { var b = e.accelerationIncludingGravity; if (!b || b.x == null) return; x = b.x; y = b.y; z = b.z - 9.81; }
  var g = Math.sqrt(x * x + y * y + z * z);
  var now = Date.now();
  if (g < SHAKE_G || now - SHAKE.last < SHAKE_COOLDOWN) return;
  // The motion sensor reports ~60x a second, so one flick produces a run of strong readings.
  // Only count a jolt if enough time has passed AND it goes the opposite way to the previous one.
  var ax = Math.abs(x) >= Math.abs(y) && Math.abs(x) >= Math.abs(z) ? x : Math.abs(y) >= Math.abs(z) ? y : z;
  var dir = ax > 0 ? 1 : -1;
  if (now - SHAKE.t < SHAKE_GAP || dir === SHAKE.dir) { if (now - SHAKE.t >= SHAKE_GAP) SHAKE.t = now; return; }
  if (!SHAKE.hits || now - SHAKE.first > SHAKE_WINDOW) { SHAKE.hits = 0; SHAKE.first = now; }
  SHAKE.hits++; SHAKE.t = now; SHAKE.dir = dir;
  if (SHAKE.hits >= SHAKE_HITS) { SHAKE.last = now; SHAKE.hits = 0; SHAKE.dir = 0; rollStage(); }
}
