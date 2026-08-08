/* ══════════════════════════════════════════════════════════════
   8BIT AGENCY — ізометричний офіс + автономні агенти
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ─────────────────────────────────────────────────────────────
   1. ГЕОМЕТРІЯ СЦЕНИ
   Сцена малюється у фіксованих «логічних» координатах, а потім
   масштабується під будь-який екран — тому композиція однакова
   і на телефоні, і на десктопі.
   ───────────────────────────────────────────────────────────── */
const TW = 24;    // пів-ширина тайла
const TH = 12;    // пів-висота тайла
const GW = 8;     // тайлів по gx (вправо-вниз)
const GH = 6;     // тайлів по gy (вліво-вниз)
const WH = 80;    // висота стін
const PAD = 14;

const OX = GH * TW + PAD;             // 158
const OY = WH + PAD;                  // 94
const SCENE_W = (GW + GH) * TW + PAD * 2;   // 364
const SCENE_H = (GW + GH) * TH + WH + PAD * 2; // 276

/** тайл → логічний піксель (точка на підлозі) */
const s = (gx, gy) => ({ x: OX + (gx - gy) * TW, y: OY + (gx + gy) * TH });
/** точка на ЛІВІЙ стіні: d — вздовж gy, h — висота над підлогою */
const wL = (d, h) => ({ x: OX - d * TW, y: OY + d * TH - h });
/** точка на ПРАВІЙ стіні: d — вздовж gx, h — висота над підлогою */
const wR = (d, h) => ({ x: OX + d * TW, y: OY + d * TH - h });

/* ─────────────────────────────────────────────────────────────
   2. ПАЛІТРА — теплий cozy pixel art
   ───────────────────────────────────────────────────────────── */
const C = {
  bg:        '#FFF6EA',
  bgVignette:'#F6E6D2',
  shadow:    'rgba(120, 88, 64, .13)',

  wallL:     '#FFE9CC',
  wallLtop:  '#FFF1DE',
  wallR:     '#F7D9AE',
  wallRtop:  '#FFE6C2',
  skirt:     '#C89B6A',
  skirtDk:   '#A87A4E',

  floorA:    '#DCA96F',
  floorB:    '#CE9860',
  floorLine: 'rgba(150, 104, 62, .30)',
  sun:       'rgba(255, 214, 130, .30)',
  sunHot:    'rgba(255, 226, 160, .28)',

  frame:     '#8D6748',
  frameDk:   '#6E4E33',
  sky:       '#AEDCF0',
  skyLo:     '#CDEBF8',
  glass:     'rgba(255,255,255,.28)',
  curtain:   '#F2B8C6',
  curtainDk: '#DE9AAC',

  board:     '#FBF7F0',
  boardInk:  '#C3AE9A',
  boardRed:  '#E07A6A',

  wood:      '#B4835A',
  woodTop:   '#C79B6E',
  woodDk:    '#8B6039',
  woodDkr:   '#70492A',

  metal:     '#8C9AA3',
  metalDk:   '#6B7880',
  metalTop:  '#A4B1B8',

  screen:    '#2E4A3C',
  screenOn:  '#7FCB94',
  screenOn2: '#A8DDB6',

  rug:       '#9EB8B0',
  rugIn:     '#BCD0C8',
  rugEdge:   '#7D9A92',

  plant:     '#6DAE5F',
  plantDk:   '#4C8842',
  plantLt:   '#8FC97F',
  pot:       '#D98A63',
  potDk:     '#B96A45',
  potTop:    '#E39C76',

  paper:     '#FFFDF5',
  mug:       '#FFFFFF',
  mugDk:     '#E4E4E4',
  coffee:    '#6B4226',

  cat:       '#F0A860',
  catDk:     '#D2853F',
  catLt:     '#FFC489',
  ink:       '#4E342E',

  book: ['#E07A6A', '#7BA7D4', '#F0C05A', '#8FC97F', '#B98FD0', '#E39C76'],
};

/* ─────────────────────────────────────────────────────────────
   3. СПРАЙТИ ПЕРСОНАЖІВ (12×18 пікселів)
   ───────────────────────────────────────────────────────────── */
const BODY = {
  max: [
    '....hhhh....',
    '..hhhhhhhh..',
    '..hHHHHHHh..',
    '..hSSSSSSh..',
    '..SSSSSSSS..',
    '..SEESSEES..',
    '..SSSSSSSS..',
    '..SSSMMSSS..',
    '..cWWAAWWc..',
    '.CCCCAACCCC.',
    '.CCCCAACCCC.',
    '.SCCCAACCCS.',
    '..cCCCCCCc..',
    '..CCCCCCCC..',
  ],
  pixel: [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '.hhHHHHHHhh.',
    '..AAAAAAAA..',
    '..SSSSSSSS..',
    '..SEESSEES..',
    '..SSSSSSSS..',
    '..SSMMMMSS..',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    '.CCCCAACCCC.',
    '.SCCCAACCCS.',
    '..CCCCCCCC..',
    '..cCCCCCCc..',
  ],
  vera: [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '.hhHHHHHHhh.',
    '.hhSSSSSShh.',
    '.hSSSSSSSSh.',
    '.hGGESSEGGh.',
    '.hSSSSSSSSh.',
    '.hSSSMMSSSh.',
    '.hcCCCCCCch.',
    '.CCCCCCCCCC.',
    '.CCCCccCCCC.',
    '.SCCCccCCCS.',
    '..CCCCCCCC..',
    '..cCCCCCCc..',
  ],
};

const LEGS = [
  [ '...PPPPPP...', '...PP..PP...', '...PP..PP...', '..BBB..BBB..' ],
  [ '...PPPPPP...', '..PP...PP...', '..PP....PP..', '.BBB....BBB.' ],
];

const PAL = {
  max:   { h:'#4E342E', H:'#6D4C41', S:'#FFCC80', E:'#3E2723', M:'#B03A2E',
           c:'#A31E1E', C:'#D94A44', A:'#F0C05A', W:'#FFF6E2', P:'#4A5C68', B:'#3E2723' },
  pixel: { h:'#5E35B1', H:'#7E57C2', S:'#FFCC80', E:'#3E2723', M:'#AD1457',
           c:'#6A1B9A', C:'#A75BC0', A:'#F0C05A', W:'#FFFFFF', P:'#2A63A8', B:'#F4F4F4' },
  vera:  { h:'#E06A20', H:'#F58F3C', S:'#FFCC80', E:'#3E2723', M:'#B03A6A',
           c:'#00695C', C:'#33A597', A:'#F0C05A', W:'#FFFFFF', P:'#3B4A52', B:'#3E2723',
           G:'#8FA6B0' },
};

const NAMES = { max: 'МАКС', pixel: 'ПІКСЕЛЬ', vera: 'ВІРА' };
const ROLES = { max: 'strategist', pixel: 'designer', vera: 'copywriter' };
const IDS = ['max', 'pixel', 'vera'];

/* ─────────────────────────────────────────────────────────────
   4. ПОЗИЦІЇ
   ───────────────────────────────────────────────────────────── */
const DESKS = {
  max:   { gx: 0.75, gy: 1.05 },
  pixel: { gx: 3.15, gy: 1.05 },
  vera:  { gx: 5.55, gy: 1.05 },
};
const DESK_W = 1.55, DESK_D = 0.9, DESK_H = 16;
const SPOTS = {
  max:   { desk: { gx: DESKS.max.gx   + .7, gy: 0.6 }, table: { gx: 1.70, gy: 4.20 } },
  pixel: { desk: { gx: DESKS.pixel.gx + .7, gy: 0.6 }, table: { gx: 3.40, gy: 2.95 } },
  vera:  { desk: { gx: DESKS.vera.gx  + .7, gy: 0.6 }, table: { gx: 5.30, gy: 4.95 } },
};

const chars = {};
IDS.forEach(id => {
  const p = SPOTS[id].desk;
  chars[id] = { gx: p.gx, gy: p.gy, tx: p.gx, ty: p.gy, at: 'desk' };
});

/* ─────────────────────────────────────────────────────────────
   5. КАНВАС + FIT-ТРАНСФОРМ
   ───────────────────────────────────────────────────────────── */
let cv, ctx, S = 1, TX = 0, TY = 0, DPR = 1;

function initCanvas() {
  cv = document.getElementById('office');
  ctx = cv.getContext('2d');
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(document.getElementById('stage'));
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
}

function fit() {
  const st = document.getElementById('stage');
  const w = st.clientWidth || 320;
  const h = st.clientHeight || 240;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * DPR);
  cv.height = Math.round(h * DPR);

  const raw = Math.min(w / SCENE_W, h / SCENE_H);
  S = Math.max(0.7, Math.floor(raw * 4) / 4);   // кроки по чверті → чіткі пікселі
  TX = (w - SCENE_W * S) / 2;
  TY = (h - SCENE_H * S) / 2;
}

/** логічні координати → CSS-пікселі всередині .stage */
const toCss = (lx, ly) => ({ x: TX + lx * S, y: TY + ly * S });

/* ─── примітиви (у логічних координатах) ─── */
function poly(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function px(x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function tile(gx, gy, fill, line) {
  const p = s(gx, gy);
  poly([{x:p.x,y:p.y-TH},{x:p.x+TW,y:p.y},{x:p.x,y:p.y+TH},{x:p.x-TW,y:p.y}], fill);
  if (line) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - TH); ctx.lineTo(p.x + TW, p.y);
    ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x - TW, p.y);
    ctx.closePath();
    ctx.strokeStyle = line; ctx.lineWidth = 0.7; ctx.stroke();
  }
}
/** прямокутник у площині лівої стіни */
const qL = (d1, d2, h1, h2, fill) => poly([wL(d1,h1), wL(d2,h1), wL(d2,h2), wL(d1,h2)], fill);
/** прямокутник у площині правої стіни */
const qR = (d1, d2, h1, h2, fill) => poly([wR(d1,h1), wR(d2,h1), wR(d2,h2), wR(d1,h2)], fill);
/** прямокутник на підлозі */
const qF = (x1, y1, x2, y2, fill) =>
  poly([s(x1,y1), s(x2,y1), s(x2,y2), s(x1,y2)], fill);

/** ізометричний паралелепіпед */
function box(gx, gy, w, d, h, top, right, left) {
  const A = s(gx, gy), B = s(gx + w, gy), Cc = s(gx + w, gy + d), D = s(gx, gy + d);
  const up = p => ({ x: p.x, y: p.y - h });
  poly([up(B), up(Cc), Cc, B], right);
  poly([up(D), up(Cc), Cc, D], left);
  poly([up(A), up(B), up(Cc), up(D)], top);
}

/* ─────────────────────────────────────────────────────────────
   6. МАЛЮВАННЯ СЦЕНИ
   ───────────────────────────────────────────────────────────── */
function draw() {
  const t = performance.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(S * DPR, 0, 0, S * DPR, TX * DPR, TY * DPR);

  roomShadow();
  walls();
  floor();
  sunPatch();
  wallDecor(t);
  objects(t);
}

/* тінь під кімнатою — «острівець» */
function roomShadow() {
  const f = s(GW, GH), l = s(0, GH), r = s(GW, 0);
  poly([
    { x: l.x - 3, y: l.y + 5 }, { x: f.x, y: f.y + 8 },
    { x: r.x + 3, y: r.y + 5 }, { x: f.x, y: f.y + 2 },
  ], C.shadow);
}

function walls() {
  // ліва стіна
  qL(0, GH, 0, WH, C.wallL);
  qL(0, GH, WH - 7, WH, C.wallLtop);
  qL(0, GH, 0, 7, C.skirt);
  // права стіна
  qR(0, GW, 0, WH, C.wallR);
  qR(0, GW, WH - 7, WH, C.wallRtop);
  qR(0, GW, 0, 7, C.skirtDk);
  // внутрішнє ребро в куті
  poly([wL(0,0), wL(0,WH), {x:wL(0,WH).x+1.5,y:wL(0,WH).y}, {x:wL(0,0).x+1.5,y:wL(0,0).y}],
       'rgba(150,104,62,.16)');
}

function floor() {
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++)
      tile(gx + 0.5, gy + 0.5, (gx + gy) % 2 ? C.floorB : C.floorA, C.floorLine);
}

/* сонячна пляма з вікна */
function sunPatch() {
  poly([s(0, 1.1), s(4.4, 1.9), s(4.4, 4.2), s(0, 3.5)], C.sun);
  poly([s(0, 1.5), s(2.6, 2.0), s(2.6, 3.3), s(0, 3.0)], C.sunHot);
}

function wallDecor(t) {
  /* ═ ВІКНО на лівій стіні ═ */
  const d1 = 1.15, d2 = 3.45, h1 = 24, h2 = 66;
  qL(d1 - .18, d2 + .18, h1 - 4, h2 + 4, C.frame);          // рама
  ctx.save();                                                // небо у вікні
  ctx.beginPath();
  const w1 = wL(d1,h1), w2 = wL(d2,h1), w3 = wL(d2,h2), w4 = wL(d1,h2);
  ctx.moveTo(w1.x,w1.y); ctx.lineTo(w2.x,w2.y); ctx.lineTo(w3.x,w3.y); ctx.lineTo(w4.x,w4.y);
  ctx.closePath(); ctx.clip();
  qL(d1, d2, h1, h2, C.sky);
  qL(d1, d2, h1, h1 + 14, C.skyLo);
  // хмарки повзуть
  for (let i = 0; i < 3; i++) {
    const span = d2 - d1;
    const dd = d1 + ((t * 0.000042 * (1 + i * .3) + i * .42) % 1) * span;
    const hh = h1 + 16 + i * 12;
    qL(dd, dd + .55, hh, hh + 5, 'rgba(255,255,255,.85)');
    qL(dd + .2, dd + .8, hh + 3, hh + 8, 'rgba(255,255,255,.7)');
  }
  ctx.restore();
  // палітурки
  qL(d1, d2, 44.4, 45.6, C.frame);
  qL(2.24, 2.36, h1, h2, C.frame);
  qL(d1, d2, h1, h2, C.glass);
  // підвіконня
  qL(d1 - .3, d2 + .3, h1 - 6, h1 - 3, C.frameDk);
  // штори
  qL(d1 - .34, d1 + .12, h1 - 2, h2 + 8, C.curtain);
  qL(d2 - .12, d2 + .34, h1 - 2, h2 + 8, C.curtain);
  qL(d1 - .34, d1 - .1, h1 - 2, h2 + 8, C.curtainDk);
  qL(d2 + .1, d2 + .34, h1 - 2, h2 + 8, C.curtainDk);
  // карниз
  qL(d1 - .5, d2 + .5, h2 + 8, h2 + 10.5, C.frameDk);

  /* ═ КАРТИНА на лівій стіні ═ */
  qL(4.5, 5.5, 36, 54, C.frame);
  qL(4.62, 5.38, 38, 52, '#DCEBD6');
  poly([wL(4.62,38), wL(5.38,38), wL(5.38,45), wL(5.0,49), wL(4.62,44)], '#8FC97F');
  qL(4.85, 5.05, 48, 50.5, '#F0C05A');

  /* ═ ДОШКА на правій стіні ═ */
  const b1 = 0.9, b2 = 4.0, bh1 = 30, bh2 = 68;
  qR(b1 - .16, b2 + .16, bh1 - 3, bh2 + 3, C.frame);
  qR(b1, b2, bh1, bh2, C.board);
  const lines = Math.min(6, 2 + phase * 2);
  for (let i = 0; i < lines; i++) {
    const y = bh2 - 8 - i * 7;
    qR(b1 + .22, b1 + .22 + (2.4 - (i % 3) * .5), y, y + 1.6,
       i % 3 === 0 ? C.boardRed : C.boardInk);
  }
  qR(b2 - .5, b2 - .28, bh2 - 6, bh2 - 3.4, C.boardRed);

  /* ═ ПОЛИЦІ на правій стіні ═ */
  shelf(5.0, 7.4, 52, [0, 1, 2, 3, 4]);
  shelf(5.4, 7.4, 30, [3, 5, 1]);

  /* ═ ГОДИННИК на правій стіні ═ */
  const c1 = 4.45, c2 = 4.95, ch = 62;
  qR(c1 - .06, c2 + .06, ch - .06, ch + 11, C.frameDk);
  qR(c1, c2, ch, ch + 10.8, C.board);
  const mins = (Date.now() / 1000 / 60) % 60;
  const ang = mins / 60 * Math.PI * 2;
  const cc = wR((c1 + c2) / 2, ch + 5.4);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(cc.x, cc.y);
  ctx.lineTo(cc.x + Math.sin(ang) * 4, cc.y - Math.cos(ang) * 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cc.x, cc.y);
  ctx.lineTo(cc.x + Math.sin(ang / 12) * 3, cc.y - Math.cos(ang / 12) * 3); ctx.stroke();
}

function shelf(d1, d2, h, books) {
  qR(d1 - .1, d2 + .1, h, h + 2.4, C.wood);
  qR(d1 - .1, d2 + .1, h - 1.6, h, C.woodDk);
  books.forEach((b, i) => {
    const d = d1 + .16 + i * .42;
    if (d + .3 > d2) return;
    const bh = 9 + (i % 3) * 2.5;
    qR(d, d + .3, h + 2.4, h + 2.4 + bh, C.book[b % C.book.length]);
    qR(d, d + .3, h + 2.4 + bh - 1.4, h + 2.4 + bh, 'rgba(0,0,0,.14)');
  });
  // рослина, що звисає з верхньої полиці
  if (h > 45) {
    qR(d2 - .55, d2 - .12, h + 2.4, h + 9, C.pot);
    for (let i = 0; i < 5; i++)
      qR(d2 - .62 + (i % 2) * .12, d2 - .42 + (i % 2) * .12, h - 3 - i * 3.4, h + 1.5 - i * 3.4,
         i % 2 ? C.plant : C.plantDk);
  }
}

/* ─── об'єкти з сортуванням по глибині ─── */
function objects(t) {
  rug();

  const list = [];
  const add = (depth, fn) => list.push({ depth, fn });

  // рослини в кутах
  add(0.3, () => plant(0.35, 0.35, 1.15));
  add(GW - 0.4 + 0.3, () => plant(GW - 0.45, 0.35, .95));
  add(0.4 + GH - 0.6, () => plant(0.4, GH - 0.7, 1.05));

  // стільці (за персонажем) + столи (перед ним)
  IDS.forEach(id => {
    const d = DESKS[id];
    const c = chars[id];
    add(c.gx + c.gy - .45, () => chair(d.gx + .44, 0.18));
    add(d.gx + DESK_W + d.gy + DESK_D, () => desk(id, d.gx, d.gy, t));
  });

  // персонажі
  IDS.forEach(id => {
    const c = chars[id];
    add(c.gx + c.gy, () => sprite(id, c, t));
  });

  // стіл переговорів
  add(2.2 + 3.6 + 2.4 + 1.6, () => meetingTable(2.2, 3.6, t));

  // кавовий куток
  add(6.5 + 3.9 + 1.4 + 1.1, () => coffeeCorner(6.5, 3.9, t));

  // кіт на килимі
  add(2.9 + 5.05, () => cat(2.9, 5.05, t));

  // коробки біля стіни
  add(7.4 + 2.6, () => {
    box(7.3, 2.35, .62, .62, 13, '#D9B98C', '#B4936A', '#A17F58');
    box(7.42, 2.5, .5, .5, 10, '#E3C79E', '#C0A177', '#AC8C64');
  });

  list.sort((a, b) => a.depth - b.depth).forEach(o => o.fn());
  labels();   // підписи — завжди поверх меблів
}

function labels() {
  ctx.textAlign = 'center';
  // компенсуємо масштаб — підпис має сталий розмір на екрані
  const fs = Math.max(3.2, Math.min(7, 10 / S));
  ctx.font = `${fs}px "Press Start 2P", monospace`;
  IDS.forEach(id => {
    const c = chars[id];
    const p = s(c.gx, c.gy);
    const y = p.y + fs + 5;
    const w = ctx.measureText(NAMES[id]).width;
    px(p.x - w / 2 - fs * .5, y - fs - 1.5, w + fs, fs + 4, 'rgba(255,246,234,.85)');
    ctx.fillStyle = id === 'max' ? '#B03A2E' : id === 'pixel' ? '#6A1B9A' : '#00695C';
    ctx.fillText(NAMES[id], p.x, y);
  });
}

function rug() {
  poly([s(1.9,3.3), s(5.1,3.3), s(5.1,5.7), s(1.9,5.7)], C.rugEdge);
  poly([s(2.02,3.42), s(4.98,3.42), s(4.98,5.58), s(2.02,5.58)], C.rug);
  poly([s(2.3,3.7), s(4.7,3.7), s(4.7,5.3), s(2.3,5.3)], C.rugIn);
  poly([s(2.6,4.0), s(4.4,4.0), s(4.4,5.0), s(2.6,5.0)], C.rug);
  poly([s(2.85,4.25), s(4.15,4.25), s(4.15,4.75), s(2.85,4.75)], C.rugEdge);
}

/** точка на висоті h над тайлом */
const at = (gx, gy, h) => { const p = s(gx, gy); return { x: p.x, y: p.y - h }; };
/** горизонтальна площина на висоті h */
const qH = (x1, y1, x2, y2, h, fill) =>
  poly([at(x1,y1,h), at(x2,y1,h), at(x2,y2,h), at(x1,y2,h)], fill);
/** передня (+gy) грань: від gx1 до gx2 на лінії gy, висоти h1..h2 */
const qFace = (gx1, gx2, gy, h1, h2, fill) =>
  poly([at(gx1,gy,h2), at(gx2,gy,h2), at(gx2,gy,h1), at(gx1,gy,h1)], fill);

function chair(gx, gy) {
  box(gx, gy, .52, .46, 9, C.woodDk, C.woodDkr, C.woodDkr);   // сидіння
  box(gx, gy - .1, .52, .1, 23, C.woodDk, C.woodDkr, C.woodDkr); // спинка
}

function desk(id, gx, gy, t) {
  const w = DESK_W, d = DESK_D, h = DESK_H;

  // ніжки
  [[.06,.06],[w-.16,.06],[.06,d-.16],[w-.16,d-.16]].forEach(([ox, oy]) => {
    box(gx + ox, gy + oy, .1, .1, h - 1.5, C.woodDk, C.woodDkr, C.woodDkr);
  });
  // стільниця
  box(gx, gy, w, d, h, C.woodTop, C.wood, C.woodDk);

  // ── монітор (лівий край стола, щоб не закривати обличчя) ──
  const mx = gx + .08, my = gy + .12, mw = .55, md = .12;
  const h0 = h, h1 = h + 4, h2 = h + 18;
  qH(mx + .18, my, mx + .38, my + md, h1, C.metalDk);                 // ніжка
  qFace(mx + .18, mx + .38, my + md, h0, h1, C.metalDk);
  // корпус
  qH(mx, my, mx + mw, my + md, h2, C.metalTop);
  poly([at(mx+mw,my,h2), at(mx+mw,my+md,h2), at(mx+mw,my+md,h1), at(mx+mw,my,h1)], C.metal);
  qFace(mx, mx + mw, my + md, h1, h2, C.metalDk);
  // екран
  qFace(mx + .05, mx + mw - .05, my + md, h1 + 1.6, h2 - 1.6, C.screen);
  const flick = Math.sin(t * 0.004 + gx * 3) > .93 ? .5 : 1;
  ctx.globalAlpha = flick;
  for (let i = 0; i < 4; i++) {
    const yy = h1 + 3 + i * 3.1;
    const ww = (mw - .16) * (i % 3 === 0 ? 1 : i % 3 === 1 ? .62 : .82);
    qFace(mx + .09, mx + .09 + ww, my + md, yy, yy + 1.5,
          i === 0 ? C.screenOn2 : C.screenOn);
  }
  ctx.globalAlpha = 1;

  // папери + кружка на стільниці
  qH(gx + .78, gy + .5, gx + 1.14, gy + .76, h, C.paper);
  qH(gx + .82, gy + .55, gx + 1.05, gy + .63, h + .6, '#EFE6D4');
  qH(gx + .82, gy + .67, gx + 1.10, gy + .72, h + .6, '#EFE6D4');
  mug(gx + 1.3, gy + .5, h);
}

function mug(gx, gy, base = 16) {
  const p = s(gx, gy);
  const y = p.y - base;
  px(p.x - 2.6, y - 6, 5.2, 6, C.mug);
  px(p.x - 2.6, y - 6, 5.2, 1.6, C.mugDk);
  px(p.x - 2, y - 5.2, 4, 1.4, C.coffee);
  px(p.x + 2.6, y - 4.6, 1.6, 2.6, C.mug);
}

function meetingTable(gx, gy, t) {
  const w = 2.4, d = 1.6, h = 15;
  box(gx, gy, w, d, h, C.woodTop, C.wood, C.woodDk);
  box(gx + w/2 - .16, gy + d/2 - .16, .32, .32, h - 2, C.woodDk, C.woodDkr, C.woodDkr);
  // папери, кружки, олівці
  const top = (x, y) => ({ ...s(gx + x, gy + y) });
  poly([top(.3,.3), top(.95,.3), top(.95,.78), top(.3,.78)].map(p=>({x:p.x,y:p.y-h})), C.paper);
  poly([top(.42,.4), top(.86,.4), top(.86,.52), top(.42,.52)].map(p=>({x:p.x,y:p.y-h-1})), C.boardInk);
  poly([top(.42,.58), top(.78,.58), top(.78,.68), top(.42,.68)].map(p=>({x:p.x,y:p.y-h-1})), C.boardInk);
  poly([top(1.3,.72), top(1.95,.72), top(1.95,1.2), top(1.3,1.2)].map(p=>({x:p.x,y:p.y-h})), '#FFF7E4');
  mug(gx + 1.9, gy + .42, h);
  mug(gx + .55, gy + 1.25, h);
  const pc = s(gx + 1.15, gy + 1.15);
  px(pc.x - 5, pc.y - h - 2, 10, 2, '#E8A33D');
  px(pc.x - 5, pc.y - h - 2, 2.5, 2, C.ink);
}

function coffeeCorner(gx, gy, t) {
  const CH = 18;                        // висота тумби
  box(gx, gy, 1.4, 1.05, CH, C.woodTop, C.wood, C.woodDk);
  qH(gx + .06, gy + .06, gx + 1.34, gy + .99, CH + .5, '#D9BE97');  // стільниця

  // кавомашина
  const mx = gx + .16, my = gy + .18, mw = .58, md = .46;
  const t1 = CH, t2 = CH + 24;
  qH(mx, my, mx + mw, my + md, t2, C.metalTop);
  poly([at(mx+mw,my,t2), at(mx+mw,my+md,t2), at(mx+mw,my+md,t1), at(mx+mw,my,t1)], C.metalDk);
  qFace(mx, mx + mw, my + md, t1, t2, C.metal);
  qFace(mx + .08, mx + mw - .08, my + md, t2 - 9, t2 - 2, '#3A4A52');   // дисплей
  qFace(mx + .12, mx + .24, my + md, t1 + 8, t1 + 11, '#E07A6A');       // кнопки
  qFace(mx + .32, mx + .44, my + md, t1 + 8, t1 + 11, '#8FC97F');
  qFace(mx + .16, mx + .42, my + md, t1 + 1, t1 + 5, '#2E3A40');        // ніша
  mug(mx + .29, my + md - .02, CH + 1);

  // пара
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.00055 + i * .25) % 1;
    const p = at(mx + mw / 2, my + md / 2, t2 + 2 + ph * 20);
    ctx.globalAlpha = (1 - ph) * .55;
    px(p.x + Math.sin(ph * 7 + i * 1.7) * 3 - 1.3, p.y, 2.8, 2.8, '#FFFFFF');
  }
  ctx.globalAlpha = 1;

  mug(gx + 1.06, gy + .34, CH + .5);
  mug(gx + 1.2, gy + .74, CH + .5);
  plant(gx + .26, gy + 1.42, 1.2);
}

function plant(gx, gy, sc = 1) {
  const p = s(gx, gy);
  const pw = 9 * sc, ph = 9 * sc;
  px(p.x - pw/2, p.y - ph, pw, ph, C.pot);
  px(p.x - pw/2 - 1, p.y - ph, pw + 2, 2.6 * sc, C.potTop);
  const leaves = [[-6,-8,C.plantDk],[-2,-13,C.plant],[3,-11,C.plantLt],
                  [6,-7,C.plantDk],[0,-17,C.plant],[-5,-12,C.plantLt],[4,-15,C.plantDk]];
  leaves.forEach(([lx, ly, col]) => {
    px(p.x + lx*sc - 2*sc, p.y - ph + ly*sc, 4.4*sc, 4.4*sc, col);
  });
}

function cat(gx, gy, t) {
  const p = s(gx, gy);
  const x = p.x, y = p.y;
  const breathe = Math.sin(t * 0.0022) * 0.6;
  // тіло (спить, клубочком)
  px(x - 9, y - 7 + breathe, 18, 7, C.cat);
  px(x - 9, y - 7 + breathe, 18, 2.4, C.catLt);
  px(x - 9, y - 1, 18, 1.6, C.catDk);
  // голова
  px(x - 13, y - 9 + breathe, 8, 7, C.cat);
  px(x - 13, y - 9 + breathe, 8, 2, C.catLt);
  // вушка
  px(x - 13, y - 11.5 + breathe, 2.6, 2.6, C.catDk);
  px(x - 8.6, y - 11.5 + breathe, 2.6, 2.6, C.catDk);
  // закриті очі + носик
  px(x - 11.6, y - 6 + breathe, 2, 1, C.ink);
  px(x - 7.8, y - 6 + breathe, 2, 1, C.ink);
  px(x - 10, y - 4.4 + breathe, 1.6, 1.2, '#C2185B');
  // хвіст
  const wag = Math.sin(t * 0.0028) * 3;
  px(x + 7, y - 5, 6, 2.4, C.catDk);
  px(x + 12, y - 6 + wag, 5, 2.4, C.cat);
  // z-z-z
  ctx.fillStyle = 'rgba(78,52,46,.4)';
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  const zp = (t * 0.0008) % 1;
  ctx.globalAlpha = (1 - zp) * .8;
  ctx.fillText('z', x - 16 - zp * 4, y - 14 - zp * 10);
  ctx.globalAlpha = 1;
}

/* ─── персонаж ─── */
function sprite(id, c, t) {
  const p = s(c.gx, c.gy);
  const moving = Math.abs(c.tx - c.gx) > .02 || Math.abs(c.ty - c.gy) > .02;
  const bob = moving ? 0 : Math.sin(t * 0.0033 + IDS.indexOf(id)) * 1.1;
  const P = 2;
  const x = p.x - 6 * P;
  const y = p.y - 18 * P + bob;

  // тінь
  poly([{x:p.x,y:p.y-3.4},{x:p.x+10,y:p.y},{x:p.x,y:p.y+3.4},{x:p.x-10,y:p.y}],
       'rgba(120,88,64,.18)');

  const pal = PAL[id];
  const legs = LEGS[moving ? (Math.floor(t / 170) % 2) : 0];
  const rows = BODY[id].concat(legs);

  // блимання очей
  const blink = (Math.sin(t * 0.0011 + IDS.indexOf(id) * 2.1) > .985);

  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      let ch = row[rx];
      if (ch === '.') continue;
      if (ch === 'E' && blink) ch = 'S';
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + rx * P, y + ry * P, P, P);
    }
  });

}

/* ─────────────────────────────────────────────────────────────
   7. ЦИКЛ АНІМАЦІЇ
   ───────────────────────────────────────────────────────────── */
function loop() {
  IDS.forEach(id => {
    const c = chars[id];
    const dx = c.tx - c.gx, dy = c.ty - c.gy;
    if (Math.abs(dx) > .02 || Math.abs(dy) > .02) { c.gx += dx * .06; c.gy += dy * .06; }
    else { c.gx = c.tx; c.gy = c.ty; }
  });
  draw();
  placeBubbles();
  requestAnimationFrame(loop);
}

function placeBubbles() {
  const stw = cv.clientWidth || SCENE_W;
  IDS.forEach(id => {
    const el = document.getElementById(`bubble-${id}`);
    if (!el || !el.classList.contains('on')) return;
    const c = chars[id];
    const p = s(c.gx, c.gy);
    const cs = toCss(p.x, p.y - 40);
    // тримаємо бабл у межах сцени, а «хвостик» — над персонажем
    const half = el.offsetWidth / 2;
    const left = Math.min(Math.max(cs.x, half + 4), stw - half - 4);
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(cs.y, el.offsetHeight + 4)}px`;
    el.style.setProperty('--tailx', `${Math.min(Math.max(cs.x - left + half, 12), el.offsetWidth - 12)}px`);
  });
}

/* ══════════════════════════════════════════════════════════════
   8. МОЗОК АГЕНТІВ
   ══════════════════════════════════════════════════════════════ */
const MODEL = 'claude-haiku-4-5-20251001';

const SYS = {
  strategist: `Ти — Макс, бренд-стратег у невеликій креативній агенції.
Ти думаєш категоріями: цільова аудиторія, інсайт, позиціонування, конкурентна відмінність, культурна напруга.
Ти конкретний, гострий, не терпиш загальних слів на кшталт "якість" та "інновації".
ВІДПОВІДАЙ УКРАЇНСЬКОЮ. Максимум 2 короткі речення. Від першої особи, як думка вголос. Без вступів і списків.`,

  designer: `Ти — Піксель, візуальний дизайнер у невеликій креативній агенції.
Ти думаєш категоріями: колір, типографіка, форма, композиція, ритм, емоція, матеріальність.
Ти пристрасний до естетики і ненавидиш кліше та стокову "чистоту".
ВІДПОВІДАЙ УКРАЇНСЬКОЮ. Максимум 2 короткі речення. Від першої особи, як думка вголос. Без вступів і списків.`,

  copywriter: `Ти — Віра, копірайтерка у невеликій креативній агенції.
Ти думаєш категоріями: назва, слоган, tone of voice, наратив, точне слово, ритм фрази.
Ти одержима мовою, ненавидиш канцелярит і порожній пафос.
ВІДПОВІДАЙ УКРАЇНСЬКОЮ. Максимум 2 короткі речення. Від першої особи, як думка вголос. Без вступів і списків.`,
};

const FINAL = {
  strategist: `Сформулюй ФІНАЛЬНЕ позиціонування — рівно одне речення.
Відповідай СТРОГО у форматі, без жодного іншого тексту:
ПОЗИЦІОНУВАННЯ: <одне речення>`,

  copywriter: `Дай фінальну назву бренду і слоган.
Відповідай СТРОГО у форматі, без жодного іншого тексту:
НАЗВА: <назва>
СЛОГАН: <слоган>`,

  designer: `Дай фінальну концепцію логотипу.
Відповідай СТРОГО у форматі, без жодного іншого тексту:
КОНЦЕПЦІЯ: <2 речення: форма, кольори, характер>
SVG: <валідний SVG, viewBox="0 0 100 100", максимум 3 кольори, лише circle/rect/path/polygon/ellipse/g, БЕЗ text, БЕЗ image, БЕЗ script>`,
};

const DEMO = {
  strategist: {
    1: ['Спершу питання не "хто наша аудиторія", а "від чого вони втомилися". Саме там живе відмінність.',
        'Категорія перевантажена однаковими обіцянками. Виграє той, хто скаже одну річ і доведе її ділом.',
        'Мене цікавить культурна напруга: люди хочуть простоти, але не хочуть виглядати простими.'],
    2: ['Піксель має рацію щодо матеріальності — але вона мусить доводити позиціонування, а не бути декором.',
        'Віра точно вловила тон. Додам стратегічну рамку: ми не "для всіх", ми для тих, хто вже обирає свідомо.',
        'Погоджуюсь із напрямком. Тільки приберімо все, що можна сказати про будь-якого конкурента.'],
    3: 'ПОЗИЦІОНУВАННЯ: Бренд для тих, кому важливо походження й чесність деталей більше, ніж гучні обіцянки.',
  },
  designer: {
    1: ['Бачу теплу палітру з приглушеним контрастом і паперовою текстурою. Жодного глянцю.',
        'Типографіка витягне все: потрібен шрифт із характером і трохи неідеальними формами.',
        'Ключ у ритмі композиції — багато повітря, один сильний акцент, і все читається за секунду.'],
    2: ['Стратегія Макса про походження — це матеріальність. Отже: крафтовий папір, штамп, ручний знак.',
        'Тон Віри теплий, тож геометрія має бути мʼяка — заокруглення, жодних гострих кутів.',
        'Тоді знак мусить працювати і на 16 пікселях, і на вивісці. Спрощую до однієї форми.'],
    3: `КОНЦЕПЦІЯ: Мʼякий круглий знак-штамп: тепле коло, всередині проста геометрична форма зі зсувом.
Палітра — терракота, вершковий, глибокий графіт; характер спокійний і рукотворний.
SVG: <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="#D98A63"/><circle cx="50" cy="50" r="33" fill="#FFF3E3"/><path d="M50 26 L70 50 L50 74 L30 50 Z" fill="#4E342E"/><circle cx="50" cy="50" r="8" fill="#D98A63"/></svg>`,
  },
  copywriter: {
    1: ['Перші двадцять назв — у кошик. Вони описують продукт, а треба назву, яка описує ставлення.',
        'Шукаю напругу в одному слові: щоб було тепло, але не солодко. Це найважче.',
        'Тон голосу: як розумний друг, що не повчає. Кожне речення проходить цей фільтр.'],
    2: ['Макс каже — конкретика. Перекладаю в мову: не "натуральність", а назва конкретної деталі.',
        'Піксель хоче рукотворність — отже і мова має бути з нерівностями, живою, не відполірованою.',
        'Тоді слоган — коротке твердження без прикметників. Дієслово несе всю вагу.'],
    3: 'НАЗВА: Тепличка\nСЛОГАН: Тут росте справжнє',
  },
};

const PRESETS = [
  'Бренд спешелті-кавʼярні в Києві для молодих професіоналів',
  'Запуск застосунку для трекінгу звичок серед студентів',
  'Ребрендинг локальної пекарні з 20-річною історією',
  'Позиціонування українського бренду вовняних ковдр на експорт',
];

/* ─── стан ─── */
let running = false, phase = 0, brief = '', secs = 0, tick = null;
let thoughts = { max: '', pixel: '', vera: '' };
let results = null;

/* ─── API ─── */
async function ask(system, user, key) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 400, system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!r.ok) {
    let m = `HTTP ${r.status}`;
    try { const j = await r.json(); if (j.error?.message) m = j.error.message; } catch {}
    throw new Error(m);
  }
  const j = await r.json();
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim() || '…';
}

/* ─── думка з бабликом ─── */
async function think(id, prompt, key, isFinal) {
  const role = ROLES[id];
  hideBubbles(id);
  const el = document.getElementById(`bubble-${id}`);
  const tx = document.getElementById(`bt-${id}`);
  tx.textContent = '';
  tx.classList.add('wait');
  el.classList.add('on');
  placeBubbles();

  let out;
  if (!key) {
    await sleep(1100 + Math.random() * 700);
    out = isFinal ? DEMO[role][3] : pick(DEMO[role][phase] || DEMO[role][1]);
  } else {
    try {
      out = await ask(SYS[role], prompt, key);
    } catch (e) {
      log('СИСТЕМА', `Помилка API: ${e.message}`, 'system');
      out = isFinal ? DEMO[role][3] : pick(DEMO[role][phase] || DEMO[role][1]);
      log('СИСТЕМА', 'Перемикаюсь на демо-думку.', 'system');
    }
  }
  if (!running) return out;

  tx.classList.remove('wait');
  // у баблі показуємо коротку версію (без службових полів)
  await type(tx, isFinal ? shorten(out) : out);
  thoughts[id] = out;
  log(NAMES[id], isFinal ? shorten(out) : out, role);
  return out;
}

const shorten = t => t.replace(/\s*SVG:[\s\S]*$/i, '')
                      .replace(/^(ПОЗИЦІОНУВАННЯ|КОНЦЕПЦІЯ):\s*/i, '')
                      .replace(/\n+/g, ' · ').trim().slice(0, 210);

function hideBubbles(except) {
  IDS.forEach(id => {
    if (id !== except) document.getElementById(`bubble-${id}`).classList.remove('on');
  });
}
const hideAll = () => IDS.forEach(id =>
  document.getElementById(`bubble-${id}`).classList.remove('on'));

/* ─── раунди ─── */
async function run(key) {
  const R = [
    { n: 1, title: 'РАУНД 1 · АНАЛІЗ',      spot: 'desk'  },
    { n: 2, title: 'РАУНД 2 · ОБГОВОРЕННЯ', spot: 'table' },
    { n: 3, title: 'РАУНД 3 · ФІНАЛ',       spot: 'desk'  },
  ];

  for (const r of R) {
    if (!running) return;
    phase = r.n;
    banner(r.title);
    badge(r.title.toLowerCase());
    log('СИСТЕМА', `── ${r.title} ──`, 'system');

    IDS.forEach(id => move(id, r.spot));
    await sleep(1900);
    if (!running) return;

    for (const id of IDS) {
      if (!running) return;
      const role = ROLES[id];
      let prompt;
      if (r.n === 1) {
        prompt = `Бриф проєкту: ${brief}\n\nЯкі твої перші думки?`;
      } else {
        const others = IDS.filter(k => k !== id && thoughts[k])
          .map(k => `${NAMES[k]} (${roleUa(k)}): "${thoughts[k]}"`).join('\n');
        prompt = r.n === 2
          ? `Бриф: ${brief}\n\nЩо сказали колеги:\n${others}\n\nТвоя реакція: з чим погоджуєшся, що заперечуєш, що розвиваєш?`
          : `Бриф: ${brief}\n\nПідсумок обговорення:\n${others}\n\n${FINAL[role]}`;
      }
      const out = await think(id, prompt, key, r.n === 3);
      if (r.n === 3) (results ||= {})[id] = out;
      await sleep(r.n === 3 ? 1500 : 2100);
    }

    if (!running) return;
    await sleep(2300);
    hideAll();
    await sleep(500);
  }

  showResults(results || {});
  banner('★ ГОТОВО ★');
  badge('результат готовий');
  log('СИСТЕМА', '★ Агенція завершила роботу.', 'system');
}

const roleUa = k => k === 'max' ? 'стратег' : k === 'pixel' ? 'дизайнер' : 'копірайтерка';

function move(id, spot) {
  const p = SPOTS[id][spot];
  chars[id].tx = p.gx;
  chars[id].ty = p.gy;
  chars[id].at = spot;
}

/* ─── результати ─── */
function showResults(r) {
  const sec = document.getElementById('resSec');
  sec.hidden = false;

  const pos = field(r.max, 'ПОЗИЦІОНУВАННЯ') || clean(r.max) || '—';
  document.getElementById('resStrategy').textContent = pos;

  const nm = field(r.vera, 'НАЗВА') || '—';
  const sl = field(r.vera, 'СЛОГАН') || '—';
  const rc = document.getElementById('resCopy');
  rc.textContent = '';
  rc.append(bold('Назва: '), nm, document.createElement('br'),
            bold('Слоган: '), sl);

  document.getElementById('resDesign').textContent =
    field(r.pixel, 'КОНЦЕПЦІЯ') || clean(r.pixel).replace(/<svg[\s\S]*$/i, '').trim() || '—';

  const box = document.getElementById('logoPreview');
  const svg = safeSvg(r.pixel || '');
  if (svg) { box.replaceChildren(svg); box.hidden = false; }
  else { box.replaceChildren(); box.hidden = true; }

  window.__res = { pos, nm, sl, concept: document.getElementById('resDesign').textContent };
  document.getElementById('btnAgain').disabled = false;
  sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function bold(t) { const b = document.createElement('b'); b.textContent = t; return b; }
const clean = t => (t || '').trim();
function field(t, name) {
  if (!t) return '';
  const m = t.match(new RegExp(`${name}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[А-ЯІЇЄA-Z]{3,}\\s*:|$)`, 'i'));
  return m ? m[1].trim() : '';
}

/* SVG від моделі — пропускаємо лише безпечну геометрію */
const SVG_OK = new Set(['svg','g','circle','rect','path','polygon','polyline','ellipse','line',
                        'defs','lineargradient','radialgradient','stop','title']);
function safeSvg(text) {
  const m = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (!m) return null;
  let doc;
  try { doc = new DOMParser().parseFromString(m[0], 'image/svg+xml'); } catch { return null; }
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' ||
      doc.getElementsByTagName('parsererror').length) return null;

  const walk = node => {
    [...node.children].forEach(el => {
      if (!SVG_OK.has(el.nodeName.toLowerCase())) { el.remove(); return; }
      [...el.attributes].forEach(a => {
        const n = a.name.toLowerCase();
        if (n.startsWith('on') || n === 'href' || n === 'xlink:href' ||
            /url\s*\(|javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
      walk(el);
    });
  };
  walk(root);
  root.removeAttribute('width');
  root.removeAttribute('height');
  if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 100 100');
  return document.importNode(root, true);
}

/* ─── UI ─── */
const $ = id => document.getElementById(id);

function badge(t) { $('phaseBadge').textContent = t; }

let bannerT = null;
function banner(t) {
  const b = $('banner');
  $('bannerText').textContent = t;
  b.classList.add('on');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('on'), 2600);
}

function status(on) {
  $('statusDot').classList.toggle('on', on);
  $('statusText').textContent = on ? 'LIVE' : 'ОФЛАЙН';
}

function log(who, msg, role) {
  const feed = $('log');
  const row = document.createElement('div');
  row.className = `lrow ${role || 'system'}`;
  const a = document.createElement('span'); a.className = 'lwho'; a.textContent = who;
  const b = document.createElement('span'); b.className = 'lmsg'; b.textContent = msg;
  row.append(a, b);
  feed.prepend(row);
  while (feed.children.length > 90) feed.lastChild.remove();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];

async function type(el, text) {
  el.textContent = '';
  const step = text.length > 150 ? 2 : 1;
  for (let i = 0; i < text.length; i += step) {
    if (!running) { el.textContent = text; return; }
    el.textContent = text.slice(0, i + step);
    await sleep(16);
  }
  el.textContent = text;
}

/* ─── старт / стоп ─── */
async function start() {
  if (running) return;
  const key = $('apiKey').value.trim();
  brief = $('taskInput').value.trim();
  if (!brief) {
    log('СИСТЕМА', 'Впишіть завдання для агенції.', 'system');
    $('taskInput').focus();
    banner('ПОТРІБЕН БРИФ');
    return;
  }

  try {
    localStorage.setItem('8bit.key', key);
    localStorage.setItem('8bit.brief', brief);
  } catch {}

  running = true; phase = 0; secs = 0;
  thoughts = { max: '', pixel: '', vera: '' };
  results = null;
  hideAll();
  $('resSec').hidden = true;
  IDS.forEach(id => move(id, 'desk'));

  status(true);
  $('btnStart').disabled = true;
  $('btnStop').disabled = false;
  $('btnAgain').disabled = true;
  if (window.matchMedia('(max-width: 899px)').matches) $('setupSec').classList.add('closed');

  log('СИСТЕМА', `Бриф: «${brief}»`, 'system');
  log('СИСТЕМА', key ? `Мозок: Claude (${MODEL}).` : 'Демо-режим — без API ключа.', 'system');

  clearInterval(tick);
  tick = setInterval(() => {
    secs++;
    $('clock').textContent =
      `${String(Math.floor(secs / 60)).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`;
  }, 1000);

  try { await run(key); }
  catch (e) { log('СИСТЕМА', `Збій: ${e.message}`, 'system'); }
  finally {
    running = false;
    clearInterval(tick);
    status(false);
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    $('btnAgain').disabled = false;
  }
}

function stop() {
  if (!running) return;
  running = false;
  clearInterval(tick);
  hideAll();
  status(false);
  badge('зупинено');
  banner('ЗУПИНЕНО');
  $('btnStart').disabled = false;
  $('btnStop').disabled = true;
  $('btnAgain').disabled = false;
  log('СИСТЕМА', 'Симуляцію зупинено.', 'system');
}

/* ─── ініціалізація ─── */
function boot() {
  initCanvas();
  requestAnimationFrame(loop);

  // прес-сети
  const wrap = $('presetChips');
  PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pchip';
    b.textContent = p.length > 42 ? p.slice(0, 40) + '…' : p;
    b.title = p;
    b.addEventListener('click', () => { $('taskInput').value = p; $('taskInput').focus(); });
    wrap.append(b);
  });

  // відновлення зі localStorage
  try {
    const k = localStorage.getItem('8bit.key');
    const b = localStorage.getItem('8bit.brief');
    if (k) $('apiKey').value = k;
    if (b) $('taskInput').value = b;
  } catch {}

  $('btnStart').addEventListener('click', start);
  $('btnStop').addEventListener('click', stop);
  $('btnAgain').addEventListener('click', () => { if (!running) start(); });
  $('setupToggle').addEventListener('click', () => $('setupSec').classList.toggle('closed'));

  $('btnCopy').addEventListener('click', async () => {
    const r = window.__res;
    if (!r) return;
    const txt = `Бриф: ${brief}\n\nПОЗИЦІОНУВАННЯ: ${r.pos}\nНАЗВА: ${r.nm}\nСЛОГАН: ${r.sl}\nЛОГОТИП: ${r.concept}`;
    try { await navigator.clipboard.writeText(txt); log('СИСТЕМА', 'Результат скопійовано.', 'system'); }
    catch { log('СИСТЕМА', 'Не вдалося скопіювати — виділіть текст вручну.', 'system'); }
  });

  document.fonts?.ready.then(draw);
  badge('готово до старту');
  log('СИСТЕМА', 'Впишіть завдання (або торкніться підказки) та натисніть ЗАПУСТИТИ.', 'system');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
