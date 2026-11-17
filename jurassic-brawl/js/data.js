/* 쥬라기 유전자 막싸움 — 게임 데이터 (종, 파츠, 기술, 도감, 돌연변이, 먹이, 스테이지) */
(function () {
  'use strict';
  var JG = window.JG = window.JG || {};

  JG.SLOTS = ['head', 'body', 'arms', 'legs'];
  JG.SLOT_LABEL = { head: '머리', body: '몸통', arms: '팔·날개', legs: '다리·꼬리' };
  JG.STAT_LABEL = { pow: '힘', bnc: '탄성', wgt: '무게', spd: '민첩' };
  JG.STAT_ICON = { pow: 'zap', bnc: 'orbit', wgt: 'weight', spd: 'feather' };
  JG.TRAIN_CAP = 5;      // 스탯별 훈련 보너스 상한
  JG.ROSTER_CAP = 18;    // 보유 공룡 상한
  JG.BREED_COST = 20;
  JG.LOCK_COST = 10;

  /* ---------- 기본 공룡 6종 ----------
     colors: [h, s, l]  /  각 파츠는 스탯 기여도와 기술 id를 가진다 */
  JG.SPECIES = {
    trex: {
      id: 'trex', name: '티라노사우루스', short: '티라노',
      syl: { head: '티라', body: '노', legs: '사우루스' },
      skin: [96, 44, 47], accent: [8, 72, 50],
      blurb: '섬의 폭군. 턱 힘은 최강인데 팔이 짧아서 등을 못 긁는다.',
      head: { label: '폭군의 턱', move: 'bite', pow: 4, wgt: 2 },
      body: { label: '근육질 몸통', wgt: 4, bnc: 2, spd: 1, hp: 3 },
      arms: { label: '쬐끄만 앞발', move: 'tiny', pow: 1, spd: 1, epithet: '팔 짧은' },
      legs: { label: '폭군 다리와 묵직한 꼬리', move: 'heavy', pow: 3, spd: 3, bnc: 2, wgt: 2 }
    },
    trice: {
      id: 'trice', name: '트리케라톱스', short: '트리케라',
      syl: { head: '트리', body: '케라', legs: '톱스' },
      skin: [204, 42, 52], accent: [32, 85, 58],
      blurb: '세 뿔 달린 전차. 일단 들이받고 나서 생각한다.',
      head: { label: '세 뿔 방패 머리', move: 'horn', pow: 3, wgt: 2 },
      body: { label: '통통한 전차 몸통', wgt: 5, bnc: 1, spd: 0, hp: 5 },
      arms: { label: '뭉툭한 앞다리', move: 'shove', pow: 2, spd: 0, epithet: '어깨 넓은' },
      legs: { label: '짧고 굵은 다리와 몽당 꼬리', move: 'stub', pow: 1, spd: 2, bnc: 1, wgt: 3 }
    },
    ptera: {
      id: 'ptera', name: '프테라노돈', short: '프테라',
      syl: { head: '프테', body: '라노', legs: '돈' },
      skin: [20, 78, 58], accent: [348, 70, 52],
      blurb: '하늘의 뺀질이. 가볍고 빠르지만 바람 불면 같이 날아간다.',
      head: { label: '볏 달린 긴 부리', move: 'peck', pow: 2, wgt: 0 },
      body: { label: '깃털처럼 가벼운 몸통', wgt: 1, bnc: 3, spd: 3, hp: 0 },
      arms: { label: '커다란 날개', move: 'wing', pow: 2, spd: 2, epithet: '날개 달린', wing: true },
      legs: { label: '가느다란 다리와 짧은 꼬리', move: 'flick', pow: 1, spd: 3, bnc: 3, wgt: 1 }
    },
    pachy: {
      id: 'pachy', name: '파키케팔로사우루스', short: '파키케팔로',
      syl: { head: '파키', body: '케팔로', legs: '사우루스' },
      skin: [276, 38, 58], accent: [44, 88, 60],
      blurb: '돌머리 박치기 장인. 문은 손잡이 대신 머리로 연다.',
      head: { label: '단단한 돌머리', move: 'butt', pow: 4, wgt: 1 },
      body: { label: '탱탱한 몸통', wgt: 2, bnc: 5, spd: 2, hp: 1 },
      arms: { label: '주먹 쥔 짧은 팔', move: 'jab', pow: 2, spd: 1, epithet: '주먹 쥔' },
      legs: { label: '스프링 다리와 균형 꼬리', move: 'spring', pow: 2, spd: 3, bnc: 5, wgt: 1 }
    },
    stego: {
      id: 'stego', name: '스테고사우루스', short: '스테고',
      syl: { head: '스테', body: '고', legs: '사우루스' },
      skin: [50, 66, 50], accent: [14, 80, 52],
      blurb: '머리는 호두만 한데 꼬리 가시는 흉기다. 느긋하게 걷다가 한 방에 끝낸다.',
      head: { label: '호두만 한 머리', move: 'bonk', pow: 1, wgt: 0 },
      body: { label: '골판 돋은 몸통', wgt: 4, bnc: 2, spd: 0, hp: 4 },
      arms: { label: '기둥 같은 앞다리', move: 'stomp', pow: 2, spd: 0, epithet: '기둥 팔' },
      legs: { label: '기둥 다리와 가시 꼬리', move: 'spike', pow: 4, spd: 1, bnc: 1, wgt: 3 }
    },
    raptor: {
      id: 'raptor', name: '벨로시랩터', short: '랩터',
      syl: { head: '벨로', body: '시', legs: '랩터' },
      skin: [170, 52, 40], accent: [352, 78, 55],
      blurb: '깃털 달린 날쌘돌이. 빠르고 영리한데 자기 꼬리에 자주 놀란다.',
      head: { label: '날카로운 주둥이', move: 'snap', pow: 3, wgt: 1 },
      body: { label: '날렵한 깃털 몸통', wgt: 2, bnc: 3, spd: 3, hp: 1 },
      arms: { label: '갈고리 발톱 팔', move: 'claw', pow: 3, spd: 2, epithet: '할퀴는' },
      legs: { label: '질주 다리와 채찍 꼬리', move: 'whip', pow: 2, spd: 5, bnc: 3, wgt: 1 }
    }
  };
  JG.SPECIES_IDS = ['trex', 'trice', 'ptera', 'pachy', 'stego', 'raptor'];

  /* ---------- 기술 ----------
     slot: head | arms | tail
     dmg 피해, kb 넉백(px/tick), up 띄우기 비율, cd 재사용(tick), wind 준비, act 판정 지속,
     reach 판정 반경 보정, lunge 돌진 속도 */
  JG.MOVES = {
    // 머리 기술 (공격 1)
    bite:  { slot: 'head', name: '와작 물어뜯기', dmg: 15, kb: 7,  up: 0.35, cd: 46, wind: 6, act: 9,  reach: 12, lunge: [13, 5],  words: ['와작!', '콱!'], sfx: 'bite' },
    horn:  { slot: 'head', name: '세 뿔 돌진',    dmg: 12, kb: 12, up: 0.30, cd: 66, wind: 8, act: 15, reach: 14, lunge: [9, 11],  words: ['쿠웅!', '들이받기!'], sfx: 'heavy', charge: true },
    peck:  { slot: 'head', name: '부리 쪼기',     dmg: 6,  kb: 3.5, up: 0.2, cd: 20, wind: 3, act: 6,  reach: 22, lunge: [12, 2],  words: ['콕!', '콕콕!'], sfx: 'peck' },
    butt:  { slot: 'head', name: '돌머리 박치기', dmg: 13, kb: 14, up: 0.40, cd: 54, wind: 7, act: 10, reach: 10, lunge: [16, 8],  words: ['박치기!', '쾅!'], sfx: 'heavy' },
    bonk:  { slot: 'head', name: '꿀밤 박기',     dmg: 5,  kb: 4,  up: 0.25, cd: 30, wind: 4, act: 7,  reach: 6,  lunge: [9, 3],   words: ['꽁!', '톡!'], sfx: 'peck' },
    snap:  { slot: 'head', name: '연속 깨물기',   dmg: 7,  kb: 4,  up: 0.2,  cd: 17, wind: 3, act: 6,  reach: 10, lunge: [12, 4],  words: ['냠!', '깨물!'], sfx: 'bite' },
    // 팔·날개 기술 (공격 3)
    tiny:  { slot: 'arms', name: '깨작 할퀴기',   dmg: 3,  kb: 2,  up: 0.2,  cd: 15, wind: 2, act: 5,  reach: 26, words: ['깨작', '간질간질'], sfx: 'peck' },
    shove: { slot: 'arms', name: '어깨 밀치기',   dmg: 5,  kb: 11, up: 0.15, cd: 48, wind: 6, act: 8,  reach: 40, words: ['으랏차!', '밀쳐!'], sfx: 'hit' },
    wing:  { slot: 'arms', name: '날개 싸대기',   dmg: 6,  kb: 9,  up: 0.45, cd: 40, wind: 5, act: 8,  reach: 62, words: ['철썩!', '펄럭!'], sfx: 'slap', gust: true },
    jab:   { slot: 'arms', name: '원투 잽',       dmg: 6,  kb: 5,  up: 0.15, cd: 18, wind: 2, act: 5,  reach: 36, words: ['잽!', '퍽!'], sfx: 'hit' },
    stomp: { slot: 'arms', name: '기둥 찍기',     dmg: 9,  kb: 6,  up: -0.6, cd: 48, wind: 7, act: 8,  reach: 40, words: ['쿵!', '찍!'], sfx: 'heavy', stun: 22 },
    claw:  { slot: 'arms', name: '갈고리 할퀴기', dmg: 10, kb: 5,  up: 0.25, cd: 25, wind: 3, act: 6,  reach: 46, words: ['샥!', '촤악!'], sfx: 'slash' },
    // 꼬리 기술 (공격 2) — 온몸을 돌려 꼬리로 후려친다
    heavy: { slot: 'tail', name: '묵직 꼬리치기',     dmg: 11, kb: 11, up: 0.4, cd: 60, wind: 5, act: 22, reach: 10, spin: 0.36, words: ['휘익 쾅!', '후려치기!'], sfx: 'heavy' },
    stub:  { slot: 'tail', name: '엉덩이 돌려치기',   dmg: 7,  kb: 10, up: 0.3, cd: 48, wind: 4, act: 18, reach: 22, spin: 0.40, words: ['엉덩이!', '뿌직!'], sfx: 'hit' },
    flick: { slot: 'tail', name: '꼬리 찰싹',         dmg: 4,  kb: 4,  up: 0.3, cd: 28, wind: 3, act: 16, reach: 8,  spin: 0.46, words: ['찰싹!'], sfx: 'slap' },
    spring:{ slot: 'tail', name: '스프링 꼬리',       dmg: 7,  kb: 9,  up: 0.7, cd: 42, wind: 4, act: 18, reach: 10, spin: 0.42, words: ['띠용!', '튕!'], sfx: 'boing', hop: 4 },
    spike: { slot: 'tail', name: '가시 꼬리 후려치기', dmg: 17, kb: 10, up: 0.35, cd: 72, wind: 6, act: 24, reach: 18, spin: 0.34, words: ['푹!', '가시다!'], sfx: 'slash' },
    whip:  { slot: 'tail', name: '채찍 꼬리',         dmg: 8,  kb: 6,  up: 0.3, cd: 30, wind: 3, act: 16, reach: 10, spin: 0.48, words: ['촤악!', '휙!'], sfx: 'slash' }
  };

  /* ---------- 돌연변이 ---------- */
  JG.MUTATIONS = {
    golden:  { id: 'golden',  name: '황금 껍질', desc: '온몸이 금빛으로 번쩍인다. 투기장 상금이 1.5배.', bonus: { bnc: 1 }, hint: '교배 중 아주 드물게 나타난다. 번쩍인다.' },
    lava:    { id: 'lava',    name: '용암 피부', desc: '갈라진 틈으로 용암이 흐른다. 라운드마다 한 번, 용암에 빠져도 튕겨 나온다.', bonus: { pow: 1 }, hint: '화산의 기운을 받은 알에서 나온다.' },
    giant:   { id: 'giant',   name: '거대화',   desc: '덩치가 1.3배. 무겁고 세지만 굼뜨다.', bonus: { pow: 2, wgt: 3, spd: -2 }, hint: '너무 잘 먹고 자란 것 같다.' },
    mini:    { id: 'mini',    name: '꼬마화',   desc: '덩치가 0.72배. 잽싸지만 잘 날아간다.', bonus: { spd: 3, wgt: -2, bnc: 1 }, hint: '주머니에 들어갈 것 같다.' },
    jelly:   { id: 'jelly',   name: '젤리 몸',  desc: '온몸이 말랑말랑. 맞으면 잘 튕기지만 피해는 덜 받는다.', bonus: { bnc: 4 }, hint: '만지면 출렁거린다.' },
    rainbow: { id: 'rainbow', name: '무지개 비늘', desc: '색이 계속 바뀐다. 모든 스탯 +1.', bonus: { pow: 1, bnc: 1, wgt: 1, spd: 1 }, hint: '비 온 뒤 화산에 뜬 무지개를 본 적 있는가.' }
  };
  JG.MUTATION_IDS = ['golden', 'lava', 'giant', 'mini', 'jelly', 'rainbow'];
  JG.MUTATION_CHANCE = 0.1;

  /* ---------- 도감 ----------
     순종 6 + 혼종(두 종 조합) 15 + 다종 2 + 전설 7 + 돌연변이 6 = 36 */
  var PAIRS = [
    ['trex', 'trice', '티라케라톱스', '뿔 달린 폭군. 물고 받고 다 한다.'],
    ['trex', 'ptera', '티라노돈', '하늘을 나는 폭군. 팔이 짧은 한을 날개로 풀었다.'],
    ['trex', 'pachy', '파키라노', '머리가 단단한 폭군. 머리를 많이 쓴다. 물리적으로.'],
    ['trex', 'stego', '스테고렉스', '등에 골판을 두른 폭군. 뒤에서 덮치면 따갑다.'],
    ['trex', 'raptor', '랩토렉스', '빠른데 크다. 반칙이다.'],
    ['trice', 'ptera', '트리케라돈', '세 뿔로 급강하한다. 착륙은 아직 못 배웠다.'],
    ['trice', 'pachy', '파키케라톱스', '뿔과 돌머리의 만남. 두통약이 필요 없다.'],
    ['trice', 'stego', '스테고톱스', '앞은 뿔, 뒤는 가시. 안아 줄 방법이 없다.'],
    ['trice', 'raptor', '랩토케라', '방패를 든 사냥꾼. 정면 승부만 고집한다.'],
    ['ptera', 'pachy', '파키라노돈', '날아다니며 박치기를 꽂는 하늘의 돌머리.'],
    ['ptera', 'stego', '스테고돈', '가시 꼬리를 단 비행체. 꼬리가 무거워 자꾸 뒤로 난다.'],
    ['ptera', 'raptor', '랩토라노돈', '깃털과 날개를 다 가진 욕심쟁이.'],
    ['pachy', 'stego', '스테고케팔로', '박치기로 열고 가시 꼬리로 닫는다.'],
    ['pachy', 'raptor', '파키랩터', '달려와서 박는다. 그게 전부인데 강하다.'],
    ['stego', 'raptor', '스테고랩터', '가시 꼬리가 달린 달리기 선수.']
  ];
  var LEGENDS = [
    { id: 'L_skyrock', name: '하늘의 돌머리', need: { head: 'pachy', arms: 'ptera' }, bonus: { pow: 2 }, special: '급강하 박치기',
      desc: '높이 날아올라 돌머리로 내리꽂는다. 연구소 지붕에 구멍이 세 개 났다.', hint: '돌머리에 날개를 달아 보자.' },
    { id: 'L_skytyrant', name: '하늘 폭군', need: { head: 'trex', arms: 'ptera' }, bonus: { pow: 1, spd: 1 }, special: '공중 와작',
      desc: '폭군의 턱이 하늘에서 내려온다. 우산은 소용없다.', hint: '폭군의 턱이 하늘을 난다면?' },
    { id: 'L_lavatank', name: '용암 전차', need: { head: 'trice', body: 'stego', legs: 'trex' }, bonus: { wgt: 2, pow: 1 }, special: '무한궤도 돌진',
      desc: '뿔, 골판, 폭군의 다리. 밀어도 밀리지 않는다.', hint: '세 뿔 머리 + 골판 몸통 + 폭군의 다리.' },
    { id: 'L_spintop', name: '가시 팽이', need: { body: 'ptera', legs: 'stego' }, bonus: { spd: 2 }, special: '가시 회오리',
      desc: '가벼운 몸에 무거운 가시 꼬리. 한번 돌기 시작하면 본인도 못 멈춘다.', hint: '가장 가벼운 몸통에 가장 아픈 꼬리를.' },
    { id: 'L_springhorn', name: '스프링 뿔탄', need: { head: 'trice', legs: 'pachy' }, bonus: { bnc: 2 }, special: '통통 뿔 돌진',
      desc: '튀어 오른 뒤 뿔부터 떨어진다. 어디로 튈지는 본인도 모른다.', hint: '세 뿔 머리에 스프링 다리.' },
    { id: 'L_bladedancer', name: '칼날 무용수', need: { body: 'ptera', arms: 'raptor', legs: 'pachy' }, bonus: { spd: 1, pow: 1 }, special: '갈고리 왈츠',
      desc: '가볍게 뛰어올라 발톱으로 춤춘다. 박자는 엉망이다.', hint: '가벼운 몸통 + 갈고리 발톱 + 스프링 다리.' },
    { id: 'L_final', name: '쥬라기 끝판왕', need: { head: 'trex', body: 'trice', arms: 'raptor', legs: 'stego' }, bonus: { pow: 2, wgt: 1, spd: 1, bnc: 1 }, special: '끝판왕의 품격',
      desc: '턱, 전차 몸통, 갈고리, 가시 꼬리. 모든 것이 과하다.', hint: '가장 센 머리, 가장 무거운 몸, 가장 날카로운 팔, 가장 아픈 꼬리.' }
  ];

  var DEX = [];
  JG.SPECIES_IDS.forEach(function (sid) {
    var sp = JG.SPECIES[sid];
    DEX.push({ id: 'S_' + sid, kind: 'pure', name: sp.name, desc: sp.blurb, formula: [sid], hint: '기본 공룡',
      sample: { head: sid, body: sid, arms: sid, legs: sid } });
  });
  PAIRS.forEach(function (p) {
    DEX.push({ id: 'P_' + p[0] + '_' + p[1], kind: 'pair', name: p[2], desc: p[3], formula: [p[0], p[1]],
      hint: JG.SPECIES[p[0]].name + ' × ???',
      sample: { head: p[0], body: p[1], arms: p[1], legs: p[0] } });
  });
  DEX.push({ id: 'X_trio', kind: 'multi', name: '삼종 잡탕', desc: '세 종의 유전자가 한 몸에. 족보를 그리려면 종이가 모자란다.', formula: [], hint: '세 종의 파츠를 한 몸에 모아 보자.',
    sample: { head: 'pachy', body: 'trex', arms: 'ptera', legs: 'trex' } });
  DEX.push({ id: 'X_chimera', kind: 'multi', name: '사종 키메라', desc: '머리, 몸통, 팔, 다리가 전부 다른 종. 거울을 볼 때마다 놀란다.', formula: [], hint: '네 부위가 전부 다른 종이면?',
    sample: { head: 'trice', body: 'stego', arms: 'ptera', legs: 'raptor' } });
  LEGENDS.forEach(function (L) {
    var s = { head: 'trex', body: 'trex', arms: 'trex', legs: 'trex' };
    // 지정되지 않은 부위는 지정된 부위 중 하나로 채워 견본을 만든다
    var first = L.need.head || L.need.body || L.need.arms || L.need.legs;
    JG.SLOTS.forEach(function (k) { s[k] = L.need[k] || first; });
    DEX.push({ id: L.id, kind: 'legend', name: L.name, desc: L.desc, hint: L.hint, need: L.need, bonus: L.bonus, special: L.special, formula: [], sample: s });
  });
  JG.MUTATION_IDS.forEach(function (mid) {
    var m = JG.MUTATIONS[mid];
    DEX.push({ id: 'M_' + mid, kind: 'mut', name: m.name, desc: m.desc, hint: m.hint, mut: mid, formula: [],
      sample: { head: 'pachy', body: 'pachy', arms: 'pachy', legs: 'pachy' } });
  });
  JG.DEX = DEX;
  JG.DEX_BY_ID = {};
  DEX.forEach(function (e) { JG.DEX_BY_ID[e.id] = e; });
  JG.LEGENDS = LEGENDS;
  JG.DEX_KIND_LABEL = { pure: '순종', pair: '혼종', multi: '다종 혼합', legend: '전설 조합', mut: '돌연변이' };

  /* ---------- 먹이 ---------- */
  JG.FOODS = [
    { id: 'steak',  name: '화산 구이 스테이크', icon: 'beef', cost: 15, give: { pow: 1 }, wgt: 1,  note: '힘 +1, 무게 +1', say: '와구와구!' },
    { id: 'fern',   name: '고사리 젤리',       icon: 'leaf', cost: 15, give: { bnc: 1 }, wgt: -1, note: '탄성 +1, 무게 -1', say: '탱글탱글!' },
    { id: 'bug',    name: '번개 메뚜기',       icon: 'bug',  cost: 15, give: { spd: 1 }, wgt: 0,  note: '민첩 +1', say: '찌릿찌릿!' }
  ];

  /* ---------- 스테이지 ---------- */
  JG.STAGES = [
    { id: 'cliff',  name: '무너지는 화산 절벽', icon: 'mountain', desc: '바깥쪽 바닥부터 차례로 무너진다. 가운데를 차지하라.' },
    { id: 'geyser', name: '간헐천 분지',       icon: 'droplets', desc: '세 구멍에서 번갈아 물기둥이 솟는다. 위에 서 있으면 하늘 구경.' },
    { id: 'meteor', name: '운석 비탈',         icon: 'flame',    desc: '운석이 떨어져 비탈을 굴러 내려온다. 그림자를 보고 피하라.' }
  ];

  /* ---------- 챔피언십 리그 ---------- */
  JG.TOUR = [
    { round: '8강전', stage: 'cliff',  diff: 1, prize: 60 },
    { round: '준결승', stage: 'geyser', diff: 2, prize: 120 },
    { round: '결승전', stage: 'meteor', diff: 3, prize: 250 }
  ];
  JG.DIFF_LABEL = ['', '순한맛', '보통맛', '매운맛'];
  JG.PRACTICE_PRIZE = [0, 25, 40, 60];
  JG.RIVAL_TITLES = ['용암 깡패', '분화구 불주먹', '절벽 끝 승부사', '화산재 먹보', '간헐천 온천객', '운석 수집가', '백악기 싸움닭', '섬마을 골목대장', '고사리밭 무법자'];

  /* 타격 글자 */
  JG.WORDS_SLAM = ['퍽!', '쿵!', '툭!'];
  JG.WORDS_KO = ['K.O.!', '기절!', '뻗었다!'];
  JG.WORDS_LAVA = ['앗 뜨거!', '풍덩!', '용암 온천!'];
})();
