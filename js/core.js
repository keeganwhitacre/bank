// ══════════════════════════════════════════════════════════════
//  BANK v2
//  All game state lives in G / STATS / EFFECTS / CARDS so that one
//  JSON snapshot captures everything: that powers undo, and the same
//  snapshot is written to localStorage after every action so a reload
//  (or iOS evicting the home-screen app) resumes the game.
// ══════════════════════════════════════════════════════════════

// ══ SVG ICON SYSTEM ══
var ICONS = {
  play:      '<svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21" fill="currentColor" stroke="none"/></svg>',
  palette:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M15.5 15a2.5 2.5 0 0 1-5 0c0-1.38 1.12-2 2.5-3s2.5 1.62 2.5 3z" fill="currentColor" stroke="none"/></svg>',
  bolt:      '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-2 8 9-12h-7z" fill="currentColor" stroke="none"/></svg>',
  dice:      '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  card:      '<svg viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M8 6h8M8 10h5" opacity=".5"/></svg>',
  target:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
  devil:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M5 9L3 3M19 9l2-6"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M9 16c1.5 1.5 4.5 1.5 6 0"/></svg>',
  chicken:   '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="7" ry="8"/><circle cx="12" cy="6" r="4"/><circle cx="13.5" cy="5.5" r=".8" fill="currentColor" stroke="none"/><path d="M16 6l2-1M16 7l2 .5"/><path d="M10 9l-1 2h3" fill="currentColor" stroke="none"/></svg>',
  gem:       '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 7-10 12L2 10z"/><path d="M2 10h20M12 22L6 10l6-7 6 7" opacity=".4"/></svg>',
  skull:     '<svg viewBox="0 0 24 24"><path d="M12 2a9 9 0 0 0-9 9c0 3.1 1.6 5.8 4 7.4V21h10v-2.6c2.4-1.6 4-4.3 4-7.4a9 9 0 0 0-9-9z"/><circle cx="9" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="2" fill="currentColor" stroke="none"/><path d="M10 21v-2M14 21v-2"/></svg>',
  retire:    '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  bounty:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>',
  shield:    '<svg viewBox="0 0 24 24"><path d="M12 2l8 4v5c0 5.25-3.5 9.75-8 11-4.5-1.25-8-5.75-8-11V6z"/><path d="M9 12l2 2 4-4" stroke-width="2.5"/></svg>',
  snowflake: '<svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><circle cx="12" cy="12" r="2"/></svg>',
  coins:     '<svg viewBox="0 0 24 24"><ellipse cx="10" cy="8" rx="7" ry="3"/><path d="M3 8v4c0 1.66 3.13 3 7 3s7-1.34 7-3V8"/><path d="M3 12v4c0 1.66 3.13 3 7 3"/><ellipse cx="16" cy="14" rx="5" ry="2"/><path d="M11 14v4c0 1.1 2.24 2 5 2s5-.9 5-2v-4"/></svg>',
  heart:     '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor" stroke="none"/></svg>',
  heartO:    '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  crown:     '<svg viewBox="0 0 24 24"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z" fill="currentColor" stroke="none"/></svg>',
  menu:      '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  chaos:     '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>',
  lock:      '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  eyeOff:    '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.3 6.3C4.2 7.7 2.7 9.8 2 12c1 2.5 5 7 10 7 1.8 0 3.4-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  flame:     '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5.5C10 10 11 11 12 11c0-3-1-6 0-9z" fill="currentColor" stroke="none"/></svg>',
  copy:      '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  fuse:      '<svg viewBox="0 0 24 24"><circle cx="10" cy="15" r="6"/><path d="M14 10l3-3"/><path d="M18 3l.8 1.7L20.5 5.5l-1.7.8L18 8l-.8-1.7-1.7-.8 1.7-.8z" fill="currentColor" stroke="none"/></svg>',
  star:      '<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z" fill="currentColor" stroke="none"/></svg>',
  snake:     '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="9" height="9" rx="2"/><rect x="13" y="9" width="9" height="9" rx="2"/><circle cx="6.5" cy="10.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="17.5" cy="13.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
  trend:     '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  flag:      '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  rules:     '<svg viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z"/><path d="M8 11h8M8 15h6"/></svg>',
  stop:      '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  exit:      '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
};
function ico(name, cls) { return '<span class="ico' + (cls ? ' ' + cls : '') + '">' + (ICONS[name] || '') + '</span>'; }
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n) { return Math.round(n).toLocaleString(); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function findP(name) { for (var i = 0; i < G.players.length; i++) if (G.players[i].name === name) return G.players[i]; return null; }
function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

// ══ STORAGE ══
var LS_SETTINGS = 'bank.settings.v2', LS_GAME = 'bank.game.v2', LS_RECORDS = 'bank.records.v1';
function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
