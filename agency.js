/* ═════════════════════════════════════════════════════════════
   8BIT AGENCY — Isometric Office Simulation Engine
   Canvas-rendered warm pixel art + Claude AI agent brains
   ═════════════════════════════════════════════════════════════ */
'use strict';

/* ── ISOMETRIC CONFIG ──────────────────────────────────────── */
const TW = 32;          // tile half-width
const TH = 16;          // tile half-height
const GW = 10;          // grid width
const GH = 8;           // grid height
const WALL_H = 100;     // wall height px
const PX = 3;            // sprite pixel size
let OX, OY;             // origin (back corner) screen coords
let canvas, ctx;
let W, H;               // canvas actual size

/* ── COLORS — warm Stardew Valley palette ──────────────────── */
const C = {
  sky:        '#B8E0F6',
  skyLight:   '#D4EEFB',
  cloud:      '#FFFFFF',
  wallL:      '#FFF3E0',
  wallLShade: '#FFE8CC',
  wallR:      '#FFE0B2',
  wallRShade: '#FFD19A',
  wallLine:   '#C9A87C',
  floorA:     '#D4A574',
  floorB:     '#C49060',
  floorLine:  '#B88050',
  wood:       '#8D6E42',
  woodDk:     '#6D4C2A',
  woodLt:     '#A68B5B',
  window:     '#87CEEB',
  windowLt:   '#C5E8F7',
  windowFrame:'#A1887F',
  curtain:    '#F8BBD0',
  shelf:      '#8D6E42',
  book1:      '#E57373',
  book2:      '#64B5F6',
  book3:      '#FFD54F',
  book4:      '#81C784',
  book5:      '#CE93D8',
  plant:      '#66BB6A',
  plantDk:    '#388E3C',
  pot:        '#D4835E',
  potDk:      '#B05E3A',
  monitor:    '#263238',
  screen:     '#1B5E20',
  screenLt:   '#388E3C',
  mug:        '#FFFFFF',
  mugCoffee:  '#5D4037',
  cat:        '#FFB74D',
  catDk:      '#F57C00',
  catEye:     '#333333',
  carpet:     '#BCAAA4',
  carpetDk:   '#A1887F',
  board:      '#EFEBE9',
  boardFrame: '#8D6E42',
  skin:       '#FFCC80',
  skinDk:     '#FFB74D',
  max_hair:   '#5D4037',
  max_shirt:  '#E57373',
  max_shirtDk:'#C62828',
  max_tie:    '#FFD54F',
  max_pants:  '#546E7A',
  pix_hair:   '#7E57C2',
  pix_shirt:  '#CE93D8',
  pix_shirtDk:'#6A1B9A',
  pix_band:   '#FFD54F',
  pix_pants:  '#1565C0',
  vera_hair:  '#E65100',
  vera_shirt: '#80CBC4',
  vera_shirtDk:'#00695C',
  vera_pants: '#37474F',
  vera_glass: '#90A4AE',
  shoes:      '#4E342E',
  shoesDk:    '#3E2723',
};

/* ── GRID → SCREEN conversion ──────────────────────────────── */
function g2s(gx, gy) {
  return {
    x: OX + (gx - gy) * TW,
    y: OY + (gx + gy) * TH,
  };
}

/* ── CANVAS SETUP ──────────────────────────────────────────── */
function initCanvas() {
  canvas = document.getElementById('office');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const vp = document.getElementById('viewport');
  W = vp.clientWidth;
  H = vp.clientHeight;
  canvas.width = W;
  canvas.height = H;
  OX = W * 0.42;
  OY = H * 0.18;
  drawScene();
}

/* ── DRAW HELPERS ──────────────────────────────────────────── */
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function diamond(cx, cy, w, h, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - w, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}

function quad(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function quadStroke(pts, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw || 1;
  ctx.stroke();
}

/* ── DRAW ROOM ─────────────────────────────────────────────── */
function drawScene() {
  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  grad.addColorStop(0, C.skyLight);
  grad.addColorStop(1, C.sky);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Clouds
  drawClouds();

  // Walls
  drawWalls();

  // Floor
  drawFloor();

  // Wall decorations
  drawWallDecorations();

  // Furniture (sorted by depth)
  drawFurniture();

  // Cat
  drawCat();

  // Characters
  drawCharacters();
}

/* ── CLOUDS ────────────────────────────────────────────────── */
function drawClouds() {
  const t = Date.now() * 0.008;
  [
    { x: 60, y: 25, s: 1.0 },
    { x: 300, y: 15, s: 0.7 },
    { x: 550, y: 30, s: 0.9 },
  ].forEach(c => {
    const cx = ((c.x + t * c.s * 0.3) % (W + 100)) - 50;
    const cy = c.y;
    const s = c.s;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    [[-12,0],[0,-5],[12,0],[6,0],[-6,0]].forEach(([dx,dy]) => {
      ctx.fillRect(Math.round(cx+dx*s), Math.round(cy+dy*s), Math.round(14*s), Math.round(8*s));
    });
  });
}

/* ── WALLS ─────────────────────────────────────────────────── */
function drawWalls() {
  // Left wall (gy direction, at gx=0)
  const lt = g2s(0, 0);      // back corner
  const lb = g2s(0, GH);     // front-left corner
  quad([
    { x: lt.x - TW, y: lt.y - WALL_H },
    { x: lt.x, y: lt.y - TH - WALL_H },
    { x: lt.x, y: lt.y - TH },
    { x: lb.x - TW, y: lb.y },
    { x: lb.x - TW, y: lb.y - WALL_H },
  ], C.wallL);
  // Shade strip
  quad([
    { x: lb.x - TW, y: lb.y - WALL_H },
    { x: lt.x - TW, y: lt.y - WALL_H },
    { x: lt.x - TW + 8, y: lt.y - WALL_H + 2 },
    { x: lb.x - TW + 8, y: lb.y - WALL_H + 2 },
  ], C.wallLShade);

  // Right wall (gx direction, at gy=0)
  const rt = g2s(GW, 0);     // back-right corner
  quad([
    { x: lt.x, y: lt.y - TH - WALL_H },
    { x: rt.x + TW, y: rt.y - WALL_H },
    { x: rt.x + TW, y: rt.y },
    { x: lt.x, y: lt.y - TH },
  ], C.wallR);
  // Shade strip
  quad([
    { x: lt.x, y: lt.y - TH - WALL_H },
    { x: rt.x + TW, y: rt.y - WALL_H },
    { x: rt.x + TW, y: rt.y - WALL_H + 6 },
    { x: lt.x, y: lt.y - TH - WALL_H + 6 },
  ], C.wallRShade);

  // Wall outlines
  ctx.strokeStyle = C.wallLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Left wall bottom edge
  ctx.moveTo(lt.x - TW, lt.y - WALL_H);
  ctx.lineTo(lb.x - TW, lb.y);
  // Floor left edge visible
  ctx.moveTo(lt.x, lt.y - TH);
  ctx.lineTo(lb.x - TW, lb.y);
  // Right wall bottom edge
  ctx.moveTo(lt.x, lt.y - TH);
  ctx.lineTo(rt.x + TW, rt.y);
  // Top edges
  ctx.moveTo(lt.x - TW, lt.y - WALL_H);
  ctx.lineTo(lt.x, lt.y - TH - WALL_H);
  ctx.lineTo(rt.x + TW, rt.y - WALL_H);
  ctx.stroke();
}

/* ── FLOOR ─────────────────────────────────────────────────── */
function drawFloor() {
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const { x, y } = g2s(gx, gy);
      const light = (gx + gy) % 2 === 0;
      diamond(x, y, TW, TH, light ? C.floorA : C.floorB, C.floorLine);
    }
  }
}

/* ── WALL DECORATIONS ──────────────────────────────────────── */
function drawWallDecorations() {
  // === Window on left wall ===
  // Window is between gy=1 and gy=3
  const wy1 = g2s(0, 1.5);
  const wx = wy1.x - TW - 2;
  const winY = wy1.y - WALL_H * 0.7;
  const winW = 6;
  const winH = WALL_H * 0.45;

  // Window frame
  const wfx = wx;
  const wfy = winY;
  for (let i = 0; i < 4; i++) {
    const pane_y = wfy + i * (winH / 4);
    const pane_x = wfx - (i * TW / 4) + 2;
    // Pane
    rect(pane_x, pane_y, winW + 4, winH / 4 - 2, C.windowLt);
    // Frame
    ctx.strokeStyle = C.windowFrame;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pane_x, pane_y, winW + 4, winH / 4 - 2);
  }

  // === Whiteboard on right wall ===
  const bpos = g2s(4, 0);
  const bx = bpos.x + 8;
  const by = bpos.y - TH - WALL_H * 0.75;
  const bw = TW * 3;
  const bh = WALL_H * 0.4;
  rect(bx - 2, by - 2, bw + 4, bh + 4, C.boardFrame);
  rect(bx, by, bw, bh, C.board);
  // Board text lines
  ctx.fillStyle = C.wallLine;
  for (let i = 0; i < 4; i++) {
    rect(bx + 6, by + 8 + i * 9, bw * 0.5 - i * 6, 2, '#BCAAA4');
  }
  // Pin
  rect(bx + bw - 10, by + 4, 4, 4, C.book1);

  // === Shelves on right wall ===
  drawShelf(7, 0, [C.book1, C.book2, C.book3, C.book5]);
  drawShelf(8.5, 0, [C.book4, C.book1, C.book2]);

  // === Wall art on left wall (picture frame) ===
  const ap = g2s(0, 5);
  const ax = ap.x - TW + 3;
  const ay = ap.y - WALL_H * 0.65;
  rect(ax - 1, ay - 1, 14, 12, C.boardFrame);
  rect(ax, ay, 12, 10, '#C8E6C9');
  // Little mountain landscape
  ctx.fillStyle = '#81C784';
  ctx.beginPath();
  ctx.moveTo(ax, ay + 10);
  ctx.lineTo(ax + 4, ay + 3);
  ctx.lineTo(ax + 8, ay + 7);
  ctx.lineTo(ax + 12, ay + 2);
  ctx.lineTo(ax + 12, ay + 10);
  ctx.fill();
}

function drawShelf(gx, gy, bookColors) {
  const p = g2s(gx, gy);
  const sx = p.x;
  const sy = p.y - TH - WALL_H * 0.55;
  // Shelf plank
  rect(sx, sy + 14, TW * 1.2, 3, C.shelf);
  // Books
  bookColors.forEach((c, i) => {
    const bh = 10 + (i % 3) * 2;
    rect(sx + 3 + i * 8, sy + 14 - bh, 6, bh, c);
    rect(sx + 3 + i * 8, sy + 14 - bh, 6, 1, 'rgba(0,0,0,0.15)');
  });
}

/* ── FURNITURE ─────────────────────────────────────────────── */
function drawFurniture() {
  // Draw all furniture sorted by depth (gx + gy)
  const items = [
    { type: 'plant', gx: 0.5, gy: 0.5 },
    { type: 'desk', gx: 2, gy: 2.5, color: C.max_shirt },
    { type: 'desk', gx: 5, gy: 2.5, color: C.pix_shirt },
    { type: 'desk', gx: 8, gy: 2.5, color: C.vera_shirt },
    { type: 'plant', gx: 9.5, gy: 0.5 },
    { type: 'table', gx: 5, gy: 5.5 },
    { type: 'coffee', gx: 9, gy: 5.5 },
    { type: 'plant', gx: 0.5, gy: 6 },
    { type: 'carpet', gx: 5, gy: 5.5 },
  ];

  // Sort by depth
  items.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));

  // Draw carpet first (under table)
  drawCarpet(5, 5.5);

  items.forEach(it => {
    switch (it.type) {
      case 'desk': drawDesk(it.gx, it.gy, it.color); break;
      case 'plant': drawPlant(it.gx, it.gy); break;
      case 'table': drawMeetingTable(it.gx, it.gy); break;
      case 'coffee': drawCoffeeMachine(it.gx, it.gy); break;
    }
  });
}

function drawCarpet(gx, gy) {
  const { x, y } = g2s(gx, gy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const p = g2s(gx + dx, gy + dy);
      const light = (dx + dy) % 2 === 0;
      diamond(p.x, p.y, TW, TH, light ? C.carpet : C.carpetDk, C.carpetDk);
    }
  }
}

function drawDesk(gx, gy, accent) {
  const { x, y } = g2s(gx, gy);
  // Desk top (isometric box)
  const dw = TW * 1.4;
  const dh = TH * 1.4;
  const dt = 4; // thickness
  const dy_off = -6;

  // Top face
  diamond(x, y + dy_off, dw, dh, C.woodLt, C.woodDk);
  // Front-right face
  quad([
    { x: x, y: y + dy_off + dh },
    { x: x + dw, y: y + dy_off },
    { x: x + dw, y: y + dy_off + dt },
    { x: x, y: y + dy_off + dh + dt },
  ], C.wood);
  // Front-left face
  quad([
    { x: x - dw, y: y + dy_off },
    { x: x, y: y + dy_off + dh },
    { x: x, y: y + dy_off + dh + dt },
    { x: x - dw, y: y + dy_off + dt },
  ], C.woodDk);

  // Legs
  const legH = 18;
  [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([lx, ly]) => {
    const lp = { x: x + lx * dw * 0.7, y: y + dy_off + ly * dh * 0.7 + dt };
    rect(lp.x - 1, lp.y, 3, legH, C.woodDk);
  });

  // Monitor
  const mx = x - 4;
  const my = y + dy_off - 22;
  rect(mx, my, 14, 12, C.monitor);
  rect(mx + 1, my + 1, 12, 9, C.screen);
  // Screen glow lines
  for (let i = 0; i < 3; i++) {
    rect(mx + 3, my + 3 + i * 3, 8, 1, C.screenLt);
  }
  // Stand
  rect(mx + 5, my + 12, 4, 4, C.monitor);
  rect(mx + 3, my + 15, 8, 2, C.monitor);

  // Coffee mug on desk
  const mugX = x + 12;
  const mugY = y + dy_off - 6;
  rect(mugX, mugY, 5, 6, C.mug);
  rect(mugX + 1, mugY + 1, 3, 2, C.mugCoffee);
  rect(mugX + 5, mugY + 2, 2, 2, C.mug); // handle
}

function drawPlant(gx, gy) {
  const { x, y } = g2s(gx, gy);
  const py = y - 4;
  // Pot
  ctx.fillStyle = C.pot;
  ctx.fillRect(x - 5, py, 10, 8);
  ctx.fillStyle = C.potDk;
  ctx.fillRect(x - 6, py, 12, 3);
  // Leaves
  const leaves = [[-6,-8],[-2,-12],[2,-10],[5,-7],[0,-14],[-4,-11],[3,-13]];
  leaves.forEach(([lx, ly]) => {
    rect(x + lx, py + ly, 4, 4, C.plant);
    rect(x + lx + 1, py + ly + 1, 2, 2, C.plantDk);
  });
}

function drawMeetingTable(gx, gy) {
  const { x, y } = g2s(gx, gy);
  // Round-ish table (bigger diamond)
  diamond(x, y - 4, TW * 1.2, TH * 1.2, C.woodLt, C.woodDk);
  // Thickness
  quad([
    { x: x, y: y - 4 + TH * 1.2 },
    { x: x + TW * 1.2, y: y - 4 },
    { x: x + TW * 1.2, y: y },
    { x: x, y: y - 4 + TH * 1.2 + 4 },
  ], C.wood);
  // Leg
  rect(x - 1, y, 3, 14, C.woodDk);
  // Papers on table
  rect(x - 6, y - 8, 8, 5, '#FFF');
  rect(x + 2, y - 7, 6, 4, '#FFFDE7');
}

function drawCoffeeMachine(gx, gy) {
  const { x, y } = g2s(gx, gy);
  // Machine body
  rect(x - 8, y - 28, 16, 24, '#78909C');
  rect(x - 6, y - 26, 12, 8, '#455A64');
  // Buttons
  rect(x - 4, y - 16, 3, 3, '#EF5350');
  rect(x + 1, y - 16, 3, 3, '#66BB6A');
  // Cup area
  rect(x - 4, y - 10, 8, 6, '#37474F');
  // Cup
  rect(x - 2, y - 9, 5, 5, C.mug);
  rect(x - 1, y - 8, 3, 2, C.mugCoffee);
  // Steam
  const st = Date.now() * 0.003;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 3; i++) {
    const sy = y - 30 - i * 5 - Math.sin(st + i) * 2;
    const sx = x - 1 + Math.cos(st + i * 0.7) * 2;
    ctx.fillRect(Math.round(sx), Math.round(sy), 3, 3);
  }
}

/* ── CAT ───────────────────────────────────────────────────── */
function drawCat() {
  const { x, y } = g2s(1, 5);
  const cx = x + 2;
  const cy = y - 2;
  // Body
  rect(cx - 5, cy - 3, 10, 5, C.cat);
  rect(cx - 5, cy - 3, 10, 2, C.catDk);
  // Head
  rect(cx - 7, cy - 6, 6, 5, C.cat);
  // Ears
  rect(cx - 7, cy - 8, 2, 2, C.catDk);
  rect(cx - 3, cy - 8, 2, 2, C.catDk);
  // Eyes
  const blink = Math.sin(Date.now() * 0.002) > 0.95;
  if (!blink) {
    rect(cx - 6, cy - 4, 1, 1, C.catEye);
    rect(cx - 3, cy - 4, 1, 1, C.catEye);
  }
  // Tail
  const tw = Math.sin(Date.now() * 0.003) * 3;
  rect(cx + 5, cy - 4, 3, 2, C.cat);
  rect(cx + 7 + Math.round(tw), cy - 5, 3, 2, C.catDk);
}

/* ── CHARACTER SPRITES ─────────────────────────────────────── */
const CHAR_OFFSETS = {
  max:   { home: { gx: 2, gy: 3.5 }, meeting: { gx: 4, gy: 5.5 }, coffee: { gx: 8, gy: 5.5 } },
  pixel: { home: { gx: 5, gy: 3.5 }, meeting: { gx: 5, gy: 5.5 }, coffee: { gx: 8.5, gy: 6 } },
  vera:  { home: { gx: 8, gy: 3.5 }, meeting: { gx: 6, gy: 5.5 }, coffee: { gx: 9, gy: 6.5 } },
};

let characters = {
  max:   { gx: 2, gy: 3.5, targetGx: 2, targetGy: 3.5, frame: 0 },
  pixel: { gx: 5, gy: 3.5, targetGx: 5, targetGy: 3.5, frame: 0 },
  vera:  { gx: 8, gy: 3.5, targetGx: 8, targetGy: 3.5, frame: 0 },
};

function drawCharacters() {
  // Sort by depth for correct overlap
  const sorted = ['max', 'pixel', 'vera'].sort((a, b) => {
    return (characters[a].gx + characters[a].gy) - (characters[b].gx + characters[b].gy);
  });
  sorted.forEach(id => {
    const ch = characters[id];
    const { x, y } = g2s(ch.gx, ch.gy);
    const bob = Math.sin(Date.now() * 0.004 + Object.keys(characters).indexOf(id) * 2) * 1.5;
    drawSprite(id, x, y - 4 + bob);
    // Name label
    ctx.fillStyle = id === 'max' ? C.max_shirtDk : id === 'pixel' ? C.pix_shirtDk : C.vera_shirtDk;
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'center';
    const names = { max: 'МАКС', pixel: 'ПІКСЕЛЬ', vera: 'ВІРА' };
    ctx.fillText(names[id], x, y + 16);
  });
}

function drawSprite(id, x, y) {
  const P = 3;
  const frame = characters[id].frame;
  const isWalking = Math.abs(characters[id].gx - characters[id].targetGx) > 0.1 ||
                    Math.abs(characters[id].gy - characters[id].targetGy) > 0.1;
  const legAnim = isWalking ? Math.floor(Date.now() / 200) % 2 : 0;

  if (id === 'max') {
    // Hair
    rect(x-4*P, y-13*P, 8*P, 2*P, C.max_hair);
    rect(x-4*P, y-11*P, 1*P, 1*P, C.max_hair);
    rect(x+3*P, y-11*P, 1*P, 1*P, C.max_hair);
    // Head
    rect(x-3*P, y-11*P, 6*P, 4*P, C.skin);
    // Eyes
    rect(x-2*P, y-10*P, P, P, '#333');
    rect(x+1*P, y-10*P, P, P, '#333');
    // Smile
    rect(x-1*P, y-8*P, 2*P, P, '#C62828');
    // Shirt/jacket
    rect(x-4*P, y-7*P, 8*P, 5*P, C.max_shirt);
    rect(x-4*P, y-7*P, 2*P, 5*P, C.max_shirtDk);
    rect(x+2*P, y-7*P, 2*P, 5*P, C.max_shirtDk);
    // Tie
    rect(x-0.5*P, y-7*P, 1*P, 4*P, C.max_tie);
    // Pants
    rect(x-3*P, y-2*P, 6*P, 3*P, C.max_pants);
    // Legs with walk animation
    if (legAnim === 0) {
      rect(x-3*P, y+1*P, 2*P, 3*P, C.max_pants);
      rect(x+1*P, y+1*P, 2*P, 3*P, C.max_pants);
    } else {
      rect(x-3*P, y+1*P, 2*P, 2*P, C.max_pants);
      rect(x+1*P, y, 2*P, 2*P, C.max_pants);
    }
    // Shoes
    rect(x-3*P, y+3*P+(legAnim?-1:0)*P, 3*P, P, C.shoes);
    rect(x+1*P, y+3*P+(legAnim?1:-0)*P, 3*P, P, C.shoes);
  }
  else if (id === 'pixel') {
    // Messy hair
    rect(x-4*P, y-14*P, 8*P, 3*P, C.pix_hair);
    rect(x-5*P, y-13*P, 2*P, 2*P, C.pix_hair);
    rect(x+3*P, y-13*P, 2*P, 2*P, C.pix_hair);
    rect(x-2*P, y-15*P, 3*P, 1*P, C.pix_hair);
    // Head
    rect(x-3*P, y-11*P, 6*P, 4*P, C.skin);
    // Headband
    rect(x-4*P, y-11*P, 8*P, P, C.pix_band);
    // Eyes (big, artistic)
    rect(x-2*P, y-10*P, 1*P, 1*P, '#333');
    rect(x+1*P, y-10*P, 1*P, 1*P, '#333');
    // Big smile
    rect(x-2*P, y-8*P, 4*P, P, '#E91E63');
    // T-shirt
    rect(x-4*P, y-7*P, 8*P, 5*P, C.pix_shirt);
    // Star on shirt
    rect(x-1*P, y-5*P, 2*P, 2*P, C.pix_band);
    // Jeans
    rect(x-3*P, y-2*P, 6*P, 3*P, C.pix_pants);
    // Legs
    if (legAnim === 0) {
      rect(x-3*P, y+1*P, 2*P, 3*P, C.pix_pants);
      rect(x+1*P, y+1*P, 2*P, 3*P, C.pix_pants);
    } else {
      rect(x-3*P, y+1*P, 2*P, 2*P, C.pix_pants);
      rect(x+1*P, y, 2*P, 2*P, C.pix_pants);
    }
    // Sneakers
    rect(x-4*P, y+3*P+(legAnim?-1:0)*P, 3*P, P, '#FFF');
    rect(x+1*P, y+3*P+(legAnim?1:0)*P, 3*P, P, '#FFF');
  }
  else if (id === 'vera') {
    // Long hair
    rect(x-4*P, y-13*P, 8*P, 2*P, C.vera_hair);
    rect(x-5*P, y-11*P, 2*P, 7*P, C.vera_hair);
    rect(x+3*P, y-11*P, 2*P, 7*P, C.vera_hair);
    // Head
    rect(x-3*P, y-11*P, 6*P, 4*P, C.skin);
    // Glasses
    rect(x-3*P, y-10*P, 2*P, 2*P, C.vera_glass);
    rect(x+1*P, y-10*P, 2*P, 2*P, C.vera_glass);
    rect(x-1*P, y-10*P, 2*P, P, C.vera_glass);
    // Eyes behind glasses
    rect(x-2*P, y-9*P, P, P, '#333');
    rect(x+1*P, y-9*P, P, P, '#333');
    // Mouth
    rect(x-1*P, y-8*P, 2*P, P, '#C62828');
    // Hoodie
    rect(x-4*P, y-7*P, 8*P, 5*P, C.vera_shirt);
    rect(x-4*P, y-7*P, 8*P, 1*P, C.vera_shirtDk);
    // Hoodie pocket
    rect(x-2*P, y-4*P, 4*P, 2*P, C.vera_shirtDk);
    // Pants
    rect(x-3*P, y-2*P, 6*P, 3*P, C.vera_pants);
    // Legs
    if (legAnim === 0) {
      rect(x-3*P, y+1*P, 2*P, 3*P, C.vera_pants);
      rect(x+1*P, y+1*P, 2*P, 3*P, C.vera_pants);
    } else {
      rect(x-3*P, y+1*P, 2*P, 2*P, C.vera_pants);
      rect(x+1*P, y, 2*P, 2*P, C.vera_pants);
    }
    // Boots
    rect(x-3*P, y+3*P+(legAnim?-1:0)*P, 3*P, P, C.shoesDk);
    rect(x+1*P, y+3*P+(legAnim?1:0)*P, 3*P, P, C.shoesDk);
  }
}

/* ── POSITION BUBBLE OVERLAYS ──────────────────────────────── */
function updateBubblePositions() {
  ['max', 'pixel', 'vera'].forEach(id => {
    const ch = characters[id];
    const { x, y } = g2s(ch.gx, ch.gy);
    const bubble = document.getElementById(`bubble-${id}`);
    if (!bubble) return;

    // Convert canvas coords to viewport coords
    const vp = document.getElementById('viewport');
    const scaleX = vp.clientWidth / W;
    const scaleY = vp.clientHeight / H;

    const bx = x * scaleX;
    const by = (y - 55) * scaleY;

    bubble.style.left = `${bx}px`;
    bubble.style.top = `${by}px`;
    bubble.style.transform = 'translate(-50%, -100%)';
  });
}

/* ── ANIMATION LOOP ────────────────────────────────────────── */
function animate() {
  // Interpolate character positions
  ['max', 'pixel', 'vera'].forEach(id => {
    const ch = characters[id];
    const dx = ch.targetGx - ch.gx;
    const dy = ch.targetGy - ch.gy;
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      ch.gx += dx * 0.04;
      ch.gy += dy * 0.04;
    } else {
      ch.gx = ch.targetGx;
      ch.gy = ch.targetGy;
    }
  });

  drawScene();
  updateBubblePositions();
  requestAnimationFrame(animate);
}

/* ══════════════════════════════════════════════════════════════
   AGENT SIMULATION — 3-round workflow
   ══════════════════════════════════════════════════════════════ */

/* ── AGENT PROMPTS (Ukrainian) ─────────────────────────────── */
const SYSTEM_PROMPTS = {
  strategist: `Ти — Макс, бренд-стратег у маленькій креативній агенції.
Ти думаєш про бізнес-цілі, цільову аудиторію, позиціонування, конкурентні переваги та культурні інсайти.
Ти дуже гострий на думку, конкретний і стратегічний.
Відповідай УКРАЇНСЬКОЮ. Коротко — 1-2 речення. Від першої особи, як думка вголос.`,

  designer: `Ти — Піксель, візуальний дизайнер у маленькій креативній агенції.
Ти думаєш про кольори, типографіку, візуальну ієрархію, емоції, стиль та UX.
Ти пристрасний до естетики, ненавидиш кліше та завжди шукаєш несподівані рішення.
Відповідай УКРАЇНСЬКОЮ. Коротко — 1-2 речення. Від першої особи, як думка вголос.`,

  copywriter: `Ти — Віра, копірайтер у маленькій креативній агенції.
Ти думаєш про назви, слогани, tone of voice, наратив, точне слово, емоційний гачок.
Ти одержима мовою, ненавидиш канцеляризми і шукаєш ідеальну фразу.
Відповідай УКРАЇНСЬКОЮ. Коротко — 1-2 речення. Від першої особи, як думка вголос.`,
};

const FINAL_PROMPTS = {
  strategist: `На основі всього обговорення, сформулюй ФІНАЛЬНЕ ПОЗИЦІОНУВАННЯ бренду.
Формат відповіді (тільки це, нічого більше):
ПОЗИЦІОНУВАННЯ: [одне чітке речення]`,

  designer: `На основі обговорення, запропонуй концепцію логотипу.
Формат відповіді (тільки це, нічого більше):
КОНЦЕПЦІЯ: [опис логотипу: форма, кольори, стиль, в 2-3 реченнях]
SVG: [простий SVG код логотипу, viewBox="0 0 100 100", максимум 3 кольори, прості геометричні форми, БЕЗ тексту в SVG]`,

  copywriter: `На основі обговорення, запропонуй назву бренду та слоган.
Формат відповіді (тільки це, нічого більше):
НАЗВА: [назва]
СЛОГАН: [слоган]`,
};

/* ── DEMO THOUGHTS (Ukrainian, for offline mode) ───────────── */
const DEMO = {
  strategist: {
    round1: [
      "Цільова аудиторія — це не всі. Треба зрізати до болю конкретно, хто ці люди і чого вони бояться.",
      "Головне питання: яку порожню нішу ми займемо? Конкуренти вже зайняли очевидне.",
    ],
    round2: [
      "Згоден з Пікселем — візуальна мова має йти від позиціонування. Але спочатку — ЧИМ ми відрізняємося.",
      "Віра правильно каже про емоцію. Але емоція без стратегії — це просто крик у порожнечу.",
    ],
    final: "ПОЗИЦІОНУВАННЯ: Бренд для тих, хто втомився від фальші — чесний, локальний, без зайвих прикрас.",
  },
  designer: {
    round1: [
      "Вже бачу палітру: теплі відтінки, крафтові текстури, але з сучасним мінімалізмом. Ніякого глянцю.",
      "Типографіка — це 50% характеру бренду. Потрібен шрифт з історією, не черговий гротеск.",
    ],
    round2: [
      "Стратегія Макса про нішу — це добре. Візуально це означає: менше, але точніше. Кожен елемент має говорити.",
      "Назва від Віри буде диктувати форму логотипу. Чекаю на неї, але вже скечу геометрію.",
    ],
    final: "КОНЦЕПЦІЯ: Мінімалістичний логотип — тепле коло з м'яким градієнтом, всередині — абстрактна геометрична форма.\nSVG: <svg viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"50\" cy=\"50\" r=\"45\" fill=\"#E8A87C\"/><circle cx=\"50\" cy=\"50\" r=\"30\" fill=\"#D4735E\"/><rect x=\"38\" y=\"35\" width=\"24\" height=\"24\" rx=\"4\" fill=\"#FFF5EE\" transform=\"rotate(45 50 47)\"/></svg>",
  },
  copywriter: {
    round1: [
      "Ключове — знайти напругу між тим, що є, і тим, що хочуть. Саме в цій щілині живе бренд-войс.",
      "Перші 30 назв — у кошик. Ідеальна назва прийде, коли перестанеш її шукати. Але працювати треба.",
    ],
    round2: [
      "Макс каже — конкретність. Я перекладаю це в слова: не 'якість', а конкретна деталь, яку відчуваєш.",
      "Піксель хоче крафт + мінімалізм. В словах це значить — коротко, тепло, без пафосу.",
    ],
    final: "НАЗВА: ТЕПЛИЦЯ\nСЛОГАН: Тут росте справжнє",
  },
};

/* ── SIMULATION STATE ──────────────────────────────────────── */
let simRunning = false;
let simTimer = null;
let simSeconds = 0;
let clockTimer = null;
let currentBrief = '';
let agentThoughts = { max: '', pixel: '', vera: '' };
let currentPhase = 0; // 0=idle, 1=analysis, 2=discussion, 3=final

/* ── CLAUDE API ────────────────────────────────────────────── */
async function callClaude(system, user, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `API ${res.status}`);
  }
  const data = await res.json();
  return data.content[0]?.text?.trim() || '...';
}

/* ── THINK FUNCTION ────────────────────────────────────────── */
async function agentThink(id, role, prompt, apiKey) {
  const bubble = document.getElementById(`bubble-${id}`);
  const textEl = document.getElementById(`bubbleText-${id}`);
  if (!bubble || !textEl) return '';

  // Show bubble with typing indicator
  bubble.classList.add('visible');
  textEl.textContent = '';
  textEl.classList.add('typing');

  let thought;
  if (!apiKey) {
    // Demo mode
    const phase = currentPhase === 1 ? 'round1' : currentPhase === 2 ? 'round2' : 'final';
    if (phase === 'final') {
      thought = DEMO[role].final;
    } else {
      const pool = DEMO[role][phase];
      thought = pool[Math.floor(Math.random() * pool.length)];
    }
    await sleep(1500 + Math.random() * 1000);
  } else {
    try {
      thought = await callClaude(SYSTEM_PROMPTS[role], prompt, apiKey);
    } catch (err) {
      log('СИСТЕМА', `Помилка API: ${err.message}`, 'system');
      thought = '...не вдалося подумати...';
    }
  }

  // Type out the thought
  textEl.classList.remove('typing');
  await typeText(textEl, thought, 25);

  agentThoughts[id] = thought;
  log(id === 'max' ? 'МАКС' : id === 'pixel' ? 'ПІКСЕЛЬ' : 'ВІРА', thought, role);

  return thought;
}

function hideBubble(id) {
  const bubble = document.getElementById(`bubble-${id}`);
  if (bubble) bubble.classList.remove('visible');
}

/* ── PHASES ─────────────────────────────────────────────────── */
function showPhase(text) {
  const ov = document.getElementById('phaseOverlay');
  const title = document.getElementById('phaseTitle');
  title.textContent = text;
  ov.classList.add('visible');
  // Update badge
  document.getElementById('phaseBadge').textContent = text;
  setTimeout(() => ov.classList.remove('visible'), 3000);
}

async function runSimulation(apiKey) {
  if (!simRunning) return;

  // ═══ PHASE 1: АНАЛІЗ ═══
  currentPhase = 1;
  showPhase('РАУНД 1 — АНАЛІЗ');
  log('СИСТЕМА', '── Раунд 1: Кожен аналізує бриф ──', 'system');

  // Move everyone to desks
  moveChar('max', 'home');
  moveChar('pixel', 'home');
  moveChar('vera', 'home');
  await sleep(1500);

  // Think sequentially with delays
  for (const [id, role] of [['max','strategist'],['pixel','designer'],['vera','copywriter']]) {
    if (!simRunning) return;
    await agentThink(id, role, `Бриф проєкту: ${currentBrief}\n\nТвої перші думки і аналіз?`, apiKey);
    await sleep(2000);
  }

  await sleep(4000);
  ['max','pixel','vera'].forEach(hideBubble);

  if (!simRunning) return;

  // ═══ PHASE 2: ОБГОВОРЕННЯ ═══
  currentPhase = 2;
  showPhase('РАУНД 2 — ОБГОВОРЕННЯ');
  log('СИСТЕМА', '── Раунд 2: Обговорення ідей ──', 'system');

  // Move to meeting table
  moveChar('max', 'meeting');
  moveChar('pixel', 'meeting');
  moveChar('vera', 'meeting');
  await sleep(2000);

  for (const [id, role] of [['max','strategist'],['pixel','designer'],['vera','copywriter']]) {
    if (!simRunning) return;
    const others = Object.entries(agentThoughts)
      .filter(([k]) => k !== id)
      .map(([k, v]) => {
        const name = k === 'max' ? 'Макс (стратег)' : k === 'pixel' ? 'Піксель (дизайнер)' : 'Віра (копірайтер)';
        return `${name}: "${v}"`;
      }).join('\n');

    const prompt = `Бриф: ${currentBrief}\n\nДумки колег:\n${others}\n\nТвоя реакція, зауваження, розвиток ідей?`;
    await agentThink(id, role, prompt, apiKey);
    await sleep(2500);
  }

  await sleep(4000);
  ['max','pixel','vera'].forEach(hideBubble);

  if (!simRunning) return;

  // ═══ PHASE 3: ФІНАЛ ═══
  currentPhase = 3;
  showPhase('РАУНД 3 — ФІНАЛ');
  log('СИСТЕМА', '── Раунд 3: Фінальні рішення ──', 'system');

  // Back to desks
  moveChar('max', 'home');
  moveChar('pixel', 'home');
  moveChar('vera', 'home');
  await sleep(1500);

  const results = {};
  for (const [id, role] of [['max','strategist'],['pixel','designer'],['vera','copywriter']]) {
    if (!simRunning) return;
    const allThoughts = Object.entries(agentThoughts)
      .map(([k, v]) => {
        const name = k === 'max' ? 'Макс' : k === 'pixel' ? 'Піксель' : 'Віра';
        return `${name}: "${v}"`;
      }).join('\n');

    const prompt = `Бриф: ${currentBrief}\n\nПідсумок обговорення:\n${allThoughts}\n\n${FINAL_PROMPTS[role]}`;
    results[id] = await agentThink(id, role, prompt, apiKey);
    await sleep(2000);
  }

  // Show results
  showResults(results);
  log('СИСТЕМА', '★ Агенція завершила роботу! ★', 'system');
  currentPhase = 0;
  document.getElementById('phaseBadge').textContent = 'ГОТОВО';
}

/* ── RESULTS ───────────────────────────────────────────────── */
function showResults(results) {
  const section = document.getElementById('resultsSection');
  section.style.display = 'block';

  // Strategy
  document.getElementById('resultStrategy').textContent =
    extractField(results.max, 'ПОЗИЦІОНУВАННЯ') || results.max || '—';

  // Copy
  const name = extractField(results.vera, 'НАЗВА') || '—';
  const slogan = extractField(results.vera, 'СЛОГАН') || '—';
  document.getElementById('resultCopy').innerHTML =
    `<strong>Назва:</strong> ${esc(name)}<br><strong>Слоган:</strong> ${esc(slogan)}`;

  // Design
  const concept = extractField(results.pixel, 'КОНЦЕПЦІЯ') || results.pixel || '—';
  document.getElementById('resultDesign').textContent = concept;

  // Try to render SVG logo
  const svgMatch = (results.pixel || '').match(/<svg[\s\S]*?<\/svg>/i);
  const preview = document.getElementById('logoPreview');
  if (svgMatch) {
    // Sanitize: only allow safe SVG elements
    const safe = svgMatch[0]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
    preview.innerHTML = safe;
  } else {
    preview.innerHTML = '';
  }
}

function extractField(text, field) {
  if (!text) return '';
  const regex = new RegExp(`${field}:\\s*(.+?)(?:\\n|$)`, 'i');
  const m = text.match(regex);
  return m ? m[1].trim() : '';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ── MOVEMENT ──────────────────────────────────────────────── */
function moveChar(id, location) {
  const target = CHAR_OFFSETS[id][location];
  if (!target) return;
  characters[id].targetGx = target.gx;
  characters[id].targetGy = target.gy;
  const locNames = { home: 'за столом', meeting: 'на нараді', coffee: 'біля кави' };
  const charNames = { max: 'МАКС', pixel: 'ПІКСЕЛЬ', vera: 'ВІРА' };
  log(charNames[id], `→ ${locNames[location] || location}`, id === 'max' ? 'strategist' : id === 'pixel' ? 'designer' : 'copywriter');
}

/* ── CONTROLS ──────────────────────────────────────────────── */
window.Agency = {
  start() {
    if (simRunning) return;
    const brief = document.getElementById('taskInput').value.trim();
    if (!brief) {
      log('СИСТЕМА', 'Введіть завдання для агенції!', 'system');
      document.getElementById('taskInput').focus();
      return;
    }

    currentBrief = brief;
    simRunning = true;
    simSeconds = 0;
    agentThoughts = { max: '', pixel: '', vera: '' };
    currentPhase = 0;

    // Reset characters to home
    Object.keys(characters).forEach(id => {
      const home = CHAR_OFFSETS[id].home;
      characters[id].gx = home.gx;
      characters[id].gy = home.gy;
      characters[id].targetGx = home.gx;
      characters[id].targetGy = home.gy;
    });

    // UI
    setStatus(true);
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnStop').disabled = false;
    document.getElementById('resultsSection').style.display = 'none';

    log('СИСТЕМА', `★ Агенція відкрита!`, 'system');
    log('СИСТЕМА', `Бриф: "${brief}"`, 'system');

    const apiKey = document.getElementById('apiKey').value.trim();
    log('СИСТЕМА', apiKey ? 'Режим Claude AI.' : 'Демо-режим (без API ключа).', 'system');

    // Clock
    clockTimer = setInterval(() => {
      simSeconds++;
      const m = String(Math.floor(simSeconds / 60)).padStart(2, '0');
      const s = String(simSeconds % 60).padStart(2, '0');
      document.getElementById('clockDisplay').textContent = `${m}:${s}`;
    }, 1000);

    // Run the workflow
    runSimulation(apiKey).then(() => {
      if (simRunning) {
        simRunning = false;
        clearInterval(clockTimer);
        setStatus(false);
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStop').disabled = true;
      }
    });
  },

  stop() {
    simRunning = false;
    clearInterval(clockTimer);
    ['max', 'pixel', 'vera'].forEach(hideBubble);
    setStatus(false);
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStop').disabled = true;
    document.getElementById('phaseBadge').textContent = '—';
    log('СИСТЕМА', '■ Симуляцію зупинено.', 'system');
  }
};

/* ── UI HELPERS ────────────────────────────────────────────── */
function setStatus(active) {
  document.getElementById('statusDot').className = 'status-dot' + (active ? ' active' : '');
  document.getElementById('statusText').textContent = active ? 'LIVE' : 'ОФЛАЙН';
}

function log(who, msg, role) {
  const feed = document.getElementById('logFeed');
  const row = document.createElement('div');
  row.className = `log-row ${role || 'system'}`;
  row.innerHTML = `<span class="log-who">${esc(who)}</span><span class="log-msg">${esc(msg)}</span>`;
  feed.insertBefore(row, feed.firstChild);
  while (feed.children.length > 80) feed.removeChild(feed.lastChild);
}

/* ── UTILITIES ─────────────────────────────────────────────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeText(el, text, speed) {
  el.textContent = '';
  for (const ch of text) {
    if (!simRunning) break;
    el.textContent += ch;
    await sleep(speed);
  }
}

/* ── INIT ──────────────────────────────────────────────────── */
initCanvas();
animate();
log('СИСТЕМА', 'Введіть завдання та натисніть ЗАПУСТИТИ.', 'system');
