/* 쥬라기 유전자 막싸움 — Web Audio API 프로시저럴 사운드
   모든 효과음과 배경 음악을 오실레이터·노이즈·필터로 직접 합성한다(음원 파일 없음). */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};

  /* ---------- 합성 도우미 ---------- */
  function noiseBuf(ac) {
    if (ac._jgNoise) return ac._jgNoise;
    var len = Math.floor(ac.sampleRate * 1.5), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    ac._jgNoise = buf; return buf;
  }
  function env(g, t, peak, a, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  /* o: {type, f0, f1, fm(중간 주파수), t, dur, g, a, vib:[hz, depth]} */
  function tone(ac, out, o) {
    var osc = ac.createOscillator(), g = ac.createGain(), t = o.t, dur = o.dur;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t);
    if (o.fm != null) { osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.fm), t + dur * 0.4); osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + dur); }
    else if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + dur);
    if (o.vib) { var l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
    env(g, t, o.g, o.a || 0.006, dur);
    osc.connect(g); g.connect(o.out || out);
    osc.start(t); osc.stop(t + dur + 0.05);
    return g;
  }
  /* o: {type(필터), f0, f1, q, t, dur, g, a} */
  function noise(ac, out, o) {
    var src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t = o.t, dur = o.dur;
    src.buffer = noiseBuf(ac); src.loop = true;
    fl.type = o.type || 'bandpass'; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.f0, t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    env(g, t, o.g, o.a || 0.004, dur);
    src.connect(fl); fl.connect(g); g.connect(o.out || out);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
    return g;
  }
  function shaper(ac, amount) {
    var ws = ac.createWaveShaper(), n = 256, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
    ws.curve = c; return ws;
  }
  var NOTE = { C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, Bb3: 233.08, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5 };

  /* ---------- 효과음 ---------- */
  var SFX = {
    // 찰진 타격
    hit: function (ac, out, t, o) {
      var v = (o.vol || 1);
      noise(ac, out, { t: t, dur: 0.07, g: 0.5 * v, type: 'bandpass', f0: 1800, f1: 350, q: 0.8 });
      tone(ac, out, { t: t, dur: 0.16, g: 0.7 * v, f0: 210, f1: 62 });
      tone(ac, out, { t: t, dur: 0.03, g: 0.25 * v, type: 'square', f0: 900, f1: 200 });
    },
    // 묵직한 한 방(박치기·돌진·운석)
    heavy: function (ac, out, t, o) {
      var v = (o.vol || 1), ws = shaper(ac, 6), g = ac.createGain(); g.gain.value = 0.8; ws.connect(g); g.connect(out);
      tone(ac, out, { t: t, dur: 0.34, g: 0.9 * v, f0: 150, f1: 36, out: ws });
      tone(ac, out, { t: t, dur: 0.5, g: 0.5 * v, f0: 70, f1: 30 });
      noise(ac, out, { t: t, dur: 0.12, g: 0.6 * v, type: 'lowpass', f0: 2400, f1: 200 });
      noise(ac, out, { t: t + 0.02, dur: 0.3, g: 0.18 * v, type: 'bandpass', f0: 500, f1: 120, q: 0.6 });
    },
    slap: function (ac, out, t, o) {
      noise(ac, out, { t: t, dur: 0.05, g: 0.75, type: 'highpass', f0: 1800 });
      noise(ac, out, { t: t + 0.012, dur: 0.09, g: 0.35, type: 'bandpass', f0: 2600, f1: 900, q: 1.2 });
      tone(ac, out, { t: t, dur: 0.08, g: 0.3, f0: 420, f1: 180 });
    },
    bite: function (ac, out, t, o) {
      noise(ac, out, { t: t, dur: 0.045, g: 0.6, type: 'bandpass', f0: 2800, q: 2 });
      noise(ac, out, { t: t + 0.05, dur: 0.07, g: 0.7, type: 'bandpass', f0: 1900, f1: 700, q: 1.5 });
      tone(ac, out, { t: t + 0.04, dur: 0.14, g: 0.55, f0: 180, f1: 70 });
    },
    peck: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.06, g: 0.5, type: 'triangle', f0: 1100, f1: 480 });
      noise(ac, out, { t: t, dur: 0.02, g: 0.3, type: 'highpass', f0: 3000 });
    },
    slash: function (ac, out, t, o) {
      noise(ac, out, { t: t, dur: 0.16, g: 0.55, type: 'bandpass', f0: 4200, f1: 700, q: 2.2 });
      tone(ac, out, { t: t + 0.03, dur: 0.1, g: 0.3, f0: 260, f1: 90 });
    },
    whoosh: function (ac, out, t, o) {
      var p = o.pitch || 1;
      noise(ac, out, { t: t, dur: 0.22, g: 0.22, a: 0.08, type: 'bandpass', f0: 500 * p, f1: 1900 * p, q: 1.6 });
    },
    // 띠용~ (스프링·튕김)
    boing: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.42, g: 0.45, type: 'triangle', f0: 190, fm: 560, f1: 150, vib: [17, 40] });
    },
    // 흐물흐물 넘어질 때: 슬라이드 휘슬 + 뽀잉
    flop: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.34, g: 0.3, f0: 880, f1: 190, vib: [9, 22] });
      tone(ac, out, { t: t + 0.3, dur: 0.3, g: 0.34, type: 'triangle', f0: 150, fm: 330, f1: 110, vib: [15, 30] });
      noise(ac, out, { t: t + 0.32, dur: 0.1, g: 0.25, type: 'lowpass', f0: 500 });
    },
    jump: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.13, g: 0.26, type: 'triangle', f0: 250 * (o.pitch || 1), f1: 620 * (o.pitch || 1) }); },
    flap: function (ac, out, t, o) {
      noise(ac, out, { t: t, dur: 0.12, g: 0.4, a: 0.03, type: 'lowpass', f0: 900, f1: 250 });
      tone(ac, out, { t: t, dur: 0.1, g: 0.12, f0: 200, f1: 320 });
    },
    land: function (ac, out, t, o) {
      var v = o.vol || 1;
      tone(ac, out, { t: t, dur: 0.16, g: 0.55 * v, f0: 110, f1: 44 });
      noise(ac, out, { t: t, dur: 0.07, g: 0.3 * v, type: 'lowpass', f0: 700 });
    },
    // 공룡 울음: 톱니파 + 으르렁 AM + 포먼트 필터. size가 클수록 낮고 길다
    roar: function (ac, out, t, o) {
      var sz = o.size || 1, base = 150 / sz, dur = 0.55 + sz * 0.3;
      var fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2.2;
      fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.3); fl.frequency.exponentialRampToValueAtTime(420, t + dur);
      var am = ac.createGain(); am.gain.value = 0.6;
      var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.type = 'sawtooth'; lfo.frequency.value = 24 + 10 / sz; lg.gain.value = 0.45; lfo.connect(lg); lg.connect(am.gain); lfo.start(t); lfo.stop(t + dur + 0.1);
      var ws = shaper(ac, 4), og = ac.createGain(); og.gain.value = 0.9;
      fl.connect(ws); ws.connect(am); am.connect(og); og.connect(out);
      tone(ac, out, { t: t, dur: dur, g: 0.7, a: 0.05, type: 'sawtooth', f0: base, fm: base * 1.55, f1: base * 0.55, out: fl });
      tone(ac, out, { t: t, dur: dur, g: 0.5, a: 0.05, type: 'square', f0: base * 0.5, fm: base * 0.78, f1: base * 0.28, out: fl });
      noise(ac, out, { t: t, dur: dur, g: 0.5, a: 0.08, type: 'bandpass', f0: 900, f1: 500, q: 0.7, out: fl });
      tone(ac, out, { t: t, dur: dur, g: 0.22, a: 0.06, f0: base * 0.5, f1: base * 0.3 });
    },
    crack: function (ac, out, t, o) {
      for (var i = 0; i < 3; i++) noise(ac, out, { t: t + i * 0.035 + Math.random() * 0.01, dur: 0.03, g: 0.5, type: 'highpass', f0: 2500 + i * 800 });
      tone(ac, out, { t: t, dur: 0.05, g: 0.2, type: 'square', f0: 700, f1: 300 });
    },
    // 알 부화 팡파르
    hatch: function (ac, out, t, o) {
      var seq = ['C5', 'E5', 'G5', 'C6'], i;
      for (i = 0; i < seq.length; i++) {
        tone(ac, out, { t: t + i * 0.1, dur: 0.22, g: 0.3, type: 'square', f0: NOTE[seq[i]] });
        tone(ac, out, { t: t + i * 0.1, dur: 0.25, g: 0.25, type: 'triangle', f0: NOTE[seq[i]] * 2.005 });
      }
      ['C5', 'E5', 'G5', 'C6', 'E6'].forEach(function (n) { tone(ac, out, { t: t + 0.46, dur: 0.9, g: 0.17, type: 'triangle', f0: NOTE[n], vib: [6, 4] }); });
      tone(ac, out, { t: t + 0.46, dur: 0.9, g: 0.22, type: 'sawtooth', f0: NOTE.C4 });
      noise(ac, out, { t: t + 0.46, dur: 0.7, g: 0.12, type: 'highpass', f0: 6000 });
    },
    mutate: function (ac, out, t, o) {
      for (var i = 0; i < 9; i++) tone(ac, out, { t: t + i * 0.05, dur: 0.25, g: 0.16, type: 'triangle', f0: 600 * Math.pow(1.122, i * 2), vib: [12, 14] });
      noise(ac, out, { t: t, dur: 0.6, g: 0.1, a: 0.3, type: 'bandpass', f0: 3000, f1: 9000, q: 3 });
    },
    coin: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.09, g: 0.26, type: 'square', f0: 988 });
      tone(ac, out, { t: t + 0.075, dur: 0.3, g: 0.26, type: 'square', f0: 1319 });
    },
    click: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.05, g: 0.22, type: 'triangle', f0: 720, f1: 520 }); },
    tab: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.08, g: 0.2, type: 'triangle', f0: 480, f1: 820 }); },
    error: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.11, g: 0.2, type: 'square', f0: 190 });
      tone(ac, out, { t: t + 0.13, dur: 0.16, g: 0.2, type: 'square', f0: 150 });
    },
    count: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.16, g: 0.3, type: 'square', f0: 440 }); tone(ac, out, { t: t, dur: 0.16, g: 0.2, f0: 880 }); },
    go: function (ac, out, t, o) {
      ['C5', 'E5', 'G5'].forEach(function (n) { tone(ac, out, { t: t, dur: 0.5, g: 0.2, type: 'square', f0: NOTE[n] }); });
      noise(ac, out, { t: t, dur: 0.25, g: 0.2, type: 'highpass', f0: 4000 });
    },
    ko: function (ac, out, t, o) {
      SFX.heavy(ac, out, t, { vol: 1.1 });
      tone(ac, out, { t: t + 0.05, dur: 0.8, g: 0.3, type: 'sawtooth', f0: 520, f1: 50 });
      noise(ac, out, { t: t, dur: 0.7, g: 0.25, type: 'lowpass', f0: 3000, f1: 150 });
    },
    // 용암 풍덩 치이익
    lava: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.3, g: 0.5, f0: 190, f1: 50 });
      noise(ac, out, { t: t, dur: 1.0, g: 0.4, a: 0.03, type: 'highpass', f0: 2600 });
      noise(ac, out, { t: t, dur: 0.4, g: 0.35, type: 'lowpass', f0: 500, f1: 120 });
      tone(ac, out, { t: t + 0.12, dur: 0.14, g: 0.2, f0: 300, f1: 620 });
    },
    geyser: function (ac, out, t, o) {
      noise(ac, out, { t: t, dur: 0.9, g: 0.5, a: 0.12, type: 'bandpass', f0: 260, f1: 3200, q: 0.8 });
      noise(ac, out, { t: t, dur: 0.9, g: 0.3, a: 0.1, type: 'lowpass', f0: 180 });
      tone(ac, out, { t: t, dur: 0.5, g: 0.2, f0: 70, f1: 160 });
    },
    bubble: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.09, g: 0.16, f0: 220 + Math.random() * 200, f1: 620 + Math.random() * 300 }); },
    meteorFall: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.85, g: 0.2, a: 0.2, f0: 1900, f1: 260 });
      noise(ac, out, { t: t, dur: 0.85, g: 0.16, a: 0.4, type: 'bandpass', f0: 3000, f1: 600, q: 1.5 });
    },
    boom: function (ac, out, t, o) {
      SFX.heavy(ac, out, t, { vol: 1.15 });
      noise(ac, out, { t: t, dur: 0.75, g: 0.5, type: 'lowpass', f0: 1800, f1: 90 });
    },
    crumble: function (ac, out, t, o) {
      for (var i = 0; i < 7; i++) noise(ac, out, { t: t + i * 0.07 + Math.random() * 0.03, dur: 0.14, g: 0.3, type: 'lowpass', f0: 500 + Math.random() * 500, f1: 120 });
      tone(ac, out, { t: t, dur: 0.6, g: 0.3, f0: 80, f1: 34 });
    },
    warn: function (ac, out, t, o) {
      tone(ac, out, { t: t, dur: 0.1, g: 0.16, type: 'square', f0: 740 });
      tone(ac, out, { t: t + 0.13, dur: 0.12, g: 0.16, type: 'square', f0: 560 });
    },
    win: function (ac, out, t, o) {
      var seq = [['C5', 0], ['E5', 0.11], ['G5', 0.22], ['C6', 0.33], ['G5', 0.5], ['C6', 0.62]];
      seq.forEach(function (n) { tone(ac, out, { t: t + n[1], dur: n[1] > 0.6 ? 0.7 : 0.18, g: 0.26, type: 'square', f0: NOTE[n[0]] }); tone(ac, out, { t: t + n[1], dur: 0.2, g: 0.2, type: 'triangle', f0: NOTE[n[0]] / 2 }); });
      ['E5', 'G5'].forEach(function (n) { tone(ac, out, { t: t + 0.62, dur: 0.7, g: 0.15, type: 'triangle', f0: NOTE[n], vib: [7, 5] }); });
    },
    // 패배: 트롬본 와~ 와~ 와~ 와~
    lose: function (ac, out, t, o) {
      var fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 3; fl.connect(out);
      ['Bb3', 'A3', 'G3'].forEach(function (n, i) { tone(ac, out, { t: t + i * 0.32, dur: 0.3, g: 0.4, a: 0.04, type: 'sawtooth', f0: NOTE[n] * 1.03, f1: NOTE[n] * 0.97, out: fl }); });
      tone(ac, out, { t: t + 0.96, dur: 0.9, g: 0.42, a: 0.05, type: 'sawtooth', f0: NOTE.F3 * 1.04, f1: NOTE.F3 * 0.82, vib: [6, 7], out: fl });
    },
    eat: function (ac, out, t, o) {
      for (var i = 0; i < 3; i++) { noise(ac, out, { t: t + i * 0.13, dur: 0.06, g: 0.45, type: 'bandpass', f0: 1600 + i * 300, q: 1.5 }); tone(ac, out, { t: t + i * 0.13, dur: 0.07, g: 0.2, f0: 300, f1: 160 }); }
    },
    statup: function (ac, out, t, o) {
      ['E5', 'G5', 'C6'].forEach(function (n, i) { tone(ac, out, { t: t + i * 0.08, dur: 0.2, g: 0.24, type: 'triangle', f0: NOTE[n] }); });
    },
    smash: function (ac, out, t, o) {
      noise(ac, out, { t: t, dur: 0.3, g: 0.6, type: 'lowpass', f0: 4000, f1: 300 });
      tone(ac, out, { t: t, dur: 0.25, g: 0.6, f0: 160, f1: 40 });
      for (var i = 0; i < 4; i++) noise(ac, out, { t: t + 0.08 + i * 0.06, dur: 0.05, g: 0.22, type: 'bandpass', f0: 900 + Math.random() * 1500, q: 2 });
    },
    miss: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.3, g: 0.3, type: 'triangle', f0: 420, f1: 110, vib: [20, 35] }); },
    star: function (ac, out, t, o) { tone(ac, out, { t: t, dur: 0.12, g: 0.16, type: 'triangle', f0: 1500, f1: 2300 }); }
  };
  JG.SFX = SFX;

  /* ---------- 배경 음악: 16분음표 스텝 시퀀서 ---------- */
  var SONGS = {
    lab: { bpm: 104, vol: 0.5,
      lead: ['E4', 0, 'G4', 0, 'A4', 0, 'G4', 'E4', 0, 'D4', 0, 'E4', 'G4', 0, 0, 0, 'A4', 0, 'C5', 0, 'A4', 0, 'G4', 'E4', 0, 'G4', 0, 'D4', 'E4', 0, 0, 0],
      bass: ['C3', 0, 0, 0, 'C3', 0, 'G3', 0, 'A3', 0, 0, 0, 'A3', 0, 'E3', 0, 'F3', 0, 0, 0, 'F3', 0, 'C3', 0, 'G3', 0, 0, 0, 'G3', 0, 'D3', 0],
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], leadType: 'triangle' },
    arena: { bpm: 138, vol: 0.55,
      lead: ['A4', 0, 'A4', 'C5', 0, 'A4', 0, 'G4', 'A4', 0, 0, 'E4', 'G4', 0, 'A4', 0, 'C5', 0, 'C5', 'D5', 0, 'C5', 0, 'A4', 'G4', 0, 'E4', 0, 'G4', 'A4', 0, 0],
      bass: ['A3', 0, 'A3', 0, 0, 'A3', 0, 'A3', 'A3', 0, 'G3', 0, 0, 'G3', 'A3', 0, 'F3', 0, 'F3', 0, 0, 'F3', 0, 'F3', 'G3', 0, 'G3', 0, 'E3', 0, 'G3', 0],
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], hat: [0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1], leadType: 'square' }
  };
  function playStep(ac, out, song, step, t) {
    var sl = 60 / song.bpm / 4, n;
    n = song.lead[step % song.lead.length];
    if (n) tone(ac, out, { t: t, dur: sl * 1.8, g: 0.11, type: song.leadType, f0: NOTE[n] });
    n = song.bass[step % song.bass.length];
    if (n) tone(ac, out, { t: t, dur: sl * 1.6, g: 0.2, type: 'triangle', f0: NOTE[n] / 2 });
    if (song.kick[step % 16]) tone(ac, out, { t: t, dur: 0.14, g: 0.34, f0: 130, f1: 42 });
    if (song.hat[step % 16]) noise(ac, out, { t: t, dur: 0.035, g: 0.07, type: 'highpass', f0: 7000 });
    if (song === SONGS.arena && step % 32 >= 28) tone(ac, out, { t: t, dur: 0.12, g: 0.2, f0: 220 - (step % 4) * 30, f1: 90 });   // 탐탐 필인
  }

  /* ---------- 오디오 관리자 ---------- */
  var A = JG.Audio = {
    ctx: null, sfxOn: true, musicOn: true, last: {}, song: null, step: 0, nextT: 0, timer: null, played: 0,
    unlock: function () {
      try {
        if (!A.ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          A.ctx = new AC();
          var comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(A.ctx.destination);
          A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = 0.8; A.sfxGain.connect(comp);
          A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = 0.5; A.musicGain.connect(comp);
        }
        if (A.ctx.state === 'suspended') A.ctx.resume().catch(function () {});
        return true;
      } catch (e) { return false; }
    },
    play: function (name, opts) {
      if (!A.sfxOn || !A.ctx || !SFX[name]) return;
      var now = A.ctx.currentTime, key = name;
      if (A.last[key] && now - A.last[key] < 0.045) return;   // 같은 소리 겹침 방지
      A.last[key] = now;
      try { SFX[name](A.ctx, A.sfxGain, now + 0.005 + ((opts && opts.delay) || 0), opts || {}); A.played++; } catch (e) { /* 소리 실패는 게임을 멈추지 않는다 */ }
    },
    music: function (name) {
      A.want = name;
      if (A.timer) { clearInterval(A.timer); A.timer = null; }
      A.song = null;
      if (!name || !A.musicOn || !A.ctx) return;
      A.song = SONGS[name]; A.step = 0; A.nextT = A.ctx.currentTime + 0.08;
      A.musicGain.gain.value = A.song.vol;
      A.timer = setInterval(function () {
        if (!A.song || !A.ctx || A.ctx.state !== 'running') return;
        var sl = 60 / A.song.bpm / 4;
        if (A.nextT < A.ctx.currentTime) A.nextT = A.ctx.currentTime + 0.05;
        while (A.nextT < A.ctx.currentTime + 0.25) { try { playStep(A.ctx, A.musicGain, A.song, A.step, A.nextT); } catch (e) {} A.step++; A.nextT += sl; }
      }, 90);
    },
    setSfx: function (on) { A.sfxOn = on; },
    setMusic: function (on) { A.musicOn = on; if (on) A.music(A.want); else { var w = A.want; A.music(null); A.want = w; } },
    /* 점검용: 모든 효과음을 OfflineAudioContext로 렌더링해 실제로 소리가 나는지(RMS) 확인 */
    selfTest: function () {
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, names = Object.keys(SFX);
      return Promise.all(names.map(function (n) {
        var oc = new OAC(1, 44100 * 2, 44100);
        SFX[n](oc, oc.destination, 0.01, { size: 1 });
        return oc.startRendering().then(function (buf) {
          var d = buf.getChannelData(0), s = 0, pk = 0, bad = 0;
          for (var i = 0; i < d.length; i++) { var v = d[i]; if (v !== v) bad++; s += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); }
          return { name: n, rms: Math.sqrt(s / d.length), peak: pk, nan: bad };
        });
      }).concat(Object.keys(SONGS).map(function (k) {
        var oc = new OAC(1, 44100 * 4, 44100), song = SONGS[k], sl = 60 / song.bpm / 4;
        for (var i = 0; i < 32; i++) playStep(oc, oc.destination, song, i, 0.02 + i * sl);
        return oc.startRendering().then(function (buf) {
          var d = buf.getChannelData(0), s = 0, pk = 0;
          for (var i = 0; i < d.length; i++) { s += d[i] * d[i]; if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); }
          return { name: 'music:' + k, rms: Math.sqrt(s / d.length), peak: pk, nan: 0 };
        });
      })));
    }
  };
})();
