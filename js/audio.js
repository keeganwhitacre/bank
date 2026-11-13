// ══ SOUND SYSTEM ══
var AC = null, AUDIO_OK = false;
function getAC() {
  if (!AUDIO_OK || PREFS.sound === 'off') return null;
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
// Audio can only start from a user gesture (iOS especially)
['pointerdown', 'touchend', 'click'].forEach(function(ev) {
  document.addEventListener(ev, function() { AUDIO_OK = true; if (AC && AC.state === 'suspended') AC.resume(); }, { capture: true, passive: true });
});

var SFX = {
  // Every sound goes through one master gain so the volume setting applies everywhere
  _master: null,
  _out: function(ac) {
    if (!SFX._master || SFX._master.context !== ac) { SFX._master = ac.createGain(); SFX._master.connect(ac.destination); }
    SFX._master.gain.value = SOUND_VOL[PREFS.sound] || 0;
    return SFX._master;
  },
  _noise: function(ac, dur, decay) {
    var len = Math.max(1, Math.floor(ac.sampleRate * dur));
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    return buf;
  },
  _tone: function(ac, type, f0, f1, t0, dur, gain, filt) {
    var o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (filt) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(SFX._out(ac)); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  _hit: function(ac, t, dur, decay, type, freq, q, gain) {
    var s = ac.createBufferSource(); s.buffer = SFX._noise(ac, dur, decay);
    var f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    var g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(SFX._out(ac)); s.start(t);
  },

  // Dice on table. Heat (0–4) deepens the thud and adds a sub as the pot grows.
  roll: function(heat) {
    heat = heat || 0;
    var ac = getAC(), t = ac.currentTime;
    SFX._hit(ac, t, 0.06 + heat * 0.01, 12 - heat, 'lowpass', 280 - heat * 35, 0, 0.55 + heat * 0.07);
    SFX._hit(ac, t + 0.005, 0.04, 18, 'bandpass', 1100, 1.2, 0.18);
    if (heat >= 2) SFX._tone(ac, 'sine', 75, 42, t, 0.2, 0.12 * (heat - 1));
  },
  doubles: function(heat) {
    heat = heat || 0;
    var ac = getAC(), t = ac.currentTime;
    [0, 0.055].forEach(function(o) {
      SFX._hit(ac, t + o, 0.07, 10, 'lowpass', 320, 0, o ? 0.65 : 0.5);
      SFX._hit(ac, t + o, 0.05, 16, 'bandpass', 900, 1, 0.3);
    });
    if (heat >= 1) SFX._tone(ac, 'sine', 220, 440 + heat * 120, t + 0.08, 0.28, 0.07 + heat * 0.03);
    if (heat >= 3) SFX._tone(ac, 'sine', 60, 38, t, 0.35, 0.3);
  },
  safeSeven: function(golden) {
    var ac = getAC(), t = ac.currentTime;
    var s = ac.createBufferSource(); s.buffer = SFX._noise(ac, 0.14, 2);
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t); bp.frequency.linearRampToValueAtTime(1800, t + 0.1); bp.Q.value = 2;
    var sg = ac.createGain(); sg.gain.setValueAtTime(0.12, t); sg.gain.linearRampToValueAtTime(0.06, t + 0.1); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(bp); bp.connect(sg); sg.connect(SFX._out(ac)); s.start(t);
    SFX._hit(ac, t + 0.1, 0.025, 20, 'bandpass', 2200, 0.8, 0.22);
    if (golden) { SFX._tone(ac, 'triangle', 880, 880, t + 0.1, 0.4, 0.07); SFX._tone(ac, 'triangle', 1320, 1320, t + 0.18, 0.5, 0.05); }
  },
  // Bust. Magnitude (0–1) scales with the pot: big pots get a deep falling boom.
  bust: function(mag) {
    mag = mag || 0;
    var ac = getAC(), t = ac.currentTime;
    SFX._hit(ac, t, 0.18, 6, 'lowpass', 160, 0, 0.9);
    var sc = ac.createBufferSource(); sc.buffer = SFX._noise(ac, 0.32 + mag * 0.4, 3);
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    var g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32 + mag * 0.4);
    sc.connect(bp); bp.connect(g); g.connect(SFX._out(ac)); sc.start(t);
    SFX._hit(ac, t + 0.01, 0.28, 2, 'highpass', 2000, 0, 0.14);
    if (mag > 0.15) {
      SFX._tone(ac, 'sine', 110, 26, t, 0.6 + mag * 0.7, 0.35 + mag * 0.5);
      SFX._tone(ac, 'sawtooth', 160, 40, t + 0.05, 0.5 + mag * 0.4, 0.06 + mag * 0.08, 400);
    }
    if (mag > 0.6) SFX._hit(ac, t + 0.15, 1.2, 1.5, 'lowpass', 90, 0, 0.5);
  },
  halve: function() {
    var ac = getAC(), t = ac.currentTime;
    SFX._hit(ac, t, 0.12, 6, 'lowpass', 200, 0, 0.6);
    SFX._tone(ac, 'triangle', 440, 220, t, 0.3, 0.08);
  },
  bank: function(amt) {
    amt = amt || 0;
    var ac = getAC(), t = ac.currentTime;
    SFX._hit(ac, t, 0.022, 22, 'bandpass', 1800, 1.5, 0.45);
    SFX._hit(ac, t, 0.09, 8, 'lowpass', 240, 0, 0.6);
    SFX._hit(ac, t + 0.01, 0.22, 1.5, 'bandpass', 380, 4, 0.07);
    if (amt >= 250) [0.06, 0.12, 0.19, 0.27].forEach(function(o, i) { SFX._hit(ac, t + o, 0.03, 18, 'bandpass', 2600 + i * 400, 3, 0.12); });
  },
  roundClear: function() {
    var ac = getAC(), t = ac.currentTime;
    SFX._hit(ac, t, 0.018, 24, 'bandpass', 1600, 1.2, 0.28);
    SFX._hit(ac, t, 0.06, 10, 'lowpass', 200, 0, 0.3);
  },
  card: function() {
    var ac = getAC(), t = ac.currentTime;
    SFX._hit(ac, t, 0.03, 25, 'highpass', 3500, 0, 0.38);
    SFX._hit(ac, t, 0.05, 14, 'bandpass', 320, 1, 0.25);
  },
  announce: function(kind) {
    var ac = getAC(), t = ac.currentTime;
    if (kind === 'bad') { SFX._tone(ac, 'triangle', 330, 330, t, 0.18, 0.08); SFX._tone(ac, 'triangle', 247, 247, t + 0.12, 0.3, 0.08); return; }
    SFX._tone(ac, 'triangle', 660, 660, t, 0.16, 0.07);
    SFX._tone(ac, 'triangle', 990, 990, t + 0.1, 0.32, 0.07);
    if (kind === 'gold') SFX._tone(ac, 'triangle', 1320, 1320, t + 0.2, 0.45, 0.06);
  },
  reveal: function() {
    var ac = getAC(), t = ac.currentTime;
    var s = ac.createBufferSource(); s.buffer = SFX._noise(ac, 0.4, 1.5);
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.2); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    s.connect(bp); bp.connect(g); g.connect(SFX._out(ac)); s.start(t);
    SFX._tone(ac, 'sine', 880, 880, t + 0.32, 0.9, 0.09);
    SFX._tone(ac, 'sine', 1320, 1320, t + 0.36, 0.8, 0.05);
  },
  elim: function() {
    var ac = getAC(), t = ac.currentTime;
    SFX._tone(ac, 'sine', 95, 30, t, 0.8, 0.6);
    SFX._tone(ac, 'sawtooth', 240, 70, t, 0.55, 0.1, 700);
    SFX._hit(ac, t, 0.25, 5, 'lowpass', 140, 0, 0.7);
  },
  heartbreak: function() {
    var ac = getAC(), t = ac.currentTime;
    SFX._tone(ac, 'sine', 560, 260, t, 0.28, 0.09);
  },
  showdown: function() {
    var ac = getAC(), t = ac.currentTime;
    SFX._tone(ac, 'sine', 80, 40, t, 1.0, 0.5);
    SFX._tone(ac, 'triangle', 196, 196, t + 0.05, 0.5, 0.08);
    SFX._tone(ac, 'triangle', 185, 185, t + 0.45, 0.8, 0.08);
  },
  victory: function() {
    var ac = getAC(), t = ac.currentTime;
    [523, 659, 784, 1047].forEach(function(f, i) { SFX._tone(ac, 'triangle', f, f, t + i * 0.11, 0.6, 0.09); });
    [523, 784, 1047].forEach(function(f) { SFX._tone(ac, 'sine', f, f, t + 0.5, 1.4, 0.05); });
  },
  heatUp: function(level) {
    var ac = getAC(), t = ac.currentTime;
    var s = ac.createBufferSource(); s.buffer = SFX._noise(ac, 1.1, 0.6);
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 + level * 0.05, t + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    s.connect(lp); lp.connect(g); g.connect(SFX._out(ac)); s.start(t);
  },

  // Tension state sounds. Only called on a state CHANGE (see render).
  _droneNode: null, _droneGain: null, _stopTimer: null, _state: 'none',
  startDrone: function(intense) {
    var ac = getAC(), t = ac.currentTime;
    var thud = ac.createBufferSource(); thud.buffer = SFX._noise(ac, intense ? 0.5 : 0.35, intense ? 1.8 : 2.2);
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = intense ? 100 : 130;
    var g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(intense ? 0.55 : 0.35, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + (intense ? 0.5 : 0.35));
    thud.connect(lp); lp.connect(g); g.connect(SFX._out(ac)); thud.start(t);
    if (!intense) return;
    // A pending stop would kill the drone we're about to reuse
    if (SFX._stopTimer) { clearTimeout(SFX._stopTimer); SFX._stopTimer = null; }
    if (!SFX._droneNode) {
      var len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      var a = ac.createBiquadFilter(); a.type = 'lowpass'; a.frequency.value = 180;
      var b = ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = 180;
      var dg = ac.createGain(); dg.gain.setValueAtTime(0, t); dg.gain.linearRampToValueAtTime(0.055, t + 2.5);
      src.connect(a); a.connect(b); b.connect(dg); dg.connect(SFX._out(ac)); src.start(t);
      SFX._droneNode = src; SFX._droneGain = dg;
    } else {
      SFX._droneGain.gain.cancelScheduledValues(t);
      SFX._droneGain.gain.setValueAtTime(SFX._droneGain.gain.value || 0, t);
      SFX._droneGain.gain.linearRampToValueAtTime(0.055, t + 1.0);
    }
  },
  stopDrone: function() {
    if (!SFX._droneGain || !SFX._droneNode || SFX._stopTimer) return;
    var ac = getAC(), t = ac.currentTime;
    SFX._droneGain.gain.cancelScheduledValues(t);
    SFX._droneGain.gain.setValueAtTime(SFX._droneGain.gain.value || 0, t);
    SFX._droneGain.gain.linearRampToValueAtTime(0, t + 1.8);
    var node = SFX._droneNode;
    SFX._stopTimer = setTimeout(function() {
      try { node.stop(); } catch (e) {}
      if (SFX._droneNode === node) { SFX._droneNode = null; SFX._droneGain = null; }
      SFX._stopTimer = null;
    }, 2200);
  }
};
// Every public sound is a no-op without audio, and can never throw into game logic
Object.keys(SFX).forEach(function(k) {
  if (k.charAt(0) === '_' || typeof SFX[k] !== 'function') return;
  var f = SFX[k];
  SFX[k] = function() { try { if (!getAC()) return; return f.apply(SFX, arguments); } catch (e) {} };
});
