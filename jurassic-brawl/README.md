# 쥬라기 유전자 막싸움 (가제)

공룡을 교배해 혼종을 만들고, 흐물흐물한 래그돌 물리 투기장에서 막싸움을 벌이는 웹 게임.
빌드 과정 없이 브라우저에서 바로 돈다.

## 실행 방법

### 1. 로컬 서버로 실행 (권장)

이 폴더에서 아래 중 하나를 실행한 뒤 브라우저로 `http://localhost:8000` 을 연다.

```bash
python3 -m http.server 8000      # macOS / Linux
py -m http.server 8000           # Windows
npx serve -l 8000                # Node.js가 있을 때
```

### 2. 파일을 바로 열기

`index.html` 을 더블클릭해도 된다. ES 모듈이나 fetch를 쓰지 않아서 `file://` 에서도 그대로 돈다.

인터넷이 연결되어 있으면 Matter.js(cdnjs)와 글꼴(Google Fonts)을 CDN에서 받는다.
연결이 없으면 물리 엔진은 `vendor/matter.min.js` 사본으로 대신하고, 글꼴은 시스템 글꼴로 나온다.

## 조작

| | 이동 | 점프·날갯짓 | 머리 기술 | 꼬리 후려치기 | 팔·날개 기술 |
|---|---|---|---|---|---|
| 혼자 할 때 | `A` `D` 또는 `←` `→` | `W` / `Space` / `↑` | `J` (좌클릭) | `K` (우클릭) | `L` |
| 2인 대전 1P | `A` `D` | `W` | `F` | `G` | `H` |
| 2인 대전 2P | `←` `→` | `↑` | `,` | `.` | `/` |

- 날개 파츠가 있으면 공중에서 점프 키로 날갯짓(5회), 누르고 있으면 활공한다.
- 공중에서 머리 기술을 쓰면 급강하 공격이 된다.
- 맞을수록 더 멀리 날아간다. 상대를 용암에 빠뜨리거나 체력을 다 깎으면 라운드 승리(3판 2선승).
- `Esc` 일시정지. 터치 기기에서는 화면 버튼이 나온다.

## 게임 흐름

1. **교배소** — 두 공룡을 교배기에 넣으면 머리 / 몸통 / 팔·날개 / 다리·꼬리가 부모에게서 하나씩 유전된다. 상금을 더 내면 부위를 고정할 수 있고, 가끔 돌연변이가 나온다.
2. **훈련장** — 먹이 주기, 바위 부수기(타이밍), 운석 피하기(좌우 이동)로 스탯을 올린다.
3. **투기장** — 연습 경기, 챔피언십 리그(8강 → 준결승 → 결승, 우승하면 희귀 알), 2인 대전.
4. **유전자 도감** — 순종 6 + 혼종 15 + 다종 2 + 전설 7 + 돌연변이 6 = 36칸. 카드마다 조합 공식·스탯·특수기가 나오고 텍스트/이미지 카드로 공유할 수 있다.

진행 상황은 브라우저 LocalStorage(`jurassic-brawl-save-v1`)에 저장된다.

## 폴더 구조

```
index.html
css/style.css
js/data.js      종·파츠·기술·도감·돌연변이·스테이지 데이터
js/dino.js      유전(교배·스탯·도감 판정), 파츠 치수, 포즈, 모듈형 Canvas 렌더러
js/fighter.js   Matter.js 래그돌(관절 Constraint + 각도 스프링), 공격 판정, CPU
js/arena.js     스테이지 기믹, 라운드 진행, 입력, 타격 연출, 투기장 렌더링
js/audio.js     Web Audio API 효과음·배경 음악 합성
js/fx.js        파티클, 만화 글자, 화면 흔들림
js/train.js     훈련 미니게임
js/ui.js        화면, 저장, 보상 흐름
js/icons.js     Lucide 아이콘(필요한 것만 인라인)
vendor/matter.min.js   CDN을 못 쓸 때 쓰는 Matter.js 사본
```

## 쓰인 오픈소스

- [Matter.js](https://brm.io/matter-js/) 0.20.0 — MIT License, Liam Brummitt
- [Lucide](https://lucide.dev) 아이콘 — ISC License
- [Bagel Fat One](https://fonts.google.com/specimen/Bagel+Fat+One), [Jua](https://fonts.google.com/specimen/Jua) — SIL Open Font License (Google Fonts)

그림(공룡 파츠, 배경)과 소리는 전부 코드로 그리고 합성한다. 이미지·음원 파일은 없다.
