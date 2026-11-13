// ══ EFFECTS / ANIMATION ══
function doFlash(color) {
  var el = $('flash');
  el.style.background = color; el.className = '';
  void el.offsetWidth; el.className = 'go';
}
function potPulse() {
  var el = $('gPotValue');
  el.style.transition = 'none'; el.style.opacity = '.25';
  setTimeout(function() { el.style.transition = 'opacity .35s'; el.style.opacity = ''; }, 80);
}
function potSlam(mag) {
  if (reducedMotion()) return;
  var el = $('gPotValue');
  if (!el.animate) return;
  try { el.animate([{ scale: '1' }, { scale: String(1.1 + mag * 0.18) }, { scale: '1' }], { duration: 460, easing: 'cubic-bezier(.2,1.6,.4,1)' }); } catch (e) {}
}
function animatePot(from, to) {
  var el = $('gPotValue');
  var dur = 200 + Math.min(400, Math.abs(to - from) / 3), start = performance.now();
  function step(now) {
    var t = Math.min((now - start) / dur, 1);
    t = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = fmt(G.pot);
  }
  requestAnimationFrame(step);
}
function shakeScreen(mag) {
  if (reducedMotion()) return;
  mag = 1 + (mag || 0) * 1.6;
  var game = $('game');
  var frames = [[-6, 0], [6, -3], [-5, 3], [5, -2], [-3, 1], [2, 0], [0, 0]];
  var i = 0;
  var iv = setInterval(function() {
    var f = frames[i++];
    game.style.transform = 'translate(' + (f[0] * mag).toFixed(1) + 'px,' + (f[1] * mag).toFixed(1) + 'px)';
    if (i >= frames.length) { clearInterval(iv); game.style.transform = ''; }
  }, 50);
}

// Confetti canvas (DPR-aware so it's crisp)
var CV = $('cv'), CTX = CV.getContext('2d');
var PTS = [], RAF = false, DPR = 1;
var COLS = ['#ff3300', '#ffe14d', '#38e878', '#60a5fa', '#f472b6', '#fff', '#a78bfa', '#fb923c'];
function resizeCV() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  var h = (document.body && document.body.clientHeight) || innerHeight;
  CV.width = innerWidth * DPR; CV.height = h * DPR;
  CV.style.width = innerWidth + 'px'; CV.style.height = h + 'px';
  CTX.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resizeCV(); addEventListener('resize', resizeCV);
function spawnConfetti(n, big, o) {
  if (reducedMotion()) return;
  o = o || {};
  var W = innerWidth, H = innerHeight;
  var cx = o.x != null ? o.x : W / 2, cy = o.y != null ? o.y : (big ? H * 0.3 : H * 0.55), sm = big ? 1.4 : 1;
  var cols = o.colors || COLS;
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2, sp = (5 + Math.random() * 12) * sm;
    PTS.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up != null ? o.up : (big ? 7 : 4)), col: cols[Math.floor(Math.random() * cols.length)],
      sz: (o.shape === 'heart' ? 7 : 4) + Math.random() * 5, life: 1, decay: 0.013 + Math.random() * 0.013, rot: Math.random() * Math.PI * 2, rs: (Math.random() - 0.5) * 0.22,
      shape: o.shape || (Math.random() > 0.45 ? 'rect' : 'dot') });
  }
  if (!RAF) loopConf();
}
function loopConf() {
  RAF = true; CTX.clearRect(0, 0, innerWidth, innerHeight);
  PTS = PTS.filter(function(p) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.vx *= 0.98; p.rot += p.rs; p.life -= p.decay;
    if (p.life <= 0) return false;
    CTX.save(); CTX.globalAlpha = p.life; CTX.translate(p.x, p.y); CTX.rotate(p.rot); CTX.fillStyle = p.col;
    var s = p.sz;
    if (p.shape === 'rect') CTX.fillRect(-s / 2, -s / 4, s, s / 2);
    else if (p.shape === 'shard') { CTX.beginPath(); CTX.moveTo(-s / 2, -s / 3); CTX.lineTo(s / 2, -s / 2); CTX.lineTo(s / 6, s / 2); CTX.closePath(); CTX.fill(); }
    else if (p.shape === 'heart') { CTX.beginPath(); CTX.moveTo(0, s * 0.3); CTX.bezierCurveTo(-s, -s * 0.3, -s * 0.4, -s, 0, -s * 0.45); CTX.bezierCurveTo(s * 0.4, -s, s, -s * 0.3, 0, s * 0.3); CTX.fill(); }
    else { CTX.beginPath(); CTX.arc(0, 0, s / 2, 0, Math.PI * 2); CTX.fill(); }
    CTX.restore(); return true;
  });
  if (PTS.length > 0) requestAnimationFrame(loopConf);
  else { RAF = false; CTX.clearRect(0, 0, innerWidth, innerHeight); }
}

// Toasts queue instead of overwriting each other
var TOAST = null, TQ = [], TBUSY = false;
function showToast(msg) {
  if (!msg) return;
  TQ.push(msg); if (TQ.length > 3) TQ.shift();
  if (!TBUSY) nextToast();
}
function nextToast() {
  if (!TOAST) { TOAST = document.createElement('div'); TOAST.className = 'toast'; document.body.appendChild(TOAST); }
  if (!TQ.length) { TBUSY = false; TOAST.classList.remove('show'); return; }
  TBUSY = true;
  TOAST.textContent = TQ.shift();
  TOAST.classList.add('show');
  setTimeout(nextToast, TQ.length ? 1100 : 2300);
}

// Announcements: big, brief, never block input
var ANN_Q = [], ANN_BUSY = false;
// big = always worth showing (records, comebacks); the setting can limit to those or turn all off
function announce(title, sub, kind, big) {
  if (PREFS.announce === 'off' || (PREFS.announce === 'big' && !big)) return;
  if (ANN_Q.length >= 2) ANN_Q.shift();
  ANN_Q.push({ title: title, sub: sub, kind: kind });
  if (!ANN_BUSY) nextAnnounce();
}
function nextAnnounce() {
  var a = ANN_Q.shift();
  if (!a) { ANN_BUSY = false; return; }
  ANN_BUSY = true;
  var el = document.createElement('div'); el.className = 'announce' + (a.kind ? ' ann-' + a.kind : '');
  el.innerHTML = '<div class="ann-band"><div class="ann-title">' + esc(a.title) + '</div>' + (a.sub ? '<div class="ann-sub">' + esc(a.sub) + '</div>' : '') + '</div>';
  document.body.appendChild(el);
  SFX.announce(a.kind);
  setTimeout(function() { el.classList.add('out'); }, 1500);
  setTimeout(function() { el.remove(); nextAnnounce(); }, 1850);
}
