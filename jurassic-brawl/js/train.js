/* 쥬라기 유전자 막싸움 — 훈련 미니게임
   rock  : 바위 부수기(타이밍)  → 힘
   dodge : 운석 피하기(좌우 이동) → 민첩 */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};
  var W = 720, H = 420, GROUND = 350, TAU = Math.PI * 2;
  var A = function (n, o) { if (JG.Audio) JG.Audio.play(n, o); };
  var FONT_D = '"Bagel Fat One", "Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', FONT_B = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  /* onDone({score, max, gain, stat, coins}) */
  function MiniGame(canvas, kind, dino, onDone) {
    var self = this;
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.kind = kind; this.dino = dino; this.onDone = onDone;
    this.fx = new JG.FX(); this.t = 0; this.dead = false; this.done = false; this.keys = {};
    this.sp = JG.spec(dino);
    this.fit = Math.min(1.25, 150 / (this.sp.bbox.b - this.sp.bbox.t));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr; this.dpr = dpr;
    if (kind === 'rock') {
      this.round = 0; this.score = 0; this.max = 10; this.marker = 0; this.dirM = 1; this.wait = 40; this.mode = 'idle'; this.modeT = 0; this.rockHp = 1; this.results = [];
      this.newRock();
    } else {
      this.x = W / 2; this.hearts = 3; this.inv = 0; this.left = 20 * 60; this.meteors = []; this.spawn = 30; this.face = 1; this.pointerX = null; this.dodged = 0; this.mode = 'idle';
    }
    this._kd = function (e) {
      if (self.dead) return;
      if (['Space', 'Enter', 'KeyJ', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].indexOf(e.code) >= 0) e.preventDefault();
      self.keys[e.code] = true;
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') && !e.repeat) self.action();
    };
    this._ku = function (e) { self.keys[e.code] = false; };
    this._pd = function (e) { e.preventDefault(); self.pointer(e); self.action(); };
    this._pm = function (e) { if (e.buttons || e.pointerType === 'touch' || self.kind === 'dodge') self.pointer(e); };
    this._pl = function () { self.pointerX = null; };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    canvas.addEventListener('pointerdown', this._pd); canvas.addEventListener('pointermove', this._pm); canvas.addEventListener('pointerleave', this._pl);
    this.last = 0; this.acc = 0;
    this.loop = function (ts) {
      if (self.dead) return;
      self.raf = requestAnimationFrame(self.loop);
      var dt = Math.min(60, ts - (self.last || ts)); self.last = ts; self.acc += dt; var n = 0;
      while (self.acc >= 1000 / 60 && n < 3) { self.tick(); self.acc -= 1000 / 60; n++; }
      self.render();
    };
    this.raf = requestAnimationFrame(this.loop);
  }
  var P = MiniGame.prototype;
  P.pointer = function (e) { var r = this.canvas.getBoundingClientRect(); this.pointerX = (e.clientX - r.left) / r.width * W; };
  P.destroy = function () {
    this.dead = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    this.canvas.removeEventListener('pointerdown', this._pd); this.canvas.removeEventListener('pointermove', this._pm); this.canvas.removeEventListener('pointerleave', this._pl);
  };
  P.finish = function (res) {
    if (this.done) return; this.done = true; this.result = res;
    var self = this;
    A(res.gain > 0 ? 'win' : 'lose');
    setTimeout(function () { if (!self.dead && self.onDone) self.onDone(res); }, 900);
  };

  /* ---------- 바위 부수기 ---------- */
  P.newRock = function () {
    this.zone = JG.rand(0.3, 0.75); this.zoneW = 0.24 - this.round * 0.025; this.speed = 0.017 + this.round * 0.0045; this.marker = Math.random() * 0.2; this.dirM = 1; this.rockHp = 1; this.swung = false;
  };
  P.action = function () {
    if (this.kind !== 'rock' || this.done || this.swung || this.wait > 0) return;
    var d = Math.abs(this.marker - this.zone), q = d < this.zoneW * 0.2 ? 2 : d < this.zoneW * 0.5 ? 1 : 0;
    this.swung = true; this.mode = q ? 'strike' : 'slip'; this.modeT = 0; this.q = q; this.score += q; this.results.push(q);
    A('whoosh');
  };
  P.tickRock = function () {
    if (this.wait > 0) this.wait--;
    if (!this.swung && this.wait <= 0 && !this.done) {
      this.marker += this.speed * this.dirM;
      if (this.marker > 1) { this.marker = 1; this.dirM = -1; } else if (this.marker < 0) { this.marker = 0; this.dirM = 1; }
    }
    if (this.swung) {
      this.modeT++;
      if (this.modeT === 9) {
        var rx = 500, ry = GROUND - 50;
        if (this.q === 2) {
          this.rockHp = 0; A('smash'); this.fx.addShake(14);
          this.fx.burst(rx, ry, { n: 26, colors: ['#8d6e63', '#5a3d4c', '#c9a58f'], speed: [3, 13], life: [20, 44], size: [5, 13], kind: 'chunk', grav: 0.5 });
          this.fx.text(rx, ry - 90, '완벽!', { size: 44, big: true, color: '#fff', burst: '#ff5a1f' });
        } else if (this.q === 1) {
          this.rockHp = 0.5; A('hit'); this.fx.addShake(6);
          this.fx.burst(rx - 40, ry, { n: 8, colors: ['#8d6e63', '#c9a58f'], speed: [2, 7], life: [14, 30], size: [4, 8], kind: 'chunk', grav: 0.5 });
          this.fx.text(rx, ry - 90, '금 갔다!', { size: 34, color: '#ffe14d' });
        } else { A('miss'); this.fx.text(320, GROUND - 150, '삑사리!', { size: 34, color: '#c9a9b8' }); }
      }
      if (this.modeT > 62) {
        this.round++; this.mode = 'idle';
        if (this.round >= 5) { var g = this.score >= 8 ? 2 : this.score >= 4 ? 1 : 0; this.finish({ score: this.score, max: 10, gain: g, stat: 'pow', coins: this.score * 2 }); }
        else { this.newRock(); this.wait = 16; }
      }
    }
  };

  /* ---------- 운석 피하기 ---------- */
  P.tickDodge = function () {
    if (this.done) return;
    var dir = (this.keys.ArrowRight || this.keys.KeyD ? 1 : 0) - (this.keys.ArrowLeft || this.keys.KeyA ? 1 : 0), i, m;
    var spd = 4.2 + JG.stats(this.dino).spd * 0.28;
    if (!dir && this.pointerX != null && Math.abs(this.pointerX - this.x) > 8) dir = this.pointerX > this.x ? 1 : -1;
    this.x = JG.clamp(this.x + dir * spd, 50, W - 50);
    if (dir) this.face = dir;
    this.mode = this.inv > 30 ? 'hit' : dir ? 'walk' : 'idle';
    if (this.inv > 0) this.inv--;
    this.left--;
    var prog = 1 - this.left / (20 * 60);
    if (--this.spawn <= 0) {
      var tx = Math.random() < 0.45 ? JG.clamp(this.x + JG.rand(-70, 70), 40, W - 40) : JG.rand(40, W - 40);
      this.meteors.push({ x: tx, y: -30, vy: 3.4 + prog * 3.6 + Math.random() * 1.2, r: JG.rand(15, 24), rot: Math.random() * TAU });
      this.spawn = Math.round(JG.rand(30, 48) - prog * 22);
      if (Math.random() < 0.3) A('meteorFall');
    }
    for (i = this.meteors.length - 1; i >= 0; i--) {
      m = this.meteors[i]; m.y += m.vy; m.rot += 0.1;
      if (this.t % 3 === 0) this.fx.burst(m.x, m.y - m.r, { n: 1, colors: ['#ffb627', '#ff5a1f'], speed: [0.2, 1], life: [8, 16], size: [3, 7], grav: -0.05 });
      var dx = m.x - this.x, dy = m.y - (GROUND - 70 * this.fit);
      if (this.inv <= 0 && dx * dx + dy * dy < Math.pow(m.r + 38 * this.fit, 2)) {
        this.hearts--; this.inv = 70; A('heavy'); A('flop', { delay: 0.1 }); this.fx.addShake(14);
        this.fx.text(this.x, GROUND - 170, '쾅!', { size: 40, big: true, color: '#fff', burst: '#ff5a1f' });
        this.fx.burst(m.x, m.y, { n: 14, colors: ['#ffb627', '#ff5a1f', '#5a3d4c'], speed: [3, 9], life: [14, 30], size: [4, 9], grav: 0.3 });
        this.meteors.splice(i, 1);
        if (this.hearts <= 0) { this.finish({ score: Math.floor((20 * 60 - this.left) / 60), max: 20, gain: 0, stat: 'spd', coins: Math.floor(this.dodged / 2) }); return; }
        continue;
      }
      if (m.y > GROUND - m.r * 0.5) {
        this.dodged++; A('land', { vol: 0.5 });
        this.fx.burst(m.x, GROUND, { n: 8, colors: ['#8d6e63', '#c9a58f', '#ffb627'], speed: [2, 6], life: [12, 26], size: [3, 7], grav: 0.3, angle: -Math.PI / 2, spread: 2.4 });
        this.meteors.splice(i, 1);
      }
    }
    if (this.left <= 0) this.finish({ score: 20, max: 20, gain: this.hearts >= 3 ? 2 : 1, stat: 'spd', coins: 10 + this.hearts * 2 });
  };

  P.tick = function () { this.t++; this.fx.update(); if (this.kind === 'rock') this.tickRock(); else this.tickDodge(); };

  P.render = function () {
    var ctx = this.ctx, t = this.t, fx = this.fx, i;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#24122c'); sky.addColorStop(0.6, '#6e2a55'); sky.addColorStop(1, '#e0663a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b1730'; ctx.beginPath(); ctx.moveTo(60, GROUND); ctx.lineTo(240, 150); ctx.lineTo(300, 140); ctx.lineTo(460, GROUND); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,77,.5)'; ctx.beginPath(); ctx.arc(270, 144, 26, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(fx.sx, fx.sy);
    ctx.fillStyle = '#3b2636'; ctx.fillRect(-20, GROUND, W + 40, H - GROUND + 20);
    ctx.fillStyle = '#8a6373'; ctx.fillRect(-20, GROUND, W + 40, 8);
    if (this.kind === 'rock') this.renderRock(ctx, t); else this.renderDodge(ctx, t);
    fx.drawParticles(ctx); fx.drawTexts(ctx);
    ctx.restore();
    if (this.done && this.result) {
      ctx.fillStyle = 'rgba(26,14,26,.6)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.font = '64px ' + FONT_D; ctx.lineWidth = 14; ctx.strokeStyle = '#22121f';
      var msg = this.result.gain >= 2 ? '훈련 대성공!' : this.result.gain === 1 ? '훈련 성공!' : '다음엔 잘하자';
      ctx.strokeText(msg, W / 2, H / 2 - 10); ctx.fillStyle = this.result.gain ? '#ffe14d' : '#c9a9b8'; ctx.fillText(msg, W / 2, H / 2 - 10);
    }
  };
  P.drawDino = function (ctx, x, mode, face) {
    ctx.save(); ctx.translate(x, GROUND); ctx.scale(this.fit, this.fit);
    JG.drawShadow(ctx, 0, 0, this.sp.w * 0.6, 0.3);
    var pose = JG.animPose(this.sp, face, 0, 0, this.t / 60, mode);
    if (this.kind === 'dodge' && this.inv > 0 && this.t % 8 < 4) ctx.globalAlpha = 0.45;
    JG.drawDino(ctx, this.dino, pose, this.t / 60);
    ctx.restore();
  };
  P.renderRock = function (ctx, t) {
    var lunge = 0, mode = 'idle';
    if (this.swung) { var k = this.modeT; lunge = k < 9 ? k / 9 * 150 : Math.max(0, 150 - (k - 9) * 6); mode = this.q ? (k < 26 ? 'roar' : 'idle') : (k > 6 ? 'hit' : 'roar'); }
    // 바위
    if (this.rockHp > 0 && this.round < 5) {
      var rx = 520, ry = GROUND, s = 1 + this.round * 0.06, sh = this.swung && this.modeT > 9 && this.modeT < 20 ? Math.sin(t * 2) * 4 : 0;
      ctx.save(); ctx.translate(rx + sh, ry); ctx.scale(s, s);
      ctx.fillStyle = '#5a3d4c'; ctx.strokeStyle = '#22121f'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-58, -58); ctx.lineTo(-20, -96); ctx.lineTo(34, -88); ctx.lineTo(70, -44); ctx.lineTo(74, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a6373'; ctx.beginPath(); ctx.moveTo(-50, -54); ctx.lineTo(-18, -86); ctx.lineTo(24, -80); ctx.lineTo(-6, -58); ctx.closePath(); ctx.fill();
      if (this.rockHp < 1) { ctx.strokeStyle = '#22121f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-30, -90); ctx.lineTo(-8, -56); ctx.lineTo(-26, -34); ctx.lineTo(4, -4); ctx.moveTo(-8, -56); ctx.lineTo(28, -44); ctx.stroke(); }
      ctx.restore();
    }
    this.drawDino(ctx, 210 + lunge, mode, 1);
    // 타이밍 게이지
    var gx = 110, gw = 500, gy = 44;
    ctx.fillStyle = '#22121f'; rr(ctx, gx - 6, gy - 6, gw + 12, 40, 14); ctx.fill();
    ctx.fillStyle = '#5a3d4c'; rr(ctx, gx, gy, gw, 28, 9); ctx.fill();
    ctx.fillStyle = '#ffb627'; rr(ctx, gx + (this.zone - this.zoneW * 0.5) * gw, gy, this.zoneW * gw, 28, 6); ctx.fill();
    ctx.fillStyle = '#ff5a1f'; rr(ctx, gx + (this.zone - this.zoneW * 0.2) * gw, gy, this.zoneW * 0.4 * gw, 28, 6); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.strokeStyle = '#22121f'; ctx.lineWidth = 4; rr(ctx, gx + this.marker * gw - 7, gy - 10, 14, 48, 6); ctx.fill(); ctx.stroke();
    ctx.font = '19px ' + FONT_B; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff3d6';
    ctx.fillText(this.done ? '' : '주황 칸에 맞춰 스페이스(또는 화면 누르기)', W / 2, gy + 62);
    // 결과 점
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = '#22121f'; ctx.beginPath(); ctx.arc(W / 2 - 80 + i * 40, H - 30, 14, 0, TAU); ctx.fill();
      var q = this.results[i]; ctx.fillStyle = q === 2 ? '#ff5a1f' : q === 1 ? '#ffb627' : q === 0 ? '#5a3d4c' : '#3d2a40';
      ctx.beginPath(); ctx.arc(W / 2 - 80 + i * 40, H - 30, 10, 0, TAU); ctx.fill();
    }
  };
  P.renderDodge = function (ctx, t) {
    var i, m;
    for (i = 0; i < this.meteors.length; i++) {
      m = this.meteors[i];
      ctx.globalAlpha = 0.35 * Math.min(1, m.y / 200 + 0.2); ctx.fillStyle = '#ff2d2d'; ctx.beginPath(); ctx.ellipse(m.x, GROUND + 4, m.r * 1.4, 6, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(m.x, m.y);
      var g = ctx.createRadialGradient(0, 0, m.r * 0.4, 0, 0, m.r * 2); g.addColorStop(0, 'rgba(255,225,77,.85)'); g.addColorStop(1, 'rgba(255,90,31,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, m.r * 2, 0, TAU); ctx.fill();
      ctx.rotate(m.rot); ctx.fillStyle = '#7a3b2e'; ctx.strokeStyle = '#22121f'; ctx.lineWidth = 4;
      ctx.beginPath(); for (var k = 0; k < 8; k++) { var a = k / 8 * TAU, r2 = m.r * (0.88 + (k % 3) * 0.08); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    this.drawDino(ctx, this.x, this.mode, this.face);
    // 남은 시간, 하트
    ctx.fillStyle = '#22121f'; rr(ctx, W / 2 - 150, 16, 300, 30, 12); ctx.fill();
    ctx.fillStyle = '#35d6b4'; rr(ctx, W / 2 - 144, 22, Math.max(8, 288 * Math.max(0, this.left) / (20 * 60)), 18, 7); ctx.fill();
    for (i = 0; i < 3; i++) heart(ctx, 44 + i * 40, 32, 15, i < this.hearts ? '#ff5a1f' : '#5a3d4c');
    ctx.font = '19px ' + FONT_B; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff3d6';
    if (!this.done && this.left > 17 * 60) ctx.fillText('A / D 또는 방향키(화면을 눌러도 됨)로 20초 버티기', W / 2, 70);
  };
  function heart(ctx, x, y, s, col) {
    ctx.fillStyle = '#22121f'; ctx.beginPath(); ctx.arc(x, y, s + 5, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.7); ctx.bezierCurveTo(x - s * 1.3, y - s * 0.2, x - s * 0.6, y - s * 1.0, x, y - s * 0.3); ctx.bezierCurveTo(x + s * 0.6, y - s * 1.0, x + s * 1.3, y - s * 0.2, x, y + s * 0.7); ctx.fill();
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  JG.MiniGame = MiniGame;
})();
