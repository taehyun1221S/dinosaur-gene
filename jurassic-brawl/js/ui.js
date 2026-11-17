/* 쥬라기 유전자 막싸움 — 화면(교배소·훈련장·도감·투기장 메뉴), 저장, 보상 흐름 */
(function () {
  'use strict';
  var JG = window.JG, S = JG.SPECIES, TAU = Math.PI * 2;
  var A = function (n, o) { JG.Audio.play(n, o); };
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n, size) { return JG.icon(n, size || 18); }

  /* ================= 저장 ================= */
  var KEY = 'jurassic-brawl-save-v1', state = null, storageOK = true;
  function defaultState() {
    var dinos = JG.SPECIES_IDS.map(JG.makePure), dex = {};
    dinos.forEach(function (d) { dex['S_' + d.parts.head] = { t: Date.now(), sample: snap(d) }; });
    return { v: 1, coins: 120, eggs: 1, dinos: dinos, dex: dex, sel: dinos[0].id, tour: null, titles: 0, settings: { sfx: true, music: true }, seenHelp: false };
  }
  function snap(d) { return { parts: { head: d.parts.head, body: d.parts.body, arms: d.parts.arms, legs: d.parts.legs }, colors: { skin: d.colors.skin.slice(), accent: d.colors.accent.slice() }, mut: d.mut || null }; }
  function validDino(d) {
    if (!d || !d.parts || !d.id) return false;
    for (var i = 0; i < JG.SLOTS.length; i++) if (!S[d.parts[JG.SLOTS[i]]]) return false;
    if (!d.colors || !Array.isArray(d.colors.skin) || !Array.isArray(d.colors.accent)) return false;
    if (d.mut && !JG.MUTATIONS[d.mut]) d.mut = null;
    d.train = d.train || {}; ['pow', 'bnc', 'spd'].forEach(function (k) { d.train[k] = JG.clamp(+d.train[k] || 0, 0, JG.TRAIN_CAP); });
    d.fed = JG.clamp(+d.fed || 0, -3, 3); d.wins = +d.wins || 0; d.gen = +d.gen || 1;
    return true;
  }
  function adopt(raw) {
    var def = defaultState();
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.dinos)) return def;
    raw.dinos = raw.dinos.filter(validDino);
    if (raw.dinos.length < 2) return def;
    raw.coins = Math.max(0, +raw.coins || 0); raw.eggs = Math.max(0, +raw.eggs || 0); raw.titles = +raw.titles || 0;
    raw.dex = raw.dex && typeof raw.dex === 'object' ? raw.dex : {};
    Object.keys(raw.dex).forEach(function (k) { if (!JG.DEX_BY_ID[k] || !validDino(Object.assign({ id: 'x' }, raw.dex[k].sample))) delete raw.dex[k]; });
    raw.settings = Object.assign({ sfx: true, music: true }, raw.settings || {});
    if (!raw.dinos.some(function (d) { return d.id === raw.sel; })) raw.sel = raw.dinos[0].id;
    if (raw.tour && (!Array.isArray(raw.tour.rivals) || !raw.tour.rivals.every(validDino) || !byId(raw.tour.dinoId, raw.dinos))) raw.tour = null;
    return raw;
  }
  function load() {
    try { var raw = window.localStorage.getItem(KEY); return adopt(raw ? JSON.parse(raw) : null); }
    catch (e) { storageOK = false; return defaultState(); }
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { if (storageOK) { storageOK = false; toast('이 브라우저에서는 저장이 막혀 있어 새로 고치면 진행이 사라진다', true); } }
  }
  function byId(id, list) { list = list || state.dinos; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  /* 도감 등록. 새로 발견한 항목 id 목록을 돌려준다 */
  function registerDex(d) {
    var fresh = [];
    JG.dexIdsFor(d).forEach(function (id) { if (!state.dex[id]) { state.dex[id] = { t: Date.now(), sample: snap(d) }; fresh.push(id); } });
    return fresh;
  }
  function dexCount() { return Object.keys(state.dex).length; }

  /* ================= 캔버스 그리기 관리 ================= */
  var anims = [], frame = 0, arena = null, t0 = performance.now();
  function addCanvas(c, draw, isStatic) { var a = { c: c, draw: draw, st: !!isStatic, done: false }; anims.push(a); return a; }
  function sizeCanvas(c) {
    var r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w < 2 || h < 2) return null;
    var ch = c.width !== w || c.height !== h;
    if (ch) { c.width = w; c.height = h; }
    return { w: r.width, h: r.height, dpr: dpr, changed: ch };
  }
  function animLoop(ts) {
    requestAnimationFrame(animLoop);
    frame++;
    if (arena && !arena.dead) return;
    var t = (ts - t0) / 1000, i, a;
    for (i = anims.length - 1; i >= 0; i--) {
      a = anims[i];
      if (!a.c.isConnected) { anims.splice(i, 1); continue; }
      if (a.st && a.done && frame % 40 !== 0) continue;
      var sz = sizeCanvas(a.c);
      if (!sz) continue;
      if (a.st && a.done && !sz.changed) continue;
      var ctx = a.c.getContext('2d');
      ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0); ctx.clearRect(0, 0, sz.w, sz.h);
      try { a.draw(ctx, sz.w, sz.h, t); } catch (e) { /* 그림 하나가 실패해도 화면은 계속 돈다 */ }
      a.done = true;
    }
  }
  function mountDino(c, d, opts) {
    opts = opts || {};
    return addCanvas(c, function (ctx, w, h, t) {
      var o = { facing: opts.facing || 1, pad: opts.pad == null ? 0.1 : opts.pad, silhouette: opts.silhouette, mode: typeof opts.mode === 'function' ? opts.mode(t) : (opts.mode || 'idle'), maxScale: opts.maxScale };
      JG.drawPreview(ctx, d, { x: 0, y: 0, w: w, h: h }, opts.still ? 1.0 : t, o);
    }, !!opts.still);
  }

  /* ================= 작은 부품 ================= */
  function toast(msg, bad) {
    var el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg;
    $('#toast-root').appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }
  var modalStack = [];
  function openModal(html, opts) {
    opts = opts || {};
    var back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true">' + (opts.noClose ? '' : '<button class="icon-btn modal-x" type="button" aria-label="닫기">' + ic('x') + '</button>') + html + '</div>';
    $('#modal-root').appendChild(back);
    var m = { el: back, onClose: opts.onClose, noClose: opts.noClose };
    modalStack.push(m);
    if (!opts.noClose) {
      $('.modal-x', back).addEventListener('click', function () { closeModal(m); });
      back.addEventListener('pointerdown', function (e) { if (e.target === back) closeModal(m); });
    }
    JG.paintIcons(back);
    var f = $('[data-autofocus]', back) || $('.modal-x', back); if (f) f.focus();
    return m;
  }
  function closeModal(m) {
    m = m || modalStack[modalStack.length - 1]; if (!m) return;
    var i = modalStack.indexOf(m); if (i >= 0) modalStack.splice(i, 1);
    m.el.remove(); if (m.onClose) m.onClose();
  }
  function statRows(d) {
    var st = JG.stats(d), html = '<div class="stats">';
    ['pow', 'bnc', 'wgt', 'spd'].forEach(function (k) {
      var plus = k === 'wgt' ? 0 : (d.train && d.train[k]) || 0, base = Math.max(0, st[k] - plus);
      html += '<div class="stat"><span class="stat-name">' + ic(JG.STAT_ICON[k], 15) + JG.STAT_LABEL[k] + '</span><span class="stat-bar"><i class="stat-fill" style="width:calc(' + (base / 15 * 100) + '% - 3px)"></i>' +
        (plus ? '<i class="stat-plus" style="left:' + (base / 15 * 100) + '%;width:' + (plus / 15 * 100) + '%"></i>' : '') + '</span><span class="stat-val">' + st[k] + '</span></div>';
    });
    return html + '</div>';
  }
  function dinoTags(d) {
    var h = '';
    if (d.mut) h += '<span class="tag tag-egg">' + ic('sparkles', 13) + esc(JG.MUTATIONS[d.mut].name) + '</span>';
    var L = JG.legendOf(d); if (L) h += '<span class="tag tag-lava">' + ic('crown', 13) + esc(L.name) + '</span>';
    h += '<span class="tag">' + esc(S[d.parts.arms].arms.epithet) + '</span>';
    return h;
  }
  /* 공룡 우리(고르기 목록). marks: {id: {cls, badge}} */
  function rosterHTML(marks, strip) {
    marks = marks || {};
    return state.dinos.map(function (d) {
      var m = marks[d.id] || {}, st = JG.stats(d);
      return '<div class="dino-wrap"><button type="button" class="dino-card ' + (m.cls || '') + '" data-pick="' + d.id + '">' +
        '<canvas data-dino="' + d.id + '"></canvas>' + (m.badge ? '<span class="badge">' + m.badge + '</span>' : '') +
        '<span class="nm">' + esc(JG.dinoName(d)) + '</span><span class="sub">' + (d.mut ? esc(JG.MUTATIONS[d.mut].name) : '힘 ' + st.pow + ' · 민첩 ' + st.spd) + '</span></button>' +
        (strip ? '' : '<button type="button" class="info" data-info="' + d.id + '" aria-label="' + esc(JG.dinoName(d)) + ' 자세히">' + ic('info', 16) + '</button>') + '</div>';
    }).join('');
  }
  function mountRoster(root, onPick) {
    $$('canvas[data-dino]', root).forEach(function (c) { var d = byId(c.getAttribute('data-dino')); if (d) mountDino(c, d, { still: true, pad: 0.08 }); });
    $$('[data-pick]', root).forEach(function (b) { b.addEventListener('click', function () { A('click'); onPick(b.getAttribute('data-pick')); }); });
    $$('[data-info]', root).forEach(function (b) { b.addEventListener('click', function () { A('click'); openDinoSheet(byId(b.getAttribute('data-info'))); }); });
  }
  function refreshWallet() {
    $('#coin-count').textContent = state.coins; $('#egg-count').textContent = state.eggs;
    $('#btn-sfx').setAttribute('aria-pressed', state.settings.sfx); $('#btn-sfx').innerHTML = ic(state.settings.sfx ? 'volume-2' : 'volume-x');
    $('#btn-music').setAttribute('aria-pressed', state.settings.music); $('#btn-music').innerHTML = ic(state.settings.music ? 'audio-lines' : 'audio-lines-off');
  }
  function gain(coins) { if (coins) { state.coins += coins; A('coin'); } }

  /* ================= 화면 전환 ================= */
  var view = 'lab', VIEWS = ['lab', 'train', 'dex', 'arena'];
  var ui = { pa: null, pb: null, locks: {}, trainMode: 'idle', trainUntil: 0, arena: { mode: 'practice', p1: null, p2: null, stage: 'cliff', diff: 1, pick: 1, rival: null } };
  function setView(v, silent) {
    if (VIEWS.indexOf(v) < 0) v = 'lab';
    view = v;
    VIEWS.forEach(function (n) { $('#view-' + n).hidden = n !== v; $('#tab-' + n).setAttribute('aria-selected', n === v); });
    render();
    if (!silent) { try { if (location.hash !== '#' + v) location.hash = v; } catch (e) {} }
    $('#main').scrollTop = 0;
  }
  function render() {
    refreshWallet();
    if (view === 'lab') renderLab(); else if (view === 'train') renderTrain(); else if (view === 'dex') renderDex(); else renderArenaMenu();
    JG.paintIcons(document);
  }

  /* ================= 교배소 ================= */
  function breedCost() { var n = 0; JG.SLOTS.forEach(function (k) { if (ui.locks[k]) n++; }); return JG.BREED_COST + n * JG.LOCK_COST; }
  function renderLab() {
    var a = byId(ui.pa), b = byId(ui.pb), root = $('#view-lab'), cost = breedCost();
    if (!a) ui.pa = null; if (!b) ui.pb = null;
    function pod(d, which) {
      var cls = which === 'a' ? 'pod' : 'pod pod-b', lab = which === 'a' ? '부모 A' : '부모 B';
      if (!d) return '<div class="' + cls + '"><span class="pod-label">' + lab + '</span><div class="pod-empty">공룡 우리에서 한 마리를 골라 넣는다</div><div class="pod-foot"><span class="pod-name muted">비어 있음</span></div></div>';
      return '<div class="' + cls + '"><span class="pod-label">' + lab + '</span><canvas id="pod-' + which + '"></canvas><div class="pod-foot"><span class="pod-name">' + esc(JG.dinoName(d)) + '</span><button type="button" class="pod-x" data-clear="' + which + '" aria-label="' + lab + ' 빼기">' + ic('x', 18) + '</button></div></div>';
    }
    var rows = JG.SLOTS.map(function (k) {
      var la = a ? S[a.parts[k]][k].label : '—', lb = b ? S[b.parts[k]][k].label : '—', lock = ui.locks[k] || null;
      return '<div class="gene-row"><div class="gene-part a' + (lock === 'a' ? ' on' : '') + '"><span>' + esc(la) + '</span><small>' + (a ? esc(S[a.parts[k]].short) : '') + '</small></div>' +
        '<div><div class="seg" role="group" aria-label="' + JG.SLOT_LABEL[k] + ' 유전 방식">' +
        '<button type="button" data-lock="' + k + ':a" aria-pressed="' + (lock === 'a') + '" aria-label="A에게서">A</button>' +
        '<button type="button" data-lock="' + k + ':" aria-pressed="' + (!lock) + '" aria-label="무작위">' + ic('dice-5', 16) + '</button>' +
        '<button type="button" data-lock="' + k + ':b" aria-pressed="' + (lock === 'b') + '" aria-label="B에게서">B</button></div><div class="seg-slot">' + JG.SLOT_LABEL[k] + '</div></div>' +
        '<div class="gene-part b' + (lock === 'b' ? ' on' : '') + '"><span>' + esc(lb) + '</span><small>' + (b ? esc(S[b.parts[k]].short) : '') + '</small></div></div>';
    }).join('');
    var why = '';
    if (!a || !b) why = '부모 두 마리를 넣어야 교배할 수 있다.';
    else if (state.dinos.length >= JG.ROSTER_CAP) why = '우리가 가득 찼다. 공룡 정보(i)에서 방생하면 자리가 난다.';
    else if (state.coins < cost) why = '상금이 모자란다. 투기장에서 벌어 오자.';
    else why = '주사위 칸은 A와 B 중 무작위로 물려받는다. 가끔 돌연변이도 나온다.';
    var can = a && b && state.dinos.length < JG.ROSTER_CAP && state.coins >= cost;
    root.innerHTML = '<div class="lab-grid"><div class="panel"><div class="panel-head"><h2>유전자 교배기</h2><span class="muted">머리·몸통·팔·다리를 부모에게서 하나씩 물려받는다</span></div>' +
      '<div class="machine">' + pod(a, 'a') + '<div class="splice"><span class="helix">' + ic('dna', 44) + '</span>×</div>' + pod(b, 'b') + '</div>' +
      '<div class="genes-title"><h3>부위별 유전</h3><span class="muted">A나 B로 고정하면 칸마다 상금 ' + JG.LOCK_COST + ' 추가</span></div><div class="genes">' + rows + '</div>' +
      '<div class="breed-bar"><button type="button" class="btn btn-big" id="btn-breed"' + (can ? '' : ' disabled') + '>교배 시작 <span class="cost">' + ic('coins', 15) + cost + '</span></button>' +
      '<button type="button" class="btn btn-fern" id="btn-rare"' + (state.eggs > 0 && state.dinos.length < JG.ROSTER_CAP ? '' : ' disabled') + '>' + ic('egg') + '희귀 알 부화 (' + state.eggs + ')</button>' +
      '<p class="muted">' + why + '</p></div></div>' +
      '<div class="panel"><div class="panel-head"><h2>공룡 우리</h2><span class="muted">' + state.dinos.length + ' / ' + JG.ROSTER_CAP + '마리</span></div><div class="roster" id="lab-roster">' +
      rosterHTML((function () { var m = {}; if (a) m[a.id] = { cls: 'sel', badge: 'A' }; if (b) m[b.id] = { cls: 'sel-b', badge: 'B' }; return m; })()) + '</div></div></div>';
    if (a) mountDino($('#pod-a'), a, { pad: 0.12 });
    if (b) mountDino($('#pod-b'), b, { pad: 0.12, facing: -1 });
    mountRoster(root, function (id) {
      if (ui.pa === id) ui.pa = null; else if (ui.pb === id) ui.pb = null;
      else if (!ui.pa) ui.pa = id; else if (!ui.pb) ui.pb = id; else ui.pb = id;
      render();
    });
    $$('[data-clear]', root).forEach(function (x) { x.addEventListener('click', function () { ui['p' + x.getAttribute('data-clear')] = null; A('click'); render(); }); });
    $$('[data-lock]', root).forEach(function (x) { x.addEventListener('click', function () { var p = x.getAttribute('data-lock').split(':'); ui.locks[p[0]] = p[1] || null; A('click'); render(); }); });
    $('#btn-breed').addEventListener('click', doBreed);
    $('#btn-rare').addEventListener('click', doRare);
  }
  function doBreed() {
    var a = byId(ui.pa), b = byId(ui.pb), cost = breedCost();
    if (!a || !b || state.coins < cost || state.dinos.length >= JG.ROSTER_CAP) { A('error'); return; }
    state.coins -= cost;
    var child = JG.breed(a, b, ui.locks);
    state.dinos.push(child);
    var fresh = registerDex(child);
    save(); refreshWallet();
    openHatch(child, { a: a, b: b, fresh: fresh });
  }
  function doRare() {
    if (state.eggs <= 0 || state.dinos.length >= JG.ROSTER_CAP) { A('error'); return; }
    state.eggs--;
    var child = JG.hatchRare();
    state.dinos.push(child);
    var fresh = registerDex(child);
    save(); refreshWallet();
    openHatch(child, { rare: true, fresh: fresh });
  }

  /* ---------- 부화 연출 ---------- */
  function openHatch(child, info) {
    var taps = 0, phase = 'egg', bornAt = 0, kick = 0, fx = new JG.FX(), sp = JG.spec(child), lastT = 0;
    var m = openModal('<div class="hatch"><div class="hatch-stage" id="hatch-stage" role="button" tabindex="0" aria-label="알 두드리기" data-autofocus><canvas></canvas></div><div class="hatch-info" id="hatch-info"></div></div>', { cls: 'modal-wide', noClose: true, onClose: function () { render(); } });
    var stage = $('#hatch-stage', m.el), infoEl = $('#hatch-info', m.el);
    function intro() {
      infoEl.innerHTML = '<span class="tag tag-fern">' + (info.rare ? '희귀 알' : '교배 성공') + '</span><h2>알이 나왔다</h2><p class="muted" style="margin:8px 0 14px">알을 톡톡 세 번 두드리면 깨어난다. 스페이스 키도 된다.</p>' +
        '<div class="news"><span class="tag">두드린 횟수 ' + taps + ' / 3</span></div>';
    }
    function reveal() {
      var st = JG.stats(child), news = '';
      info.fresh.forEach(function (id) { var e = JG.DEX_BY_ID[id]; news += '<span class="tag ' + (e.kind === 'mut' ? 'tag-egg' : 'tag-lava') + '">' + ic('book-open', 13) + '도감 새 기록 · ' + esc(e.name) + '</span>'; });
      var rows = JG.SLOTS.map(function (k) {
        var from = child.from ? child.from[k] : null, who = from ? (from === 'a' ? 'A ' + JG.dinoName(info.a) : 'B ' + JG.dinoName(info.b)) : S[child.parts[k]].short;
        return '<div><span class="muted">' + JG.SLOT_LABEL[k] + '</span><span>' + esc(S[child.parts[k]][k].label) + '</span><span class="' + (from === 'a' ? 'from-a' : from === 'b' ? 'from-b' : 'muted') + '">' + esc(who) + '</span></div>';
      }).join('');
      infoEl.innerHTML = '<span class="tag tag-fern">' + (child.gen || 1) + '세대 탄생</span><h2>' + esc(JG.dinoName(child)) + '</h2>' +
        '<div class="news">' + dinoTags(child) + '</div>' + (news ? '<div class="news">' + news + '</div>' : '') +
        (child.mut ? '<p class="muted">' + esc(JG.MUTATIONS[child.mut].desc) + '</p>' : '') +
        '<div class="inherit">' + rows + '</div>' + statRows(child) +
        '<dl class="kv"><dt>특수기</dt><dd>' + esc(JG.special(child)) + '</dd><dt>체력</dt><dd>' + st.hp + '</dd></dl>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" id="hatch-arena">' + ic('swords') + '투기장으로</button><button type="button" class="btn" id="hatch-ok" data-autofocus>' + ic('check') + '연구소로</button></div>';
      JG.paintIcons(infoEl);
      $('#hatch-ok', infoEl).addEventListener('click', function () { A('click'); closeModal(m); });
      $('#hatch-arena', infoEl).addEventListener('click', function () { A('click'); state.sel = child.id; ui.arena.p1 = child.id; save(); closeModal(m); setView('arena'); });
      $('#hatch-ok', infoEl).focus();
    }
    function tap() {
      if (phase !== 'egg') return;
      JG.Audio.unlock();
      taps++; kick = 1; A('crack');
      fx.burst(0, -20, { n: 6, colors: ['#fff3d6', '#e8d5c0'], speed: [2, 6], life: [14, 26], size: [3, 7], kind: 'chunk', grav: 0.4 });
      if (taps >= 3) {
        phase = 'born'; bornAt = lastT;
        A('hatch'); if (child.mut) A('mutate', { delay: 0.5 }); A('roar', { size: JG.clamp(sp.scale * (0.6 + JG.stats(child).wgt * 0.07), 0.6, 1.5), delay: 0.9 });
        fx.burst(0, -30, { n: 34, colors: ['#fff3d6', '#e8d5c0', '#ffb627'], speed: [4, 14], life: [22, 46], size: [5, 12], kind: 'chunk', grav: 0.45 });
        fx.burst(0, -30, { n: 18, colors: ['#ffe14d', '#fff', '#35d6b4'], speed: [3, 11], life: [20, 40], size: [4, 9], kind: 'star', grav: 0.1 });
        fx.addShake(12);
        reveal();
      } else intro();
    }
    stage.addEventListener('pointerdown', function (e) { e.preventDefault(); tap(); });
    stage.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(); } });
    intro();
    var shell = info.rare ? '#ffd45e' : '#fff3d6', spot = JG.hsl(child.colors.skin, 0);
    addCanvas($('canvas', stage), function (ctx, w, h, t) {
      lastT = t; fx.update(); kick *= 0.9;
      var cx = w / 2, cy = h * 0.66, R = Math.min(w, h) * 0.2, i;
      // 뒤 햇살
      ctx.save(); ctx.translate(cx, cy - R * 0.6); ctx.rotate(t * 0.3); ctx.fillStyle = 'rgba(255,182,39,' + (phase === 'born' ? 0.22 : 0.08) + ')';
      for (i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.09, -w); ctx.lineTo(w * 0.09, -w); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      JG.drawShadow(ctx, cx, cy + R * 1.32, R * 1.2, 0.35);
      ctx.save(); ctx.translate(cx + fx.sx, cy + fx.sy);
      if (phase === 'egg') {
        ctx.rotate(Math.sin(t * (5 + taps * 3)) * (0.03 + taps * 0.035) + kick * 0.2 * Math.sin(t * 40));
        ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#22121f'; ctx.fillStyle = shell;
        ctx.beginPath(); ctx.moveTo(0, -R * 1.45); ctx.bezierCurveTo(R * 1.05, -R * 1.4, R * 1.25, R * 0.5, 0, R * 1.3); ctx.bezierCurveTo(-R * 1.25, R * 0.5, -R * 1.05, -R * 1.4, 0, -R * 1.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip(); ctx.fillStyle = spot;
        [[-0.45, -0.5, 0.26], [0.4, -0.1, 0.2], [-0.2, 0.55, 0.3], [0.5, 0.7, 0.18], [0.1, -1.0, 0.16]].forEach(function (q) { ctx.beginPath(); ctx.arc(q[0] * R, q[1] * R, q[2] * R, 0, TAU); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-R * 0.42, -R * 0.7, R * 0.16, R * 0.34, 0.4, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.lineWidth = 4;
        var cr = [[[-0.2, -1.3], [0.05, -0.9], [-0.25, -0.6], [0.1, -0.3]], [[0.75, -0.3], [0.4, -0.05], [0.6, 0.3], [0.2, 0.5]], [[-0.9, 0.2], [-0.5, 0.1], [-0.6, 0.5], [-0.15, 0.7], [-0.3, 1.0]]];
        for (i = 0; i < taps; i++) { ctx.beginPath(); cr[i].forEach(function (q, n) { if (n) ctx.lineTo(q[0] * R, q[1] * R); else ctx.moveTo(q[0] * R, q[1] * R); }); ctx.stroke(); }
      }
      fx.drawParticles(ctx);
      ctx.restore();
      if (phase === 'born') {
        var age = t - bornAt;
        JG.drawPreview(ctx, child, { x: w * 0.06, y: h * 0.1, w: w * 0.88, h: h * 0.84 }, t, { mode: age < 2.4 ? 'cheer' : age < 3.6 ? 'roar' : 'idle', pad: 0.06 });
        // 깨진 알껍데기
        ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#22121f'; ctx.fillStyle = shell;
        ctx.beginPath(); ctx.moveTo(cx - R * 1.05, cy + R * 0.7); ctx.lineTo(cx - R * 0.7, cy + R * 1.0); ctx.lineTo(cx - R * 0.35, cy + R * 0.72); ctx.lineTo(cx, cy + R * 1.05); ctx.lineTo(cx + R * 0.35, cy + R * 0.72); ctx.lineTo(cx + R * 0.7, cy + R * 1.0); ctx.lineTo(cx + R * 1.05, cy + R * 0.7);
        ctx.bezierCurveTo(cx + R * 0.95, cy + R * 1.5, cx - R * 0.95, cy + R * 1.5, cx - R * 1.05, cy + R * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    });
  }

  /* ---------- 공룡 정보 ---------- */
  function openDinoSheet(d) {
    if (!d) return;
    var mv = JG.movesOf(d), st = JG.stats(d), armed = false;
    var m = openModal('<div class="dex-detail"><div class="stage"><canvas id="sheet-cv"></canvas></div><div>' +
      '<h2>' + esc(JG.dinoName(d)) + '</h2><div class="news">' + dinoTags(d) + '</div>' + statRows(d) +
      '<dl class="kv"><dt>체력</dt><dd>' + st.hp + '</dd><dt>머리</dt><dd>' + esc(S[d.parts.head].head.label) + ' · ' + esc(mv.head.name) + '</dd><dt>몸통</dt><dd>' + esc(S[d.parts.body].body.label) + '</dd>' +
      '<dt>팔·날개</dt><dd>' + esc(S[d.parts.arms].arms.label) + ' · ' + esc(mv.arms.name) + '</dd><dt>다리·꼬리</dt><dd>' + esc(S[d.parts.legs].legs.label) + ' · ' + esc(mv.tail.name) + '</dd>' +
      '<dt>혈통</dt><dd>' + (d.parents ? esc(d.parents[0]) + ' × ' + esc(d.parents[1]) + ' (' + d.gen + '세대)' : '연구소 원종') + '</dd><dt>전적</dt><dd>' + d.wins + '승</dd></dl>' +
      '<div class="share-row"><button type="button" class="btn btn-small btn-amber" id="sheet-main">' + ic('star', 16) + '대표로 정하기</button>' +
      '<button type="button" class="btn btn-small btn-ghost" id="sheet-share">' + ic('share-2', 16) + '조합 공유하기</button>' +
      '<button type="button" class="btn btn-small btn-ghost" id="sheet-free">' + ic('trash', 16) + '방생하기</button></div></div></div>', { cls: 'modal-wide' });
    var roarUntil = 0;
    mountDino($('#sheet-cv', m.el), d, { pad: 0.1, mode: function (t) { return t < roarUntil ? 'roar' : 'idle'; } });
    $('#sheet-cv', m.el).addEventListener('click', function () { roarUntil = (performance.now() - t0) / 1000 + 1; A('roar', { size: JG.clamp(JG.spec(d).scale * (0.6 + st.wgt * 0.07), 0.6, 1.5) }); });
    $('#sheet-main', m.el).addEventListener('click', function () { state.sel = d.id; ui.arena.p1 = d.id; save(); A('statup'); toast(JG.dinoName(d) + '을(를) 대표 공룡으로 정했다'); closeModal(m); render(); });
    $('#sheet-share', m.el).addEventListener('click', function () { A('click'); openShare(d, null); });
    $('#sheet-free', m.el).addEventListener('click', function () {
      var b = this;
      if (state.dinos.length <= 2) { A('error'); toast('공룡은 최소 두 마리는 남겨야 한다', true); return; }
      if (state.tour && state.tour.dinoId === d.id) { A('error'); toast('리그에 출전 중인 공룡은 방생할 수 없다', true); return; }
      if (!armed) { armed = true; b.innerHTML = ic('trash', 16) + '한 번 더 누르면 방생'; b.classList.add('btn-ghost'); b.style.background = 'var(--lava)'; return; }
      state.dinos = state.dinos.filter(function (x) { return x.id !== d.id; });
      if (ui.pa === d.id) ui.pa = null; if (ui.pb === d.id) ui.pb = null;
      if (state.sel === d.id) state.sel = state.dinos[0].id;
      if (ui.arena.p1 === d.id) ui.arena.p1 = null; if (ui.arena.p2 === d.id) ui.arena.p2 = null;
      save(); A('flop'); toast(JG.dinoName(d) + '을(를) 섬에 풀어 주었다'); closeModal(m); render();
    });
  }

  /* ================= 훈련장 ================= */
  function renderTrain() {
    var d = byId(state.sel) || state.dinos[0], root = $('#view-train'), cap = JG.TRAIN_CAP;
    state.sel = d.id;
    function capNote(k) { return (d.train[k] || 0) >= cap ? ' · 한계 도달' : ' · 훈련 ' + (d.train[k] || 0) + '/' + cap; }
    var foods = JG.FOODS.map(function (f) {
      var k = Object.keys(f.give)[0], full = (d.train[k] || 0) >= cap;
      return '<div class="act"><span class="act-ic">' + ic(f.icon, 24) + '</span><div><h3>' + esc(f.name) + '</h3><p>' + esc(f.note) + capNote(k) + '</p></div>' +
        '<button type="button" class="btn btn-small" data-food="' + f.id + '"' + (full || state.coins < f.cost ? ' disabled' : '') + '>먹이기 <span class="cost">' + ic('coins', 13) + f.cost + '</span></button></div>';
    }).join('');
    var games = [
      { id: 'rock', icon: 'hammer', name: '바위 부수기', note: '게이지가 주황 칸에 올 때 내리친다. 힘 최대 +2', k: 'pow' },
      { id: 'dodge', icon: 'flame', name: '운석 피하기', note: '20초 동안 좌우로 피한다. 민첩 최대 +2', k: 'spd' }
    ].map(function (g) {
      return '<div class="act"><span class="act-ic">' + ic(g.icon, 24) + '</span><div><h3>' + g.name + '</h3><p>' + g.note + capNote(g.k) + '</p></div>' +
        '<button type="button" class="btn btn-small btn-fern" data-game="' + g.id + '">' + ic('play', 15) + '시작</button></div>';
    }).join('');
    var marks = {}; marks[d.id] = { cls: 'sel', badge: '훈련' };
    root.innerHTML = '<div class="train-grid"><div class="panel"><div class="trainee-stage"><canvas id="trainee-cv"></canvas></div>' +
      '<div class="trainee-name"><h2>' + esc(JG.dinoName(d)) + '</h2>' + dinoTags(d) + '</div>' + statRows(d) +
      '<p class="muted" style="margin-top:10px">노란 구간이 훈련으로 올린 몫이다. 스탯마다 +' + cap + '까지 올릴 수 있다.</p></div>' +
      '<div class="panel"><h3 class="sub-h">' + ic('utensils', 20) + '먹이 주기</h3><div class="act-list">' + foods + '</div>' +
      '<h3 class="sub-h">' + ic('target', 20) + '훈련</h3><div class="act-list">' + games + '</div>' +
      '<h3 class="sub-h">' + ic('hand', 20) + '훈련할 공룡</h3><div class="roster roster-strip">' + rosterHTML(marks, true) + '</div></div></div>';
    mountDino($('#trainee-cv'), d, { pad: 0.14, mode: function (t) { return t < ui.trainUntil ? ui.trainMode : 'idle'; } });
    mountRoster(root, function (id) { state.sel = id; save(); render(); });
    $$('[data-food]', root).forEach(function (b) { b.addEventListener('click', function () { feed(d, b.getAttribute('data-food')); }); });
    $$('[data-game]', root).forEach(function (b) { b.addEventListener('click', function () { A('click'); openMini(d, b.getAttribute('data-game')); }); });
  }
  function feed(d, fid) {
    var f = JG.FOODS.filter(function (x) { return x.id === fid; })[0], k = Object.keys(f.give)[0];
    if (state.coins < f.cost || (d.train[k] || 0) >= JG.TRAIN_CAP) { A('error'); return; }
    state.coins -= f.cost; d.train[k] = Math.min(JG.TRAIN_CAP, (d.train[k] || 0) + f.give[k]); d.fed = JG.clamp((d.fed || 0) + f.wgt, -3, 3);
    save(); A('eat'); A('statup', { delay: 0.45 });
    ui.trainMode = 'eat'; ui.trainUntil = (performance.now() - t0) / 1000 + 1.3;
    toast(f.say + ' ' + f.note);
    render();
  }
  function openMini(d, kind) {
    var game = null, title = kind === 'rock' ? '바위 부수기' : '운석 피하기';
    var m = openModal('<h2>' + title + '</h2><p class="muted">' + esc(JG.dinoName(d)) + ' 훈련 중</p><div class="mini-stage"><canvas id="mini-cv"></canvas></div><div id="mini-res"></div>', { onClose: function () { if (game) game.destroy(); render(); } });
    function start() {
      $('#mini-res', m.el).innerHTML = '';
      if (game) game.destroy();
      game = new JG.MiniGame($('#mini-cv', m.el), kind, d, function (res) {
        var k = res.stat, before = d.train[k] || 0, got = Math.min(res.gain, JG.TRAIN_CAP - before);
        d.train[k] = before + got; gain(res.coins); save(); refreshWallet();
        if (got > 0) { A('statup'); ui.trainMode = 'cheer'; ui.trainUntil = (performance.now() - t0) / 1000 + 2; }
        $('#mini-res', m.el).innerHTML = '<div class="reward-row"><span class="tag">점수 ' + res.score + ' / ' + res.max + '</span>' +
          (got > 0 ? '<span class="tag tag-fern">' + JG.STAT_LABEL[k] + ' +' + got + '</span>' : res.gain > 0 ? '<span class="tag">이미 한계까지 훈련했다</span>' : '<span class="tag">스탯 변화 없음</span>') +
          (res.coins ? '<span class="tag">' + ic('coins', 13) + '+' + res.coins + '</span>' : '') + '</div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-ghost" id="mini-again">' + ic('rotate-ccw') + '한 번 더</button><button type="button" class="btn" id="mini-close">' + ic('check') + '훈련 끝</button></div>';
        JG.paintIcons(m.el);
        $('#mini-again', m.el).addEventListener('click', function () { A('click'); start(); });
        $('#mini-close', m.el).addEventListener('click', function () { A('click'); closeModal(m); });
      });
      JG._mini = game;
    }
    start();
  }

  /* ================= 도감 ================= */
  function dexSample(e) {
    var rec = state.dex[e.id], base = rec ? rec.sample : e.sample;
    var d = JG.makeFromParts(base.parts || base, e.kind === 'mut' ? e.mut : (rec ? base.mut : null));
    if (rec) d.colors = { skin: base.colors.skin.slice(), accent: base.colors.accent.slice() };
    if (e.kind !== 'mut' && rec && e.kind !== 'legend') d.mut = null;
    return d;
  }
  function renderDex() {
    var root = $('#view-dex'), total = JG.DEX.length, n = dexCount(), html = '';
    html += '<div class="panel dex-top"><h2>유전자 도감</h2><div><div class="dex-progress"><i style="width:calc(' + (n / total * 100) + '% - 8px)"></i></div><p class="muted" style="margin-top:4px">' + n + ' / ' + total + ' 발견 · 새 조합을 부화시키면 기록된다</p></div></div>';
    ['pure', 'pair', 'multi', 'legend', 'mut'].forEach(function (kind) {
      var list = JG.DEX.filter(function (e) { return e.kind === kind; }), got = list.filter(function (e) { return state.dex[e.id]; }).length;
      html += '<div class="dex-sec"><h3>' + JG.DEX_KIND_LABEL[kind] + '<small>' + got + ' / ' + list.length + '</small></h3><div class="dex-grid">' + list.map(function (e) {
        var has = !!state.dex[e.id];
        return '<button type="button" class="dex-card ' + kind + (has ? '' : ' locked') + '" data-dex="' + e.id + '"><canvas data-dexcv="' + e.id + '"></canvas><span class="nm">' + (has ? esc(e.name) : '???') + '</span></button>';
      }).join('') + '</div></div>';
    });
    root.innerHTML = html;
    $$('canvas[data-dexcv]', root).forEach(function (c) { var e = JG.DEX_BY_ID[c.getAttribute('data-dexcv')]; mountDino(c, dexSample(e), { still: true, pad: 0.1, silhouette: state.dex[e.id] ? null : '#4d3550' }); });
    $$('[data-dex]', root).forEach(function (b) { b.addEventListener('click', function () { A('click'); openDex(JG.DEX_BY_ID[b.getAttribute('data-dex')]); }); });
  }
  function formulaHTML(e, d) {
    function sp(id) { return '<span class="sp">' + esc(S[id].name) + '</span>'; }
    if (e.kind === 'pure') return sp(e.formula[0]) + '<span class="muted">연구소 원종</span>';
    if (e.kind === 'pair') return sp(e.formula[0]) + '<span class="x">×</span>' + sp(e.formula[1]);
    if (e.kind === 'legend') return JG.SLOTS.filter(function (k) { return e.need[k]; }).map(function (k) { return '<span class="sp">' + JG.SLOT_LABEL[k] + ' · ' + esc(S[e.need[k]].short) + '</span>'; }).join('<span class="x">+</span>');
    if (e.kind === 'mut') return '<span class="sp">교배 중 낮은 확률</span><span class="x">/</span><span class="sp">희귀 알</span>';
    return JG.speciesSet(d).map(sp).join('<span class="x">×</span>');
  }
  function openDex(e) {
    var has = !!state.dex[e.id], d = dexSample(e), body;
    if (has) {
      var st = JG.stats(d), bonus = '';
      if (e.bonus) bonus = Object.keys(e.bonus).map(function (k) { return JG.STAT_LABEL[k] + ' ' + (e.bonus[k] > 0 ? '+' : '') + e.bonus[k]; }).join(', ');
      if (e.kind === 'mut') bonus = Object.keys(JG.MUTATIONS[e.mut].bonus).map(function (k) { var v = JG.MUTATIONS[e.mut].bonus[k]; return JG.STAT_LABEL[k] + ' ' + (v > 0 ? '+' : '') + v; }).join(', ');
      body = '<span class="tag">' + JG.DEX_KIND_LABEL[e.kind] + '</span><h2>' + esc(e.name) + '</h2><p style="margin-top:6px">' + esc(e.desc) + '</p>' +
        '<div class="formula">' + formulaHTML(e, d) + '</div>' + statRows(d) +
        '<dl class="kv"><dt>특수기</dt><dd>' + esc(e.special || JG.special(d)) + '</dd><dt>체력</dt><dd>' + st.hp + '</dd>' + (bonus ? '<dt>조합 보너스</dt><dd>' + bonus + '</dd>' : '') +
        '<dt>첫 발견</dt><dd>' + new Date(state.dex[e.id].t).toLocaleDateString('ko-KR') + '</dd></dl>' +
        '<div class="share-row"><button type="button" class="btn btn-small btn-amber" id="dex-share">' + ic('share-2', 16) + '조합 공유하기</button></div>';
    } else {
      body = '<span class="tag">' + JG.DEX_KIND_LABEL[e.kind] + ' · 미발견</span><h2>???</h2><p style="margin-top:6px" class="muted">아직 태어난 적 없는 조합이다.</p>' +
        '<dl class="kv"><dt>단서</dt><dd>' + esc(e.hint) + '</dd></dl>';
    }
    var m = openModal('<div class="dex-detail"><div class="stage"><canvas id="dex-cv"></canvas></div><div>' + body + '</div></div>', { cls: 'modal-wide' });
    var roarUntil = 0;
    mountDino($('#dex-cv', m.el), d, { pad: 0.1, silhouette: has ? null : '#4d3550', mode: function (t) { return t < roarUntil ? 'roar' : 'idle'; } });
    if (has) {
      $('#dex-cv', m.el).addEventListener('click', function () { roarUntil = (performance.now() - t0) / 1000 + 1; A('roar', { size: JG.clamp(JG.spec(d).scale * (0.6 + JG.stats(d).wgt * 0.07), 0.6, 1.5) }); });
      $('#dex-share', m.el).addEventListener('click', function () { A('click'); openShare(d, e); });
    }
  }

  /* ---------- 조합 공유(텍스트·이미지 카드) ---------- */
  function shareText(d, e) {
    var st = JG.stats(d), p = d.parts, name = e ? e.name : JG.dinoName(d);
    var formula = e && e.kind === 'legend' ? JG.SLOTS.filter(function (k) { return e.need[k]; }).map(function (k) { return JG.SLOT_LABEL[k] + ' ' + S[e.need[k]].short; }).join(' + ')
      : e && e.kind === 'mut' ? '교배 중 낮은 확률 또는 희귀 알' : JG.speciesSet(d).map(function (id) { return S[id].name; }).join(' × ');
    return ['[쥬라기 유전자 막싸움] 조합 레시피', '이름: ' + name + (e ? ' (' + JG.DEX_KIND_LABEL[e.kind] + ')' : ''), '공식: ' + formula,
      '파츠: 머리 ' + S[p.head].short + ' / 몸통 ' + S[p.body].short + ' / 팔·날개 ' + S[p.arms].short + ' / 다리·꼬리 ' + S[p.legs].short + (d.mut ? ' / 돌연변이 ' + JG.MUTATIONS[d.mut].name : ''),
      '스탯: 힘 ' + st.pow + ' · 탄성 ' + st.bnc + ' · 무게 ' + st.wgt + ' · 민첩 ' + st.spd, '특수기: ' + (e && e.special ? e.special : JG.special(d)), '너도 만들어서 투기장에서 붙자!'].join('\n');
  }
  function shareCard(d, e) {
    var c = document.createElement('canvas'), W = 720, H = 940; c.width = W; c.height = H;
    var g = c.getContext('2d'), st = JG.stats(d), name = e ? e.name : JG.dinoName(d), FD = '"Bagel Fat One", "Jua", sans-serif', FB = '"Jua", sans-serif', i;
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a1830'); bg.addColorStop(0.7, '#3d2a40'); bg.addColorStop(1, '#b23a1e');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,243,214,.05)'; for (i = 0; i < 300; i++) g.fillRect((i * 97) % W, (i * 53) % H, 3, 3);
    g.lineJoin = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '40px ' + FD; g.lineWidth = 12; g.strokeStyle = '#22121f'; g.strokeText('쥬라기 유전자 막싸움', W / 2, 62); g.fillStyle = '#ffb627'; g.fillText('쥬라기 유전자 막싸움', W / 2, 62);
    g.fillStyle = '#170c18'; rrect(g, 50, 112, W - 100, 400, 30); g.fill(); g.lineWidth = 6; g.strokeStyle = '#22121f'; g.stroke();
    var glow = g.createRadialGradient(W / 2, 360, 20, W / 2, 360, 260); glow.addColorStop(0, 'rgba(53,214,180,.35)'); glow.addColorStop(1, 'rgba(53,214,180,0)'); g.fillStyle = glow; g.fillRect(50, 112, W - 100, 400);
    JG.drawPreview(g, d, { x: 70, y: 126, w: W - 140, h: 372 }, 1.2, { pad: 0.08 });
    g.font = '58px ' + FD; g.lineWidth = 14; g.strokeStyle = '#22121f'; g.strokeText(name, W / 2, 566); g.fillStyle = '#fff3d6'; g.fillText(name, W / 2, 566);
    g.font = '25px ' + FB; g.fillStyle = '#35d6b4';
    var formula = e && e.kind === 'legend' ? JG.SLOTS.filter(function (k) { return e.need[k]; }).map(function (k) { return JG.SLOT_LABEL[k] + ' ' + S[e.need[k]].short; }).join(' + ') : JG.speciesSet(d).map(function (id) { return S[id].short; }).join(' × ');
    g.fillText('공식  ' + formula + (d.mut ? '  +  ' + JG.MUTATIONS[d.mut].name : ''), W / 2, 622);
    ['pow', 'bnc', 'wgt', 'spd'].forEach(function (k, n) {
      var y = 676 + n * 44;
      g.textAlign = 'left'; g.font = '25px ' + FB; g.fillStyle = '#cfb1bf'; g.fillText(JG.STAT_LABEL[k], 96, y);
      g.fillStyle = '#22121f'; rrect(g, 176, y - 13, 400, 26, 13); g.fill();
      g.fillStyle = '#35d6b4'; rrect(g, 180, y - 9, Math.max(14, 392 * st[k] / 15), 18, 9); g.fill();
      g.textAlign = 'right'; g.fillStyle = '#fff3d6'; g.fillText(st[k], 626, y);
    });
    g.textAlign = 'center'; g.font = '27px ' + FB; g.fillStyle = '#ffb627'; g.fillText('특수기  ' + (e && e.special ? e.special : JG.special(d)), W / 2, 866);
    g.font = '21px ' + FB; g.fillStyle = '#fff3d6'; g.fillText('너도 만들어서 투기장에서 붙자!', W / 2, 906);
    return c;
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function openShare(d, e) {
    var text = shareText(d, e), card = shareCard(d, e), url = '';
    try { url = card.toDataURL('image/png'); } catch (err) { url = ''; }
    var m = openModal('<h2>조합 공유하기</h2><p class="muted">레시피를 글이나 이미지 카드로 복사해 친구에게 보낸다.</p>' +
      (url ? '<img class="share-img" id="share-img" alt="' + esc(e ? e.name : JG.dinoName(d)) + ' 조합 카드" src="' + url + '">' : '') +
      '<label class="muted" for="share-text" style="display:block;margin:12px 0 4px">레시피 글</label><textarea class="share-text" id="share-text" readonly>' + esc(text) + '</textarea>' +
      '<div class="modal-actions"><button type="button" class="btn btn-ghost" id="share-copy-img">' + ic('image') + '이미지 카드 복사</button><button type="button" class="btn" id="share-copy-text" data-autofocus>' + ic('copy') + '텍스트 복사</button></div>' +
      '<p class="muted" id="share-note" style="margin-top:8px"></p>', { cls: 'modal-narrow' });
    var note = $('#share-note', m.el);
    $('#share-copy-text', m.el).addEventListener('click', function () {
      var ta = $('#share-text', m.el);
      function manual() { ta.focus(); ta.select(); note.textContent = '자동 복사가 막혀 있다. 글이 선택되어 있으니 Ctrl+C(⌘C)로 복사한다.'; }
      try { navigator.clipboard.writeText(text).then(function () { A('coin'); toast('레시피 글을 복사했다'); note.textContent = '복사 완료. 메신저에 붙여 넣으면 된다.'; }, manual); } catch (err) { manual(); }
    });
    $('#share-copy-img', m.el).addEventListener('click', function () {
      function manual() { note.textContent = '이미지 자동 복사가 막혀 있다. 위 카드를 우클릭(모바일은 길게 누르기)해서 복사하거나 저장한다.'; }
      try {
        card.toBlob(function (blob) {
          try { navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]).then(function () { A('coin'); toast('이미지 카드를 복사했다'); note.textContent = '복사 완료. 메신저에 붙여 넣으면 된다.'; }, manual); } catch (err) { manual(); }
        }, 'image/png');
      } catch (err) { manual(); }
    });
  }

  /* ================= 투기장 메뉴 ================= */
  function newRival() { ui.arena.rival = JG.randomRival(ui.arena.diff); }
  function renderArenaMenu() {
    var root = $('#view-arena'), a = ui.arena, tour = state.tour;
    if (!byId(a.p1)) a.p1 = state.sel;
    if (!byId(a.p2)) a.p2 = (state.dinos.filter(function (d) { return d.id !== a.p1; })[0] || state.dinos[0]).id;
    if (!a.rival) newRival();
    var p1 = a.mode === 'tour' && tour ? byId(tour.dinoId) : byId(a.p1), p2, p2name, sub = '';
    if (a.mode === 'versus') { p2 = byId(a.p2); p2name = JG.dinoName(p2); }
    else if (a.mode === 'tour') { p2 = tour ? tour.rivals[tour.idx] : null; p2name = p2 ? p2.rival + ' ' + JG.dinoName(p2) : '참가하면 상대가 정해진다'; }
    else { p2 = a.rival; p2name = p2.rival + ' ' + JG.dinoName(p2); }
    var modes = [['practice', 'bot', '연습 경기', 'CPU와 한 판. 스테이지와 매운 정도를 고른다.'], ['tour', 'trophy', '챔피언십 리그', '8강부터 결승까지 3연승하면 희귀 알을 받는다.'], ['versus', 'users', '2인 대전', '한 키보드에서 1P와 2P가 맞붙는다.']]
      .map(function (m) { return '<button type="button" class="mode" data-mode="' + m[0] + '" aria-pressed="' + (a.mode === m[0]) + '"><h3>' + ic(m[1], 24) + m[2] + '</h3><p>' + m[3] + '</p></button>'; }).join('');
    function stageOpts() {
      return '<h3 class="sub-h">' + ic('mountain', 20) + '스테이지</h3><div class="opt-row">' + JG.STAGES.map(function (s) {
        return '<button type="button" class="opt" data-stage="' + s.id + '" aria-pressed="' + (a.stage === s.id) + '"><b>' + ic(s.icon, 17) + s.name + '</b><span>' + s.desc + '</span></button>';
      }).join('') + '</div>';
    }
    var right = '', startLabel = '출전', startOK = true, note = '';
    if (a.mode === 'practice') {
      right = stageOpts() + '<h3 class="sub-h">' + ic('flame', 20) + '상대의 매운 정도</h3><div class="opt-row">' + [1, 2, 3].map(function (n) {
        return '<button type="button" class="opt" data-diff="' + n + '" aria-pressed="' + (a.diff === n) + '"><b>' + JG.DIFF_LABEL[n] + '</b><span>이기면 상금 ' + JG.PRACTICE_PRIZE[n] + '</span></button>';
      }).join('') + '</div><div class="share-row"><button type="button" class="btn btn-small btn-ghost" id="arena-reroll">' + ic('dice-5', 16) + '상대 바꾸기</button></div>' +
        '<h3 class="sub-h">' + ic('hand', 20) + '출전할 공룡</h3><div class="roster roster-strip">' + rosterHTML(mark(a.p1, 'sel', '출전'), true) + '</div>';
      note = '세 판 중 두 판을 먼저 이기면 승리. 상대를 용암에 빠뜨리거나 체력을 다 깎는다.';
    } else if (a.mode === 'tour') {
      if (tour) {
        right = '<h3 class="sub-h">' + ic('trophy', 20) + '대진표</h3><div class="ladder">' + JG.TOUR.map(function (t, i) {
          var r = tour.rivals[i], stg = JG.STAGES.filter(function (s) { return s.id === t.stage; })[0];
          return '<div class="rung ' + (i < tour.idx ? 'done' : i === tour.idx ? 'now' : '') + '"><canvas data-rival="' + i + '"></canvas><div><b style="font-weight:400">' + t.round + ' · ' + esc(r.rival + ' ' + JG.dinoName(r)) + '</b><div class="muted">' + stg.name + ' · ' + JG.DIFF_LABEL[t.diff] + '</div></div><span class="tag">' + (i < tour.idx ? '승리' : ic('coins', 13) + t.prize) + '</span></div>';
        }).join('') + '</div><div class="share-row"><button type="button" class="btn btn-small btn-ghost" id="tour-quit">' + ic('log-out', 16) + '기권하기</button></div>';
        startLabel = JG.TOUR[tour.idx].round + ' 시작'; note = '리그 도중에는 출전 공룡을 바꿀 수 없다. 지면 탈락한다.';
      } else {
        right = '<h3 class="sub-h">' + ic('trophy', 20) + '챔피언십 리그</h3><p class="muted">8강(절벽·순한맛) → 준결승(간헐천·보통맛) → 결승(운석·매운맛). 우승하면 상금과 희귀 알 1개를 받는다. 지금까지 우승 ' + state.titles + '회.</p>' +
          '<h3 class="sub-h">' + ic('hand', 20) + '출전할 공룡</h3><div class="roster roster-strip">' + rosterHTML(mark(a.p1, 'sel', '출전'), true) + '</div>';
        startLabel = '리그 참가'; note = '참가하면 세 상대가 정해진다.';
      }
    } else {
      right = stageOpts() + '<h3 class="sub-h">' + ic('keyboard', 20) + '조작</h3><div class="keys"><div><span class="tag" style="color:var(--amber)">1P</span> <kbd>A</kbd><kbd>D</kbd> 이동 · <kbd>W</kbd> 점프 · <kbd>F</kbd> 머리 · <kbd>G</kbd> 꼬리 · <kbd>H</kbd> 팔·날개</div>' +
        '<div><span class="tag tag-fern">2P</span> <kbd>←</kbd><kbd>→</kbd> 이동 · <kbd>↑</kbd> 점프 · <kbd>,</kbd> 머리 · <kbd>.</kbd> 꼬리 · <kbd>/</kbd> 팔·날개</div></div>' +
        '<h3 class="sub-h">' + ic('hand', 20) + '공룡 고르기</h3><div class="opt-row" style="margin-bottom:10px"><button type="button" class="opt" data-pickwho="1" aria-pressed="' + (a.pick === 1) + '"><b>1P가 고르는 중</b></button><button type="button" class="opt" data-pickwho="2" aria-pressed="' + (a.pick === 2) + '"><b>2P가 고르는 중</b></button></div>' +
        '<div class="roster roster-strip">' + rosterHTML((function () { var m = mark(a.p1, 'sel', '1P'); if (a.p2 !== a.p1) m[a.p2] = { cls: 'sel-b', badge: '2P' }; else m[a.p1].badge = '1P·2P'; return m; })(), true) + '</div>';
      startLabel = '대전 시작'; note = '상금은 없다. 자존심만 걸려 있다.';
    }
    function mark(id, cls, badge) { var m = {}; m[id] = { cls: cls, badge: badge }; return m; }
    var keysNote = a.mode === 'versus' ? '' : '<div class="keys" style="margin-top:12px"><div><kbd>A</kbd><kbd>D</kbd> 이동 · <kbd>W</kbd>/<kbd>Space</kbd> 점프(날개가 있으면 날갯짓·활공)</div><div><kbd>J</kbd> 머리 기술 · <kbd>K</kbd> 꼬리 후려치기 · <kbd>L</kbd> 팔·날개 기술 (마우스 좌·우클릭도 된다)</div></div>';
    root.innerHTML = '<div class="modes">' + modes + '</div><div class="arena-setup"><div class="panel">' +
      '<div class="versus"><div class="vs-card p1"><canvas id="vs-p1"></canvas><div class="nm">' + esc(JG.dinoName(p1)) + '</div></div><span class="vs-mark">VS</span>' +
      '<div class="vs-card p2">' + (p2 ? '<canvas id="vs-p2"></canvas>' : '<div style="aspect-ratio:1.25;display:grid;place-items:center" class="muted">?</div>') + '<div class="nm">' + esc(p2name) + '</div></div></div>' +
      '<div class="breed-bar"><button type="button" class="btn btn-big" id="arena-start"' + (startOK ? '' : ' disabled') + '>' + ic('swords', 24) + startLabel + '</button><p class="muted">' + note + '</p></div>' + keysNote + '</div>' +
      '<div class="panel">' + right + '</div></div>';
    mountDino($('#vs-p1'), p1, { pad: 0.1 });
    if (p2) mountDino($('#vs-p2'), p2, { pad: 0.1, facing: -1 });
    $$('canvas[data-rival]', root).forEach(function (c) { mountDino(c, tour.rivals[+c.getAttribute('data-rival')], { still: true, pad: 0.06, facing: -1 }); });
    $$('[data-mode]', root).forEach(function (b) { b.addEventListener('click', function () { a.mode = b.getAttribute('data-mode'); A('tab'); render(); }); });
    $$('[data-stage]', root).forEach(function (b) { b.addEventListener('click', function () { a.stage = b.getAttribute('data-stage'); A('click'); render(); }); });
    $$('[data-diff]', root).forEach(function (b) { b.addEventListener('click', function () { a.diff = +b.getAttribute('data-diff'); newRival(); A('click'); render(); }); });
    $$('[data-pickwho]', root).forEach(function (b) { b.addEventListener('click', function () { a.pick = +b.getAttribute('data-pickwho'); A('click'); render(); }); });
    if ($('#arena-reroll')) $('#arena-reroll').addEventListener('click', function () { newRival(); A('click'); render(); });
    if ($('#tour-quit')) $('#tour-quit').addEventListener('click', function () { state.tour = null; save(); A('flop'); toast('리그에서 기권했다'); render(); });
    mountRoster(root, function (id) {
      if (a.mode === 'versus') { if (a.pick === 1) { a.p1 = id; a.pick = 2; } else { a.p2 = id; a.pick = 1; } }
      else { a.p1 = id; state.sel = id; save(); }
      render();
    });
    $('#arena-start').addEventListener('click', function () {
      JG.Audio.unlock();
      if (a.mode === 'tour' && !state.tour) {
        state.tour = { dinoId: a.p1, idx: 0, rivals: JG.TOUR.map(function (t) { return JG.randomRival(t.diff); }) };
        save(); A('go'); toast('리그 참가 완료. 8강부터 시작이다'); render(); return;
      }
      startMatch();
    });
  }

  /* ================= 경기 ================= */
  function startMatch(demo) {
    if (!window.Matter) { A('error'); toast('물리 엔진을 아직 불러오지 못했다. 인터넷 연결을 확인하고 잠시 뒤 다시 누른다', true); return; }
    var a = ui.arena, cfg, tour = state.tour, layer = $('#arena-layer');
    if (a.mode === 'tour' && tour) {
      var T = JG.TOUR[tour.idx], r = tour.rivals[tour.idx], me = byId(tour.dinoId);
      cfg = { stageId: T.stage, mode: '1p', title: T.round, p1: { dino: me, name: JG.dinoName(me) }, p2: { dino: r, name: JG.dinoName(r), diff: T.diff } };
    } else if (a.mode === 'versus') {
      cfg = { stageId: a.stage, mode: '2p', title: '2인 대전', p1: { dino: byId(a.p1), name: JG.dinoName(byId(a.p1)) }, p2: { dino: byId(a.p2), name: JG.dinoName(byId(a.p2)) } };
    } else {
      cfg = { stageId: a.stage, mode: '1p', title: '연습 경기', p1: { dino: byId(a.p1), name: JG.dinoName(byId(a.p1)) }, p2: { dino: a.rival, name: JG.dinoName(a.rival), diff: a.diff } };
    }
    if (demo) { cfg.mode = 'demo'; cfg.p1.diff = 2; }
    cfg.onEnd = onMatchEnd; cfg.onPause = togglePause;
    layer.hidden = false; $('#arena-panel').hidden = true; $('#arena-pause').hidden = false;
    $('#touch-pad').style.visibility = cfg.mode === '1p' ? '' : 'hidden';
    arena = new JG.Arena($('#arena-canvas'), cfg);
    JG._arena = arena;
    JG.Audio.music('arena');
    document.activeElement && document.activeElement.blur();
  }
  function togglePause() {
    if (!arena || arena.dead || arena.state === 'matchEnd') return;
    arena.paused = !arena.paused;
    var p = $('#arena-panel');
    if (arena.paused) {
      p.hidden = false;
      p.innerHTML = '<div class="modal modal-narrow" style="animation:none"><h2>일시정지</h2><p class="muted" style="margin-top:6px">' + esc(arena.stage.name) + ' · ' + esc(arena.stage.desc) + '</p>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" id="pause-exit">' + ic('log-out') + '경기 포기</button><button type="button" class="btn" id="pause-go">' + ic('play') + '계속하기</button></div></div>';
      $('#pause-go').addEventListener('click', togglePause); $('#pause-exit').addEventListener('click', function () { exitArena(true); });
      $('#pause-go').focus();
    } else { p.hidden = true; p.innerHTML = ''; }
  }
  function exitArena(forfeit) {
    if (arena) { arena.destroy(); arena = null; JG._arena = null; }
    $('#arena-layer').hidden = true; $('#arena-panel').hidden = true; $('#arena-panel').innerHTML = '';
    if (forfeit && ui.arena.mode === 'tour' && state.tour) { state.tour = null; save(); toast('경기를 포기해 리그에서 탈락했다', true); }
    JG.Audio.music('lab');
    render();
  }
  function onMatchEnd(res) {
    var a = ui.arena, win = res.winner === 0, p = $('#arena-panel'), title, sub, rewards = '', next = '', me, coins = 0;
    if (res.mode === 'demo') { exitArena(); return; }
    if (arena) arena.banner = null;
    if (res.mode === '2p') {
      var wd = byId(res.winner === 0 ? a.p1 : a.p2); if (wd) wd.wins++;
      title = (res.winner + 1) + 'P 승리!'; sub = esc(JG.dinoName(wd)) + ' · ' + res.wins[0] + ' : ' + res.wins[1];
      next = '<button type="button" class="btn" id="res-again" data-autofocus>' + ic('rotate-ccw') + '한 판 더</button>';
    } else if (a.mode === 'tour' && state.tour) {
      var tour = state.tour, T = JG.TOUR[tour.idx]; me = byId(tour.dinoId);
      if (win) {
        coins = Math.round(T.prize * (me.mut === 'golden' ? 1.5 : 1)); me.wins++; tour.idx++;
        if (tour.idx >= JG.TOUR.length) {
          state.tour = null; state.eggs++; state.titles++;
          title = '리그 우승!'; sub = esc(JG.dinoName(me)) + ' · 챔피언 등극';
          rewards = '<span class="tag">' + ic('coins', 15) + '+' + coins + '</span><span class="tag tag-egg">' + ic('egg', 15) + '희귀 알 +1</span>';
        } else {
          title = T.round + ' 승리!'; sub = '다음은 ' + JG.TOUR[tour.idx].round;
          rewards = '<span class="tag">' + ic('coins', 15) + '+' + coins + '</span>';
          next = '<button type="button" class="btn" id="res-next" data-autofocus>' + ic('swords') + JG.TOUR[tour.idx].round + ' 시작</button>';
        }
      } else { coins = 10; state.tour = null; title = '탈락…'; sub = T.round + '에서 졌다. 훈련하고 다시 도전하자.'; rewards = '<span class="tag">' + ic('coins', 15) + '위로금 +' + coins + '</span>'; }
    } else {
      me = byId(a.p1);
      if (win) { coins = Math.round(JG.PRACTICE_PRIZE[a.diff] * (me.mut === 'golden' ? 1.5 : 1)); me.wins++; title = '승리!'; sub = esc(JG.dinoName(me)) + ' · ' + res.wins[0] + ' : ' + res.wins[1]; }
      else { coins = 5; title = '패배…'; sub = '상대가 한 수 위였다. ' + res.wins[0] + ' : ' + res.wins[1]; }
      rewards = '<span class="tag">' + ic('coins', 15) + (win ? '상금 +' : '위로금 +') + coins + '</span>';
      next = '<button type="button" class="btn" id="res-again" data-autofocus>' + ic('rotate-ccw') + '한 판 더</button>';
      newRival();
    }
    if (coins) gain(coins);
    save(); refreshWallet();
    $('#arena-pause').hidden = true;
    p.hidden = false;
    p.innerHTML = '<div class="modal modal-narrow"><div class="result-title">' + title + '</div><p class="result-sub">' + sub + '</p><div class="reward-row">' + rewards + '</div>' +
      '<div class="modal-actions" style="justify-content:center"><button type="button" class="btn btn-ghost" id="res-exit">' + ic('flask-conical') + '연구소로</button>' + next + '</div></div>';
    JG.paintIcons(p);
    $('#res-exit').addEventListener('click', function () { A('click'); exitArena(); });
    if ($('#res-again')) $('#res-again').addEventListener('click', function () { A('click'); arena.destroy(); arena = null; startMatch(); });
    if ($('#res-next')) $('#res-next').addEventListener('click', function () { A('click'); arena.destroy(); arena = null; startMatch(); });
    var f = $('[data-autofocus]', p) || $('#res-exit'); f.focus();
  }

  /* ================= 도움말 ================= */
  function openHelp() {
    openModal('<h2>게임 방법</h2><ol class="help-list">' +
      '<li><div><b style="font-weight:400">교배소</b>에서 두 공룡을 교배기에 넣고 알을 깨운다. 머리·몸통·팔·다리가 부모에게서 하나씩 유전된다.</div></li>' +
      '<li><div><b style="font-weight:400">훈련장</b>에서 먹이를 주거나 미니게임으로 힘·탄성·민첩을 올린다.</div></li>' +
      '<li><div><b style="font-weight:400">투기장</b>에서 흐물흐물한 몸으로 막싸움을 벌인다. 상대를 용암에 빠뜨리거나 체력을 다 깎으면 이긴다.</div></li>' +
      '<li><div>상금으로 다시 교배해 <b style="font-weight:400">유전자 도감</b> ' + JG.DEX.length + '칸을 채운다. 리그에서 우승하면 돌연변이가 확정인 희귀 알을 받는다.</div></li></ol>' +
      '<div class="keys" style="margin-top:14px"><div><kbd>A</kbd><kbd>D</kbd> 또는 <kbd>←</kbd><kbd>→</kbd> 이동 · <kbd>W</kbd>/<kbd>Space</kbd> 점프(날개가 있으면 공중에서 날갯짓, 누르고 있으면 활공)</div>' +
      '<div><kbd>J</kbd> 머리 기술(박치기·물기·뿔 돌진) · <kbd>K</kbd> 꼬리 후려치기 · <kbd>L</kbd> 팔·날개 기술 · <kbd>Esc</kbd> 일시정지</div>' +
      '<div>맞을수록 더 멀리 날아간다. 공중에서 머리 기술을 쓰면 급강하 공격이 된다.</div></div>' +
      '<div class="modal-actions"><button type="button" class="btn" id="help-ok" data-autofocus>' + ic('check') + '알겠다</button></div>', { cls: 'modal-narrow', onClose: function () { if (!state.seenHelp) { state.seenHelp = true; save(); } } });
    $('#help-ok').addEventListener('click', function () { A('click'); closeModal(); });
  }

  /* ================= 시작 ================= */
  function start(data) {
    state = data && Array.isArray(data.dinos) ? adopt(data) : load();
    JG.Audio.setSfx(state.settings.sfx); JG.Audio.musicOn = state.settings.music;
    var first = true;
    function unlock() {
      if (!JG.Audio.unlock()) return;
      if (first) { first = false; if (!arena) JG.Audio.music('lab'); }
    }
    document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
    $$('.tab').forEach(function (b) { b.addEventListener('click', function () { A('tab'); setView(b.getAttribute('data-view')); }); });
    $('#btn-sfx').addEventListener('click', function () { state.settings.sfx = !state.settings.sfx; JG.Audio.setSfx(state.settings.sfx); save(); refreshWallet(); A('click'); });
    $('#btn-music').addEventListener('click', function () { state.settings.music = !state.settings.music; JG.Audio.setMusic(state.settings.music); save(); refreshWallet(); A('click'); });
    $('#btn-help').addEventListener('click', function () { A('click'); openHelp(); });
    $('#arena-pause').addEventListener('click', togglePause);
    $('#arena-exit').addEventListener('click', function () { if (arena && arena.state !== 'matchEnd' && !arena.paused) togglePause(); else exitArena(arena && arena.state !== 'matchEnd'); });
    $$('[data-touch]').forEach(function (b) {
      var n = b.getAttribute('data-touch');
      function set(v) { return function (e) { e.preventDefault(); if (arena) arena.setTouch(n, v); }; }
      b.addEventListener('pointerdown', set(true)); b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false)); b.addEventListener('pointerleave', set(false));
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    document.addEventListener('keydown', function (e) { if (e.code === 'Escape' && modalStack.length && !modalStack[modalStack.length - 1].noClose) closeModal(); });
    window.addEventListener('hashchange', function () { var h = location.hash.replace('#', ''); if (VIEWS.indexOf(h) >= 0 && h !== view) setView(h, true); });
    var h0 = ''; try { h0 = location.hash.replace('#', ''); } catch (e) {}
    setView(VIEWS.indexOf(h0) >= 0 ? h0 : 'lab', true);
    requestAnimationFrame(animLoop);
    if (!state.seenHelp) openHelp();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { anims.forEach(function (a) { a.done = false; }); });
  }
  /* 점검·연동용 */
  JG.UI = { getState: function () { return state; }, setView: setView, render: render, startMatch: startMatch, exitArena: exitArena, save: save, registerDex: registerDex, KEY: KEY, toast: toast };

  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(function () { return state; }); } catch (e) {} }
  function boot() { if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
