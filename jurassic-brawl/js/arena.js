/* 쥬라기 유전자 막싸움 — 용암 투기장
   스테이지(무너지는 절벽 / 간헐천 / 운석 비탈), 라운드 진행, 입력, 타격 연출, 렌더링 */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};
  var W = 1280, H = 720, LAVA0 = 664, FLOOR = 520, STEP = 1000 / 60, TAU = Math.PI * 2;
  var A = function (n, o) { if (JG.Audio) JG.Audio.play(n, o); };
  var FONT_D = '"Bagel Fat One", "Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', FONT_B = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  var PCOL = ['#ffb627', '#35d6b4'];

  var MAP1 = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['KeyW', 'Space', 'ArrowUp'], a1: ['KeyJ', 'KeyF', 'Comma', 'Mouse0'], a2: ['KeyK', 'KeyG', 'Period', 'Mouse2'], a3: ['KeyL', 'KeyH', 'Slash', 'Mouse1'] };
  var MAP2 = [
    { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], a1: ['KeyF'], a2: ['KeyG'], a3: ['KeyH'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], a1: ['Comma', 'KeyK', 'Numpad1'], a2: ['Period', 'KeyL', 'Numpad2'], a3: ['Slash', 'Semicolon', 'Numpad3'] }
  ];
  var GAME_KEYS = {};
  [MAP1, MAP2[0], MAP2[1]].forEach(function (m) { for (var k in m) m[k].forEach(function (c) { GAME_KEYS[c] = 1; }); });
  var NONE = { dir: 0, face: 0, jumpPressed: false, jumpHeld: false, a1: false, a2: false, a3: false };

  /* cfg: { stageId, mode:'1p'|'2p'|'demo', p1:{dino,name}, p2:{dino,name,diff}, roundsToWin, title, onEnd(result) } */
  function Arena(canvas, cfg) {
    var self = this;
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cfg = cfg;
    this.stageId = cfg.stageId || 'cliff'; this.mode = cfg.mode || '1p';
    this.stage = JG.STAGES.filter(function (s) { return s.id === self.stageId; })[0];
    this.fx = new JG.FX();
    this.wins = [0, 0]; this.round = 0; this.roundsToWin = cfg.roundsToWin || 2;
    this.keys = {}; this.pressed = {}; this.touch = {}; this.touchPressed = {};
    this.paused = false; this.dead = false; this.acc = 0; this.last = 0; this.time = 0; this.hitstop = 0;
    this.fighters = []; this.platforms = []; this.banner = null; this.hintT = 0;
    this.embers = []; this.bubbles = []; this.smoke = [];
    for (var i = 0; i < 46; i++) this.embers.push({ x: Math.random() * W, y: Math.random() * H, v: JG.rand(0.4, 1.6), s: JG.rand(1, 3.2), p: Math.random() * TAU });
    for (i = 0; i < 9; i++) this.smoke.push({ x: 640 + JG.rand(-30, 30), y: 215 - i * 24, r: 18 + i * 5, p: Math.random() * TAU });
    this.bg = this.buildBackground();
    this.resize();
    this.bind();
    this.startRound();
    this.loop = function (ts) {
      if (self.dead) return;
      self.raf = requestAnimationFrame(self.loop);
      var dt = Math.min(60, ts - (self.last || ts)); self.last = ts;
      if (!self.paused) {
        self.acc += dt; var n = 0;
        while (self.acc >= STEP && n < 3) { self.tick(); self.acc -= STEP; n++; }
        if (n === 3) self.acc = 0;
      }
      self.render();
    };
    this.raf = requestAnimationFrame(this.loop);
  }
  var P = Arena.prototype;
  JG.Arena = Arena;

  /* ================= 입력 ================= */
  P.bind = function () {
    var self = this;
    this._kd = function (e) {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat && self.cfg.onPause) self.cfg.onPause(); e.preventDefault(); return; }
      if (!GAME_KEYS[e.code]) return;
      if (!e.repeat) self.pressed[e.code] = true;
      self.keys[e.code] = true; e.preventDefault();
    };
    this._ku = function (e) { if (GAME_KEYS[e.code]) { self.keys[e.code] = false; e.preventDefault(); } };
    this._md = function (e) { if (e.button <= 2) { self.pressed['Mouse' + e.button] = true; e.preventDefault(); } };
    this._cm = function (e) { e.preventDefault(); };
    this._blur = function () { self.keys = {}; };
    this._rs = function () { self.resize(); };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', this._blur); window.addEventListener('resize', this._rs);
    this.canvas.addEventListener('mousedown', this._md); this.canvas.addEventListener('contextmenu', this._cm);
  };
  P.unbind = function () {
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    window.removeEventListener('blur', this._blur); window.removeEventListener('resize', this._rs);
    this.canvas.removeEventListener('mousedown', this._md); this.canvas.removeEventListener('contextmenu', this._cm);
  };
  P.setTouch = function (name, down) { if (down && !this.touch[name]) this.touchPressed[name] = true; this.touch[name] = down; };
  function any(list, src) { for (var i = 0; i < list.length; i++) if (src[list[i]]) return true; return false; }
  P.humanInput = function (pi) {
    var m = this.mode === '2p' ? MAP2[pi] : MAP1, k = this.keys, pr = this.pressed, t = pi === 0 ? this.touch : {}, tp = pi === 0 ? this.touchPressed : {};
    return { dir: ((any(m.right, k) || t.right) ? 1 : 0) - ((any(m.left, k) || t.left) ? 1 : 0), face: 0,
      jumpPressed: any(m.jump, pr) || !!tp.jump, jumpHeld: any(m.jump, k) || !!t.jump,
      a1: any(m.a1, pr) || !!tp.a1, a2: any(m.a2, pr) || !!tp.a2, a3: any(m.a3, pr) || !!tp.a3 };
  };

  P.resize = function () {
    var c = this.canvas, box = c.parentNode ? c.parentNode.getBoundingClientRect() : { width: W, height: H };
    var cw = box.width || W, ch = box.height || H, sc = Math.min(cw / W, ch / H);
    var dpr = Math.min(window.devicePixelRatio || 1, 2), pw = Math.max(320, Math.round(W * sc * dpr));
    if (pw > 1920) pw = 1920;
    c.width = pw; c.height = Math.round(pw * H / W);
    c.style.width = Math.floor(W * sc) + 'px'; c.style.height = Math.floor(H * sc) + 'px';
    this.scale = c.width / W;
  };

  /* ================= 라운드 ================= */
  P.startRound = function () {
    var M = window.Matter, self = this, cfg = this.cfg;
    if (this.engine) { M.Events.off(this.engine); M.Composite.clear(this.engine.world, false); M.Engine.clear(this.engine); }
    this.engine = M.Engine.create({ positionIterations: 8, velocityIterations: 6, constraintIterations: 4 });
    this.engine.gravity.scale = JG.GRAVITY_SCALE;
    this.world = this.engine.world;
    this.platforms = []; this.fighters = []; this.debris = []; this.meteors = []; this.vents = []; this.tiles = [];
    this.round++; this.state = 'intro'; this.stateT = 0; this.fightT = 0; this.timeLeft = 60 * 60; this.lavaY = LAVA0; this.lavaRising = false;
    this.hitstop = 0; this.engine.timing.timeScale = 1; this.roundWinner = null;
    this.buildStage();
    var top = FLOOR - 250;
    var d1 = cfg.p1, d2 = cfg.p2;
    this.fighters.push(new JG.Fighter(this, d1.dino, 0, 430, top, 1, { ai: this.mode === 'demo', diff: d1.diff || 2, name: d1.name }));
    this.fighters.push(new JG.Fighter(this, d2.dino, 1, 850, top, -1, { ai: this.mode !== '2p', diff: d2.diff || 2, name: d2.name }));
    this.ghost = [1, 1];
    M.Events.on(this.engine, 'collisionStart', function (ev) { self.onCollide(ev); });
    this.say((this.cfg.title ? this.cfg.title + ' · ' : '') + this.round + '라운드', this.stage.name, 70);
    if (this.round === 1) this.hintT = 60 * 9;
  };

  function plat(arena, body, meta) {
    body.friction = 0.9; body.restitution = 0.05;
    body.collisionFilter = { group: 0, category: JG.CAT.WORLD, mask: 0xFFFF };
    body.jgPlat = meta || {};
    window.Matter.Composite.add(arena.world, body);
    arena.platforms.push(body);
    return body;
  }
  P.buildStage = function () {
    var M = window.Matter, B = M.Bodies, i;
    if (this.stageId === 'cliff') {
      var n = 9, x0 = 150, tw = 980 / n;
      for (i = 0; i < n; i++) {
        var b = plat(this, B.rectangle(x0 + tw * (i + 0.5), FLOOR + 35, tw + 0.5, 70, { isStatic: true }), { kind: 'tile', i: i });
        this.tiles.push({ body: b, i: i, state: 'solid', t: 0, x: x0 + tw * (i + 0.5), w: tw });
      }
      this.crumbleOrder = [0, 8, 1, 7, 2, 6]; this.crumbleIdx = 0; this.nextCrumble = 60 * 7;
    } else if (this.stageId === 'geyser') {
      plat(this, B.rectangle(640, FLOOR + 35, 940, 70, { isStatic: true }), { kind: 'slab' });
      plat(this, B.rectangle(285, 378, 150, 24, { isStatic: true }), { kind: 'ledge' });
      plat(this, B.rectangle(995, 378, 150, 24, { isStatic: true }), { kind: 'ledge' });
      [400, 640, 880].forEach(function (x) { this.vents.push({ x: x, state: 'idle', t: 0, hit: {} }); }, this);
      this.nextVent = 60 * 4; this.lastVent = -1;
    } else {
      var ang = Math.atan2(40, 460), len = 462 / Math.cos(ang) + 10;
      plat(this, B.rectangle(410 + Math.sin(ang) * 30, 528 + Math.cos(ang) * 30, len, 60, { isStatic: true, angle: -ang }), { kind: 'slab' });
      plat(this, B.rectangle(870 - Math.sin(ang) * 30, 528 + Math.cos(ang) * 30, len, 60, { isStatic: true, angle: ang }), { kind: 'slab' });
      this.nextMeteor = 60 * 3;
    }
    this.updateMain();
  };
  P.updateMain = function () {
    var l = 1e9, r = -1e9;
    this.platforms.forEach(function (b) { if (b.jgPlat.kind === 'ledge') return; l = Math.min(l, b.bounds.min.x); r = Math.max(r, b.bounds.max.x); });
    this.mainL = l; this.mainR = r;
  };
  function topAt(b, x) {
    var v = b.vertices, best = null;
    for (var i = 0; i < v.length; i++) {
      var p = v[i], q = v[(i + 1) % v.length];
      if ((x < p.x && x < q.x) || (x > p.x && x > q.x) || p.x === q.x) continue;
      var y = p.y + (x - p.x) / (q.x - p.x) * (q.y - p.y);
      if (best == null || y < best) best = y;
    }
    return best;
  }
  /* (x, yFrom) 아래에서 가장 가까운 지면의 y. 없으면 null */
  P.groundYAt = function (x, yFrom) {
    var best = null;
    for (var i = 0; i < this.platforms.length; i++) {
      var b = this.platforms[i];
      if (x < b.bounds.min.x || x > b.bounds.max.x) continue;
      var top = topAt(b, x);
      if (top == null || top < yFrom - 34) continue;
      if (best == null || top < best) best = top;
    }
    if (best != null && best > this.lavaY) return null;
    return best;
  };
  P.safeX = function () { return (this.mainL + this.mainR) / 2; };
  /* AI용: x 지점이 위험하면 피할 방향(-1/1), 아니면 0 */
  P.dangerDir = function (x) {
    var i, mid = this.safeX();
    for (i = 0; i < this.tiles.length; i++) { var t = this.tiles[i]; if (t.state === 'warn' && Math.abs(x - t.x) < t.w * 0.7) return x < mid ? 1 : -1; }
    for (i = 0; i < this.vents.length; i++) { var v = this.vents[i]; if (v.state !== 'idle' && Math.abs(x - v.x) < 84) return x >= v.x ? 1 : -1; }
    for (i = 0; i < this.meteors.length; i++) { var m = this.meteors[i]; if (m.phase !== 'roll' && Math.abs(x - m.tx) < 110) return x >= m.tx ? 1 : -1; }
    return 0;
  };

  /* ================= 연출 훅 (Fighter가 호출) ================= */
  P.say = function (text, sub, life, color) { this.banner = { text: text, sub: sub || '', t: 0, life: life || 80, color: color || '#fff3d6' }; };
  P.onHit = function (victim, h, dmg, kb, heavy) {
    var fx = this.fx, at = h.at || victim.torso.position, mv = h.move || {}, by = h.by;
    var col = by && by.idx != null ? PCOL[by.idx] : '#ffe14d';
    this.hitstop = Math.max(this.hitstop, victim.ko ? 12 : heavy ? 7 : 3);
    fx.addShake(victim.ko ? 26 : heavy ? 15 : 5 + dmg * 0.3);
    if (heavy) { fx.punch(0.035); fx.flashScreen(0.22); }
    fx.burst(at.x, at.y, { n: heavy ? 16 : 8, colors: ['#fff', '#ffe14d', col], speed: [3, heavy ? 13 : 8], life: [12, 26], size: [3, 8], kind: 'star', grav: 0.2 });
    fx.burst(at.x, at.y, { n: heavy ? 10 : 4, colors: ['#fff'], speed: [5, 15], life: [6, 12], size: [3, 5], kind: 'line', grav: 0 });
    fx.burst(at.x, at.y, { n: 1, colors: ['#fff'], speed: [0, 0], life: [14, 14], size: [heavy ? 9 : 6, heavy ? 9 : 6], kind: 'ring', grav: 0 });
    var words = mv.words || JG.WORDS_SLAM;
    fx.text(at.x + JG.rand(-14, 14), at.y - (heavy ? 84 : 52), h.dive ? '급강하!' : JG.pick(words), { size: heavy ? 40 : 30, big: heavy, color: heavy ? '#fff' : col, burst: heavy ? (by && by.idx === 1 ? '#0e9f86' : '#ff5a1f') : null });
    fx.text(victim.torso.position.x + h.dirX * 46 + JG.rand(-10, 10), victim.torso.position.y - 8, '-' + Math.max(1, Math.round(dmg)), { size: 22, color: '#ff7a59', plain: true, life: 34 });
    A(mv.sfx || 'hit');
    if (heavy) { A('heavy', { vol: 0.8 }); A('flop', { delay: 0.12 }); }
    if (victim.ko) { A('ko'); fx.flashScreen(0.7); }
  };
  P.onLand = function (f, vy) {
    var p = f.torso.position, gy = this.groundYAt(p.x, p.y) || p.y + f.sp.standH;
    this.fx.burst(p.x, gy - 4, { n: vy > 12 ? 14 : 7, colors: ['#c9a58f', '#8d6e63', '#e8d5c0'], speed: [1, 4], life: [16, 30], size: [3, 8], kind: 'smoke', grav: -0.02, angle: -Math.PI / 2, spread: 3 });
    A('land', { vol: Math.min(1.2, vy / 12) });
    if (vy > 13) { this.fx.addShake(6 + f.st.wgt * 0.5); if (f.st.wgt >= 7) this.fx.text(p.x, gy - 70, '쿵!', { size: 30, color: '#e8d5c0' }); }
  };
  P.onJump = function (f) {
    var p = f.torso.position;
    this.fx.burst(p.x, p.y + f.sp.standH - 4, { n: 5, colors: ['#c9a58f', '#e8d5c0'], speed: [1, 3], life: [12, 22], size: [3, 6], kind: 'smoke', grav: 0, angle: -Math.PI / 2, spread: 3 });
    A('jump', { pitch: JG.clamp(1.5 - f.st.wgt * 0.07, 0.7, 1.4) });
  };
  P.onFlap = function (f) {
    var p = f.torso.position;
    this.fx.burst(p.x, p.y, { n: 5, colors: ['#fff', JG.hsl(f.dino.colors.accent, 10)], speed: [2, 5], life: [14, 24], size: [2, 5], kind: 'line', grav: 0.1, angle: Math.PI / 2, spread: 2 });
    A('flap');
  };
  P.onStep = function (f) {
    var p = f.torso.position;
    this.fx.burst(p.x - f.f * 10, p.y + f.sp.standH - 3, { n: 2, colors: ['#c9a58f'], speed: [0.5, 1.5], life: [10, 18], size: [2, 5], kind: 'smoke', grav: -0.02 });
  };
  P.onSwing = function (f, mv, slot) {
    A('whoosh', { pitch: slot === 'tail' ? 0.7 : slot === 'head' ? 1 : 1.4 });
    if (slot === 'tail' && mv.sfx === 'boing') A('boing');
  };
  /* 날개 바람: 앞쪽 상대를 밀어낸다 */
  P.gust = function (f, dir) {
    var p = f.torso.position, i, k;
    this.fx.burst(p.x + dir * 40, p.y, { n: 10, colors: ['#fff', '#d8f3ff'], speed: [8, 15], life: [10, 18], size: [2, 4], kind: 'line', grav: 0, angle: dir > 0 ? 0 : Math.PI, spread: 0.7, jy: 60 });
    for (i = 0; i < this.fighters.length; i++) {
      var foe = this.fighters[i]; if (foe === f || foe.out) continue;
      var dx = (foe.torso.position.x - p.x) * dir, dy = Math.abs(foe.torso.position.y - p.y);
      if (dx < 0 || dx > 230 || dy > 130) continue;
      var push = 5.2 * (1 - dx / 230) / foe.kbResist;
      for (k = 0; k < foe.bodies.length; k++) foe.addVel(foe.bodies[k], dir * push, -push * 0.25);
    }
  };

  /* 몸끼리·운석과의 물리 충돌 → 몸통 박치기 피해 */
  P.onCollide = function (ev) {
    if (this.state !== 'fight') return;
    var pairs = ev.pairs, i;
    for (i = 0; i < pairs.length; i++) {
      var a = pairs[i].bodyA, b = pairs[i].bodyB, fa = a.jgF, fb = b.jgF;
      if (a.jgMeteor || b.jgMeteor) { this.meteorTouch(a.jgMeteor ? a : b, a.jgMeteor ? b : a); continue; }
      if (!fa || !fb || fa === fb) continue;
      var rvx = a.velocity.x - b.velocity.x, rvy = a.velocity.y - b.velocity.y, rv = Math.sqrt(rvx * rvx + rvy * rvy);
      if (rv < 9.5 || fa.slamCd > 0 || fb.slamCd > 0) continue;
      var sa = a.speed, sb = b.speed, atk = sa >= sb ? fa : fb, vic = sa >= sb ? fb : fa;
      if (atk.atk || atk.stun > 0 || vic.inv > 0) continue;
      fa.slamCd = fb.slamCd = 26;
      var s = pairs[i].collision.supports, at = s && s[0] ? { x: s[0].x, y: s[0].y } : { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
      vic.takeHit({ dmg: Math.min(9, (rv - 8) * 0.9) * (0.7 + atk.st.wgt * 0.06), kb: Math.min(9, rv * 0.42), dirX: vic.torso.position.x >= atk.torso.position.x ? 1 : -1, up: 0.25, by: atk, move: { words: JG.WORDS_SLAM, sfx: 'hit' }, at: at });
    }
  };

  /* ================= 스테이지 기믹 ================= */
  P.updateHazards = function () {
    var M = window.Matter, Body = M.Body, self = this, i, k, fast = this.lavaRising ? 0.5 : 1;
    // --- 무너지는 절벽 ---
    if (this.stageId === 'cliff') {
      if (this.fightT >= this.nextCrumble && this.crumbleIdx < this.crumbleOrder.length) {
        var tl = this.tiles[this.crumbleOrder[this.crumbleIdx++]];
        tl.state = 'warn'; tl.t = 110; this.nextCrumble = this.fightT + Math.round(60 * 5 * fast);
        A('warn');
      }
      this.tiles.forEach(function (t) {
        if (t.state !== 'warn') return;
        if (t.t % 9 === 0) self.fx.burst(t.x + JG.rand(-t.w / 2, t.w / 2), FLOOR + 4, { n: 2, colors: ['#8d6e63', '#5a3d4c'], speed: [1, 3], life: [14, 26], size: [3, 6], kind: 'chunk', grav: 0.4 });
        if (--t.t <= 0) {
          t.state = 'gone';
          M.Composite.remove(self.world, t.body);
          self.platforms.splice(self.platforms.indexOf(t.body), 1);
          self.debris.push({ x: t.x, y: FLOOR, w: t.w, vy: 1, rot: 0, vr: JG.rand(-0.02, 0.02), i: t.i });
          self.updateMain();
          self.fx.addShake(12); A('crumble');
          self.fx.burst(t.x, FLOOR + 20, { n: 18, colors: ['#8d6e63', '#5a3d4c', '#3b2636'], speed: [2, 8], life: [20, 40], size: [4, 10], kind: 'chunk', grav: 0.5, jx: t.w });
          self.fx.text(t.x, FLOOR - 40, '와르르!', { size: 34, color: '#e8d5c0' });
        }
      });
    }
    // --- 간헐천 ---
    if (this.stageId === 'geyser') {
      if (this.fightT >= this.nextVent) {
        var idle = []; this.vents.forEach(function (v, n) { if (v.state === 'idle' && n !== self.lastVent) idle.push(n); });
        if (idle.length) { var vi = JG.pick(idle), v = this.vents[vi]; v.state = 'warn'; v.t = 78; v.hit = {}; this.lastVent = vi; A('warn'); }
        this.nextVent = this.fightT + Math.round(JG.rand(200, 300) * fast);
      }
      this.vents.forEach(function (v) {
        if (v.state === 'warn') {
          if (v.t % 6 === 0) self.fx.burst(v.x + JG.rand(-22, 22), FLOOR - 4, { n: 1, colors: ['#e8fbff', '#bfeaf5'], speed: [1, 3], life: [16, 28], size: [3, 7], kind: 'smoke', grav: -0.08, angle: -Math.PI / 2, spread: 0.6 });
          if (v.t % 14 === 0) A('bubble');
          if (--v.t <= 0) { v.state = 'erupt'; v.t = 56; A('geyser'); self.fx.addShake(9); }
        } else if (v.state === 'erupt') {
          self.fx.burst(v.x + JG.rand(-26, 26), FLOOR - 10, { n: 4, colors: ['#ffffff', '#c9f1ff', '#8fd9f2'], speed: [14, 26], life: [18, 30], size: [4, 9], kind: 'dot', grav: 0.5, angle: -Math.PI / 2, spread: 0.28 });
          self.fx.burst(v.x + JG.rand(-30, 30), FLOOR - 40, { n: 1, colors: ['#e8fbff'], speed: [1, 4], life: [20, 34], size: [6, 12], kind: 'smoke', grav: -0.1 });
          self.fighters.forEach(function (f) {
            var touched = false;
            for (k = 0; k < f.bodies.length; k++) {
              var b = f.bodies[k], p = b.position;
              if (Math.abs(p.x - v.x) < 54 && p.y < FLOOR + 10 && p.y > 40) { Body.setVelocity(b, { x: b.velocity.x + (p.x - v.x) * 0.005, y: Math.max(-18, b.velocity.y - 2.7) }); touched = true; }
            }
            if (touched && !v.hit[f.idx] && !f.out) {
              v.hit[f.idx] = true; f.hp = Math.max(1, f.hp - 4); f.stun = Math.max(f.stun, 34); f.getup = 0; f.hurtT = 30; f.atk = null; f.spinning = false;
              self.fx.text(f.torso.position.x, f.torso.position.y - 70, JG.pick(['솟구쳐!', '뜨거워!', '으아아!']), { size: 34, color: '#c9f1ff' });
              A('flop');
            }
          });
          if (--v.t <= 0) v.state = 'idle';
        }
      });
    }
    // --- 운석 ---
    if (this.stageId === 'meteor') {
      if (this.fightT >= this.nextMeteor && this.meteors.length < 3) {
        var tgt = JG.pick(this.fighters), tx = JG.clamp(tgt.torso.position.x + JG.rand(-110, 110), 230, 1050);
        this.meteors.push({ phase: 'mark', tx: tx, t: 34, r: JG.rand(24, 33), body: null, life: 0, rot: 0 });
        this.nextMeteor = this.fightT + Math.round(JG.rand(190, 320) * fast);
        A('meteorFall');
      }
      for (i = this.meteors.length - 1; i >= 0; i--) {
        var m = this.meteors[i];
        if (m.phase === 'mark') {
          if (--m.t <= 0) {
            var sx = m.tx + JG.rand(-320, 320), T = 46, gy = this.groundYAt(m.tx, 200) || FLOOR, dy = (gy - m.r) - (-60);
            var body = M.Bodies.circle(sx, -60, m.r, { density: 0.0045, restitution: 0.3, friction: 0.7, frictionAir: 0.002, collisionFilter: { group: 0, category: JG.CAT.PROP, mask: JG.CAT.WORLD | JG.CAT.DINO | JG.CAT.PROP } });
            body.jgMeteor = m; m.body = body; m.phase = 'fall';
            Body.setVelocity(body, { x: (m.tx - sx) / T, y: (dy - 0.25 * T * T) / T });
            M.Composite.add(this.world, body);
          }
        } else {
          var mp = m.body.position;
          m.rot = m.body.angle;
          if (m.phase === 'fall') this.fx.burst(mp.x, mp.y, { n: 2, colors: ['#ffb627', '#ff5a1f', '#fff3d6'], speed: [0.5, 2], life: [10, 20], size: [4, 10], kind: 'dot', grav: -0.05 });
          else if (--m.life <= 0) { this.fx.burst(mp.x, mp.y, { n: 12, colors: ['#5a3d4c', '#8d6e63'], speed: [2, 6], life: [16, 30], size: [4, 9], kind: 'chunk' }); M.Composite.remove(this.world, m.body); this.meteors.splice(i, 1); continue; }
          if (mp.y > this.lavaY + 10 || mp.x < -200 || mp.x > W + 200) {
            if (mp.y > this.lavaY) { this.splash(mp.x, 10); A('lava'); }
            M.Composite.remove(this.world, m.body); this.meteors.splice(i, 1);
          }
        }
      }
    }
    // --- 무너진 바닥 조각(그림만) ---
    for (i = this.debris.length - 1; i >= 0; i--) {
      var d = this.debris[i]; d.vy += 0.5; d.y += d.vy; d.rot += d.vr;
      if (d.y > this.lavaY && !d.sp) { d.sp = true; this.splash(d.x, 12); A('lava'); }
      if (d.y > H + 100) this.debris.splice(i, 1);
    }
    // --- 시간 종료 뒤 용암 상승 ---
    if (this.lavaRising && this.lavaY > 300) this.lavaY -= 0.28;
  };
  P.meteorTouch = function (mb, other) {
    var m = mb.jgMeteor, self = this, p = mb.position;
    if (m.phase === 'fall' && (other.jgPlat || other.jgF)) {
      m.phase = 'roll'; m.life = 300;
      this.fx.addShake(18); this.fx.flashScreen(0.3, '#ffb627'); A('boom');
      this.fx.burst(p.x, p.y + m.r, { n: 22, colors: ['#ffb627', '#ff5a1f', '#fff3d6', '#5a3d4c'], speed: [3, 12], life: [16, 36], size: [4, 10], kind: 'dot', grav: 0.3, angle: -Math.PI / 2, spread: 3 });
      this.fx.burst(p.x, p.y + m.r, { n: 8, colors: ['#3b2636'], speed: [1, 4], life: [24, 40], size: [8, 14], kind: 'smoke', grav: -0.05 });
      this.fx.text(p.x, p.y - 50, '쾅!', { size: 52, big: true, color: '#fff', burst: '#ff5a1f' });
      this.fighters.forEach(function (f) {
        var dx = f.torso.position.x - p.x, dy = f.torso.position.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 125 && !f.out) f.takeHit({ dmg: 13 * (1 - d / 190), kb: 8.5 * (1 - d / 220), dirX: dx >= 0 ? 1 : -1, up: 0.7, move: { words: ['운석이다!', '으악!'], sfx: 'heavy' }, at: { x: f.torso.position.x, y: f.torso.position.y } });
      });
    } else if (m.phase === 'roll' && other.jgF && mb.speed > 4.5 && other.jgF.slamCd <= 0 && other.jgF.inv <= 0) {
      var f = other.jgF; f.slamCd = 30;
      f.takeHit({ dmg: Math.min(10, mb.speed * 0.9), kb: Math.min(7, mb.speed * 0.5), dirX: mb.velocity.x >= 0 ? 1 : -1, up: 0.3, move: { words: ['데굴데굴!', '퍽!'], sfx: 'hit' }, at: { x: other.position.x, y: other.position.y } });
    }
  };
  P.splash = function (x, n) {
    this.fx.burst(x, this.lavaY, { n: n, colors: ['#ffb627', '#ff5a1f', '#ffe14d'], speed: [4, 13], life: [20, 40], size: [4, 10], kind: 'dot', grav: 0.45, angle: -Math.PI / 2, spread: 1.3 });
    this.fx.burst(x, this.lavaY, { n: Math.ceil(n / 2), colors: ['#3b2636', '#6b4a5a'], speed: [1, 3], life: [30, 50], size: [8, 14], kind: 'smoke', grav: -0.08 });
  };

  /* ================= 틱 ================= */
  P.tick = function () {
    var M = window.Matter, self = this, fs = this.fighters, i, f;
    this.time++;
    this.fx.update();
    this.updateAmbient();
    if (this.banner && ++this.banner.t > this.banner.life) this.banner = null;
    if (this.hintT > 0) this.hintT--;
    if (this.hitstop > 0) { this.hitstop--; return; }
    this.stateT++;

    var inputs = [NONE, NONE];
    if (this.state === 'intro') {
      if (this.stateT === 50) { A('roar', { size: JG.clamp(fs[0].sp.scale * (0.6 + fs[0].st.wgt * 0.07), 0.6, 1.5) }); fs[0].mouth = 1; fs[0].hurtT = 0; }
      if (this.stateT === 78) { A('roar', { size: JG.clamp(fs[1].sp.scale * (0.6 + fs[1].st.wgt * 0.07), 0.6, 1.5) }); fs[1].mouth = 1; }
      if (this.stateT === 70) A('count');
      if (this.stateT === 100) A('count');
      if (this.stateT >= 130) { this.state = 'fight'; this.stateT = 0; this.say('막싸움 시작!', '', 46, '#ffe14d'); A('go'); this.pressed = {}; this.touchPressed = {}; }
    } else if (this.state === 'fight') {
      this.fightT++;
      for (i = 0; i < 2; i++) inputs[i] = fs[i].isAI ? JG.aiInput(fs[i], fs[1 - i], this) : this.humanInput(i);
      if (this.timeLeft > 0 && --this.timeLeft === 0) { this.lavaRising = true; this.say('용암이 차오른다!', '높은 곳으로!', 90, '#ff5a1f'); A('warn'); A('crumble'); this.fx.addShake(14); }
      this.updateHazards();
    } else if (this.state === 'roundEnd') {
      if (this.stateT === 60) { this.engine.timing.timeScale = 1; }
      var wn = this.roundWinner;
      if (wn >= 0 && this.stateT > 60) {
        inputs[wn] = { dir: 0, face: 0, jumpPressed: this.stateT % 30 === 0, jumpHeld: false, a1: false, a2: false, a3: false };
        if (this.stateT === 70) { A('roar', { size: JG.clamp(fs[wn].sp.scale * (0.6 + fs[wn].st.wgt * 0.07), 0.6, 1.5) }); }
        fs[wn].mouth = 1;
      }
      this.updateHazards();
      if (this.stateT >= 175) {
        var over = wn >= 0 && this.wins[wn] >= this.roundsToWin;
        if (over) { this.state = 'matchEnd'; this.stateT = 0; this.finish(wn); }
        else { this.startRound(); return; }
      }
    } else if (this.state === 'matchEnd') {
      var w2 = this.roundWinner;
      if (w2 >= 0) inputs[w2] = { dir: 0, face: 0, jumpPressed: this.stateT % 30 === 0, jumpHeld: false, a1: false, a2: false, a3: false };
    }

    for (i = 0; i < 2; i++) fs[i].preStep(inputs[i]);
    M.Engine.update(this.engine, STEP);
    for (i = 0; i < 2; i++) fs[i].postStep();
    this.pressed = {}; this.touchPressed = {};

    // 용암·장외 판정
    for (i = 0; i < 2; i++) {
      f = fs[i];
      if (f.out) continue;
      var p = f.torso.position;
      if (!f.isSane()) { f.out = true; f.ko = true; continue; }
      if (p.y > this.lavaY - 4 || p.x < -260 || p.x > W + 260) {
        if (f.lavaPerk && !f.lavaUsed && p.y > this.lavaY - 4 && this.state === 'fight') {
          f.lavaUsed = true; f.hp = Math.max(1, f.hp - 12); f.stun = 0; f.getup = 1;
          f.launch((this.safeX() - p.x) * 0.02, -21, 0.2);
          this.splash(p.x, 14); A('lava'); A('boing');
          this.fx.text(p.x, this.lavaY - 90, '용암 피부!', { size: 40, big: true, color: '#fff', burst: '#ff5a1f' });
        } else {
          f.out = true; f.ko = true; f.hp = 0;
          this.splash(JG.clamp(p.x, 20, W - 20), 22); A('lava'); this.fx.addShake(16);
          this.fx.text(JG.clamp(p.x, 120, W - 120), this.lavaY - 80, JG.pick(JG.WORDS_LAVA), { size: 48, big: true, color: '#fff', burst: '#ff5a1f' });
        }
      }
      this.ghost[i] += (f.hp / f.maxHp - this.ghost[i]) * 0.06;
    }
    if (this.state === 'fight') {
      var dead = fs.filter(function (x) { return x.ko || x.out; });
      if (dead.length) {
        this.state = 'roundEnd'; this.stateT = 0;
        this.roundWinner = dead.length === 2 ? -1 : 1 - dead[0].idx;
        this.endReason = dead[0].out ? 'lava' : 'ko';
        this.engine.timing.timeScale = 0.3;
        if (this.roundWinner >= 0) this.wins[this.roundWinner]++;
        var wname = this.roundWinner >= 0 ? fs[this.roundWinner].name : '';
        if (this.roundWinner < 0) this.say('동시에 뻗었다!', '이번 라운드는 무효', 150);
        else this.say(this.endReason === 'lava' ? '용암 퐁당!' : JG.pick(JG.WORDS_KO), wname + ' 승리', 160, PCOL[this.roundWinner]);
        if (this.endReason === 'lava') { A('ko'); this.fx.flashScreen(0.5, '#ffb627'); }
      }
    }
  };
  P.finish = function (winner) {
    var fs = this.fighters, self = this;
    this.say((fs[winner].name) + ' 우승!', this.wins[0] + ' : ' + this.wins[1], 400, PCOL[winner]);
    A(this.mode === '2p' || winner === 0 ? 'win' : 'lose');
    var res = { winner: winner, wins: this.wins.slice(), stageId: this.stageId, mode: this.mode, hpLeft: fs[winner].hp / fs[winner].maxHp };
    this.result = res;
    setTimeout(function () { if (!self.dead && self.cfg.onEnd) self.cfg.onEnd(res); }, this.cfg.endDelay == null ? 1900 : this.cfg.endDelay);
  };
  /* 점검용: 화면 없이 n틱을 한 번에 진행 */
  P.fastForward = function (n) { for (var i = 0; i < n && this.state !== 'matchEnd'; i++) this.tick(); return this.state; };
  P.destroy = function () {
    var M = window.Matter;
    this.dead = true; cancelAnimationFrame(this.raf); this.unbind();
    if (this.engine) { M.Events.off(this.engine); M.Composite.clear(this.engine.world, false); M.Engine.clear(this.engine); }
  };

  P.updateAmbient = function () {
    var i, e;
    for (i = 0; i < this.embers.length; i++) { e = this.embers[i]; e.y -= e.v; e.x += Math.sin(this.time * 0.02 + e.p) * 0.5; if (e.y < -10) { e.y = this.lavaY + 10; e.x = Math.random() * W; } }
    if (this.time % 16 === 0) this.bubbles.push({ x: Math.random() * W, r: 0, max: JG.rand(6, 16) });
    for (i = this.bubbles.length - 1; i >= 0; i--) { e = this.bubbles[i]; e.r += 0.35; if (e.r > e.max) this.bubbles.splice(i, 1); }
  };

  /* ================= 그리기 ================= */
  P.buildBackground = function () {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), id = this.stageId, i, grd;
    var sky = id === 'geyser' ? ['#1a2238', '#3a3055', '#b5546a', '#f29a4b'] : id === 'meteor' ? ['#120c22', '#2a1840', '#6e2a55', '#e0663a'] : ['#24122c', '#4c1f44', '#b23a48', '#ff8a3c'];
    grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, sky[0]); grd.addColorStop(0.42, sky[1]); grd.addColorStop(0.78, sky[2]); grd.addColorStop(1, sky[3]);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // 별
    g.fillStyle = '#fff3d6';
    for (i = 0; i < (id === 'meteor' ? 90 : 40); i++) { g.globalAlpha = Math.random() * 0.7; g.fillRect(Math.random() * W, Math.random() * 300, 2, 2); }
    g.globalAlpha = 1;
    if (id === 'meteor') { g.strokeStyle = 'rgba(255,220,160,.5)'; g.lineWidth = 2; for (i = 0; i < 5; i++) { var mx = 150 + i * 240, my = 40 + (i * 53) % 150; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx - 60, my - 34); g.stroke(); } }
    // 붉은 해
    grd = g.createRadialGradient(930, 260, 10, 930, 260, 190); grd.addColorStop(0, 'rgba(255,214,140,.95)'); grd.addColorStop(0.35, 'rgba(255,140,70,.55)'); grd.addColorStop(1, 'rgba(255,90,31,0)');
    g.fillStyle = grd; g.fillRect(700, 40, 460, 460);
    // 화산
    g.fillStyle = '#2b1730';
    g.beginPath(); g.moveTo(250, 640); g.lineTo(520, 250); g.lineTo(580, 232); g.lineTo(640, 246); g.lineTo(700, 230); g.lineTo(760, 252); g.lineTo(1040, 640); g.closePath(); g.fill();
    grd = g.createRadialGradient(640, 238, 4, 640, 238, 120); grd.addColorStop(0, 'rgba(255,225,77,.95)'); grd.addColorStop(0.3, 'rgba(255,90,31,.6)'); grd.addColorStop(1, 'rgba(255,90,31,0)');
    g.fillStyle = grd; g.fillRect(500, 120, 280, 240);
    g.strokeStyle = '#ff7a2f'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(610, 246); g.quadraticCurveTo(580, 330, 530, 420); g.quadraticCurveTo(505, 470, 520, 540); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(668, 242); g.quadraticCurveTo(700, 320, 760, 400); g.quadraticCurveTo(790, 440, 780, 500); g.stroke();
    g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.beginPath(); g.moveTo(610, 246); g.quadraticCurveTo(580, 330, 530, 420); g.stroke();
    // 먼 바위 능선
    g.fillStyle = '#241229';
    g.beginPath(); g.moveTo(0, 640);
    var ridge = [0, 470, 60, 430, 130, 468, 210, 500, 300, 540, 420, 580, 860, 590, 980, 548, 1080, 500, 1150, 452, 1220, 480, 1280, 440];
    for (i = 0; i < ridge.length; i += 2) g.lineTo(ridge[i], ridge[i + 1]);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    // 비밀 연구소(왼쪽 절벽 위)
    g.fillStyle = '#3a2440'; g.beginPath(); g.arc(92, 432, 40, Math.PI, 0); g.fill(); g.fillRect(52, 430, 80, 16);
    g.strokeStyle = '#3a2440'; g.lineWidth = 3; g.beginPath(); g.moveTo(104, 396); g.lineTo(118, 356); g.stroke();
    g.fillStyle = '#ff5a1f'; g.beginPath(); g.arc(118, 354, 4, 0, TAU); g.fill();
    g.fillStyle = '#ffe14d'; g.fillRect(70, 414, 9, 9); g.fillRect(86, 414, 9, 9); g.fillRect(102, 414, 9, 9);
    // 고사리 실루엣
    g.strokeStyle = '#1b0d20'; g.lineWidth = 5;
    [[30, 640, 1], [1250, 640, -1], [1180, 650, 1], [110, 655, -1]].forEach(function (f) {
      for (var k = 0; k < 6; k++) { var a = -Math.PI / 2 + (k - 2.5) * 0.36 * f[2]; g.beginPath(); g.moveTo(f[0], f[1]); g.quadraticCurveTo(f[0] + Math.cos(a) * 60, f[1] + Math.sin(a) * 90, f[0] + Math.cos(a + 0.5 * f[2]) * 110, f[1] + Math.sin(a + 0.5 * f[2]) * 100); g.stroke(); }
    });
    return c;
  };

  function rockPath(ctx, v) { ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y); for (var i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y); ctx.closePath(); }
  P.drawPlatform = function (ctx, b, shakeX) {
    var v = b.vertices, meta = b.jgPlat, i, bx = b.bounds, top;
    ctx.save();
    if (shakeX) ctx.translate(shakeX, 0);
    // 바위 아래로 늘어진 종유석
    if (meta.kind !== 'ledge') {
      var x0 = bx.min.x, x1 = bx.max.x, n = Math.max(2, Math.round((x1 - x0) / 60)), seed = (meta.i || 0) * 7 + 3;
      ctx.fillStyle = '#3a2238'; ctx.strokeStyle = '#1b0d1c'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x0 + 3, topAt(b, x0 + 3) + 40);
      for (i = 0; i <= n; i++) {
        var px = x0 + (x1 - x0) * i / n, dep = 70 + ((seed + i * 37) % 60);
        if (i > 0) ctx.lineTo(px - (x1 - x0) / n * 0.5, (topAt(b, px - 2) || FLOOR) + 62 + dep);
        ctx.lineTo(Math.min(px, x1 - 3), (topAt(b, Math.min(px, x1 - 3)) || FLOOR) + 60);
      }
      ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    var grd = ctx.createLinearGradient(0, bx.min.y, 0, bx.max.y); grd.addColorStop(0, '#5a3d4c'); grd.addColorStop(1, '#2e1a2c');
    rockPath(ctx, v); ctx.fillStyle = grd; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1b0d1c'; ctx.lineJoin = 'round'; ctx.stroke();
    // 윗면
    ctx.save(); rockPath(ctx, v); ctx.clip();
    ctx.strokeStyle = '#8a6373'; ctx.lineWidth = 16; ctx.beginPath();
    var L = bx.min.x - 4, R = bx.max.x + 4; ctx.moveTo(L, topAt(b, bx.min.x + 0.5));
    for (i = 1; i <= 8; i++) { var qx = bx.min.x + (bx.max.x - bx.min.x) * i / 8; ctx.lineTo(qx, topAt(b, Math.min(qx, bx.max.x - 0.5))); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,50,.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(L, bx.max.y); ctx.lineTo(R, bx.max.y); ctx.stroke();
    ctx.restore();
    ctx.restore();
  };

  /* 여러 발판의 윗면을 이어 하나의 바위 능선으로 그린다(운석 비탈) */
  P.drawRidge = function (ctx) {
    var self = this, pts = [], x, i, L = this.mainL + 2, R = this.mainR - 2;
    function top(px) { var best = null; self.platforms.forEach(function (b) { if (px < b.bounds.min.x || px > b.bounds.max.x) return; var y = topAt(b, px); if (y != null && (best == null || y < best)) best = y; }); return best == null ? FLOOR : best; }
    for (x = L; x < R; x += 20) pts.push({ x: x, y: top(x) });
    pts.push({ x: R, y: top(R) });
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#3a2238'; ctx.strokeStyle = '#1b0d1c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L + 3, pts[0].y + 40);
    var n = 15;
    for (i = 0; i <= n; i++) { var px = L + (R - L) * i / n; if (i > 0) ctx.lineTo(px - (R - L) / n * 0.5, top(px - 20) + 120 + ((i * 37) % 60)); ctx.lineTo(Math.min(px, R - 3), top(Math.min(px, R - 3)) + 58); }
    ctx.closePath(); ctx.stroke(); ctx.fill();
    function body() { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); for (i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + 60); ctx.closePath(); }
    var grd = ctx.createLinearGradient(0, 500, 0, 610); grd.addColorStop(0, '#5a3d4c'); grd.addColorStop(1, '#2e1a2c');
    body(); ctx.fillStyle = grd; ctx.fill(); ctx.stroke();
    ctx.save(); body(); ctx.clip();
    ctx.strokeStyle = '#8a6373'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(pts[0].x - 6, pts[0].y); for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.lineTo(R + 6, pts[pts.length - 1].y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,120,50,.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y + 60); for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + 60); ctx.stroke();
    ctx.restore();
  };

  P.render = function () {
    var ctx = this.ctx, fx = this.fx, s = this.scale, t = this.time, i, self = this;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    // 분화구 연기
    ctx.fillStyle = '#3b2636';
    for (i = 0; i < this.smoke.length; i++) { var sm = this.smoke[i]; ctx.globalAlpha = 0.5 - i * 0.045; ctx.beginPath(); ctx.arc(sm.x + Math.sin(t * 0.012 + sm.p) * (8 + i * 3) + i * 9, sm.y - ((t * 0.25) % 24), sm.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;

    // 카메라(흔들림 + 타격 줌)
    ctx.save();
    var z = 1 + fx.zoom;
    ctx.translate(W / 2 + fx.sx, H / 2 + fx.sy); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);

    // 불티
    for (i = 0; i < this.embers.length; i++) { var e = this.embers[i]; ctx.globalAlpha = 0.35 + 0.4 * Math.sin(t * 0.08 + e.p); ctx.fillStyle = i % 3 ? '#ffb627' : '#ff5a1f'; ctx.fillRect(e.x, e.y, e.s, e.s); }
    ctx.globalAlpha = 1;

    // 운석 낙하 예고
    this.meteors.forEach(function (m) {
      if (m.phase === 'roll') return;
      var gy = self.groundYAt(m.tx, 200) || FLOOR, k = 0.5 + 0.5 * Math.sin(t * 0.5);
      ctx.globalAlpha = 0.35 + 0.3 * k; ctx.fillStyle = '#ff2d2d'; ctx.beginPath(); ctx.ellipse(m.tx, gy, m.r * 1.9, 9, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.ellipse(m.tx, gy, m.r * 2.4, 12, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffe14d'; ctx.font = '26px ' + FONT_D; ctx.textAlign = 'center'; ctx.fillText('!', m.tx, gy - 22 - k * 6);
    });

    // 발판
    if (this.stageId === 'meteor') this.drawRidge(ctx);
    else for (i = 0; i < this.platforms.length; i++) {
      var b = this.platforms[i], sh = 0;
      if (b.jgPlat.kind === 'tile') { var tl = this.tiles[b.jgPlat.i]; if (tl.state === 'warn') sh = Math.sin(t * 1.7) * 3; }
      this.drawPlatform(ctx, b, sh);
      if (b.jgPlat.kind === 'tile' && this.tiles[b.jgPlat.i].state === 'warn') {
        var tt = this.tiles[b.jgPlat.i]; ctx.strokeStyle = 'rgba(255,225,77,' + (0.5 + 0.5 * Math.sin(t * 0.6)) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tt.x - 20 + sh, FLOOR + 4); ctx.lineTo(tt.x - 4 + sh, FLOOR + 26); ctx.lineTo(tt.x - 16 + sh, FLOOR + 40); ctx.lineTo(tt.x + 6 + sh, FLOOR + 66);
        ctx.moveTo(tt.x - 4 + sh, FLOOR + 26); ctx.lineTo(tt.x + 22 + sh, FLOOR + 34); ctx.stroke();
      }
    }
    this.debris.forEach(function (d) {
      ctx.save(); ctx.translate(d.x, d.y + 35); ctx.rotate(d.rot); ctx.fillStyle = '#3b2636'; ctx.strokeStyle = '#1b0d1c'; ctx.lineWidth = 4;
      ctx.fillRect(-d.w / 2, -35, d.w, 70); ctx.strokeRect(-d.w / 2, -35, d.w, 70); ctx.fillStyle = '#8a6373'; ctx.fillRect(-d.w / 2, -35, d.w, 9); ctx.restore();
    });
    // 간헐천 구멍과 물기둥
    this.vents.forEach(function (v) {
      ctx.fillStyle = '#1b0d1c'; ctx.beginPath(); ctx.ellipse(v.x, FLOOR + 3, 40, 8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = v.state === 'warn' ? 'rgba(201,241,255,' + (0.5 + 0.5 * Math.sin(t * 0.7)) + ')' : '#8a6373'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(v.x, FLOOR + 3, 44, 10, 0, 0, TAU); ctx.stroke();
      if (v.state === 'erupt') {
        var hgt = Math.min(1, (56 - v.t) / 8) * 470, wob = Math.sin(t * 0.9) * 6;
        var grd = ctx.createLinearGradient(v.x - 50, 0, v.x + 50, 0); grd.addColorStop(0, 'rgba(143,217,242,0)'); grd.addColorStop(0.3, 'rgba(201,241,255,.75)'); grd.addColorStop(0.5, 'rgba(255,255,255,.95)'); grd.addColorStop(0.7, 'rgba(201,241,255,.75)'); grd.addColorStop(1, 'rgba(143,217,242,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(v.x - 44, FLOOR + 4); ctx.quadraticCurveTo(v.x - 30 + wob, FLOOR - hgt * 0.5, v.x - 46, FLOOR - hgt); ctx.lineTo(v.x + 46, FLOOR - hgt); ctx.quadraticCurveTo(v.x + 30 + wob, FLOOR - hgt * 0.5, v.x + 44, FLOOR + 4); ctx.closePath(); ctx.fill();
      }
    });
    // 운석
    this.meteors.forEach(function (m) {
      if (!m.body) return;
      var p = m.body.position;
      ctx.save(); ctx.translate(p.x, p.y);
      if (m.phase === 'fall') { var gg = ctx.createRadialGradient(0, 0, m.r * 0.5, 0, 0, m.r * 2.2); gg.addColorStop(0, 'rgba(255,225,77,.9)'); gg.addColorStop(1, 'rgba(255,90,31,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, m.r * 2.2, 0, TAU); ctx.fill(); }
      ctx.rotate(m.rot);
      ctx.fillStyle = m.phase === 'fall' ? '#7a3b2e' : '#4a3344'; ctx.strokeStyle = '#1b0d1c'; ctx.lineWidth = 4;
      ctx.beginPath(); for (var k = 0; k < 9; k++) { var a = k / 9 * TAU, rr = m.r * (0.9 + ((k * 5) % 3) * 0.07); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = m.phase === 'fall' ? '#ffb627' : '#2e1a2c';
      ctx.beginPath(); ctx.arc(-m.r * 0.3, -m.r * 0.2, m.r * 0.22, 0, TAU); ctx.arc(m.r * 0.35, m.r * 0.1, m.r * 0.16, 0, TAU); ctx.arc(-m.r * 0.05, m.r * 0.45, m.r * 0.13, 0, TAU); ctx.fill();
      ctx.restore();
    });

    // 공룡
    for (i = 0; i < this.fighters.length; i++) this.drawFighter(ctx, this.fighters[i]);

    fx.drawParticles(ctx);
    this.drawLava(ctx);
    fx.drawTexts(ctx);
    ctx.restore();

    if (fx.flash > 0) { ctx.globalAlpha = Math.min(0.8, fx.flash); ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawHUD(ctx);
  };

  P.drawFighter = function (ctx, f) {
    var p = f.torso.position, t = this.time, sp = f.sp;
    if (p.y > this.lavaY + 160) return;
    // 그림자
    var gy = this.groundYAt(p.x, p.y);
    if (gy != null) { var hh = Math.max(0, gy - p.y - sp.standH), k = JG.clamp(1 - hh / 330, 0.25, 1); JG.drawShadow(ctx, p.x, gy + 2, sp.w * 0.62 * k, 0.3 * k); }
    var pose = f.getPose();
    JG.drawDino(ctx, f.dino, pose, t / 60, { flash: f.flash > 0 ? f.flash / 7 : 0 });
    var hp = f.head.position;
    // 기절 별
    if (f.stun > 0 && !f.ko) {
      ctx.fillStyle = '#ffe14d';
      for (var i = 0; i < 3; i++) { var a = t * 0.16 + i * TAU / 3; JG.star4(ctx, hp.x + Math.cos(a) * sp.r * 1.1, hp.y - sp.r * 1.5 + Math.sin(a) * sp.r * 0.3, 7); }
    }
    // 플레이어 표식
    if (!f.out) {
      var my = Math.min(hp.y, p.y) - sp.r * 2.1 - 16 + Math.sin(t * 0.1) * 2, lab = f.isAI ? (this.mode === 'demo' ? 'CPU' + (f.idx + 1) : 'CPU') : (f.idx + 1) + 'P';
      ctx.font = '17px ' + FONT_D; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var tw = ctx.measureText(lab).width + 14;
      ctx.fillStyle = '#22121f'; rr(ctx, hp.x - tw / 2, my - 12, tw, 22, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hp.x - 6, my + 9); ctx.lineTo(hp.x + 6, my + 9); ctx.lineTo(hp.x, my + 17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PCOL[f.idx]; ctx.fillText(lab, hp.x, my);
    }
  };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  P.drawLava = function (ctx) {
    var t = this.time, ly = this.lavaY, x, i;
    var glow = ctx.createLinearGradient(0, ly - 150, 0, ly); glow.addColorStop(0, 'rgba(255,90,31,0)'); glow.addColorStop(1, 'rgba(255,140,40,.38)');
    ctx.fillStyle = glow; ctx.fillRect(-40, ly - 150, W + 80, 150);
    var grd = ctx.createLinearGradient(0, ly - 8, 0, H + 40); grd.addColorStop(0, '#ffe14d'); grd.addColorStop(0.12, '#ffb627'); grd.addColorStop(0.4, '#ff5a1f'); grd.addColorStop(1, '#a3201c');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(-40, H + 60);
    for (x = -40; x <= W + 40; x += 20) ctx.lineTo(x, ly + Math.sin(x * 0.02 + t * 0.05) * 5 + Math.sin(x * 0.045 - t * 0.032) * 3);
    ctx.lineTo(W + 40, H + 60); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 3; ctx.beginPath();
    for (x = -40; x <= W + 40; x += 20) { var y = ly + Math.sin(x * 0.02 + t * 0.05) * 5 + Math.sin(x * 0.045 - t * 0.032) * 3; if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
    for (i = 0; i < this.bubbles.length; i++) { var b = this.bubbles[i]; ctx.globalAlpha = 1 - b.r / b.max; ctx.beginPath(); ctx.arc(b.x, ly + 22 + (i % 3) * 12, b.r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };

  P.drawHUD = function (ctx) {
    var fs = this.fighters, t = this.time, i;
    ctx.textBaseline = 'middle';
    for (i = 0; i < 2; i++) {
      var f = fs[i], left = i === 0, bx = left ? 28 : W - 28, dir = left ? 1 : -1, bw = 430, by = 30;
      // 초상
      ctx.save();
      ctx.fillStyle = '#22121f'; ctx.beginPath(); ctx.arc(bx + dir * 44, by + 40, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = PCOL[i]; ctx.beginPath(); ctx.arc(bx + dir * 44, by + 40, 40, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + dir * 44, by + 40, 37, 0, TAU); ctx.clip();
      ctx.fillStyle = '#3d2a40'; ctx.fillRect(bx + dir * 44 - 40, by, 80, 80);
      JG.drawPreview(ctx, f.dino, { x: bx + dir * 44 - 44, y: by + 2, w: 88, h: 78 }, t / 60, { facing: dir, noShadow: true, pad: 0.04, mode: f.ko ? 'hit' : 'idle' });
      ctx.restore();
      // 체력
      var x0 = bx + dir * 100, hpw = bw - 100, pct = JG.clamp(f.hp / f.maxHp, 0, 1), gh = JG.clamp(this.ghost[i], 0, 1);
      ctx.fillStyle = '#22121f'; rr(ctx, left ? x0 - 4 : x0 - hpw - 4, by + 22, hpw + 8, 34, 12); ctx.fill();
      ctx.fillStyle = '#5a3d4c'; rr(ctx, left ? x0 : x0 - hpw, by + 26, hpw, 26, 9); ctx.fill();
      ctx.save(); rr(ctx, left ? x0 : x0 - hpw, by + 26, hpw, 26, 9); ctx.clip();
      if (gh > pct) { ctx.fillStyle = '#fff3d6'; ctx.fillRect(left ? x0 : x0 - hpw * gh, by + 26, hpw * gh, 26); }
      if (pct > 0) { ctx.fillStyle = pct > 0.5 ? '#3ddc97' : pct > 0.25 ? '#ffb627' : '#ff5a1f'; ctx.fillRect(left ? x0 : x0 - hpw * pct, by + 26, hpw * pct, 26); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(left ? x0 : x0 - hpw * pct, by + 28, hpw * pct, 7); }
      ctx.restore();
      ctx.font = '21px ' + FONT_B; ctx.textAlign = left ? 'left' : 'right'; ctx.fillStyle = '#22121f'; ctx.lineWidth = 5; ctx.strokeStyle = '#22121f'; ctx.lineJoin = 'round';
      ctx.strokeText(f.name, x0, by + 8); ctx.fillStyle = '#fff3d6'; ctx.fillText(f.name, x0, by + 8);
      // 라운드 승수
      for (var k = 0; k < this.roundsToWin; k++) {
        var px = x0 + dir * (14 + k * 28), py = by + 76;
        ctx.fillStyle = '#22121f'; ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.fill();
        ctx.fillStyle = k < this.wins[i] ? '#ffe14d' : '#5a3d4c'; ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
      }
      // 날갯짓 횟수
      if (f.wings) for (k = 0; k < f.flapMax; k++) { ctx.fillStyle = k < f.flap ? '#c9f1ff' : '#5a3d4c'; rr(ctx, x0 + dir * (86 + k * 20) - (left ? 0 : 14), by + 69, 14, 14, 4); ctx.fill(); }
    }
    // 시간
    var sec = Math.ceil(this.timeLeft / 60);
    ctx.fillStyle = '#22121f'; rr(ctx, W / 2 - 54, 20, 108, 62, 18); ctx.fill();
    ctx.textAlign = 'center';
    if (this.lavaRising) { ctx.font = '19px ' + FONT_D; ctx.fillStyle = t % 30 < 15 ? '#ff5a1f' : '#ffe14d'; ctx.fillText('용암 상승', W / 2, 52); }
    else { ctx.font = '40px ' + FONT_D; ctx.fillStyle = sec <= 10 ? '#ff5a1f' : '#fff3d6'; ctx.fillText(sec, W / 2, 54); }

    // 배너
    var b = this.banner;
    if (b) {
      var pop = b.t < 8 ? 0.4 + b.t / 8 * 0.75 : b.t < 13 ? 1.15 - (b.t - 8) / 5 * 0.15 : 1, fade = b.t > b.life - 12 ? (b.life - b.t) / 12 : 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.translate(W / 2, 250); ctx.scale(pop, pop); ctx.rotate(-0.035);
      ctx.font = '92px ' + FONT_D; ctx.lineJoin = 'round'; ctx.lineWidth = 22; ctx.strokeStyle = '#22121f'; ctx.strokeText(b.text, 0, 0);
      ctx.lineWidth = 8; ctx.strokeStyle = '#ff5a1f'; ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      if (b.sub) { ctx.font = '34px ' + FONT_B; ctx.lineWidth = 10; ctx.strokeStyle = '#22121f'; ctx.strokeText(b.sub, 0, 78); ctx.fillStyle = '#fff3d6'; ctx.fillText(b.sub, 0, 78); }
      ctx.restore();
    }
    // 조작 안내
    if (this.hintT > 0 || this.paused) {
      ctx.globalAlpha = this.paused ? 1 : Math.min(1, this.hintT / 40);
      if (this.mode === '2p') {
        hint(ctx, 300, H - 64, '1P', [['A', 'D'], '이동', ['W'], '점프', ['F'], '머리', ['G'], '꼬리', ['H'], '팔·날개'], PCOL[0]);
        hint(ctx, W - 300, H - 64, '2P', [['←', '→'], '이동', ['↑'], '점프', [','], '머리', ['.'], '꼬리', ['/'], '팔·날개'], PCOL[1]);
      } else {
        hint(ctx, W / 2, H - 64, '', [['A', 'D'], '이동', ['W'], '점프·날갯짓', ['J'], '머리', ['K'], '꼬리', ['L'], '팔·날개'], PCOL[0]);
      }
      ctx.globalAlpha = 1;
    }
  };
  function hint(ctx, cx, y, tag, items, col) {
    var i, k, w = 0, parts = [];
    ctx.font = '18px ' + FONT_B;
    for (i = 0; i < items.length; i++) { var it = items[i], iw = typeof it === 'string' ? ctx.measureText(it).width + 16 : it.length * 34; parts.push(iw); w += iw; }
    if (tag) w += 40;
    var x = cx - w / 2;
    ctx.fillStyle = 'rgba(34,18,31,.82)'; rr(ctx, x - 14, y - 24, w + 28, 48, 16); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (tag) { ctx.font = '20px ' + FONT_D; ctx.fillStyle = col; ctx.fillText(tag, x, y + 1); x += 40; }
    for (i = 0; i < items.length; i++) {
      if (typeof items[i] === 'string') { ctx.font = '18px ' + FONT_B; ctx.fillStyle = '#fff3d6'; ctx.fillText(items[i], x + 2, y + 1); }
      else for (k = 0; k < items[i].length; k++) {
        ctx.fillStyle = '#fff3d6'; rr(ctx, x + k * 34, y - 15, 30, 30, 8); ctx.fill();
        ctx.fillStyle = '#22121f'; ctx.font = '18px ' + FONT_D; ctx.textAlign = 'center'; ctx.fillText(items[i][k], x + k * 34 + 15, y + 1); ctx.textAlign = 'left';
      }
      x += parts[i];
    }
  }
})();
