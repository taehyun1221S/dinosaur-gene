/* 쥬라기 유전자 막싸움 — 래그돌 파이터 (Matter.js)
   몸통·머리·꼬리 2마디·다리 4마디·팔(날개) 2개를 핀 관절(Constraint)로 잇고,
   각 관절에 약한 각도 스프링을 걸어 "흐물흐물하지만 조종은 되는" 액티브 래그돌을 만든다. */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};
  var DT2 = (1000 / 60) * (1000 / 60);
  var G = 0.5;                       // 중력 가속도(px/tick²) = gravity.scale 0.0018
  JG.GRAVITY_SCALE = 0.0018;
  var CAT = JG.CAT = { WORLD: 1, DINO: 2, PROP: 4 };
  var wrap = JG.wrapAngle, clamp = JG.clamp;

  function rot(x, y, a) { var c = Math.cos(a), s = Math.sin(a); return { x: x * c - y * s, y: x * s + y * c }; }

  function Fighter(arena, dino, idx, x, groundY, facing, opts) {
    var M = window.Matter, Bodies = M.Bodies, Body = M.Body, Constraint = M.Constraint, Composite = M.Composite;
    opts = opts || {};
    var self = this, sp = JG.spec(dino), st = JG.stats(dino), s = sp.scale, f = facing;
    this.arena = arena; this.dino = dino; this.idx = idx; this.sp = sp; this.st = st; this.f = f;
    this.moves = JG.movesOf(dino);
    this.isAI = !!opts.ai; this.diff = opts.diff || 2; this.name = opts.name || JG.dinoName(dino);
    this.maxHp = st.hp; this.hp = st.hp;
    this.massMul = 0.75 + st.wgt * 0.075;
    this.maxSpeed = 3.3 + st.spd * 0.3;
    this.accel = 0.5 + st.spd * 0.035;
    this.jumpV = clamp(10.4 + st.bnc * 0.42 - st.wgt * 0.16, 8.8, 15.5);
    this.powMul = 0.6 + st.pow * 0.055;
    this.kbResist = 0.62 + st.wgt * 0.085;
    this.cdMul = clamp(1.14 - st.spd * 0.022, 0.8, 1.14);
    this.wings = sp.wing; this.flapMax = 5; this.flap = 5;
    this.legend = JG.legendOf(dino);
    this.jelly = dino.mut === 'jelly';
    this.lavaPerk = dino.mut === 'lava';
    var restitution = Math.min(0.62, 0.05 + st.bnc * 0.045);

    // ---- 몸 만들기 ----
    var grp = -(idx + 1);
    var filt = { group: grp, category: CAT.DINO, mask: CAT.WORLD | CAT.DINO | CAT.PROP };
    var pose = JG.place(sp, f, x, groundY - sp.standH, sp.rest);
    var mm = this.massMul;
    function common(part, density) {
      return { density: density * mm, friction: 0.55, frictionAir: 0.012, restitution: restitution, collisionFilter: filt, label: part };
    }
    function rect(part, seg, w, h, density) {
      w = Math.max(5, w); h = Math.max(5, h);
      var o = common(part, density); o.angle = seg.a; o.chamfer = { radius: Math.min(w, h) * 0.38 };
      var b = Bodies.rectangle(seg.x, seg.y, w, h, o); b.jgF = self; b.jgPart = part; b.jgR = Math.max(w, h) / 2; return b;
    }
    var torso = rect('torso', pose.torso, sp.w * 0.88, sp.h * 0.84, 0.0016);
    var head = Bodies.circle(pose.head.x, pose.head.y, sp.r * 0.92, common('head', 0.0008));
    Body.setAngle(head, pose.head.a); head.jgF = this; head.jgPart = 'head'; head.jgR = sp.r;
    var tailHeavy = dino.parts.legs === 'stego' ? 1.7 : dino.parts.legs === 'trex' ? 1.2 : 1;
    var t1 = rect('t1', pose.t1, sp.l1, sp.t1 * 0.8, 0.0006);
    var t2 = rect('t2', pose.t2, sp.l2, (sp.t1 + sp.t2) * 0.42, 0.0006 * tailHeavy);
    var thN = rect('thN', pose.thN, sp.wt * 0.9, sp.lt, 0.0007), shN = rect('shN', pose.shN, sp.ws, sp.ls + sp.ws * 0.3, 0.0007);
    var thF = rect('thF', pose.thF, sp.wt * 0.9, sp.lt, 0.0007), shF = rect('shF', pose.shF, sp.ws, sp.ls + sp.ws * 0.3, 0.0007);
    var armN, armF;
    if (sp.wing) { armN = rect('armN', pose.armN, sp.armLen, sp.armW * 1.1, 0.00028); armF = rect('armF', pose.armF, sp.armLen, sp.armW * 1.1, 0.00028); }
    else { armN = rect('armN', pose.armN, sp.armW, sp.armLen, 0.0005); armF = rect('armF', pose.armF, sp.armW, sp.armLen, 0.0005); }
    this.torso = torso; this.head = head; this.t1 = t1; this.t2 = t2; this.thN = thN; this.shN = shN; this.thF = thF; this.shF = shF; this.armN = armN; this.armF = armF;
    this.bodies = [torso, head, t1, t2, thN, shN, thF, shF, armN, armF];
    this.mass = 0; this.bodies.forEach(function (b) { self.mass += b.mass; });

    // ---- 핀 관절 ----
    var stiffMul = this.jelly ? 0.55 : 1;
    function pin(bA, la, bB, lb, stiff) {
      var pa = rot(f * la.x, la.y, bA.angle), pb = rot(f * lb.x, lb.y, bB.angle);
      return Constraint.create({ bodyA: bA, pointA: pa, bodyB: bB, pointB: pb, length: 0, stiffness: stiff * stiffMul, damping: 0.08 });
    }
    var armAnchor = sp.wing ? { x: sp.armLen / 2, y: 0 } : { x: 0, y: -sp.armLen / 2 };
    this.cons = [
      pin(torso, sp.headPivot, head, sp.headAnchor, 0.72),
      pin(torso, sp.tailA, t1, { x: sp.l1 / 2, y: 0 }, 0.85),
      pin(t1, { x: -sp.l1 / 2, y: 0 }, t2, { x: sp.l2 / 2, y: 0 }, 0.85),
      pin(torso, sp.hip, thN, { x: 0, y: -sp.lt / 2 }, 0.9), pin(thN, { x: 0, y: sp.lt / 2 }, shN, { x: 0, y: -sp.ls / 2 }, 0.9),
      pin(torso, sp.hipF, thF, { x: 0, y: -sp.lt / 2 }, 0.9), pin(thF, { x: 0, y: sp.lt / 2 }, shF, { x: 0, y: -sp.ls / 2 }, 0.9),
      pin(torso, sp.sh, armN, armAnchor, 0.85), pin(torso, sp.shF, armF, armAnchor, 0.85)
    ];
    // ---- 각도 스프링(근육) ----
    var R = sp.rest;
    function J(c, p, rest, w, z) { return { c: c, p: p, rest: rest, w: w, z: z, off: 0, gain: 1 }; }
    this.j = {
      head: J(head, torso, R.head - R.torso, 0.30, 0.5),
      t1: J(t1, torso, R.t1 - R.torso, 0.22, 0.4), t2: J(t2, t1, R.t2 - R.t1, 0.20, 0.35),
      thN: J(thN, torso, R.thN - R.torso, 0.34, 0.6), shN: J(shN, thN, R.shN - R.thN, 0.34, 0.6),
      thF: J(thF, torso, R.thF - R.torso, 0.34, 0.6), shF: J(shF, thF, R.shF - R.thF, 0.34, 0.6),
      armN: J(armN, torso, R.armN - R.torso, 0.30, 0.5), armF: J(armF, torso, R.armF - R.torso, 0.30, 0.5)
    };
    this.jlist = ['head', 't1', 't2', 'thN', 'shN', 'thF', 'shF', 'armN', 'armF'].map(function (k) { return self.j[k]; });

    this.comp = Composite.create({ label: 'fighter' + idx });
    Composite.add(this.comp, this.bodies); Composite.add(this.comp, this.cons);
    Composite.add(arena.world, this.comp);

    // ---- 상태 ----
    this.tick = 0; this.stun = 0; this.ko = false; this.out = false; this.grounded = true; this.coyote = 0;
    this.jumpLock = 0; this.turnCd = 0; this.flapCd = 0; this.flapT = 0; this.gliding = false;
    this.cd = { head: 0, tail: 0, arms: 0 }; this.atk = null; this.spinning = false;
    this.flash = 0; this.hurtT = 0; this.inv = 0; this.phase = 0; this.getup = 1; this.slamCd = 0;
    this.mouth = 0; this.eye = { x: 0, y: 0, vx: 0, vy: 0 }; this.prevHV = { x: 0, y: 0 }; this.blinkT = Math.floor(JG.rand(60, 200));
    this.prevVy = 0; this.lavaUsed = false; this.input = null; this.dustT = 0;
    this.buf = { a1: 0, a2: 0, a3: 0, jump: 0 };   // 입력 버퍼: 기절·경직 직후에 누른 키도 놓치지 않는다
  }
  var P = Fighter.prototype;

  P.pos = function () { return this.torso.position; };

  /* 좌우 반전: 몸통 x를 축으로 모든 마디와 관절 기준점을 거울처럼 뒤집는다 */
  P.setFacing = function (nf) {
    if (nf === this.f || !nf) return;
    var M = window.Matter, Body = M.Body, Vector = M.Vector, cx = this.torso.position.x, tvx = this.torso.velocity.x, i, c, b;
    for (i = 0; i < this.cons.length; i++) {
      c = this.cons[i];
      Vector.rotate(c.pointA, c.bodyA.angle - c.angleA, c.pointA); c.angleA = c.bodyA.angle;
      Vector.rotate(c.pointB, c.bodyB.angle - c.angleB, c.pointB); c.angleB = c.bodyB.angle;
    }
    for (i = 0; i < this.bodies.length; i++) {
      b = this.bodies[i];
      var vx = b.velocity.x, vy = b.velocity.y, w = b.angularVelocity;
      Body.setPosition(b, { x: 2 * cx - b.position.x, y: b.position.y });
      Body.setAngle(b, -b.angle);
      Body.setVelocity(b, { x: 2 * tvx - vx, y: vy });
      Body.setAngularVelocity(b, -w);
    }
    for (i = 0; i < this.cons.length; i++) {
      c = this.cons[i];
      c.pointA.x = -c.pointA.x; c.angleA = c.bodyA.angle;
      c.pointB.x = -c.pointB.x; c.angleB = c.bodyB.angle;
    }
    this.f = nf; this.turnCd = 8;
  };

  P.launch = function (vx, vy, keep) {
    var Body = window.Matter.Body;
    for (var i = 0; i < this.bodies.length; i++) {
      var b = this.bodies[i];
      Body.setVelocity(b, { x: vx == null ? b.velocity.x : b.velocity.x * (keep || 0) + vx, y: vy == null ? b.velocity.y : vy });
    }
  };
  P.addVel = function (b, dx, dy) { window.Matter.Body.setVelocity(b, { x: b.velocity.x + dx, y: b.velocity.y + dy }); };

  /* ---------- 매 틱: 물리 갱신 전에 힘·토크·공격을 넣는다 ---------- */
  P.preStep = function (input) {
    var M = window.Matter, Body = M.Body, sp = this.sp, s = sp.scale, torso = this.torso, arena = this.arena, f, i, jn;
    this.tick++; this.input = input;
    var bf = this.buf;
    if (input.a1) bf.a1 = 9; if (input.a2) bf.a2 = 9; if (input.a3) bf.a3 = 9; if (input.jumpPressed) bf.jump = 7;
    var conscious = !this.ko && this.stun <= 0 && !this.out;
    if (conscious && this.getup < 1) this.getup = Math.min(1, this.getup + 0.05);

    // 방향 전환
    var wantF = input.face || input.dir;
    if (conscious && !this.atk && wantF && wantF !== this.f && this.turnCd <= 0) this.setFacing(wantF);
    f = this.f;

    // 지면
    var tp = torso.position, vx = torso.velocity.x, vy = torso.velocity.y;
    var gy = arena.groundYAt(tp.x, tp.y - sp.h * 0.3);
    var hgt = gy == null ? 1e9 : gy - tp.y;
    var H = sp.standH * (this.spinning ? 1.32 : 1);
    var wasGrounded = this.grounded;
    this.grounded = hgt < H + 9 * s;
    if (this.grounded) { this.coyote = 6; if (this.flap < this.flapMax && this.tick % 6 === 0) this.flap++; }
    else if (this.coyote > 0) this.coyote--;
    if (!wasGrounded && this.grounded && this.prevVy > 7 && arena.onLand) arena.onLand(this, this.prevVy);
    this.prevVy = vy;

    // 서 있기(호버 스프링): 다리 길이만큼 몸통을 띄워 준다
    if (conscious && this.jumpLock <= 0 && hgt < H + 4) {
      var err = H - hgt;
      var ay = clamp(-G - 0.07 * err - 0.38 * vy, -4, 0.3) * this.getup;
      torso.force.y += this.mass * ay / DT2;
    }
    // 균형 잡기
    if (conscious && !this.spinning) {
      var target = f * sp.lean + input.dir * 0.13 + (this.atk && this.atk.slot === 'head' && this.atk.t > this.atk.move.wind ? f * 0.22 : 0);
      var e = wrap(torso.angle - target), wb = 0.3;
      torso.torque += (-(wb * wb) * e - 2 * 0.8 * wb * torso.angularVelocity) * torso.inertia / DT2 * this.getup;
    }
    // 이동
    if (conscious) {
      var want = input.dir * this.maxSpeed, ctrl = this.grounded ? 1 : 0.45;
      var ax = clamp((want - vx) * 0.22, -this.accel, this.accel) * ctrl;
      if (!input.dir && !this.grounded) ax = 0;
      torso.force.x += this.mass * ax / DT2;
      // 점프 / 날갯짓
      if (bf.jump > 0) {
        if ((this.grounded || this.coyote > 0) && this.jumpLock <= 0) {
          this.launch(null, -this.jumpV); this.jumpLock = 9; this.coyote = 0; this.grounded = false; bf.jump = 0;
          if (arena.onJump) arena.onJump(this);
        } else if (this.wings && this.flap > 0 && this.flapCd <= 0 && !this.grounded) {
          this.launch(null, Math.min(vy, 2) - this.jumpV * 0.62); this.flap--; this.flapCd = 9; this.flapT = 12; bf.jump = 0;
          if (arena.onFlap) arena.onFlap(this);
        }
      }
      // 활공: 날개가 있으면 점프 키를 누르고 있는 동안 천천히 떨어진다
      this.gliding = this.wings && input.jumpHeld && !this.grounded && vy > 0.8;
      if (this.gliding) torso.force.y -= this.mass * (G * 0.8 + (vy - 0.8) * 0.05) / DT2;
    } else this.gliding = false;

    // 걷기·공중 자세
    var j = this.j, moving = conscious && this.grounded && Math.abs(vx) > 0.6;
    if (moving) this.phase += Math.abs(vx) * 0.085;
    if (moving) {
      var sw = Math.sin(this.phase), cw = Math.cos(this.phase);
      j.thN.off = sw * 0.75; j.shN.off = Math.max(0, cw) * 0.55; j.thF.off = -sw * 0.75; j.shF.off = Math.max(0, -cw) * 0.55;
      if (!sp.wing) { j.armN.off = -sw * 0.4; j.armF.off = sw * 0.4; }
      j.t1.off = sw * 0.12;
      if (this.dustT-- <= 0 && Math.abs(vx) > 3 && arena.onStep) { arena.onStep(this); this.dustT = 14; }
    } else if (!this.grounded) {
      j.thN.off = -0.35; j.shN.off = 0.5; j.thF.off = -0.75; j.shF.off = 0.65; j.t1.off = 0.25;
      if (!sp.wing) { j.armN.off = -0.9; j.armF.off = -1.1; }
    } else {
      j.thN.off = 0; j.shN.off = 0; j.thF.off = 0; j.shF.off = 0; j.t1.off = Math.sin(this.tick * 0.07) * 0.08;
      if (!sp.wing) { j.armN.off = 0; j.armF.off = 0; }
    }
    if (sp.wing) {
      var wo = 0;
      if (this.flapT > 0) { wo = -Math.sin((1 - this.flapT / 12) * Math.PI) * 1.5; this.flapT--; }
      else if (this.gliding) wo = -0.55 + Math.sin(this.tick * 0.3) * 0.08;
      else if (!this.grounded) wo = -0.25;
      if (!(this.atk && this.atk.slot === 'arms')) { j.armN.off = wo; j.armF.off = wo; }
    }

    // 공격
    if (conscious && !this.atk) {
      if (bf.a1 > 0 && this.cd.head <= 0) { this.startAttack('head'); bf.a1 = 0; }
      else if (bf.a2 > 0 && this.cd.tail <= 0) { this.startAttack('tail'); bf.a2 = 0; }
      else if (bf.a3 > 0 && this.cd.arms <= 0) { this.startAttack('arms'); bf.a3 = 0; }
    }
    if (bf.a1 > 0) bf.a1--; if (bf.a2 > 0) bf.a2--; if (bf.a3 > 0) bf.a3--; if (bf.jump > 0) bf.jump--;
    this.updateAttack();

    // 근육(각도 스프링)
    var limp = conscious ? 1 : 0.1;
    for (i = 0; i < this.jlist.length; i++) {
      jn = this.jlist[i];
      var er = wrap(jn.c.angle - jn.p.angle - f * (jn.rest + jn.off));
      var acc = (-(jn.w * jn.w) * er - 2 * jn.z * jn.w * (jn.c.angularVelocity - jn.p.angularVelocity)) * limp * jn.gain;
      var tq = acc * jn.c.inertia / DT2;
      jn.c.torque += tq; jn.p.torque -= tq;
    }
  };

  P.startAttack = function (slot) {
    var mv = this.moves[slot];
    this.atk = { slot: slot, move: mv, t: 0, hit: {}, air: !this.grounded };
    this.cd[slot] = Math.round(mv.cd * this.cdMul);
    if (slot === 'head') this.addVel(this.head, -this.f * 3, -1);
    if (this.arena.onSwing) this.arena.onSwing(this, mv, slot);
  };

  P.updateAttack = function () {
    var a = this.atk; if (!a) return;
    var Body = window.Matter.Body, mv = a.move, f = this.f, torso = this.torso, sp = this.sp;
    a.t++;
    if (this.ko || this.stun > 0) { this.atk = null; this.spinning = false; return; }
    if (a.t === mv.wind) {
      if (a.slot === 'head') {
        this.addVel(this.head, f * mv.lunge[0], a.air ? 3 : -1.5);
        this.addVel(torso, f * mv.lunge[1], a.air ? 3.5 : 0);
      } else if (a.slot === 'arms') {
        var av = sp.wing ? -f * 0.5 : -f * 0.55;
        Body.setAngularVelocity(this.armN, av); Body.setAngularVelocity(this.armF, av);
        this.j.armN.off = sp.wing ? -1.7 : -1.5; this.j.armF.off = sp.wing ? -1.6 : -1.6;
        this.addVel(torso, f * 2.6, 0);
        if (mv.gust && this.arena.gust) this.arena.gust(this, f);
      } else {
        this.spinning = true;
        if (this.grounded) this.launch(null, -(3.2 + (mv.hop || 0)));
        this.jumpLock = 4;
      }
    }
    if (a.t > mv.wind && a.t <= mv.wind + mv.act) {
      if (a.slot === 'head' && mv.charge) torso.force.x += this.mass * f * 1.0 / DT2;
      if (a.slot === 'tail') Body.setAngularVelocity(torso, JG.lerp(torso.angularVelocity, f * mv.spin, 0.45));
      this.hitTest(a);
    }
    if (a.t > mv.wind + mv.act) {
      this.spinning = false;
      if (a.slot === 'arms' && !sp.wing) { this.j.armN.off = 0; this.j.armF.off = 0; }
      if (a.t > mv.wind + mv.act + 6) this.atk = null;
    }
  };

  P.strikePoints = function (slot, mv) {
    var sp = this.sp, s = sp.scale, f = this.f, pts = [], q;
    if (slot === 'head') {
      q = JG.wp({ x: this.head.position.x, y: this.head.position.y, a: this.head.angle }, f, sp.r * 0.7, 0);
      pts.push({ x: q.x, y: q.y, r: sp.r * 0.9 + mv.reach * s });
    } else if (slot === 'arms') {
      q = JG.wp({ x: this.torso.position.x, y: this.torso.position.y, a: this.torso.angle }, f, sp.w * 0.5 + mv.reach * 0.45 * s, -sp.h * 0.05);
      pts.push({ x: q.x, y: q.y, r: mv.reach * 0.72 * s + 8 });
    } else {
      var T2 = { x: this.t2.position.x, y: this.t2.position.y, a: this.t2.angle };
      q = JG.wp(T2, f, -sp.l2 / 2, 0);
      pts.push({ x: q.x, y: q.y, r: sp.t1 * 0.5 + mv.reach * s + 6 });
      pts.push({ x: T2.x, y: T2.y, r: sp.t1 * 0.5 + 6 });
      if (mv.reach >= 20) { q = JG.wp({ x: this.torso.position.x, y: this.torso.position.y, a: this.torso.angle }, f, -sp.w * 0.45, 0); pts.push({ x: q.x, y: q.y, r: sp.h * 0.5 + 6 }); }
    }
    return pts;
  };

  P.hitTest = function (a) {
    var pts = this.strikePoints(a.slot, a.move), fs = this.arena.fighters, i, k, n, foe, b, p;
    a.pts = pts;
    for (i = 0; i < fs.length; i++) {
      foe = fs[i];
      if (foe === this || foe.ko || foe.out || a.hit[foe.idx]) continue;
      var done = false;
      for (k = 0; k < pts.length && !done; k++) {
        p = pts[k];
        for (n = 0; n < foe.bodies.length; n++) {
          b = foe.bodies[n];
          if (p.x > b.bounds.min.x - p.r && p.x < b.bounds.max.x + p.r && p.y > b.bounds.min.y - p.r && p.y < b.bounds.max.y + p.r) { done = true; break; }
        }
      }
      if (!done) continue;
      a.hit[foe.idx] = true;
      var mv = a.move, dmg = mv.dmg * this.powMul, kb = mv.kb * (0.8 + this.powMul * 0.25);
      var dive = a.slot === 'head' && a.air && !this.grounded;
      if (dive) { dmg *= this.legend && /sky/.test(this.legend.id) ? 1.6 : 1.3; kb *= 1.2; }
      if (this.dino.mut === 'lava') dmg += 2;
      var dx = foe.torso.position.x - this.torso.position.x;
      foe.takeHit({ dmg: dmg, kb: kb, dirX: dx === 0 ? this.f : (dx > 0 ? 1 : -1), up: mv.up, stun: mv.stun, by: this, move: mv, at: p, dive: dive });
      if (a.slot === 'head') this.addVel(this.torso, -this.f * 2.2, 0);
    }
  };

  P.takeHit = function (h) {
    if (this.ko || this.out || this.inv > 0) return false;
    var Body = window.Matter.Body, torso = this.torso, i, b;
    var dmg = h.dmg * (this.jelly ? 0.8 : 1) * (this.dino.parts.body === 'stego' ? 0.92 : 1);
    this.hp = Math.max(0, this.hp - dmg);
    // 체력이 깎일수록 더 멀리 날아간다
    var kb = h.kb / this.kbResist * (this.jelly ? 1.2 : 1) * (0.32 + 0.62 * (1 - this.hp / this.maxHp));
    var kx = h.dirX * kb, ky = h.up >= 0 ? -kb * (0.2 + h.up * 0.8) : kb * (-h.up);
    for (i = 0; i < this.bodies.length; i++) {
      b = this.bodies[i];
      Body.setVelocity(b, { x: b.velocity.x * 0.4 + kx * (b === torso ? 1 : 0.9), y: b.velocity.y * 0.4 + ky });
    }
    Body.setAngularVelocity(torso, torso.angularVelocity + h.dirX * kb * 0.014 * JG.rand(0.5, 1.5));
    var heavy = kb > 5.2 || this.hp <= 0;
    this.stun = Math.max(this.stun, heavy ? (h.stun || Math.round(14 + kb * 2.2)) : 6);
    if (heavy) this.getup = 0;
    this.flash = 7; this.hurtT = 24; this.inv = 8; this.atk = null; this.spinning = false; this.jumpLock = 6;
    if (this.hp <= 0) this.ko = true;
    if (this.arena.onHit) this.arena.onHit(this, h, dmg, kb, heavy);
    return true;
  };

  /* 물리 갱신 뒤 */
  P.postStep = function () {
    var Body = window.Matter.Body, i, b;
    if (this.stun > 0) this.stun--;
    if (this.jumpLock > 0) this.jumpLock--;
    if (this.turnCd > 0) this.turnCd--;
    if (this.flapCd > 0) this.flapCd--;
    if (this.flash > 0) this.flash--;
    if (this.hurtT > 0) this.hurtT--;
    if (this.inv > 0) this.inv--;
    if (this.slamCd > 0) this.slamCd--;
    for (var k in this.cd) if (this.cd[k] > 0) this.cd[k]--;
    // 속도 폭주 방지
    for (i = 0; i < this.bodies.length; i++) {
      b = this.bodies[i];
      var v = b.velocity, sp2 = v.x * v.x + v.y * v.y;
      if (sp2 > 46 * 46) { var k2 = 46 / Math.sqrt(sp2); Body.setVelocity(b, { x: v.x * k2, y: v.y * k2 }); }
      if (Math.abs(b.angularVelocity) > 0.9) Body.setAngularVelocity(b, b.angularVelocity > 0 ? 0.9 : -0.9);
    }
    // 표정: 입, 데굴데굴 눈
    var wantMouth = (this.atk && this.atk.slot === 'head') || this.hurtT > 8 || this.ko ? 1 : 0;
    this.mouth += (wantMouth - this.mouth) * 0.35;
    var hv = this.head.velocity, e = this.eye;
    e.vx += (this.prevHV.x - hv.x) * 0.09 - e.x * 0.12 - e.vx * 0.18; e.vy += (this.prevHV.y - hv.y) * 0.09 - e.y * 0.12 - e.vy * 0.18;
    e.x = clamp(e.x + e.vx, -1, 1); e.y = clamp(e.y + e.vy, -1, 1);
    this.prevHV.x = hv.x; this.prevHV.y = hv.y;
    if (--this.blinkT < -6) this.blinkT = Math.floor(JG.rand(80, 240));
  };

  function seg(b) { return { x: b.position.x, y: b.position.y, a: b.angle }; }
  P.getPose = function () {
    return { f: this.f, torso: seg(this.torso), head: seg(this.head), t1: seg(this.t1), t2: seg(this.t2), thN: seg(this.thN), shN: seg(this.shN), thF: seg(this.thF), shF: seg(this.shF), armN: seg(this.armN), armF: seg(this.armF),
      mouth: this.mouth, blink: this.blinkT < 0, eye: this.eye, hurt: this.hurtT > 6 || (this.stun > 0 && !this.ko) ? 1 : 0, ko: this.ko };
  };
  P.isSane = function () {
    for (var i = 0; i < this.bodies.length; i++) { var p = this.bodies[i].position; if (!isFinite(p.x) || !isFinite(p.y)) return false; }
    return true;
  };
  P.destroy = function () { window.Matter.Composite.remove(this.arena.world, this.comp, true); };
  JG.Fighter = Fighter;

  /* ================= AI ================= */
  JG.aiInput = function (me, foe, arena) {
    var b = me.brain || (me.brain = { t: 0, next: 0, dir: 0, face: 0, atk: 0, jump: false, hold: false });
    var out = { dir: 0, face: 0, jumpPressed: false, jumpHeld: false, a1: false, a2: false, a3: false };
    b.t++;
    if (me.ko || me.out || me.stun > 0 || !foe) return out;
    var diff = me.diff, react = [0, 18, 11, 6][diff];
    var mp = me.torso.position, fp = foe.torso.position, dx = fp.x - mp.x, adx = Math.abs(dx), dy = fp.y - mp.y, sgn = dx >= 0 ? 1 : -1;
    var safeX = arena.safeX ? arena.safeX(mp.x) : 640;
    // 발밑에 땅이 없으면 무조건 복귀
    if (arena.groundYAt(mp.x, mp.y - 30) == null) {
      out.dir = safeX > mp.x ? 1 : -1; out.jumpHeld = true;
      if (b.t % 8 === 0) out.jumpPressed = true;
      return out;
    }
    if (b.t >= b.next) {
      b.next = b.t + react + Math.floor(Math.random() * react);
      var range = me.sp.w * 0.5 + me.sp.r * 1.6 + foe.sp.w * 0.4 + me.moves.head.reach, want = 0;
      if (foe.ko || foe.out) want = 0;
      else if (adx > range) want = sgn;
      else if (adx < range * 0.4 && Math.random() < 0.35) want = -sgn;
      // 위험 구역(간헐천·운석·무너지는 바닥) 피하기
      if (diff >= 2 && arena.dangerDir) { var dz = arena.dangerDir(mp.x); if (dz && (diff === 3 || Math.random() < 0.6)) want = dz; }
      // 낭떠러지 앞에서 멈추기
      if (want && arena.groundYAt(mp.x + want * (50 + me.maxSpeed * 7), mp.y - 30) == null) {
        if (!(me.wings && diff >= 2 && Math.abs(fp.x - safeX) < 300 && Math.random() < 0.3)) want = 0;
        if (Math.abs(mp.x - safeX) > 60 && arena.groundYAt(mp.x + (safeX > mp.x ? 1 : -1) * 40, mp.y - 30) != null && adx > range) want = safeX > mp.x ? 1 : -1;
      }
      b.dir = want; b.face = sgn; b.atk = 0;
      var agg = [0, 0.38, 0.62, 0.88][diff];
      if (!foe.ko && !foe.out && Math.abs(dy) < 100 && Math.random() < agg) {
        var headR = range + me.moves.head.lunge[0] * 3, armR = me.sp.w * 0.5 + me.moves.arms.reach * 1.2 + foe.sp.w * 0.45, tailR = me.sp.l1 + me.sp.l2 + foe.sp.w * 0.4;
        var r = Math.random();
        if (adx < tailR && me.cd.tail <= 0 && r < 0.3) b.atk = 2;
        else if (adx < armR && me.cd.arms <= 0 && r < 0.62) b.atk = 3;
        else if (adx < headR && me.cd.head <= 0) b.atk = 1;
        else if (adx < tailR && me.cd.tail <= 0) b.atk = 2;
      }
      b.jump = (dy < -80 && adx < 220 && Math.random() < 0.5) || Math.random() < 0.02 * diff || (diff === 3 && foe.atk && adx < 150 && Math.random() < 0.3);
      b.hold = me.wings && dy < -40;
    }
    // 생각하는 사이에도 낭떠러지 앞에서는 바로 멈춘다
    if (b.dir && arena.groundYAt(mp.x + b.dir * 46, mp.y - 30) == null && !(me.wings && diff >= 2 && b.hold)) b.dir = 0;
    out.dir = b.dir; out.face = b.face; out.jumpHeld = b.hold;
    if (b.atk) { out['a' + b.atk] = true; b.atk = 0; }
    if (b.jump) { out.jumpPressed = true; b.jump = false; }
    return out;
  };
})();
