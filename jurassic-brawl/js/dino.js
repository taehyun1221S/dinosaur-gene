/* 쥬라기 유전자 막싸움 — 유전(교배/스탯/도감 판정), 파츠 치수, 포즈 계산, 모듈형 Canvas 렌더러
   머리·몸통·팔(날개)·다리(꼬리) 네 파츠를 관절 기준점으로 조립하므로 어떤 조합도 끊기지 않는다. */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};
  var S = JG.SPECIES, TAU = Math.PI * 2;

  /* ================= 유틸 ================= */
  JG.rand = function (a, b) { return a + Math.random() * (b - a); };
  JG.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  JG.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  JG.lerp = function (a, b, t) { return a + (b - a) * t; };
  JG.wrapAngle = function (a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  JG.uid = function () { return 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); };
  function lerpHue(a, b, t) { var d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; }
  function hsl(c, dl, ds) { return 'hsl(' + Math.round(c[0]) + ' ' + JG.clamp(Math.round(c[1] + (ds || 0)), 0, 100) + '% ' + JG.clamp(Math.round(c[2] + (dl || 0)), 0, 100) + '%)'; }
  JG.hsl = hsl;

  /* ================= 유전 ================= */
  JG.makePure = function (sid) {
    var sp = S[sid];
    return { id: JG.uid(), parts: { head: sid, body: sid, arms: sid, legs: sid }, colors: { skin: sp.skin.slice(), accent: sp.accent.slice() },
      mut: null, train: { pow: 0, bnc: 0, spd: 0 }, fed: 0, gen: 1, parents: null, wins: 0 };
  };
  JG.makeFromParts = function (parts, mut) {
    var a = S[parts.body], b = S[parts.head];
    return { id: JG.uid(), parts: { head: parts.head, body: parts.body, arms: parts.arms, legs: parts.legs },
      colors: { skin: a.skin.slice(), accent: b.accent.slice() }, mut: mut || null, train: { pow: 0, bnc: 0, spd: 0 }, fed: 0, gen: 1, parents: null, wins: 0 };
  };
  function mixColor(a, b) {
    var t = JG.rand(0.25, 0.75);
    return [(lerpHue(a[0], b[0], t) + JG.rand(-7, 7) + 360) % 360, JG.clamp(JG.lerp(a[1], b[1], t) + JG.rand(-4, 6), 30, 90), JG.clamp(JG.lerp(a[2], b[2], t) + JG.rand(-3, 3), 36, 64)];
  }
  /* locks: { head:'a'|'b'|null, ... } — 고정한 부위는 해당 부모에게서 받는다 */
  JG.breed = function (a, b, locks) {
    locks = locks || {};
    var parts = {}, from = {};
    JG.SLOTS.forEach(function (k) {
      var src = locks[k] || (Math.random() < 0.5 ? 'a' : 'b');
      from[k] = src;
      parts[k] = (src === 'a' ? a : b).parts[k];
    });
    var mut = null, r = Math.random();
    if (a.mut && r < 0.22) mut = a.mut;
    else if (b.mut && r < 0.44) mut = b.mut;
    else if (Math.random() < JG.MUTATION_CHANCE) mut = JG.pick(JG.MUTATION_IDS);
    return { id: JG.uid(), parts: parts, colors: { skin: mixColor(a.colors.skin, b.colors.skin), accent: mixColor(a.colors.accent, b.colors.accent) },
      mut: mut, train: { pow: 0, bnc: 0, spd: 0 }, fed: 0, gen: Math.max(a.gen || 1, b.gen || 1) + 1,
      parents: [JG.dinoName(a), JG.dinoName(b)], from: from, wins: 0 };
  };
  /* 희귀 알: 무작위 혼종 + 돌연변이 확정 */
  JG.hatchRare = function () {
    var ids = JG.SPECIES_IDS, parts = {};
    JG.SLOTS.forEach(function (k) { parts[k] = JG.pick(ids); });
    if (JG.speciesSet({ parts: parts }).length < 2) parts.head = ids[(ids.indexOf(parts.head) + 1 + Math.floor(Math.random() * 5)) % 6];
    var d = JG.makeFromParts(parts, JG.pick(JG.MUTATION_IDS));
    d.colors = { skin: mixColor(S[parts.body].skin, S[parts.legs].skin), accent: mixColor(S[parts.head].accent, S[parts.arms].accent) };
    d.gen = 2; d.parents = ['희귀 알', '화산의 기운'];
    return d;
  };
  JG.randomRival = function (diff) {
    var ids = JG.SPECIES_IDS, parts = {};
    var base = JG.pick(ids), other = JG.pick(ids);
    JG.SLOTS.forEach(function (k) { parts[k] = Math.random() < 0.55 ? base : (Math.random() < 0.7 ? other : JG.pick(ids)); });
    var d = JG.makeFromParts(parts, diff >= 3 && Math.random() < 0.5 ? JG.pick(['giant', 'lava', 'golden', 'jelly']) : (Math.random() < 0.12 ? JG.pick(JG.MUTATION_IDS) : null));
    d.colors = { skin: mixColor(S[parts.body].skin, S[parts.head].skin), accent: mixColor(S[parts.head].accent, S[parts.legs].accent) };
    var t = Math.max(0, diff - 1) * 2;
    d.train = { pow: t, bnc: t, spd: t };
    d.rival = JG.pick(JG.RIVAL_TITLES);
    return d;
  };

  JG.speciesSet = function (d) {
    var out = [];
    JG.SLOTS.forEach(function (k) { if (out.indexOf(d.parts[k]) < 0) out.push(d.parts[k]); });
    return out;
  };
  JG.dinoName = function (d) {
    if (d.nick) return d.nick;
    var p = d.parts;
    return S[p.head].syl.head + S[p.body].syl.body + S[p.legs].syl.legs;
  };
  JG.dinoTitle = function (d) {
    var m = d.mut ? JG.MUTATIONS[d.mut].name + ' · ' : '';
    return m + S[d.parts.arms].arms.epithet;
  };
  function legendMatches(L, d) {
    for (var k in L.need) if (d.parts[k] !== L.need[k]) return false;
    return true;
  }
  /* 가장 조건이 까다로운(부위 지정이 많은) 전설 조합을 대표로 삼는다 */
  JG.legendOf = function (d) {
    var best = null, n = 0;
    JG.LEGENDS.forEach(function (L) {
      if (!legendMatches(L, d)) return;
      var c = Object.keys(L.need).length;
      if (c > n) { n = c; best = L; }
    });
    return best;
  };
  JG.dexIdsFor = function (d) {
    var ids = [], set = JG.speciesSet(d);
    if (set.length === 1) ids.push('S_' + set[0]);
    else if (set.length === 2) {
      var a = JG.SPECIES_IDS.indexOf(set[0]), b = JG.SPECIES_IDS.indexOf(set[1]);
      var lo = JG.SPECIES_IDS[Math.min(a, b)], hi = JG.SPECIES_IDS[Math.max(a, b)];
      ids.push('P_' + lo + '_' + hi);
    } else if (set.length === 3) ids.push('X_trio');
    else ids.push('X_chimera');
    JG.LEGENDS.forEach(function (L) { if (legendMatches(L, d)) ids.push(L.id); });
    if (d.mut) ids.push('M_' + d.mut);
    return ids;
  };
  JG.movesOf = function (d) {
    return { head: JG.MOVES[S[d.parts.head].head.move], tail: JG.MOVES[S[d.parts.legs].legs.move], arms: JG.MOVES[S[d.parts.arms].arms.move] };
  };
  JG.hasWings = function (d) { return !!S[d.parts.arms].arms.wing; };
  JG.stats = function (d) {
    var p = d.parts, H = S[p.head].head, B = S[p.body].body, A = S[p.arms].arms, L = S[p.legs].legs;
    var st = { pow: H.pow + A.pow + L.pow, bnc: B.bnc + L.bnc, wgt: B.wgt + H.wgt + L.wgt, spd: L.spd + B.spd + A.spd };
    var tr = d.train || {};
    st.pow += tr.pow || 0; st.bnc += tr.bnc || 0; st.spd += tr.spd || 0; st.wgt += d.fed || 0;
    function add(b) { if (b) for (var k in b) st[k] += b[k]; }
    if (d.mut) add(JG.MUTATIONS[d.mut].bonus);
    var L2 = JG.legendOf(d); if (L2) add(L2.bonus);
    for (var k in st) st[k] = JG.clamp(st[k], 1, 15);
    st.hp = 130 + st.wgt * 7 + B.hp * 8;
    return st;
  };
  JG.special = function (d) {
    var L = JG.legendOf(d);
    if (L) return L.special;
    var mv = JG.movesOf(d), best = mv.head;
    ['tail', 'arms'].forEach(function (k) { if (mv[k].dmg + mv[k].kb > best.dmg + best.kb) best = mv[k]; });
    return best.name;
  };

  /* ================= 파츠 치수 ================= */
  var BODY = {
    trex:   { w: 92,  h: 66, lean: -0.10 },
    trice:  { w: 104, h: 74, lean: 0.02 },
    ptera:  { w: 66,  h: 46, lean: -0.14 },
    pachy:  { w: 78,  h: 56, lean: -0.12 },
    stego:  { w: 100, h: 68, lean: 0.04 },
    raptor: { w: 78,  h: 48, lean: -0.06 }
  };
  var HEAD = {
    trex: { r: 30, neck: 9 }, trice: { r: 27, neck: 5 }, ptera: { r: 20, neck: 18 },
    pachy: { r: 25, neck: 13 }, stego: { r: 17, neck: 15 }, raptor: { r: 21, neck: 15 }
  };
  var ARMS = {
    trex: { len: 20, w: 9 }, trice: { len: 32, w: 17 }, ptera: { len: 86, w: 13, wing: true },
    pachy: { len: 28, w: 11 }, stego: { len: 34, w: 18 }, raptor: { len: 36, w: 10 }
  };
  var LEGS = {
    trex:   { lt: 34, ls: 30, wt: 24, ws: 13, foot: 22, l1: 46, l2: 44, t1: 30, t2: 8 },
    trice:  { lt: 24, ls: 20, wt: 22, ws: 18, foot: 15, l1: 26, l2: 22, t1: 26, t2: 8 },
    ptera:  { lt: 22, ls: 26, wt: 9,  ws: 6,  foot: 14, l1: 22, l2: 20, t1: 10, t2: 4 },
    pachy:  { lt: 30, ls: 30, wt: 17, ws: 10, foot: 18, l1: 40, l2: 38, t1: 20, t2: 6 },
    stego:  { lt: 26, ls: 20, wt: 23, ws: 19, foot: 15, l1: 42, l2: 40, t1: 26, t2: 10 },
    raptor: { lt: 30, ls: 32, wt: 15, ws: 8,  foot: 20, l1: 44, l2: 48, t1: 14, t2: 5 }
  };
  var specCache = {};
  JG.spec = function (d) {
    var p = d.parts, key = p.head + '|' + p.body + '|' + p.arms + '|' + p.legs + '|' + (d.mut || '');
    if (specCache[key]) return specCache[key];
    var s = d.mut === 'giant' ? 1.3 : d.mut === 'mini' ? 0.72 : 1;
    var hs = d.mut === 'mini' ? s * 1.14 : s;
    var B = BODY[p.body], H = HEAD[p.head], A = ARMS[p.arms], L = LEGS[p.legs];
    var w = B.w * s, h = B.h * s, r = H.r * hs, nl = H.neck * s;
    var sp = {
      scale: s, parts: p,
      w: w, h: h, lean: B.lean, r: r,
      neckBase: { x: w * 0.28, y: -h * 0.16 },
      headPivot: { x: w * 0.40 + nl * 0.55, y: -h * 0.40 - nl * 0.8 },
      headAnchor: { x: -r * 0.45, y: r * 0.25 },
      tailA: { x: -w * 0.40, y: -h * 0.02 },
      hip: { x: -w * 0.10, y: h * 0.26 }, hipF: { x: -w * 0.10 + 8 * s, y: h * 0.25 },
      wing: !!A.wing,
      sh: A.wing ? { x: w * 0.12, y: -h * 0.30 } : { x: w * 0.27, y: h * 0.06 },
      shF: A.wing ? { x: w * 0.18, y: -h * 0.32 } : { x: w * 0.33, y: h * 0.04 },
      armLen: A.len * s, armW: A.w * s,
      lt: L.lt * s, ls: L.ls * s, wt: L.wt * s, ws: L.ws * s, foot: L.foot * s,
      l1: L.l1 * s, l2: L.l2 * s, t1: L.t1 * s, t2: L.t2 * s
    };
    // 기본 자세 각도(오른쪽을 볼 때 기준, 절대각)
    var R = { torso: sp.lean };
    R.head = sp.lean * 0.3;
    R.t1 = sp.lean + 0.14; R.t2 = R.t1 + 0.16;
    R.thN = -0.42; R.shN = R.thN + 0.62; R.thF = 0.10; R.shF = R.thF + 0.42;
    if (sp.wing) { R.armN = 0.42; R.armF = 0.56; } else { R.armN = -0.55; R.armF = -0.75; }
    sp.rest = R;
    // 서 있을 때 몸통 중심의 지면 높이
    var pose = JG.place(sp, 1, 0, 0, R);
    var ankle = wp(pose.shN, 1, 0, sp.ls / 2);
    sp.standH = ankle.y + sp.ws * 0.5 + 1.5 * s;
    // 미리보기용 대략적인 외곽 상자(몸통 중심 기준)
    var beak = p.head === 'ptera' ? r * 3.1 : p.head === 'trex' ? r * 1.8 : p.head === 'raptor' ? r * 1.9 : r * 1.5;
    var front = Math.max(pose.head.x + beak, w / 2), back = Math.min(pose.t2.x - sp.l2 * 0.7 - sp.t1, -w / 2 - 6);
    var top = Math.min(pose.head.y - r * 1.9, -h / 2 - (p.body === 'stego' ? h * 0.5 : 6)), bottom = sp.standH;
    if (sp.wing) { back = Math.min(back, sp.sh.x - sp.armLen * 1.05); top = Math.min(top, sp.sh.y - sp.armLen * 0.6); }
    sp.bbox = { l: back, r: front, t: top, b: bottom };
    specCache[key] = sp;
    return sp;
  };

  /* ================= 포즈 ================= */
  function wp(seg, f, lx, ly) {
    var c = Math.cos(seg.a), s = Math.sin(seg.a), X = f * lx;
    return { x: seg.x + X * c - ly * s, y: seg.y + X * s + ly * c };
  }
  function attach(pt, a, f, lax, lay) {
    var c = Math.cos(a), s = Math.sin(a), X = f * lax;
    return { x: pt.x - (X * c - lay * s), y: pt.y - (X * s + lay * c), a: a };
  }
  JG.wp = wp;
  /* 몸통 중심 (x, y)와 각 부위 절대각(오른쪽 기준)으로 전신 포즈를 만든다 */
  JG.place = function (sp, f, x, y, A) {
    var T = { x: x, y: y, a: f * A.torso }, P = { f: f, torso: T };
    P.head = attach(wp(T, f, sp.headPivot.x, sp.headPivot.y), f * A.head, f, sp.headAnchor.x, sp.headAnchor.y);
    P.t1 = attach(wp(T, f, sp.tailA.x, sp.tailA.y), f * A.t1, f, sp.l1 / 2, 0);
    P.t2 = attach(wp(P.t1, f, -sp.l1 / 2, 0), f * A.t2, f, sp.l2 / 2, 0);
    P.thN = attach(wp(T, f, sp.hip.x, sp.hip.y), f * A.thN, f, 0, -sp.lt / 2);
    P.shN = attach(wp(P.thN, f, 0, sp.lt / 2), f * A.shN, f, 0, -sp.ls / 2);
    P.thF = attach(wp(T, f, sp.hipF.x, sp.hipF.y), f * A.thF, f, 0, -sp.lt / 2);
    P.shF = attach(wp(P.thF, f, 0, sp.lt / 2), f * A.shF, f, 0, -sp.ls / 2);
    if (sp.wing) {
      P.armN = attach(wp(T, f, sp.sh.x, sp.sh.y), f * A.armN, f, sp.armLen / 2, 0);
      P.armF = attach(wp(T, f, sp.shF.x, sp.shF.y), f * A.armF, f, sp.armLen / 2, 0);
    } else {
      P.armN = attach(wp(T, f, sp.sh.x, sp.sh.y), f * A.armN, f, 0, -sp.armLen / 2);
      P.armF = attach(wp(T, f, sp.shF.x, sp.shF.y), f * A.armF, f, 0, -sp.armLen / 2);
    }
    return P;
  };
  /* 미리보기·미니게임용 애니메이션 포즈. mode: idle | walk | cheer | eat | roar | hit */
  JG.animPose = function (sp, f, x, groundY, t, mode) {
    var R = sp.rest, A = {};
    for (var k in R) A[k] = R[k];
    var bob = Math.sin(t * 2.2) * 1.4 * sp.scale, lift = 0, P;
    A.head += Math.sin(t * 1.7) * 0.06;
    A.t1 += Math.sin(t * 2.4) * 0.09; A.t2 += Math.sin(t * 2.4 - 0.9) * 0.2;
    if (sp.wing) { A.armN += Math.sin(t * 3) * 0.10; A.armF += Math.sin(t * 3 + 0.4) * 0.10; }
    else { A.armN += Math.sin(t * 2) * 0.10; A.armF += Math.sin(t * 2 + 1) * 0.10; }
    var mouth = 0;
    if (mode === 'walk') {
      var ph = t * 11;
      A.thN += Math.sin(ph) * 0.6; A.shN = A.thN + 0.55 + Math.max(0, Math.cos(ph)) * 0.5;
      A.thF += Math.sin(ph + Math.PI) * 0.6; A.shF = A.thF + 0.5 + Math.max(0, Math.cos(ph + Math.PI)) * 0.5;
      A.torso += Math.sin(ph * 2) * 0.03 + 0.06; bob = Math.abs(Math.sin(ph)) * -3 * sp.scale;
      A.t1 += Math.sin(ph) * 0.12;
    } else if (mode === 'cheer') {
      var j = Math.abs(Math.sin(t * 7));
      lift = j * 26 * sp.scale; A.torso -= 0.12 * j;
      A.thN = -0.7 * j + R.thN * (1 - j); A.shN = A.thN + 0.5 + j * 0.6; A.thF = -0.5 * j + R.thF * (1 - j); A.shF = A.thF + 0.5 + j * 0.6;
      if (sp.wing) { A.armN = 0.9 - j * 1.3; A.armF = 1.0 - j * 1.3; } else { A.armN = -0.6 - j * 1.6; A.armF = -0.8 - j * 1.6; }
      A.head -= 0.25 * j; mouth = j;
    } else if (mode === 'eat') {
      var c = Math.abs(Math.sin(t * 9));
      A.head += 0.35 + c * 0.12; mouth = c; A.torso += 0.08;
    } else if (mode === 'roar') {
      A.head -= 0.35; A.torso -= 0.08; mouth = 0.8 + Math.sin(t * 40) * 0.2;
      A.t1 += 0.2; A.t2 += 0.3;
    } else if (mode === 'hit') {
      A.torso -= 0.3; A.head -= 0.5; A.thN += 0.5; A.thF += 0.7; mouth = 0.6;
      if (!sp.wing) { A.armN -= 1.2; A.armF -= 1.4; }
    }
    P = JG.place(sp, f, x, groundY - sp.standH + bob - lift, A);
    P.mouth = mouth;
    P.blink = (t % 3.3) < 0.13;
    P.eye = { x: Math.sin(t * 0.9) * 0.45, y: Math.cos(t * 1.3) * 0.3 };
    if (mode === 'hit') { P.hurt = 1; }
    return P;
  };

  /* ================= 색 ================= */
  function palette(d, time, opts) {
    if (opts.silhouette) {
      var k = opts.silhouette === true ? '#1c1023' : opts.silhouette;
      return { skin: k, skinD: k, belly: k, accent: k, accentD: k, line: k, bone: k, white: k, pupil: k, beak: k, dark: k, sil: true };
    }
    var skin = d.colors.skin, acc = d.colors.accent, belly;
    if (d.mut === 'golden') { skin = [45, 92, 54]; acc = [28, 95, 60]; }
    else if (d.mut === 'lava') { skin = [14, 22, 22]; acc = [24, 100, 56]; }
    else if (d.mut === 'rainbow') { skin = [(skin[0] + time * 70) % 360, 78, 58]; acc = [(skin[0] + 150) % 360, 85, 58]; }
    else if (d.mut === 'jelly') { skin = [skin[0], Math.min(95, skin[1] + 25), Math.min(70, skin[2] + 10)]; }
    belly = d.mut === 'lava' ? [18, 30, 32] : [(skin[0] + 18) % 360, Math.max(30, skin[1] - 8), Math.min(88, skin[2] + 26)];
    var fl = opts.flash || 0;
    function c(col, dl) { return hsl(col, (dl || 0) + fl * 38, -fl * 30); }
    return {
      skin: c(skin, 0), skinD: c(skin, -13), belly: c(belly, 0), accent: c(acc, 0), accentD: c(acc, -14),
      dark: c(skin, -18), line: '#22121f', bone: fl ? '#fff' : '#f6ecd2', white: '#fffdf4', pupil: '#1d1018',
      beak: c([42, 88, 60], 0), lava: d.mut === 'lava', sil: false
    };
  }

  /* ================= 도형 도우미 ================= */
  function capsule(ctx, x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.01 || d <= Math.abs(r1 - r2)) {
      if (r1 >= r2) { ctx.moveTo(x1 + r1, y1); ctx.arc(x1, y1, r1, 0, TAU); }
      else { ctx.moveTo(x2 + r2, y2); ctx.arc(x2, y2, r2, 0, TAU); }
      return;
    }
    var ang = Math.atan2(dy, dx), phi = Math.acos(JG.clamp((r1 - r2) / d, -1, 1));
    ctx.moveTo(x1 + r1 * Math.cos(ang + phi), y1 + r1 * Math.sin(ang + phi));
    ctx.arc(x1, y1, r1, ang + phi, ang - phi + TAU);
    ctx.arc(x2, y2, r2, ang - phi, ang + phi);
    ctx.closePath();
  }
  function circle(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  function ellipse(ctx, x, y, rx, ry, rot) { ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function poly(ctx, pts) { ctx.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }
  /* 외곽선 + 채움(겹친 도형은 하나의 실루엣으로 합쳐진다) */
  function paint(ctx, fill, line, ow) {
    if (ow > 0) { ctx.lineWidth = ow * 2; ctx.strokeStyle = line; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  }

  /* ================= 렌더러 ================= */
  JG.drawDino = function (ctx, d, pose, time, opts) {
    opts = opts || {};
    var sp = JG.spec(d), f = pose.f, C = palette(d, time || 0, opts), p = d.parts;
    var ow = opts.outline != null ? opts.outline : Math.max(2.2, 3 * Math.sqrt(sp.scale));
    var T = pose.torso, H = pose.head, r = sp.r, w = sp.w, h = sp.h;
    function W(seg, lx, ly) { return wp(seg, f, lx, ly); }
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (d.mut === 'jelly' && !C.sil) ctx.globalAlpha *= 0.8;

    // ---- 1. 뒤쪽 팔/날개, 뒤쪽 다리 ----
    drawArm(pose.armF, true);
    drawLeg(pose.thF, pose.shF, true);

    // ---- 2. 몸 뒤에 놓이는 장식 ----
    var tA = W(T, sp.tailA.x + w * 0.10, sp.tailA.y), tJ = W(pose.t1, -sp.l1 / 2, 0), tM1 = { x: pose.t1.x, y: pose.t1.y }, tM2 = { x: pose.t2.x, y: pose.t2.y }, tE = W(pose.t2, -sp.l2 / 2, 0);
    var tailPts = [tA, tM1, tJ, tM2, tE], tailR = [sp.t1 * 0.56, sp.t1 * 0.5, JG.lerp(sp.t1, sp.t2, 0.55) * 0.5, JG.lerp(sp.t1, sp.t2, 0.8) * 0.5, sp.t2 * 0.5];
    var tdx = tE.x - tM2.x, tdy = tE.y - tM2.y, tl = Math.sqrt(tdx * tdx + tdy * tdy) || 1; tdx /= tl; tdy /= tl; // 꼬리 끝 방향
    var i, a, b, q;
    if (p.legs === 'stego') {            // 가시 꼬리
      for (i = 0; i < 4; i++) {
        var side = i % 2 ? 1 : -1, back = i < 2 ? 0.18 : 0.62, bx = JG.lerp(tE.x, tM2.x, back), by = JG.lerp(tE.y, tM2.y, back);
        var nx = -tdy * side, ny = tdx * side, len = sp.t1 * 1.05, bw = sp.t1 * 0.2;
        ctx.beginPath();
        poly(ctx, [{ x: bx - tdx * bw, y: by - tdy * bw }, { x: bx + nx * len + tdx * len * 0.35, y: by + ny * len + tdy * len * 0.35 }, { x: bx + tdx * bw, y: by + tdy * bw }]);
        paint(ctx, C.bone, C.line, ow);
      }
    } else if (p.legs === 'raptor') {     // 깃털 부채
      for (i = -1; i <= 1; i++) {
        a = Math.atan2(tdy, tdx) + i * 0.42;
        ctx.beginPath(); ellipse(ctx, tE.x + Math.cos(a) * sp.t1 * 0.9, tE.y + Math.sin(a) * sp.t1 * 0.9, sp.t1 * 1.05, sp.t1 * 0.36, a);
        paint(ctx, i === 0 ? C.accent : C.accentD, C.line, ow);
      }
    } else if (p.legs === 'ptera') {      // 마름모 꼬리날
      q = sp.t1 * 1.1;
      ctx.beginPath(); poly(ctx, [{ x: tE.x - tdx * q * 0.2, y: tE.y - tdy * q * 0.2 }, { x: tE.x + tdx * q * 0.6 - tdy * q * 0.6, y: tE.y + tdy * q * 0.6 + tdx * q * 0.6 }, { x: tE.x + tdx * q * 1.5, y: tE.y + tdy * q * 1.5 }, { x: tE.x + tdx * q * 0.6 + tdy * q * 0.6, y: tE.y + tdy * q * 0.6 - tdx * q * 0.6 }]);
      paint(ctx, C.accent, C.line, ow);
    }
    if (p.body === 'stego') {             // 등 골판
      var px = [-0.66, -0.36, -0.04, 0.28, 0.56], ph = [0.36, 0.5, 0.58, 0.5, 0.34];
      for (i = 0; i < 5; i++) {
        var ex = px[i] * w / 2, ey = -h / 2 * Math.sqrt(Math.max(0, 1 - px[i] * px[i])), hh = ph[i] * h, ww = w * 0.1;
        ctx.beginPath(); poly(ctx, [W(T, ex - ww, ey + 6 * sp.scale), W(T, ex - ww * 0.75, ey - hh * 0.55), W(T, ex, ey - hh), W(T, ex + ww * 0.75, ey - hh * 0.55), W(T, ex + ww, ey + 6 * sp.scale)]);
        paint(ctx, i % 2 ? C.accentD : C.accent, C.line, ow);
      }
    } else if (p.body === 'raptor') {     // 등 깃털
      for (i = 0; i < 4; i++) {
        var fx = (-0.6 + i * 0.3) * w / 2, fy = -h / 2 * Math.sqrt(Math.max(0, 1 - Math.pow(fx / (w / 2), 2)));
        a = W(T, fx, fy + 3); b = W(T, fx - w * 0.16, fy - h * 0.34);
        ctx.beginPath(); capsule(ctx, a.x, a.y, h * 0.1, b.x, b.y, h * 0.03);
        paint(ctx, i % 2 ? C.accent : C.accentD, C.line, ow);
      }
    }
    if (p.head === 'trice') {             // 목 프릴
      q = W(H, -r * 0.6, -r * 0.5);
      ctx.beginPath(); circle(ctx, q.x, q.y, r * 1.28); paint(ctx, C.accent, C.line, ow);
      if (!C.sil) {
        ctx.fillStyle = C.accentD;
        for (i = 0; i < 5; i++) { a = (f > 0 ? Math.PI : 0) + f * (-1.0 + i * 0.52); ctx.beginPath(); circle(ctx, q.x + Math.cos(a) * r * 0.92, q.y + Math.sin(a) * r * 0.92, r * 0.15); ctx.fill(); }
      }
    } else if (p.head === 'ptera') {      // 긴 볏
      ctx.beginPath(); poly(ctx, [W(H, -r * 0.1, -r * 0.85), W(H, -r * 2.5, -r * 1.35), W(H, -r * 0.8, r * 0.1)]);
      paint(ctx, C.accent, C.line, ow);
    } else if (p.head === 'raptor') {     // 뒤통수 깃털
      for (i = 0; i < 3; i++) {
        a = W(H, -r * 0.5, -r * 0.5 + i * r * 0.3); b = W(H, -r * 1.7 + i * r * 0.15, -r * 1.05 + i * r * 0.5);
        ctx.beginPath(); capsule(ctx, a.x, a.y, r * 0.24, b.x, b.y, r * 0.06);
        paint(ctx, i === 1 ? C.accent : C.accentD, C.line, ow);
      }
    }

    // ---- 3. 꼬리 + 몸통 + 목 + 머리를 하나의 실루엣으로 ----
    var nb = W(T, sp.neckBase.x, sp.neckBase.y), mouth = pose.mouth || 0, jawA = mouth * 0.6;
    ctx.beginPath();
    for (i = 0; i < 4; i++) capsule(ctx, tailPts[i].x, tailPts[i].y, tailR[i], tailPts[i + 1].x, tailPts[i + 1].y, tailR[i + 1]);
    ellipse(ctx, T.x, T.y, w / 2, h / 2, T.a);
    if (p.body === 'trex') { q = W(T, w * 0.2, -h * 0.08); circle(ctx, q.x, q.y, h * 0.47); }
    else if (p.body === 'trice') { q = W(T, 0, h * 0.07); circle(ctx, q.x, q.y, h * 0.52); }
    else if (p.body === 'stego') { q = W(T, -w * 0.03, -h * 0.1); circle(ctx, q.x, q.y, h * 0.5); }
    else if (p.body === 'pachy') { q = W(T, -w * 0.2, 0); circle(ctx, q.x, q.y, h * 0.47); }
    capsule(ctx, nb.x, nb.y, Math.min(h * 0.34, r * 1.1), H.x, H.y, r * 0.72);
    var jp, je;
    if (p.head === 'trex') {
      circle(ctx, H.x, H.y, r * 0.92);
      a = W(H, r * 0.2, -r * 0.05); b = W(H, r * 1.25, r * 0.06); capsule(ctx, a.x, a.y, r * 0.7, b.x, b.y, r * 0.5);
      jp = W(H, r * 0.05, r * 0.5); je = W(H, r * 0.05 + Math.cos(jawA) * r * 1.12, r * 0.5 + Math.sin(jawA) * r * 1.12 + r * 0.04);
      capsule(ctx, jp.x, jp.y, r * 0.36, je.x, je.y, r * 0.25);
    } else if (p.head === 'raptor') {
      circle(ctx, H.x, H.y, r * 0.86);
      a = W(H, r * 0.3, 0); b = W(H, r * 1.55, r * 0.12); capsule(ctx, a.x, a.y, r * 0.6, b.x, b.y, r * 0.33);
      jp = W(H, r * 0.2, r * 0.42); je = W(H, r * 0.2 + Math.cos(jawA) * r * 1.2, r * 0.44 + Math.sin(jawA) * r * 1.2);
      capsule(ctx, jp.x, jp.y, r * 0.3, je.x, je.y, r * 0.17);
    } else if (p.head === 'trice') {
      circle(ctx, H.x, H.y, r * 0.9);
      a = W(H, r * 0.3, r * 0.15); b = W(H, r * 1.2, r * 0.4); capsule(ctx, a.x, a.y, r * 0.62, b.x, b.y, r * 0.3);
    } else if (p.head === 'pachy') {
      circle(ctx, H.x, H.y, r * 0.95);
      a = W(H, r * 0.3, r * 0.2); b = W(H, r * 1.0, r * 0.36); capsule(ctx, a.x, a.y, r * 0.6, b.x, b.y, r * 0.42);
    } else if (p.head === 'stego') {
      a = W(H, -r * 0.2, 0); b = W(H, r * 1.15, r * 0.2); capsule(ctx, a.x, a.y, r * 0.85, b.x, b.y, r * 0.5);
    } else {
      circle(ctx, H.x, H.y, r);
    }
    paint(ctx, C.skin, C.line, ow);

    // ---- 4. 몸통 무늬와 배 ----
    if (!C.sil) {
      ctx.save();
      ctx.beginPath(); ellipse(ctx, T.x, T.y, w / 2, h / 2, T.a); ctx.clip();
      q = W(T, w * 0.05, h * 0.36);
      ctx.fillStyle = C.belly; ctx.beginPath(); ellipse(ctx, q.x, q.y, w * 0.43, h * 0.3, T.a); ctx.fill();
      ctx.fillStyle = C.dark;
      if (p.body === 'trex' || p.body === 'raptor') {
        var n = p.body === 'trex' ? 3 : 4;
        for (i = 0; i < n; i++) {
          var sx = (-0.5 + i * (0.9 / n)) * w / 2 + w * 0.04;
          ctx.beginPath(); poly(ctx, [W(T, sx - w * 0.055, -h * 0.56), W(T, sx + w * 0.055, -h * 0.56), W(T, sx + w * 0.02, -h * (p.body === 'trex' ? 0.1 : 0.2))]); ctx.fill();
        }
      } else if (p.body === 'pachy') {
        var dots = [[-0.5, -0.5], [-0.2, -0.68], [0.12, -0.55], [-0.38, -0.2], [0.34, -0.7], [-0.05, -0.3]];
        for (i = 0; i < dots.length; i++) { q = W(T, dots[i][0] * w / 2, dots[i][1] * h / 2); ctx.beginPath(); circle(ctx, q.x, q.y, h * 0.06); ctx.fill(); }
      } else if (p.body === 'trice') {
        for (i = 0; i < 3; i++) { q = W(T, (-0.45 + i * 0.4) * w / 2, -h * 0.34); ctx.beginPath(); ellipse(ctx, q.x, q.y, w * 0.07, h * 0.05, T.a); ctx.fill(); }
      }
      if (C.lava) drawCracks(ctx, T, w, h, time, f);
      if (d.mut === 'golden' || d.mut === 'jelly') {     // 반짝이는 윤기
        ctx.globalAlpha *= 0.55; ctx.fillStyle = '#fffbe0';
        q = W(T, -w * 0.12, -h * 0.3); ctx.beginPath(); ellipse(ctx, q.x, q.y, w * 0.2, h * 0.07, T.a - f * 0.2); ctx.fill();
      }
      ctx.restore();
    }

    // ---- 4b. 얼굴 ----
    var eye = { x: r * 0.25, y: -r * 0.3, r: r * 0.26 };
    if (p.head === 'trex') {
      eye = { x: r * 0.32, y: -r * 0.36, r: r * 0.23 };
      if (!C.sil) {
        ctx.fillStyle = C.white; ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.5;
        for (i = 0; i < 5; i++) {       // 윗니
          var tx = r * (0.5 + i * 0.2);
          ctx.beginPath(); poly(ctx, [W(H, tx - r * 0.08, r * 0.46), W(H, tx + r * 0.08, r * 0.47), W(H, tx, r * 0.7)]); ctx.fill(); ctx.stroke();
        }
        q = W(H, r * 1.42, -r * 0.14); ctx.fillStyle = C.line; ctx.beginPath(); circle(ctx, q.x, q.y, r * 0.06); ctx.fill();
      }
    } else if (p.head === 'raptor') {
      eye = { x: r * 0.22, y: -r * 0.26, r: r * 0.27 };
      if (!C.sil) {
        ctx.fillStyle = C.white;
        for (i = 0; i < 4; i++) { var rx2 = r * (0.7 + i * 0.22); ctx.beginPath(); poly(ctx, [W(H, rx2 - r * 0.07, r * 0.36), W(H, rx2 + r * 0.07, r * 0.37), W(H, rx2, r * 0.55)]); ctx.fill(); }
      }
    } else if (p.head === 'trice') {
      eye = { x: r * 0.3, y: -r * 0.05, r: r * 0.22 };
      ctx.beginPath(); poly(ctx, [W(H, r * 0.02, -r * 0.5), W(H, r * 1.3, -r * 1.42), W(H, r * 0.5, -r * 0.42)]); paint(ctx, C.bone, C.line, ow);   // 이마 뿔
      ctx.beginPath(); poly(ctx, [W(H, r * 0.86, r * 0.0), W(H, r * 1.42, -r * 0.6), W(H, r * 1.22, r * 0.14)]); paint(ctx, C.bone, C.line, ow);   // 코 뿔
    } else if (p.head === 'ptera') {
      eye = { x: r * 0.12, y: -r * 0.22, r: r * 0.3 };
      var op = mouth * r * 0.9;
      ctx.beginPath(); poly(ctx, [W(H, r * 0.5, r * 0.1), W(H, r * 2.7, r * 0.22 + op), W(H, r * 0.4, r * 0.66)]); paint(ctx, C.beak, C.line, ow);
      ctx.beginPath(); poly(ctx, [W(H, r * 0.55, -r * 0.55), W(H, r * 3.1, r * 0.12), W(H, r * 0.55, r * 0.2)]); paint(ctx, C.beak, C.line, ow);
    } else if (p.head === 'pachy') {
      eye = { x: r * 0.42, y: r * 0.0, r: r * 0.25 };
      for (i = 0; i < 4; i++) { q = W(H, -r * 0.95 + i * r * 0.2, -r * 0.2 + i * r * 0.06 - (i === 0 ? r * 0.2 : 0)); ctx.beginPath(); circle(ctx, q.x, q.y, r * 0.13); paint(ctx, C.bone, C.line, ow * 0.8); }
      ctx.beginPath();     // 돌머리 돔
      a = W(H, -r * 0.92, -r * 0.3); b = W(H, r * 0.78, -r * 0.32);
      ctx.moveTo(a.x, a.y); q = W(H, -r * 0.95, -r * 1.42); var q2 = W(H, r * 0.85, -r * 1.42);
      ctx.bezierCurveTo(q.x, q.y, q2.x, q2.y, b.x, b.y); ctx.closePath();
      paint(ctx, C.bone, C.line, ow);
      if (!C.sil) { ctx.strokeStyle = '#fff'; ctx.lineWidth = ow; ctx.globalAlpha *= 0.8; a = W(H, -r * 0.35, -r * 0.98); b = W(H, r * 0.12, -r * 1.05); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.globalAlpha /= 0.8; }
    } else if (p.head === 'stego') {
      eye = { x: r * 0.3, y: -r * 0.22, r: r * 0.3 };
    }
    if (!C.sil) {
      if (C.lava) drawCracks(ctx, H, r * 1.2, r * 1.2, time + 3, f, true);
      drawEye(eye);
      // 입
      ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.7;
      if (p.head === 'trice' || p.head === 'pachy' || p.head === 'stego') {
        var mx = p.head === 'stego' ? r * 0.7 : r * 0.62, my = p.head === 'stego' ? r * 0.36 : r * 0.55;
        a = W(H, mx - r * 0.3, my); b = W(H, mx + r * 0.42, my + r * 0.04);
        if (mouth > 0.15) { ctx.fillStyle = '#7a1f2b'; ctx.beginPath(); ellipse(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, r * 0.3, r * 0.2 * mouth, H.a); ctx.fill(); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(a.x, a.y); q = W(H, mx + r * 0.05, my + r * 0.14); ctx.quadraticCurveTo(q.x, q.y, b.x, b.y); ctx.stroke(); }
      }
    }

    // ---- 5. 앞쪽 다리, 앞쪽 팔/날개 ----
    drawLeg(pose.thN, pose.shN, false);
    drawArm(pose.armN, false);

    // 황금 반짝이
    if (d.mut === 'golden' && !C.sil) {
      ctx.fillStyle = '#fff7b0';
      for (i = 0; i < 3; i++) {
        var tw = ((time * 1.3 + i * 0.37) % 1), gx = T.x + Math.sin(i * 2.4 + Math.floor(time * 1.3 + i * 0.37) * 1.7) * w * 0.6, gy = T.y - h * 0.3 + Math.cos(i * 3.1 + Math.floor(time * 1.3 + i * 0.37)) * h * 0.7;
        star4(ctx, gx, gy, (1 - Math.abs(tw - 0.5) * 2) * 9 * sp.scale);
      }
    }
    ctx.restore();

    /* ---- 내부 함수 ---- */
    function drawEye(e) {
      var c = W(H, e.x, e.y), er = e.r, ex2 = pose.eye ? pose.eye.x : 0, ey2 = pose.eye ? pose.eye.y : 0;
      if (pose.ko) {
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.9;
        ctx.beginPath(); ctx.moveTo(c.x - er, c.y - er); ctx.lineTo(c.x + er, c.y + er); ctx.moveTo(c.x + er, c.y - er); ctx.lineTo(c.x - er, c.y + er); ctx.stroke();
        return;
      }
      if (pose.hurt > 0.3) {
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.9;
        ctx.beginPath(); ctx.moveTo(c.x - f * er, c.y - er * 0.8); ctx.lineTo(c.x + f * er * 0.6, c.y); ctx.lineTo(c.x - f * er, c.y + er * 0.8); ctx.stroke();
        return;
      }
      if (pose.blink) {
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.8; ctx.beginPath(); ctx.moveTo(c.x - er, c.y); ctx.lineTo(c.x + er, c.y); ctx.stroke();
        return;
      }
      ctx.beginPath(); circle(ctx, c.x, c.y, er); paint(ctx, C.lava ? '#ffd76a' : C.white, C.line, ow * 0.7);
      ctx.fillStyle = C.pupil; ctx.beginPath(); circle(ctx, c.x + (f * 0.25 + ex2 * 0.38) * er, c.y + ey2 * 0.38 * er, er * 0.5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); circle(ctx, c.x + (f * 0.25 + ex2 * 0.38) * er - er * 0.15, c.y + ey2 * 0.38 * er - er * 0.18, er * 0.15); ctx.fill();
      if (p.head === 'trex' || p.head === 'raptor') {        // 사나운 눈썹
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 1.1;
        var b1 = W(H, e.x - er * 1.3, e.y - er * 1.5), b2 = W(H, e.x + er * 1.2, e.y - er * 0.7);
        ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      } else if (p.head === 'stego') {                       // 졸린 눈꺼풀
        ctx.save(); ctx.beginPath(); circle(ctx, c.x, c.y, er); ctx.clip();
        ctx.fillStyle = C.skinD; ctx.fillRect(c.x - er * 1.2, c.y - er * 1.2, er * 2.4, er * 0.95); ctx.restore();
        ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.6; ctx.beginPath(); ctx.moveTo(c.x - er, c.y - er * 0.25); ctx.lineTo(c.x + er, c.y - er * 0.25); ctx.stroke();
      }
    }
    function drawLeg(th, sh, far) {
      var col = far ? C.skinD : C.skin, lp = p.legs;
      var hipP = W(th, 0, -sp.lt / 2), knee = W(th, 0, sp.lt / 2), ank = W(sh, 0, sp.ls / 2);
      var fa = sh.a - f * 0.2, fl = sp.foot, tx = ank.x + f * Math.cos(fa) * fl, ty = ank.y + f * Math.sin(fa) * fl;
      var pillar = lp === 'trice' || lp === 'stego';
      ctx.beginPath();
      capsule(ctx, hipP.x, hipP.y, sp.wt * (lp === 'trex' ? 0.66 : 0.56), knee.x, knee.y, sp.wt * (pillar ? 0.5 : 0.36));
      capsule(ctx, knee.x, knee.y, sp.ws * (pillar ? 0.56 : 0.6), ank.x, ank.y, sp.ws * 0.5);
      capsule(ctx, ank.x, ank.y, sp.ws * 0.52, tx, ty, sp.ws * (pillar ? 0.5 : 0.34));
      paint(ctx, col, C.line, ow);
      if (C.sil) return;
      ctx.fillStyle = C.bone; ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.5;
      var nxx = -Math.sin(fa), nyy = Math.cos(fa), k;
      if (pillar) {
        for (k = -1; k <= 1; k++) { ctx.beginPath(); circle(ctx, tx + f * Math.cos(fa) * sp.ws * 0.3 + nxx * k * sp.ws * 0.3, ty + f * Math.sin(fa) * sp.ws * 0.3 + nyy * k * sp.ws * 0.3 * 0.6 + sp.ws * 0.12, sp.ws * 0.16); ctx.fill(); ctx.stroke(); }
      } else {
        var cl = sp.ws * (lp === 'raptor' ? 1.15 : 0.75);
        ctx.beginPath(); poly(ctx, [{ x: tx - nxx * sp.ws * 0.28, y: ty - nyy * sp.ws * 0.28 }, { x: tx + f * Math.cos(fa) * cl, y: ty + f * Math.sin(fa) * cl + cl * 0.25 }, { x: tx + nxx * sp.ws * 0.28, y: ty + nyy * sp.ws * 0.28 }]);
        ctx.fill(); ctx.stroke();
      }
    }
    function drawArm(arm, far) {
      var col = far ? C.skinD : C.skin, ap = p.arms, k;
      if (sp.wing) {
        var L = sp.armLen, aw = sp.armW, jt = W(arm, L / 2, 0), tip = W(arm, -L / 2, 0);
        var m1 = W(arm, -L * 0.3, aw * 2.3), m2 = W(arm, -L * 0.06, aw * 1.5), m3 = W(arm, L * 0.2, aw * 2.5), m4 = W(arm, L * 0.46, aw * 1.3), c1 = W(arm, -L * 0.42, aw * 1.0), c2 = W(arm, -L * 0.2, aw * 1.4), c3 = W(arm, L * 0.06, aw * 1.5), c4 = W(arm, L * 0.34, aw * 1.5);
        ctx.beginPath(); ctx.moveTo(jt.x, jt.y); ctx.lineTo(tip.x, tip.y);
        ctx.quadraticCurveTo(c1.x, c1.y, m1.x, m1.y); ctx.quadraticCurveTo(c2.x, c2.y, m2.x, m2.y); ctx.quadraticCurveTo(c3.x, c3.y, m3.x, m3.y); ctx.quadraticCurveTo(c4.x, c4.y, m4.x, m4.y); ctx.closePath();
        paint(ctx, far ? C.accentD : C.accent, C.line, ow);
        ctx.beginPath(); capsule(ctx, jt.x, jt.y, aw * 0.42, tip.x, tip.y, aw * 0.2); paint(ctx, col, C.line, ow);
        if (!C.sil) {
          ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.45; ctx.globalAlpha *= 0.35;
          var r1 = W(arm, L * 0.18, aw * 0.2), r2 = W(arm, -L * 0.14, aw * 0.2);
          ctx.beginPath(); ctx.moveTo(r1.x, r1.y); ctx.lineTo(m4.x, m4.y); ctx.moveTo(r2.x, r2.y); ctx.lineTo(m2.x, m2.y); ctx.stroke(); ctx.globalAlpha /= 0.35;
        }
        return;
      }
      var shd = W(arm, 0, -sp.armLen / 2), hand = W(arm, 0, sp.armLen / 2), aw2 = sp.armW;
      var pillar = ap === 'trice' || ap === 'stego';
      ctx.beginPath(); capsule(ctx, shd.x, shd.y, aw2 * 0.56, hand.x, hand.y, aw2 * (pillar ? 0.52 : 0.4));
      if (ap === 'pachy') circle(ctx, hand.x, hand.y, aw2 * 0.72);
      paint(ctx, col, C.line, ow);
      if (C.sil) return;
      var dx = hand.x - shd.x, dy = hand.y - shd.y, dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
      ctx.fillStyle = C.bone; ctx.strokeStyle = C.line; ctx.lineWidth = ow * 0.5;
      if (pillar) {
        for (k = -1; k <= 1; k++) { ctx.beginPath(); circle(ctx, hand.x + dx * aw2 * 0.3 - dy * k * aw2 * 0.3, hand.y + dy * aw2 * 0.3 + dx * k * aw2 * 0.3, aw2 * 0.15); ctx.fill(); ctx.stroke(); }
      } else if (ap !== 'pachy') {
        var n2 = ap === 'raptor' ? 3 : 2, cl2 = aw2 * (ap === 'raptor' ? 1.35 : 0.95), hw = aw2 * 0.21;
        ctx.lineWidth = ow * 0.38;
        for (k = 0; k < n2; k++) {
          var off = (k - (n2 - 1) / 2) * aw2 * 0.46, bx2 = hand.x - dy * off + dx * aw2 * 0.15, by2 = hand.y + dx * off + dy * aw2 * 0.15;
          var tipx = bx2 + dx * cl2 + f * cl2 * 0.3, tipy = by2 + dy * cl2;
          ctx.beginPath(); ctx.moveTo(bx2 - dy * hw, by2 + dx * hw);
          ctx.quadraticCurveTo(bx2 + dx * cl2 * 0.7 - dy * hw, by2 + dy * cl2 * 0.7 + dx * hw, tipx, tipy);
          ctx.quadraticCurveTo(bx2 + dx * cl2 * 0.5 + dy * hw, by2 + dy * cl2 * 0.5 - dx * hw, bx2 + dy * hw, by2 - dx * hw);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
    }
  };
  function star4(ctx, x, y, s) {
    if (s <= 0.5) return;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
  }
  JG.star4 = star4;
  /* 용암 피부의 갈라진 틈 */
  function drawCracks(ctx, seg, w, h, time, f, small) {
    var glow = 0.7 + Math.sin(time * 5) * 0.3, lines = small ? [[-0.5, -0.3, 0, 0.1, 0.5, -0.2]] : [[-0.8, -0.2, -0.4, 0.1, -0.1, -0.3, 0.2, 0.2], [0.1, -0.7, 0.3, -0.2, 0.7, -0.1, 0.9, 0.3], [-0.5, 0.5, -0.1, 0.3, 0.3, 0.6]];
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(255,228,120,' + glow + ')' : 'rgba(255,96,20,' + (0.55 * glow) + ')';
      ctx.lineWidth = pass ? 1.6 : 5;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i]; ctx.beginPath();
        for (var k = 0; k < L.length; k += 2) { var q = wp(seg, f, L[k] * w / 2, L[k + 1] * h / 2); if (k) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
        ctx.stroke();
      }
    }
  }

  /* 발밑 그림자 */
  JG.drawShadow = function (ctx, x, y, rw, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 0.28 : alpha; ctx.fillStyle = '#12060f';
    ctx.beginPath(); ctx.ellipse(x, y, rw, rw * 0.22, 0, 0, TAU); ctx.fill(); ctx.restore();
  };
  /* 캔버스 영역 안에 공룡 미리보기를 맞춰 그린다. box: {x, y, w, h}  */
  JG.drawPreview = function (ctx, d, box, time, opts) {
    opts = opts || {};
    var sp = JG.spec(d), bb = sp.bbox, f = opts.facing || 1;
    var bw = bb.r - bb.l, bh = bb.b - bb.t, pad = opts.pad == null ? 0.1 : opts.pad;
    var sc = Math.min(box.w * (1 - pad * 2) / bw, box.h * (1 - pad * 2) / (bh + 8));
    if (opts.maxScale) sc = Math.min(sc, opts.maxScale);
    var gx = box.x + box.w / 2 - f * (bb.l + bb.r) / 2 * sc, gy = box.y + box.h - box.h * pad - (box.h * (1 - pad * 2) - (bh + 8) * sc) * 0.35;
    ctx.save();
    ctx.translate(gx, gy); ctx.scale(sc, sc);
    if (!opts.noShadow) JG.drawShadow(ctx, f * (bb.l + bb.r) * 0.2, 0, sp.w * 0.62, opts.silhouette ? 0.18 : 0.28);
    var pose = JG.animPose(sp, f, 0, 0, time, opts.mode || 'idle');
    JG.drawDino(ctx, d, pose, time, opts);
    ctx.restore();
    return sc;
  };
})();
