// ══ SHARE RESULTS ══
// Draws a results card in the current theme and opens the phone's share sheet
// (falls back to downloading the PNG where sharing files isn't supported).
function shareResults() {
  var btn = $('shareBtn'); if (btn) btn.disabled = true;
  var done = function() { if (btn) btn.disabled = false; };
  var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  ready.then(function() {
    var canvas = drawResultsCard();
    canvas.toBlob(function(blob) {
      if (!blob) { done(); showToast('Couldn’t make the image'); return; }
      var stamp = new Date().toISOString().slice(0, 10);
      var file = null;
      try { file = new File([blob], 'bank-results-' + stamp + '.png', { type: 'image/png' }); } catch (e) {}
      var title = (G.winners || []).join(' & ') + ' won ' + MODE_LABELS[G.mode] + ' on Bank';
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: title, text: title }).catch(function() {}).then(done);
      } else {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bank-results-' + stamp + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 4000);
        showToast('Image saved'); done();
      }
    }, 'image/png');
  });
}

function drawResultsCard() {
  var W = 1080, H = 1350, P = 84;
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d');
  var cs = getComputedStyle(document.body);
  var acc = cs.getPropertyValue('--acc').trim() || '#ff3300';
  var fg = cs.getPropertyValue('--fg').trim() || '#ffffff';
  var disp = cs.getPropertyValue('--disp').trim() || "'Archivo Black', sans-serif";
  var bg = THEME_MAP[T].bg;
  var mono = "'DM Mono', monospace";
  var light = T === 'br';
  var dim = light ? 'rgba(26,26,26,.55)' : 'rgba(255,255,255,.5)';
  var faint = light ? 'rgba(26,26,26,.12)' : 'rgba(255,255,255,.08)';

  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // soft glow behind the winner
  var grd = x.createRadialGradient(W / 2, 470, 40, W / 2, 470, 620);
  grd.addColorStop(0, hexA(acc, light ? 0.10 : 0.18)); grd.addColorStop(1, hexA(acc, 0));
  x.fillStyle = grd; x.fillRect(0, 0, W, H);
  x.fillStyle = acc; x.fillRect(0, 0, W, 14);

  function text(str, px, font, color, align, y, maxW, left) {
    var size = px;
    x.font = size + 'px ' + font;
    while (maxW && x.measureText(str).width > maxW && size > 20) { size -= 4; x.font = size + 'px ' + font; }
    x.fillStyle = color; x.textAlign = align || 'left'; x.textBaseline = 'alphabetic';
    x.fillText(str, align === 'center' ? W / 2 : align === 'right' ? W - P : (left || P), y);
    return size;
  }

  var d = new Date();
  text('BANK', 54, disp, fg, 'left', 120);
  text(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(), 28, mono, dim, 'right', 112);
  text((MODE_LABELS[G.mode] || '').toUpperCase(), 30, mono, acc, 'left', 168);

  // Crown
  x.save(); x.translate(W / 2, 300); x.scale(4.2, 4.2); x.translate(-12, -12);
  x.fillStyle = acc; x.fill(new Path2D('M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z')); x.restore();

  var winners = G.winners || [];
  var lms = G.mode === 'lms';
  text(lms ? 'LAST ONE STANDING' : winners.length > 1 ? 'TIED FOR THE WIN' : 'WINNER', 30, mono, dim, 'center', 420);
  text((winners.join(' & ') || '—').toUpperCase(), 132, disp, fg, 'center', 548, W - P * 2);
  var w0 = findP(winners[0]);
  if (w0) text(lms ? (w0.lives + ' ' + (w0.lives === 1 ? 'life' : 'lives') + ' left · ' + fmt(w0.score) + ' pts') : fmt(w0.score) + ' points', 38, mono, acc, 'center', 610);

  // Standings with score bars
  var order = G.players.slice().sort(function(a, b) { return lms ? ((a.out - b.out) || (b.lives - a.lives) || (b.score - a.score)) : b.score - a.score; });
  var max = Math.max(1, Math.max.apply(null, order.map(function(p) { return p.score; })));
  var y0 = 700, rowH = Math.min(78, 430 / Math.max(1, order.length));
  order.slice(0, 8).forEach(function(p, i) {
    var y = y0 + i * rowH;
    x.fillStyle = faint; roundRect(x, P, y, W - P * 2, rowH - 14, 10); x.fill();
    var bw = Math.max(0, (W - P * 2) * (p.score / max));
    x.fillStyle = hexA(acc, i === 0 ? (light ? 0.35 : 0.45) : (light ? 0.16 : 0.2)); roundRect(x, P, y, bw, rowH - 14, 10); x.fill();
    var fs = Math.round(Math.min(38, rowH * 0.5));
    var ty = y + (rowH - 14) / 2 + fs * 0.36;
    text((i + 1) + '', fs * 0.8, mono, dim, 'left', ty);
    x.font = fs + 'px ' + disp; x.fillStyle = fg; x.textAlign = 'left';
    var nm = p.name; while (x.measureText(nm).width > W - P * 2 - 330 && nm.length > 3) nm = nm.slice(0, -1);
    x.fillText(nm + (nm !== p.name ? '…' : ''), P + 64, ty);
    text(lms && p.out ? 'out rd ' + p.outRound : fmt(p.score), fs, disp, fg, 'right', ty);
  });

  // Best moment of the night
  var m = (G.moments || []).slice().sort(function(a, b) { return b.value - a.value; })[0];
  if (m) {
    x.fillStyle = acc; x.fillRect(P, 1170, 6, 70);
    text('MOMENT OF THE NIGHT', 24, mono, acc, 'left', 1192, 0, P + 28);
    var mt = m.text; x.font = '30px ' + mono;
    while (x.measureText(mt).width > W - P * 2 - 40 && mt.length > 10) mt = mt.slice(0, -2);
    text(mt + (mt !== m.text ? '…' : ''), 30, mono, fg, 'left', 1232, 0, P + 28);
  }
  text(location.hostname && location.hostname !== 'localhost' ? location.hostname : 'bank.keeganwhitacre.com', 26, mono, dim, 'center', H - 44);
  return c;
}
function roundRect(x, l, t, w, h, r) {
  r = Math.min(r, w / 2, h / 2); x.beginPath();
  if (w <= 0) { x.rect(l, t, 0, h); return; }
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
function hexA(hex, a) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(function(c) { return c + c; }).join('');
  var n = parseInt(h, 16);
  if (isNaN(n)) return 'rgba(255,51,0,' + a + ')';
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
