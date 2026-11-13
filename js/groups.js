// ══ SAVED GROUPS ══
// "Thursday crew" loads the same names in one tap. Stored on the phone.
var LS_GROUPS = 'bank.groups.v1';
function loadGroups() { return lsGet(LS_GROUPS) || []; }
function saveGroups(list) { lsSet(LS_GROUPS, list); }

function renderGroups() {
  var el = $('suGroups'); if (!el) return;
  var groups = loadGroups();
  var h = groups.map(function(g, i) {
    return '<span class="grp-chip"><button class="grp-load" onclick="loadGroup(' + i + ')">' + ico('users', 'ico-sm') + ' ' + esc(g.name) + '<small>' + g.players.length + '</small></button>' +
           '<button class="grp-del" onclick="deleteGroup(' + i + ', this)" aria-label="Delete group">&#215;</button></span>';
  }).join('');
  h += '<button class="grp-chip grp-save" onclick="showSaveGroup()">' + ico('plus', 'ico-sm') + ' Save group</button>';
  el.innerHTML = h;
}
function loadGroup(i) {
  var g = loadGroups()[i]; if (!g) return;
  var el = $('suInputs'); el.innerHTML = '';
  g.players.slice(0, 8).forEach(function(n) { addInput(n); });
  while (el.children.length < 2) addInput('');
  saveSettings();
  showToast('Loaded ' + g.name);
}
function deleteGroup(i, btn) {
  if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.classList.add('armed'); btn.innerHTML = 'delete?'; return; }
  var list = loadGroups(); list.splice(i, 1); saveGroups(list); renderGroups();
}
function showSaveGroup() {
  var names = currentInputNames().filter(Boolean);
  if (names.length < 2) { showToast('Add at least 2 players first'); return; }
  var s = makeSheet('saveGroup', 'Save these players as a group');
  var wrap = document.createElement('div'); wrap.className = 'grp-form';
  var guess = names.length <= 2 ? names.join(' & ') : names[0] + ', ' + names[1] + ' +' + (names.length - 2);
  wrap.innerHTML = '<div class="grp-names">' + names.map(esc).join(' · ') + '</div><input type="text" id="grpName" maxlength="24" placeholder="Group name" autocomplete="off">';
  var save = document.createElement('button'); save.className = 'sh-menu-row'; save.innerHTML = ico('plus') + 'Save group';
  save.onclick = function() {
    var name = ($('grpName').value || '').trim() || guess;
    var list = loadGroups().filter(function(g) { return g.name.toLowerCase() !== name.toLowerCase(); });
    list.unshift({ name: name, players: names, updatedAt: Date.now() });
    saveGroups(list.slice(0, 12));
    s.close(); renderGroups(); showToast('Saved ' + name);
  };
  s.sh.appendChild(wrap); s.sh.appendChild(save);
  addCancel(s);
  var inp = $('grpName'); inp.value = ''; inp.placeholder = guess;
  setTimeout(function() { try { inp.focus(); } catch (e) {} }, 250);
}
