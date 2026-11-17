/* 쥬라기 유전자 막싸움 — 파티클, 만화 글자("쾅!"), 화면 흔들림 */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};
  var TAU = Math.PI * 2;

  function FX() { this.p = []; this.texts = []; this.shake = 0; this.sx = 0; this.sy = 0; this.zoom = 0; this.flash = 0; this.flashColor = '#fff'; }
  var P = FX.prototype;

  /* o: {n, colors, speed:[min,max], life:[min,max], size:[min,max], grav, kind, angle, spread, drag, up} */
  P.burst = function (x, y, o) {
    var n = o.n || 8, cols = o.colors || ['#fff'], i;
    if (this.p.length > 420) n = Math.ceil(n / 3);
    for (i = 0; i < n; i++) {
      var a = (o.angle == null ? Math.random() * TAU : o.angle + (Math.random() - 0.5) * (o.spread == null ? 1 : o.spread));
      var sp = JG.rand(o.speed ? o.speed[0] : 1, o.speed ? o.speed[1] : 5), life = JG.rand(o.life ? o.life[0] : 18, o.life ? o.life[1] : 34);
      this.p.push({ x: x + (o.jx ? (Math.random() - 0.5) * o.jx : 0), y: y + (o.jy ? (Math.random() - 0.5) * o.jy : 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
        life: life, max: life, size: JG.rand(o.size ? o.size[0] : 3, o.size ? o.size[1] : 7), grav: o.grav == null ? 0.25 : o.grav, drag: o.drag == null ? 0.96 : o.drag,
        color: cols[Math.floor(Math.random() * cols.length)], kind: o.kind || 'dot', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4 });
    }
  };
  /* 만화 글자. o: {size, color, big(뾰족 말풍선), stroke} */
  P.text = function (x, y, str, o) {
    o = o || {};
    if (this.texts.length > 14) this.texts.shift();
    this.texts.push({ x: x, y: y, str: str, size: o.size || 34, color: o.color || '#ffe14d', stroke: o.stroke || '#22121f', big: !!o.big, burst: o.burst || '#ff5a1f',
      t: 0, life: o.life || 46, rot: (Math.random() - 0.5) * 0.36, vx: (Math.random() - 0.5) * 1.2, vy: -1.2, plain: !!o.plain });
  };
  P.addShake = function (a) { this.shake = Math.min(34, Math.max(this.shake, a)); };
  P.punch = function (z) { this.zoom = Math.max(this.zoom, z); };
  P.flashScreen = function (a, color) { this.flash = Math.max(this.flash, a); this.flashColor = color || '#fff'; };

  P.update = function () {
    var i, q;
    for (i = this.p.length - 1; i >= 0; i--) {
      q = this.p[i];
      q.vy += q.grav; q.vx *= q.drag; q.vy *= q.drag; q.x += q.vx; q.y += q.vy; q.rot += q.vr;
      if (--q.life <= 0) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); }
    }
    for (i = this.texts.length - 1; i >= 0; i--) {
      q = this.texts[i]; q.t++;
      if (q.t > 10) { q.x += q.vx; q.y += q.vy; q.vy *= 0.94; }
      if (q.t > q.life) this.texts.splice(i, 1);
    }
    if (this.shake > 0.3) { this.sx = (Math.random() - 0.5) * 2 * this.shake; this.sy = (Math.random() - 0.5) * 2 * this.shake; this.shake *= 0.86; }
    else { this.shake = 0; this.sx = 0; this.sy = 0; }
    this.zoom *= 0.86; if (this.zoom < 0.001) this.zoom = 0;
    this.flash *= 0.8; if (this.flash < 0.02) this.flash = 0;
  };

  P.drawParticles = function (ctx) {
    var i, q, k;
    for (i = 0; i < this.p.length; i++) {
      q = this.p[i]; k = q.life / q.max;
      ctx.globalAlpha = q.kind === 'smoke' ? k * 0.5 : Math.min(1, k * 1.6);
      ctx.fillStyle = q.color;
      if (q.kind === 'star') { JG.star4(ctx, q.x, q.y, q.size * (0.5 + k)); }
      else if (q.kind === 'chunk') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.8); ctx.restore(); }
      else if (q.kind === 'smoke') { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (2 - k), 0, TAU); ctx.fill(); }
      else if (q.kind === 'ring') { ctx.strokeStyle = q.color; ctx.lineWidth = 3 * k + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k) * 6 + 4, 0, TAU); ctx.stroke(); }
      else if (q.kind === 'line') { ctx.strokeStyle = q.color; ctx.lineWidth = q.size * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 2.4, q.y - q.vy * 2.4); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + k * 0.6), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  };
  P.drawTexts = function (ctx) {
    var i, q;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (i = 0; i < this.texts.length; i++) {
      q = this.texts[i];
      var pop = q.t < 5 ? 0.3 + q.t / 5 * 0.95 : q.t < 9 ? 1.25 - (q.t - 5) / 4 * 0.25 : 1, fade = q.t > q.life - 10 ? (q.life - q.t) / 10 : 1;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(pop, pop); ctx.globalAlpha = Math.max(0, fade);
      ctx.font = q.size + 'px "Bagel Fat One", "Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      if (q.big) {      // 뾰족뾰족 말풍선
        var w = ctx.measureText(q.str).width * 0.56 + q.size * 0.4, h = q.size * 0.8, n = 14, k;
        ctx.beginPath();
        for (k = 0; k < n * 2; k++) { var a = k / (n * 2) * TAU, r = k % 2 ? 1 : 1.32 + ((k * 7) % 5) * 0.04; ctx.lineTo(Math.cos(a) * w * r, Math.sin(a) * h * r); }
        ctx.closePath(); ctx.fillStyle = q.burst; ctx.strokeStyle = q.stroke; ctx.lineWidth = 6; ctx.stroke(); ctx.fill();
      }
      ctx.lineWidth = q.plain ? q.size * 0.2 : q.size * 0.26; ctx.strokeStyle = q.stroke; ctx.strokeText(q.str, 0, 0);
      ctx.fillStyle = q.color; ctx.fillText(q.str, 0, 0);
      ctx.restore();
    }
  };
  JG.FX = FX;
})();
