/* The Agent Call Sheet: Oasis Camp.
 * An original, dependency-free canvas game that presents the kit's five layers.
 * Every image is painted procedurally at runtime and every sound is synthesized
 * with the Web Audio API. Content comes from the <article data-postcard> blocks
 * in index.html, so the page stays fully readable without JavaScript.
 */
(() => {
  'use strict';

  // ------------------------------------------------------------------ helpers
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const TAU = Math.PI * 2;
  function rng(seed) { // mulberry32
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, t) { const a = hex(c1), b = hex(c2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; }
  function rgba(c, a) { const v = hex(c); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; }

  // ------------------------------------------------------------------ storage (best effort)
  const KEY = 'acs-oasis-v1';
  function readSave() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function writeSave(obj) { try { localStorage.setItem(KEY, JSON.stringify(obj)); return true; } catch (e) { return false; } }

  const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const DEFAULTS = { sound: false, music: 45, amb: 60, motion: mqReduce.matches, shake: true, contrast: false, large: false, time: 'cycle' };
  const saved = readSave() || {};
  const settings = Object.assign({}, DEFAULTS, saved.settings || {});
  const state = {
    visited: new Set(saved.visited || []),
    found: new Set(saved.found || []),
    tutorialSeen: !!saved.tutorialSeen,
    completedShown: !!saved.completedShown,
    playTime: saved.playTime || 0,
    player: saved.player || null,
  };
  const photos = []; // {url} kept for this visit only

  function snapshot() {
    return {
      v: 1, settings, visited: [...state.visited], found: [...state.found],
      tutorialSeen: state.tutorialSeen, completedShown: state.completedShown,
      playTime: Math.round(state.playTime), player: { x: Math.round(player.x), y: Math.round(player.y) },
    };
  }
  function autosave() { writeSave(snapshot()); }

  // ------------------------------------------------------------------ DOM
  const body = document.body;
  const root = document.documentElement;
  const game = $('game');
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  const titleEl = $('title');
  const toastEl = $('toast');
  const interactBtn = $('btn-interact');
  const goalCount = $('goal-count');
  const dialogs = ['dlg-tutorial', 'dlg-pause', 'dlg-settings', 'dlg-postcard', 'dlg-gallery', 'dlg-results'].map($);
  const cards = {};
  document.querySelectorAll('article[data-postcard]').forEach((a) => { cards[a.dataset.postcard] = a; });

  // ------------------------------------------------------------------ world layout
  const W = 2000, H = 1200, HORIZON = 150;
  const POND = { x: 1000, y: 660, rx: 160, ry: 84 };
  const SITES = [
    { id: 'archive', kind: 'district', x: 500, y: 440 },
    { id: 'gate', kind: 'district', x: 1000, y: 330 },
    { id: 'well', kind: 'district', x: 1500, y: 440 },
    { id: 'tower', kind: 'district', x: 1500, y: 900 },
    { id: 'bridge', kind: 'district', x: 520, y: 880 },
    { id: 'overlook', kind: 'landmark', x: 230, y: 230 },
    { id: 'gauge', kind: 'landmark', x: 1770, y: 245 },
    { id: 'ruins', kind: 'landmark', x: 190, y: 1090 },
    { id: 'board', kind: 'landmark', x: 1000, y: 1100 },
    { id: 'cinema', kind: 'landmark', x: 1810, y: 1085 },
  ];
  SITES.forEach((s) => {
    const a = cards[s.id];
    s.name = a ? a.dataset.place : s.id;
    s.layer = a ? a.dataset.layer : '';
  });
  const byId = Object.fromEntries(SITES.map((s) => [s.id, s]));
  const DISTRICTS = SITES.filter((s) => s.kind === 'district');

  // Canals: pond edge -> district, sampled quadratic curves.
  function makeCanal(site, endX, endY, bend) {
    const ang = Math.atan2(endY - POND.y, endX - POND.x);
    const sx = POND.x + Math.cos(ang) * POND.rx * 0.92, sy = POND.y + Math.sin(ang) * POND.ry * 0.92;
    const mx = (sx + endX) / 2, my = (sy + endY) / 2;
    const nx = -(endY - sy), ny = endX - sx, nl = Math.hypot(nx, ny) || 1;
    const cx = mx + (nx / nl) * bend, cy = my + (ny / nl) * bend;
    const pts = []; let len = 0;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, u = 1 - t;
      const x = u * u * sx + 2 * u * t * cx + t * t * endX;
      const y = u * u * sy + 2 * u * t * cy + t * t * endY;
      if (i) len += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
      pts.push({ x, y, d: len });
    }
    return { pts, len };
  }
  const canals = {
    archive: makeCanal(byId.archive, 520, 500, 60),
    gate: makeCanal(byId.gate, 1000, 392, 0.01),
    well: makeCanal(byId.well, 1480, 500, -60),
    tower: makeCanal(byId.tower, 1470, 960, 50),
    bridge: makeCanal(byId.bridge, 330, 990, -40),
  };
  // The bridge district sits across its own canal, 72% of the way along.
  (() => { const c = canals.bridge; const target = c.len * 0.72; const p = c.pts.find((q) => q.d >= target) || c.pts[c.pts.length - 1]; byId.bridge.x = p.x; byId.bridge.y = p.y; })();

  const flow = {}, growth = {};
  DISTRICTS.forEach((d) => { flow[d.id] = state.visited.has(d.id) ? 1 : 0; growth[d.id] = flow[d.id]; });

  // Gardens near each canal's end.
  const gardens = {};
  const gr = rng(41);
  DISTRICTS.forEach((d) => {
    const end = canals[d.id].pts[canals[d.id].pts.length - 1];
    const list = [];
    const offs = d.id === 'bridge' ? [[-60, 20], [40, 40], [-10, 70], [80, -10]] : [[-90, 40], [90, 40], [-60, 92], [60, 92]];
    offs.forEach(([ox, oy]) => list.push({ x: end.x + ox, y: end.y + oy, rot: (gr() - 0.5) * 0.3, w: 70 + gr() * 18, h: 38 + gr() * 8 }));
    gardens[d.id] = list;
  });

  // Palms: a ring round the pond plus a pair at each district.
  const palms = [];
  (() => {
    const r = rng(9);
    const starts = Object.values(canals).map((c) => Math.atan2(c.pts[0].y - POND.y, c.pts[0].x - POND.x));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + r() * 0.15;
      if (starts.some((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < 0.28)) continue;
      palms.push({ x: POND.x + Math.cos(a) * POND.rx * 1.38, y: POND.y + Math.sin(a) * POND.ry * 1.55, s: 0.8 + r() * 0.35, ph: r() * TAU, owner: null });
    }
    DISTRICTS.forEach((d) => {
      if (d.id === 'bridge') { palms.push({ x: d.x - 110, y: d.y - 30, s: 0.95, ph: r() * TAU, owner: d.id }); palms.push({ x: d.x + 120, y: d.y + 60, s: 1.05, ph: r() * TAU, owner: d.id }); return; }
      palms.push({ x: d.x - 130, y: d.y + 18, s: 0.9 + r() * 0.2, ph: r() * TAU, owner: d.id });
      palms.push({ x: d.x + 135, y: d.y + 10, s: 0.95 + r() * 0.2, ph: r() * TAU, owner: d.id });
    });
  })();

  // ------------------------------------------------------------------ terrain (painted once)
  let terrain = null;
  function paintTerrain() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const r = rng(7);
    const base = g.createLinearGradient(0, HORIZON, 0, H);
    base.addColorStop(0, '#e9bd82'); base.addColorStop(0.5, '#e2ad6c'); base.addColorStop(1, '#d69c5c');
    g.fillStyle = base; g.fillRect(0, HORIZON - 4, W, H);
    // dune bands with ridge highlights and soft shadow
    for (let i = 0; i < 10; i++) {
      const y0 = HORIZON + 20 + i * 112 + r() * 26, a = 18 + r() * 22, f = 0.002 + r() * 0.003, ph = r() * 10, ph2 = r() * 10;
      const ridge = [];
      for (let x = -20; x <= W + 20; x += 16) ridge.push([x, y0 + Math.sin(x * f + ph) * a + Math.sin(x * f * 2.7 + ph2) * a * 0.35]);
      g.beginPath(); g.moveTo(-20, H);
      ridge.forEach(([x, y]) => g.lineTo(x, y));
      g.lineTo(W + 20, H); g.closePath();
      const fill = g.createLinearGradient(0, y0 - a, 0, y0 + 110);
      fill.addColorStop(0, 'rgba(246,212,158,0.55)'); fill.addColorStop(1, 'rgba(214,156,92,0)');
      g.fillStyle = fill; g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); ridge.forEach(([x, y], k) => (k ? g.lineTo(x, y + 7) : g.moveTo(x, y + 7)));
      g.strokeStyle = 'rgba(176,112,58,0.22)'; g.lineWidth = 9; g.stroke();
      g.beginPath(); ridge.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = 'rgba(252,230,190,0.6)'; g.lineWidth = 3; g.stroke();
    }
    // tactile speckle and brush strokes
    const speck = ['#f6d7a4', '#c98f4a', '#b77a3e', '#fbe6c2', '#d9a465'];
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = rgba(speck[(r() * speck.length) | 0], 0.06 + r() * 0.12);
      const x = r() * W, y = HORIZON + r() * (H - HORIZON);
      g.beginPath(); g.ellipse(x, y, 1 + r() * 2.6, 0.6 + r() * 1.4, r() * Math.PI, 0, TAU); g.fill();
    }
    for (let i = 0; i < 700; i++) {
      const x = r() * W, y = HORIZON + r() * (H - HORIZON), l = 10 + r() * 40;
      g.strokeStyle = rgba(r() < 0.5 ? '#f8dcae' : '#bf8447', 0.05 + r() * 0.07); g.lineWidth = 2 + r() * 4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4 - r() * 6, x + l, y + (r() - 0.5) * 4); g.stroke();
    }
    // footpaths from the pond to every site
    g.lineCap = 'round';
    SITES.forEach((s) => {
      const sx = POND.x + (s.x - POND.x) * 0.18, sy = POND.y + (s.y - POND.y) * 0.18;
      const cx = (sx + s.x) / 2 + (s.y - POND.y) * 0.12, cy = (sy + s.y) / 2 - (s.x - POND.x) * 0.05;
      const ey = s.y + (s.kind === 'district' ? 36 : 20);
      g.strokeStyle = 'rgba(160,104,58,0.18)'; g.lineWidth = 40;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, s.x, ey); g.stroke();
      g.strokeStyle = 'rgba(244,214,165,0.55)'; g.lineWidth = 30;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, s.x, ey); g.stroke();
    });
    // canal beds (dry until restored)
    Object.values(canals).forEach((cn) => {
      g.beginPath(); cn.pts.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.strokeStyle = '#b07a48'; g.lineWidth = 30; g.stroke();
      g.strokeStyle = '#7c5032'; g.lineWidth = 20; g.stroke();
      g.strokeStyle = 'rgba(60,36,20,0.35)'; g.lineWidth = 10; g.stroke();
    });
    // pond basin rim
    g.fillStyle = '#9c6a3e';
    g.beginPath(); g.ellipse(POND.x, POND.y + 6, POND.rx + 22, POND.ry + 16, 0, 0, TAU); g.fill();
    g.fillStyle = '#c99a64';
    g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx + 14, POND.ry + 10, 0, 0, TAU); g.fill();
    // scattered stones
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = HORIZON + 40 + r() * (H - HORIZON - 60), s = 3 + r() * 9;
      if (Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry) < 1.6) continue;
      g.fillStyle = 'rgba(90,58,34,0.25)'; g.beginPath(); g.ellipse(x + 2, y + s * 0.5, s, s * 0.45, 0, 0, TAU); g.fill();
      g.fillStyle = '#a77a52'; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,236,200,0.5)'; g.beginPath(); g.ellipse(x - s * 0.3, y - s * 0.25, s * 0.4, s * 0.25, 0, 0, TAU); g.fill();
    }
    return c;
  }

  // ------------------------------------------------------------------ time of day
  let tod = 0.36; // 0 midnight, .25 dawn, .5 noon, .75 dusk
  const FIXED = { dawn: 0.265, noon: 0.5, dusk: 0.735, night: 0.95 };
  let photoTod = null;
  function curTod() { return photoTod != null ? photoTod : tod; }
  function light(t) {
    const day = clamp(Math.sin(((t - 0.22) / 0.56) * Math.PI), 0, 1);
    const night = 1 - smooth(0, 0.32, day);
    const warm = clamp(1 - Math.abs(day - 0.25) / 0.25, 0, 1) * (t > 0.15 && t < 0.85 ? 1 : 0);
    return { day, night, warm };
  }

  // ------------------------------------------------------------------ actors
  const player = { x: state.player ? state.player.x : POND.x + 40, y: state.player ? state.player.y : POND.y + 150, vx: 0, vy: 0, face: 1, walk: 0, moving: false, target: null, pending: null };
  const residents = [];
  (() => {
    const r = rng(23);
    const robes = ['#2f7f86', '#b85c32', '#7a4e8c', '#d8a03c', '#4d7a3b', '#9c3d3d', '#3f5f8f'];
    for (let i = 0; i < 9; i++) {
      const home = DISTRICTS[i % DISTRICTS.length];
      residents.push({ x: home.x + (r() - 0.5) * 120, y: home.y + 60 + r() * 40, tx: 0, ty: 0, wait: r() * 4, speed: 34 + r() * 22, robe: robes[i % robes.length], wrap: r() < 0.5 ? '#f3e2c4' : '#e9c46a', skin: ['#8a5a3c', '#c48a5e', '#6f4a33', '#d9a77c'][i % 4], home: home.id, ph: r() * TAU, carry: r() < 0.4 });
    }
  })();

  const particles = [];
  function seedParticles() {
    particles.length = 0;
    const r = rng(77);
    for (let i = 0; i < 70; i++) particles.push({ type: 'sand', x: r() * W, y: HORIZON + r() * (H - HORIZON), s: 0.8 + r() * 1.6, v: 30 + r() * 50, ph: r() * TAU });
    for (let i = 0; i < 34; i++) particles.push({ type: 'mote', x: r() * W, y: HORIZON + r() * (H - HORIZON), s: 1 + r() * 1.5, v: 4 + r() * 8, ph: r() * TAU });
    for (let i = 0; i < 40; i++) {
      const near = i < 16 ? { x: POND.x, y: POND.y, r: 260 } : (() => { const d = DISTRICTS[i % 5]; return { x: d.x, y: d.y + 70, r: 140, id: d.id }; })();
      particles.push({ type: 'fly', cx: near.x, cy: near.y, rad: near.r, id: near.id || null, x: near.x, y: near.y, ph: r() * TAU, sp: 0.2 + r() * 0.4, s: 1.5 + r() });
    }
  }
  seedParticles();
  const splashes = []; // little bursts for discovery moments

  // ------------------------------------------------------------------ camera
  const view = { w: 0, h: 0, dpr: 1 };
  const cam = { x: player.x, y: player.y, zoom: 1, minZoom: 1, maxZoom: 3, follow: true, drift: 0 };
  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth; view.h = window.innerHeight;
    canvas.width = Math.round(view.w * view.dpr); canvas.height = Math.round(view.h * view.dpr);
    cam.minZoom = Math.max(view.w / W, view.h / H);
    cam.maxZoom = cam.minZoom * 2.8;
    const want = view.w < 700 || view.h < 500 ? cam.minZoom * 1.15 : cam.minZoom * 1.35;
    cam.zoom = clamp(cam.zoom === 1 && !resize.done ? want : cam.zoom, cam.minZoom, cam.maxZoom);
    resize.done = true;
    clampCam();
  }
  function clampCam() {
    const hw = view.w / 2 / cam.zoom, hh = view.h / 2 / cam.zoom;
    cam.x = clamp(cam.x, hw, Math.max(hw, W - hw));
    cam.y = clamp(cam.y, hh, Math.max(hh, H - hh));
  }
  function toWorld(sx, sy) { return { x: (sx - view.w / 2) / cam.zoom + cam.x, y: (sy - view.h / 2) / cam.zoom + cam.y }; }
  function toScreen(wx, wy) { return { x: (wx - cam.x) * cam.zoom + view.w / 2, y: (wy - cam.y) * cam.zoom + view.h / 2 }; }

  // ------------------------------------------------------------------ painting primitives
  function shadow(g, x, y, rx, ry, a) { g.fillStyle = `rgba(80,46,24,${a == null ? 0.22 : a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function blotches(g, x, y, w, h, seed, col) {
    const r = rng(seed); g.fillStyle = col;
    for (let i = 0; i < 14; i++) { g.globalAlpha = 0.05 + r() * 0.08; g.beginPath(); g.ellipse(x + r() * w, y + r() * h, 4 + r() * 12, 2 + r() * 6, r(), 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
  // adobe block: x,y bottom-centre of the front face
  function adobe(g, x, y, w, h, d, seed, tone) {
    const front = tone || '#e7bf87';
    shadow(g, x + 10, y + 6, w * 0.62, 14);
    g.fillStyle = mix(front, '#fff2d8', 0.35); rr(g, x - w / 2, y - h - d, w, d + 6, 6); g.fill();      // roof
    g.fillStyle = front; rr(g, x - w / 2, y - h, w, h, 5); g.fill();                                   // wall
    const grad = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    grad.addColorStop(0, 'rgba(255,240,210,0.25)'); grad.addColorStop(1, 'rgba(120,64,30,0.18)');
    g.fillStyle = grad; rr(g, x - w / 2, y - h, w, h, 5); g.fill();
    blotches(g, x - w / 2, y - h, w, h, seed, '#a8693a');
    g.strokeStyle = 'rgba(120,62,30,0.35)'; g.lineWidth = 1.5; rr(g, x - w / 2, y - h, w, h, 5); g.stroke();
    g.fillStyle = '#6b4128'; // vigas
    for (let vx = x - w / 2 + 12; vx < x + w / 2 - 6; vx += 22) { g.fillRect(vx, y - h + 6, 7, 5); }
  }
  function archDoor(g, x, y, w, h, col) {
    g.fillStyle = col || '#4f2e1c';
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h + w / 2); g.arc(x, y - h + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
  }
  function windowArch(g, x, y, w, h, lit) {
    archDoor(g, x, y, w, h, lit > 0.05 ? mix('#4f2e1c', '#ffcf7a', lit) : '#4f2e1c');
  }
  function awning(g, x, y, w, t, c1, c2, sway) {
    const n = 7, sw = w / n;
    for (let i = 0; i < n; i++) {
      const wob = sway ? Math.sin(t * 2.2 + i * 0.9) * 2.2 : 0;
      g.fillStyle = i % 2 ? c1 : c2;
      g.beginPath();
      g.moveTo(x - w / 2 + i * sw, y);
      g.lineTo(x - w / 2 + (i + 1) * sw, y);
      g.lineTo(x - w / 2 + (i + 1) * sw + 3, y + 18 + wob);
      g.quadraticCurveTo(x - w / 2 + (i + 0.5) * sw + 3, y + 24 + wob, x - w / 2 + i * sw + 3, y + 18 + wob);
      g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(80,40,20,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.stroke();
  }
  function lantern(g, x, y, t, lit) {
    g.strokeStyle = '#4a2c1a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y - 4); g.stroke();
    const fl = 0.75 + Math.sin(t * 9 + x) * 0.12 + Math.sin(t * 13.7 + y) * 0.08;
    g.fillStyle = mix('#8a5a2b', '#ffd27a', clamp(lit * fl, 0, 1));
    g.beginPath(); g.ellipse(x, y + 2, 4.5, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#4a2c1a'; g.fillRect(x - 3.5, y - 5, 7, 2); g.fillRect(x - 3, y + 7, 6, 2);
  }
  function cloth(g, x, y, w, h, t, col, sway) {
    const wob = sway ? Math.sin(t * 1.8 + x * 0.01) * 4 : 0;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y);
    g.quadraticCurveTo(x + w / 2 + wob * 0.5, y + h * 0.6, x + w / 2 + wob, y + h);
    g.lineTo(x + wob * 0.8, y + h - 8); g.lineTo(x - w / 2 + wob, y + h);
    g.quadraticCurveTo(x - w / 2 + wob * 0.5, y + h * 0.6, x - w / 2, y); g.closePath(); g.fill();
  }
  function flag(g, x, y, h, t, col, sway) {
    g.strokeStyle = '#5a3a24'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h);
    for (let i = 0; i <= 6; i++) { const fx = x + i * 5, fy = y - h + (sway ? Math.sin(t * 4 - i * 0.8) * 2.5 : 0); g.lineTo(fx, fy); }
    for (let i = 6; i >= 0; i--) { const fx = x + i * 5, fy = y - h + 14 + (sway ? Math.sin(t * 4 - i * 0.8) * 2.5 : 0); g.lineTo(fx, fy); }
    g.closePath(); g.fill();
  }
  function palm(g, p, t, sway, lush) {
    const s = p.s, x = p.x, y = p.y;
    shadow(g, x + 18 * s, y + 4, 34 * s, 9 * s, 0.18);
    const lean = Math.sin(p.ph) * 14 * s;
    const sw = sway ? Math.sin(t * 1.2 + p.ph) * 4 * s : 0;
    const topX = x + lean + sw, topY = y - 92 * s;
    // trunk with ring marks
    g.strokeStyle = '#8b5e3c'; g.lineWidth = 8 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.2, y - 50 * s, topX, topY); g.stroke();
    g.strokeStyle = 'rgba(70,40,22,0.45)'; g.lineWidth = 2 * s;
    for (let i = 1; i < 9; i++) {
      const tt = i / 9, u = 1 - tt;
      const bx = u * u * x + 2 * u * tt * (x + lean * 0.2) + tt * tt * topX, by = u * u * y + 2 * u * tt * (y - 50 * s) + tt * tt * topY;
      g.beginPath(); g.moveTo(bx - 4 * s, by); g.lineTo(bx + 4 * s, by - 1.5 * s); g.stroke();
    }
    const green = mix('#a88a4a', '#3f7d3a', lush), green2 = mix('#c2a25c', '#5c9a45', lush);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + (sway ? Math.sin(t * 1.5 + p.ph + i) * 0.07 : 0);
      const len = (40 + (i % 2) * 10) * s, droop = 18 * s;
      const ex = topX + Math.cos(a) * len, ey = topY + Math.sin(a) * len * 0.45 + droop;
      g.fillStyle = i % 2 ? green : green2;
      g.beginPath(); g.moveTo(topX, topY);
      g.quadraticCurveTo(topX + Math.cos(a - 0.35) * len * 0.6, topY + Math.sin(a - 0.35) * len * 0.3 - 10 * s, ex, ey);
      g.quadraticCurveTo(topX + Math.cos(a + 0.3) * len * 0.5, topY + Math.sin(a + 0.3) * len * 0.25 + 2 * s, topX, topY);
      g.fill();
    }
    if (lush > 0.6) { g.fillStyle = '#7a4a22'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(topX - 4 * s + i * 3 * s, topY + 5 * s, 2.6 * s, 0, TAU); g.fill(); } }
  }

  // ------------------------------------------------------------------ buildings & landmarks
  function drawSite(g, s, t, L, sway) {
    const restored = s.kind === 'district' ? growth[s.id] : 0;
    const lit = L.night;
    const x = s.x, y = s.y;
    switch (s.id) {
      case 'archive': {
        adobe(g, x, y, 190, 84, 38, 11);
        g.fillStyle = '#d4864e'; g.beginPath(); g.ellipse(x, y - 108, 40, 34, 0, Math.PI, 0); g.fill(); // dome
        g.fillStyle = 'rgba(255,230,190,0.45)'; g.beginPath(); g.ellipse(x - 12, y - 124, 12, 8, -0.4, 0, TAU); g.fill();
        g.fillStyle = '#b86a3a'; g.fillRect(x - 41, y - 110, 82, 5);
        g.fillStyle = '#e9c35a'; g.beginPath(); g.arc(x, y - 145, 4, 0, TAU); g.fill();
        archDoor(g, x, y, 34, 52);
        [-62, -34, 34, 62].forEach((o) => windowArch(g, x + o, y - 34, 14, 26, lit * 0.9));
        awning(g, x, y - 58, 64, t, '#2f8f93', '#f3e2c4', sway);
        lantern(g, x - 30, y - 40, t, lit); lantern(g, x + 30, y - 40, t, lit);
        // scroll crates
        g.fillStyle = '#8a5a34'; rr(g, x + 70, y - 18, 26, 18, 3); g.fill(); g.fillStyle = '#f1dfbd'; g.fillRect(x + 74, y - 22, 18, 5);
        break;
      }
      case 'gate': {
        shadow(g, x + 8, y + 6, 120, 16);
        [-78, 78].forEach((o) => adobe(g, x + o, y, 46, 128, 18, 30 + o, '#e3b77c'));
        g.strokeStyle = '#d69f65'; g.lineWidth = 26; g.lineCap = 'butt';
        g.beginPath(); g.arc(x, y - 118, 78, Math.PI, 0); g.stroke();
        g.strokeStyle = 'rgba(255,236,200,0.45)'; g.lineWidth = 4; g.beginPath(); g.arc(x, y - 118, 88, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
        g.strokeStyle = 'rgba(110,60,30,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - 118, 65, Math.PI, 0); g.stroke();
        for (let i = -4; i <= 4; i++) { g.fillStyle = '#c98e57'; g.fillRect(x + i * 20 - 6, y - 216 + Math.abs(i) * Math.abs(i) * 2.2, 12, 12); }
        cloth(g, x - 34, y - 110, 26, 58, t, '#b85c32', sway); cloth(g, x + 34, y - 110, 26, 58, t + 1, '#2f8f93', sway);
        lantern(g, x, y - 96, t, lit); lantern(g, x - 78, y - 60, t, lit); lantern(g, x + 78, y - 60, t, lit);
        break;
      }
      case 'well': {
        adobe(g, x + 55, y - 6, 130, 70, 30, 52, '#e5b981');
        archDoor(g, x + 55, y - 6, 28, 44);
        windowArch(g, x + 98, y - 34, 13, 22, lit * 0.9);
        awning(g, x + 55, y - 54, 80, t, '#b85c32', '#f3e2c4', sway);
        lantern(g, x + 22, y - 40, t, lit);
        // the well
        const wx = x - 70, wy = y + 10;
        shadow(g, wx + 6, wy + 6, 40, 12);
        g.fillStyle = '#9b7350'; g.beginPath(); g.ellipse(wx, wy, 36, 16, 0, 0, TAU); g.fill();
        g.fillStyle = '#b48a62'; g.fillRect(wx - 36, wy - 22, 72, 22);
        g.fillStyle = '#c9a07a'; g.beginPath(); g.ellipse(wx, wy - 22, 36, 14, 0, 0, TAU); g.fill();
        g.fillStyle = restored > 0.05 ? mix('#3a2a20', '#2f9aa0', restored) : '#3a2a20'; g.beginPath(); g.ellipse(wx, wy - 22, 27, 9, 0, 0, TAU); g.fill();
        g.strokeStyle = '#6b4128'; g.lineWidth = 5; g.beginPath(); g.moveTo(wx - 30, wy - 20); g.lineTo(wx - 30, wy - 76); g.moveTo(wx + 30, wy - 20); g.lineTo(wx + 30, wy - 76); g.stroke();
        g.fillStyle = '#b5562e'; g.beginPath(); g.moveTo(wx - 46, wy - 72); g.lineTo(wx, wy - 100); g.lineTo(wx + 46, wy - 72); g.closePath(); g.fill();
        g.strokeStyle = '#7a4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(wx - 30, wy - 62); g.lineTo(wx + 30, wy - 62); g.stroke();
        g.strokeStyle = '#5a3a24'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(wx + 6, wy - 62); g.lineTo(wx + 6, wy - 40 + Math.sin(t * 1.4) * (sway ? 2 : 0)); g.stroke();
        g.fillStyle = '#7a4a2a'; rr(g, wx + 1, wy - 42 + Math.sin(t * 1.4) * (sway ? 2 : 0), 10, 9, 2); g.fill();
        // market jars
        ['#c0673a', '#d8a03c', '#2f8f93'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.ellipse(x + 130 + i * 16, y + 4 - (i % 2) * 6, 7, 10, 0, 0, TAU); g.fill(); });
        break;
      }
      case 'tower': {
        adobe(g, x, y, 82, 190, 30, 64, '#e2b47a');
        // windcatcher slats
        g.fillStyle = '#4f2e1c';
        for (let i = 0; i < 4; i++) rr(g, x - 30 + i * 16, y - 182, 9, 34, 3), g.fill();
        g.fillStyle = '#c98e57'; g.fillRect(x - 46, y - 228, 92, 10);
        archDoor(g, x, y, 26, 44);
        windowArch(g, x, y - 100, 14, 24, lit * 0.9);
        // balcony
        g.fillStyle = '#7a4a2a'; g.fillRect(x - 50, y - 132, 100, 6);
        g.strokeStyle = '#7a4a2a'; g.lineWidth = 2; for (let i = -46; i <= 46; i += 10) { g.beginPath(); g.moveTo(x + i, y - 132); g.lineTo(x + i, y - 148); g.stroke(); }
        g.beginPath(); g.moveTo(x - 50, y - 148); g.lineTo(x + 50, y - 148); g.stroke();
        flag(g, x + 30, y - 228, 40, t, '#2f8f93', sway);
        // beacon: brighter once restored (the debugger is watching)
        const beacon = 0.35 + restored * 0.65;
        g.fillStyle = mix('#7a4a2a', '#ffe08a', clamp(beacon * (0.6 + 0.4 * Math.sin(t * 2.5)), 0, 1));
        g.beginPath(); g.arc(x - 20, y - 240, 7, 0, TAU); g.fill();
        lantern(g, x - 22, y - 40, t, lit); lantern(g, x + 22, y - 40, t, lit);
        break;
      }
      case 'bridge': {
        // a screen-aligned arched footbridge: stone abutments, a curved plank deck and rope rails
        shadow(g, x, y + 20, 84, 14, 0.25);
        g.fillStyle = '#b98a5e'; rr(g, -92 + x, y - 8, 30, 30, 6); g.fill(); rr(g, 62 + x, y - 8, 30, 30, 6); g.fill();
        g.fillStyle = '#d6b089'; rr(g, -92 + x, y - 12, 30, 10, 4); g.fill(); rr(g, 62 + x, y - 12, 30, 10, 4); g.fill();
        // arch underside shows the water through it
        g.fillStyle = 'rgba(40,24,12,0.45)'; g.beginPath(); g.moveTo(x - 62, y + 18); g.quadraticCurveTo(x, y - 30, x + 62, y + 18); g.closePath(); g.fill();
        // deck
        g.fillStyle = '#9b6b45'; g.beginPath(); g.moveTo(x - 80, y + 2); g.quadraticCurveTo(x, y - 52, x + 80, y + 2); g.lineTo(x + 80, y - 10); g.quadraticCurveTo(x, y - 64, x - 80, y - 10); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(70,40,20,0.55)'; g.lineWidth = 1.4;
        for (let k = -70; k <= 70; k += 14) { const u = (k + 80) / 160, yy = y + 2 - 4 * u * (1 - u) * 54; g.beginPath(); g.moveTo(x + k, yy); g.lineTo(x + k, yy - 12); g.stroke(); }
        // rails and posts
        g.strokeStyle = '#6b4128'; g.lineWidth = 3;
        const railY = (u) => y - 10 - 4 * u * (1 - u) * 54 - 22;
        for (let k = -76; k <= 76; k += 38) { const u = (k + 80) / 160; g.beginPath(); g.moveTo(x + k, railY(u) + 22); g.lineTo(x + k, railY(u)); g.stroke(); }
        g.beginPath(); g.moveTo(x - 80, railY(0)); g.quadraticCurveTo(x, railY(0.5) * 2 - railY(0), x + 80, railY(1)); g.stroke();
        lantern(g, x - 60, y - 40, t, lit); lantern(g, x + 60, y - 28, t, lit);
        // market stalls beside the bridge
        [[x + 110, y - 40, '#b85c32'], [x - 120, y + 50, '#7a4e8c']].forEach(([sx, sy, col]) => {
          shadow(g, sx + 4, sy + 4, 34, 8);
          g.fillStyle = '#7a4a2a'; g.fillRect(sx - 26, sy - 34, 4, 34); g.fillRect(sx + 22, sy - 34, 4, 34);
          g.fillStyle = '#9b6b45'; g.fillRect(sx - 28, sy - 14, 56, 14);
          awning(g, sx, sy - 40, 60, t, col, '#f3e2c4', sway);
          ['#d8a03c', '#4d7a3b', '#c0673a'].forEach((cc, k) => { g.fillStyle = cc; g.beginPath(); g.arc(sx - 14 + k * 14, sy - 17, 4.5, 0, TAU); g.fill(); });
        });
        break;
      }
      case 'overlook': {
        shadow(g, x, y + 4, 46, 10);
        g.fillStyle = '#6b4128'; [-30, 30].forEach((o) => g.fillRect(x + o - 2, y - 58, 4, 58));
        cloth(g, x, y - 62, 76, 22, t, '#2f8f93', sway);
        g.fillStyle = '#8a5a34'; g.fillRect(x - 24, y - 16, 48, 6);
        flag(g, x + 36, y - 58, 30, t, '#b85c32', sway);
        break;
      }
      case 'gauge': {
        shadow(g, x, y + 4, 30, 8);
        g.fillStyle = '#9b7350'; rr(g, x - 26, y - 30, 52, 30, 6); g.fill();
        const lvl = DISTRICTS.reduce((n, d) => n + growth[d.id], 0) / DISTRICTS.length;
        g.fillStyle = '#3a2a20'; rr(g, x - 20, y - 26, 40, 8, 3); g.fill();
        g.fillStyle = '#2f9aa0'; rr(g, x - 20, y - 26, 40 * lvl, 8, 3); g.fill();
        g.fillStyle = '#6b4128'; g.fillRect(x + 30, y - 80, 6, 80);
        g.fillStyle = '#f1dfbd'; for (let i = 0; i < 5; i++) g.fillRect(x + 36, y - 74 + i * 14, 8, 2);
        break;
      }
      case 'ruins': {
        [[-40, 0, 46], [0, -12, 70], [42, 4, 30]].forEach(([ox, oy, h]) => {
          shadow(g, x + ox + 6, y + oy + 4, 16, 6);
          g.fillStyle = '#d9b07a'; rr(g, x + ox - 11, y + oy - h, 22, h, 4); g.fill();
          g.fillStyle = 'rgba(120,70,36,0.3)'; g.fillRect(x + ox - 11, y + oy - h, 5, h);
          g.fillStyle = '#e8c591'; g.beginPath(); g.moveTo(x + ox - 13, y + oy - h); g.lineTo(x + ox - 2, y + oy - h - 8); g.lineTo(x + ox + 13, y + oy - h + 2); g.closePath(); g.fill();
        });
        g.fillStyle = '#c9a06b'; rr(g, x - 20, y + 14, 46, 14, 4); g.fill();
        break;
      }
      case 'board': {
        shadow(g, x, y + 4, 34, 8);
        g.fillStyle = '#6b4128'; g.fillRect(x - 30, y - 54, 5, 54); g.fillRect(x + 25, y - 54, 5, 54);
        g.fillStyle = '#9b6b45'; rr(g, x - 36, y - 62, 72, 36, 4); g.fill();
        [['#fff4e0', -24, -56], ['#f3d38a', -2, -58], ['#e9b3a0', 16, -52]].forEach(([c, ox, oy]) => { g.fillStyle = c; g.fillRect(x + ox, y + oy, 14, 18); });
        break;
      }
      case 'cinema': {
        shadow(g, x, y + 6, 70, 12);
        g.fillStyle = '#6b4128'; g.fillRect(x - 66, y - 100, 6, 100); g.fillRect(x + 60, y - 100, 6, 100);
        const glow = L.night > 0.3 ? 0.55 + Math.sin(t * 7) * 0.08 + Math.sin(t * 3.1) * 0.05 : 0;
        g.fillStyle = mix('#f6ead2', '#cfe8ff', glow); g.fillRect(x - 60, y - 98, 120, 64);
        if (glow) { g.fillStyle = 'rgba(184,92,50,0.5)'; g.beginPath(); g.arc(x - 18 + Math.sin(t) * 10, y - 66, 10, 0, TAU); g.fill(); g.fillStyle = 'rgba(47,143,147,0.5)'; g.beginPath(); g.arc(x + 20, y - 62 + Math.cos(t * 1.3) * 6, 12, 0, TAU); g.fill(); }
        ['#b85c32', '#2f8f93', '#d8a03c', '#7a4e8c'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.ellipse(x - 45 + i * 30, y + 20, 11, 6, 0, 0, TAU); g.fill(); });
        break;
      }
    }
    if (s.kind === 'landmark' && !state.found.has(s.id)) { // gentle shimmer hint
      const a = 0.35 + Math.sin(t * 3 + s.x) * 0.25;
      g.fillStyle = `rgba(255,244,200,${a})`;
      g.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k / 8) * TAU, r = k % 2 ? 4 : 11; g.lineTo(x + Math.cos(ang) * r, y - 90 + Math.sin(ang) * r); } g.closePath(); g.fill();
    }
  }

  function drawGarden(g, d, t, sway) {
    const gw = growth[d.id];
    gardens[d.id].forEach((pl, k) => {
      g.save(); g.translate(pl.x, pl.y); g.rotate(pl.rot);
      g.fillStyle = mix('#b98552', '#6d5a32', gw); rr(g, -pl.w / 2, -pl.h / 2, pl.w, pl.h, 8); g.fill();
      g.strokeStyle = 'rgba(90,54,28,0.4)'; g.lineWidth = 1.5; g.stroke();
      if (gw < 0.4) { // dry cracks
        g.strokeStyle = 'rgba(90,54,28,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-pl.w * 0.3, -6); g.lineTo(-5, 2); g.lineTo(pl.w * 0.25, -4); g.moveTo(-5, 2); g.lineTo(0, pl.h * 0.35); g.stroke();
      }
      const rows = 3, cols = 6;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const px = -pl.w / 2 + 8 + c * ((pl.w - 16) / (cols - 1)), py = -pl.h / 2 + 8 + r * ((pl.h - 16) / (rows - 1));
        const grow = clamp(gw * 1.3 - (r * cols + c) * 0.012, 0, 1);
        if (grow <= 0.02) { g.fillStyle = 'rgba(120,80,44,0.5)'; g.fillRect(px - 1, py - 1, 2, 2); continue; }
        const sz = 2 + grow * 5 + (sway ? Math.sin(t * 2 + px) * 0.4 : 0);
        g.fillStyle = mix('#8a8a3a', k % 2 ? '#4f8a3c' : '#62a04a', grow);
        g.beginPath(); g.arc(px, py, sz, 0, TAU); g.fill();
        if (grow > 0.75 && (r + c + k) % 3 === 0) { g.fillStyle = ['#e86f6f', '#f2c14e', '#b77fd6', '#ffffff'][(r + c + k) % 4]; g.beginPath(); g.arc(px + 1, py - 2, 1.8, 0, TAU); g.fill(); }
      }
      g.restore();
    });
  }

  const FIG = 1.6; // figures read at a glance on a phone
  function drawPerson(g, p, t, isPlayer) {
    const bob = p.moving ? Math.abs(Math.sin(p.walk * 9)) * 2.5 : 0;
    shadow(g, p.x, p.y + 2, 14, 5, 0.3);
    g.save(); g.translate(p.x, p.y - bob); g.scale((p.face || 1) * FIG, FIG);
    if (isPlayer) {
      g.fillStyle = '#b85c32'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.lineTo(5, -20); g.lineTo(-5, -20); g.closePath(); g.fill();
      g.fillStyle = '#7e3a1f'; g.fillRect(-6, -12, 12, 3);
      g.fillStyle = '#c48a5e'; g.beginPath(); g.arc(0, -25, 5.5, 0, TAU); g.fill();
      g.fillStyle = '#e9c46a'; g.beginPath(); g.ellipse(0, -28, 11, 3.2, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, -31, 5, 4, 0, Math.PI, 0); g.fill();
      // lantern on a pole
      g.strokeStyle = '#5a3a24'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(6, -14); g.lineTo(12, -30); g.stroke();
      const sw = Math.sin(t * 3 + p.walk * 6) * (p.moving ? 2.5 : 0.8);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.ellipse(12 + sw * 0.3, -24, 3, 4, 0, 0, TAU); g.fill();
    } else {
      g.fillStyle = p.robe; g.beginPath(); g.moveTo(-6.5, 0); g.lineTo(6.5, 0); g.lineTo(4, -17); g.lineTo(-4, -17); g.closePath(); g.fill();
      g.fillStyle = p.skin; g.beginPath(); g.arc(0, -21, 4.5, 0, TAU); g.fill();
      g.fillStyle = p.wrap; g.beginPath(); g.ellipse(0, -23.5, 5.2, 3.6, 0, Math.PI, 0); g.fill();
      if (p.carry) { g.fillStyle = '#c0673a'; g.beginPath(); g.ellipse(0, -30, 5, 4, 0, 0, TAU); g.fill(); }
    }
    g.restore();
  }

  // ------------------------------------------------------------------ scene rendering (shared by game, postcards and gallery)
  function renderScene(g, vw, vh, c, opts) {
    const t = opts.t, T = opts.tod, L = light(T), sway = !settings.motion;
    g.save();
    g.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
    g.translate(vw / 2, vh / 2); g.scale(c.zoom, c.zoom); g.translate(-c.x, -c.y);

    // sky
    const top = mix(mix('#1b1a3a', '#e47a7e', L.warm), '#7cc3df', clamp(L.day * 1.2 - L.warm * 0.5, 0, 1));
    const hor = mix(mix('#3a3566', '#f6b26b', L.warm), '#f7e3b5', clamp(L.day - L.warm * 0.4, 0, 1));
    const sky = g.createLinearGradient(0, 0, 0, HORIZON + 20);
    sky.addColorStop(0, top); sky.addColorStop(1, hor);
    g.fillStyle = sky; g.fillRect(-400, -400, W + 800, HORIZON + 420);
    // sun and moon on an arc
    const sa = ((T - 0.25) / 0.5) * Math.PI;
    if (L.day > 0.02) { const sx = lerp(80, W - 80, (T - 0.22) / 0.56), sy = HORIZON - Math.sin(sa) * 110; g.fillStyle = mix('#ff9a5a', '#fff2c4', L.day); g.beginPath(); g.arc(sx, sy, 26, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,240,200,0.18)'; g.beginPath(); g.arc(sx, sy, 48, 0, TAU); g.fill(); }
    if (L.night > 0.2) {
      const mt = ((T + 0.5) % 1), mx = lerp(80, W - 80, clamp((mt - 0.22) / 0.56, 0, 1)), my = HORIZON - Math.sin(((mt - 0.25) / 0.5) * Math.PI) * 100;
      g.fillStyle = `rgba(245,240,220,${L.night})`; g.beginPath(); g.arc(mx, my, 18, 0, TAU); g.fill();
      g.fillStyle = mix('#1b1a3a', '#3a3566', 0.3); g.beginPath(); g.arc(mx + 7, my - 4, 16, 0, TAU); g.fill();
      const sr = rng(5); g.fillStyle = `rgba(255,250,235,${L.night * 0.8})`;
      for (let i = 0; i < 80; i++) { const x = sr() * W, y = sr() * (HORIZON - 10); const tw = 0.6 + 0.4 * Math.sin(t * 2 + i); g.globalAlpha = L.night * tw; g.fillRect(x, y, 1.6, 1.6); }
      g.globalAlpha = 1;
    }
    // distant dunes
    [['#d79a62', '#5d4a72', 26, 0.004, 1.3], ['#e2a96c', '#6b5580', 14, 0.006, 4.1]].forEach(([dc, nc, a, f, ph], k) => {
      g.fillStyle = mix(mix(dc, '#e98a5a', L.warm * 0.5), nc, L.night * 0.85);
      g.beginPath(); g.moveTo(-400, HORIZON + 30);
      for (let x = -400; x <= W + 400; x += 20) g.lineTo(x, HORIZON - 18 + k * 12 + Math.sin(x * f + ph) * a + Math.sin(x * f * 3 + ph) * a * 0.3);
      g.lineTo(W + 400, HORIZON + 30); g.closePath(); g.fill();
    });

    g.drawImage(terrain, 0, 0);

    // pond with ripples
    const pg = g.createRadialGradient(POND.x - 30, POND.y - 20, 10, POND.x, POND.y, POND.rx);
    pg.addColorStop(0, '#6fe0d0'); pg.addColorStop(0.6, '#2f9aa0'); pg.addColorStop(1, '#1f6f78');
    g.fillStyle = pg; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU); g.clip();
    for (let i = 0; i < 5; i++) {
      const ph = sway ? ((t * 0.25 + i / 5) % 1) : (i + 1) / 6;
      g.strokeStyle = `rgba(230,255,250,${0.35 * (1 - ph)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(POND.x + Math.sin(i * 2.1) * 50, POND.y + Math.cos(i * 1.7) * 22, 10 + ph * 70, 5 + ph * 34, 0, 0, TAU); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 9; i++) { const sx = POND.x - 110 + i * 26 + (sway ? Math.sin(t * 0.8 + i) * 6 : 0); g.fillRect(sx, POND.y - 30 + (i % 3) * 22, 14, 2); }
    g.restore();
    // lily pads and reeds
    [[-90, 20], [70, -30], [110, 30], [-40, -40]].forEach(([ox, oy], i) => { g.fillStyle = i % 2 ? '#4f8a3c' : '#5f9a48'; g.beginPath(); g.ellipse(POND.x + ox, POND.y + oy, 12, 6, 0, 0.3, TAU); g.lineTo(POND.x + ox, POND.y + oy); g.fill(); });

    // canals: water travels as each district is restored
    Object.entries(canals).forEach(([id, cn]) => {
      const f = flow[id]; if (f <= 0.001) return;
      const lim = cn.len * f;
      g.beginPath(); let last = cn.pts[0]; g.moveTo(last.x, last.y);
      for (let i = 1; i < cn.pts.length && cn.pts[i].d <= lim; i++) { last = cn.pts[i]; g.lineTo(last.x, last.y); }
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = '#2a8a90'; g.lineWidth = 17; g.stroke();
      g.strokeStyle = '#43b6b4'; g.lineWidth = 10; g.stroke();
      g.setLineDash([10, 22]); g.lineDashOffset = sway ? -t * 40 : 0; g.strokeStyle = 'rgba(230,255,250,0.55)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
      if (f < 0.999) { g.fillStyle = 'rgba(230,255,250,0.85)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(last.x + Math.sin(t * 10 + k) * 6, last.y + Math.cos(t * 9 + k) * 4, 2.5, 0, TAU); g.fill(); } }
    });

    DISTRICTS.forEach((d) => drawGarden(g, d, t, sway));

    // depth-sorted drawables
    const items = [];
    SITES.forEach((s) => items.push({ y: s.y, f: () => drawSite(g, s, t, L, sway) }));
    palms.forEach((p) => items.push({ y: p.y, f: () => palm(g, p, t, sway, p.owner ? growth[p.owner] : 1) }));
    residents.forEach((p) => items.push({ y: p.y, f: () => drawPerson(g, p, t, false) }));
    if (opts.player) items.push({ y: player.y, f: () => drawPerson(g, player, t, true) });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.f());

    // particles
    if (sway) {
      particles.forEach((p) => {
        if (p.type === 'sand' && L.day > 0.1) { g.fillStyle = 'rgba(255,236,200,0.5)'; g.fillRect(p.x, p.y, p.s * 3, p.s * 0.8); }
        else if (p.type === 'mote' && L.day > 0.2) { g.fillStyle = 'rgba(255,248,220,0.35)'; g.beginPath(); g.arc(p.x, p.y, p.s, 0, TAU); g.fill(); }
      });
    }
    splashes.forEach((s) => { g.strokeStyle = `rgba(255,240,190,${1 - s.age})`; g.lineWidth = 3; g.beginPath(); g.arc(s.x, s.y, 10 + s.age * 70, 0, TAU); g.stroke(); });

    // night: darken, then add warm light
    if (L.night > 0.01) {
      g.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
      g.fillStyle = `rgba(20,18,52,${L.night * 0.6})`; g.fillRect(0, 0, vw, vh);
      g.translate(vw / 2, vh / 2); g.scale(c.zoom, c.zoom); g.translate(-c.x, -c.y);
      g.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, a, col) => { const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, rgba(col, a)); gg.addColorStop(1, rgba(col, 0)); g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      SITES.forEach((s) => { const rest = s.kind === 'district' ? growth[s.id] : 0.4; glow(s.x, s.y - 40, 70 + rest * 50, (0.22 + rest * 0.25) * L.night, '#ffb45a'); });
      glow(POND.x, POND.y, 180, 0.12 * L.night, '#6fe0d0');
      if (opts.player) glow(player.x + 12 * (player.face || 1), player.y - 24, 70, 0.4 * L.night, '#ffc46a');
      if (sway) particles.forEach((p) => { if (p.type === 'fly' && (!p.id || growth[p.id] > 0.5)) { const a = (0.5 + 0.5 * Math.sin(t * 3 + p.ph)) * L.night; glow(p.x, p.y, 7, a * 0.9, '#e8ff9a'); } });
      g.globalCompositeOperation = 'source-over';
    }
    // dawn/dusk warmth
    if (L.warm > 0.02) {
      g.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
      g.globalCompositeOperation = 'overlay'; g.fillStyle = `rgba(255,128,70,${L.warm * 0.22})`; g.fillRect(0, 0, vw, vh);
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  function drawLabels(g) {
    g.save(); g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const fs = view.w < 700 ? 12 : 13;
    g.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    SITES.forEach((s) => {
      const isD = s.kind === 'district';
      const near = Math.hypot(player.x - s.x, player.y - s.y) < 220;
      if (!isD && !state.found.has(s.id) && !near) return;
      const h = isD ? (s.id === 'tower' ? 260 : s.id === 'gate' ? 236 : s.id === 'bridge' ? 104 : 160) : 110;
      const p = toScreen(s.x, s.y - h);
      if (p.x < -60 || p.x > view.w + 60 || p.y < -20 || p.y > view.h + 20) return;
      const done = isD ? state.visited.has(s.id) : state.found.has(s.id);
      const text = (done ? '✓ ' : '') + (isD || done ? s.name : '?');
      const w = g.measureText(text).width + 18;
      g.fillStyle = done ? 'rgba(247,234,212,0.95)' : 'rgba(247,234,212,0.82)';
      rr(g, p.x - w / 2, p.y - 12, w, 24, 12); g.fill();
      g.strokeStyle = 'rgba(126,58,31,0.45)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = done ? '#3d6b2e' : '#3a2417'; g.fillText(text, p.x, p.y + 0.5);
    });
    g.restore();
  }

  // ------------------------------------------------------------------ audio (all synthesized, all original)
  const audio = { ctx: null, master: null, music: null, amb: null, sfx: null, wind: null, water: null, murmur: null, next: 0, step: 0, lastFoot: 0, notes: [] };
  function noiseBuffer(ac) { const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; } return b; }
  function initAudio() {
    if (audio.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ac = new AC(); audio.ctx = ac;
    audio.master = ac.createGain(); audio.master.gain.value = 0; audio.master.connect(ac.destination);
    audio.music = ac.createGain(); audio.amb = ac.createGain(); audio.sfx = ac.createGain();
    [audio.music, audio.amb, audio.sfx].forEach((n) => n.connect(audio.master));
    audio.sfx.gain.value = 0.6;
    const nb = noiseBuffer(ac);
    const loop = (freq, q, type) => { const src = ac.createBufferSource(); src.buffer = nb; src.loop = true; const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q; const gn = ac.createGain(); gn.gain.value = 0; src.connect(f); f.connect(gn); gn.connect(audio.amb); src.start(); return { f, gn }; };
    audio.wind = loop(420, 0.5); audio.water = loop(1500, 1.6); audio.murmur = loop(520, 3.5);
    // a soft drone under the music
    [[73.4, 0.05], [110, 0.035]].forEach(([fr, v]) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const gn = ac.createGain(); gn.gain.value = v; o.connect(gn); gn.connect(audio.music); o.start(); });
    audio.next = ac.currentTime + 0.3;
    applyVolumes();
    return true;
  }
  function applyVolumes() {
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    audio.master.gain.setTargetAtTime(settings.sound ? 0.9 : 0, now, 0.15);
    audio.music.gain.setTargetAtTime((settings.music / 100) * 0.8, now, 0.2);
    audio.amb.gain.setTargetAtTime((settings.amb / 100) * 0.9, now, 0.2);
  }
  function pluck(time, freq, vel, len) {
    const ac = audio.ctx, o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.001;
    f.type = 'lowpass'; f.frequency.setValueAtTime(2600, time); f.frequency.exponentialRampToValueAtTime(500, time + len);
    g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(vel, time + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(audio.music);
    o.start(time); o2.start(time); o.stop(time + len + 0.05); o2.stop(time + len + 0.05);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // major pentatonic on D
  let melodyIdx = 3;
  function scheduleMusic(L) {
    const ac = audio.ctx; if (!ac || !settings.sound || settings.music === 0) return;
    const beat = L.night > 0.5 ? 0.62 : 0.46;
    while (audio.next < ac.currentTime + 0.6) {
      const step = audio.step++;
      const rest = Math.random() < (L.night > 0.5 ? 0.45 : 0.3);
      if (!rest) {
        melodyIdx = clamp(melodyIdx + [-2, -1, -1, 1, 1, 2, 0][(Math.random() * 7) | 0], 0, SCALE.length - 1);
        const base = L.night > 0.5 ? 146.8 : 293.7;
        pluck(audio.next, base * Math.pow(2, SCALE[melodyIdx] / 12), 0.09, beat * 2.4);
      }
      if (step % 8 === 0) pluck(audio.next, 146.8 * Math.pow(2, [0, 7, 9, 4][(step / 8) % 4 | 0] / 12) / 2, 0.07, beat * 6);
      audio.next += beat;
    }
  }
  function chime() {
    if (!audio.ctx || !settings.sound) return;
    const t0 = audio.ctx.currentTime + 0.02;
    [0, 4, 7, 12, 16].forEach((st, i) => {
      const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 587.3 * Math.pow(2, st / 12);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 1.6);
      o.connect(g); g.connect(audio.sfx); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 1.7);
    });
  }
  function footstep() {
    if (!audio.ctx || !settings.sound) return;
    const ac = audio.ctx, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime;
    const b = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    src.buffer = b; f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 1.2;
    g.gain.value = 0.09; src.connect(f); f.connect(g); g.connect(audio.sfx); src.start(t0);
  }
  function uiTick() {
    if (!audio.ctx || !settings.sound) return;
    const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(), t0 = audio.ctx.currentTime;
    o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    o.connect(g); g.connect(audio.sfx); o.start(t0); o.stop(t0 + 0.1);
  }
  function updateAudio(dt, L) {
    if (!audio.ctx || !settings.sound) return;
    const now = audio.ctx.currentTime;
    const dPond = Math.hypot((player.x - POND.x) / 2, player.y - POND.y);
    let dCanal = 1e9; Object.entries(canals).forEach(([id, c]) => { if (flow[id] < 0.2) return; for (let i = 0; i < c.pts.length; i += 6) dCanal = Math.min(dCanal, Math.hypot(player.x - c.pts[i].x, player.y - c.pts[i].y)); });
    const water = clamp(1 - Math.min(dPond, dCanal * 1.4) / 420, 0.04, 1);
    audio.water.gn.gain.setTargetAtTime(water * 0.16, now, 0.3);
    audio.water.f.frequency.setTargetAtTime(1200 + Math.random() * 900, now, 0.08);
    audio.wind.gn.gain.setTargetAtTime(0.06 + 0.05 * Math.sin(now * 0.21) + 0.03 * Math.sin(now * 0.53), now, 0.5);
    const dm = Math.min(Math.hypot(player.x - byId.bridge.x, player.y - byId.bridge.y), Math.hypot(player.x - byId.well.x, player.y - byId.well.y));
    audio.murmur.gn.gain.setTargetAtTime(clamp(1 - dm / 360, 0, 1) * (0.05 + Math.random() * 0.04) * (1 - L.night * 0.8), now, 0.12);
    scheduleMusic(L);
    if (player.moving && performance.now() - audio.lastFoot > 330) { audio.lastFoot = performance.now(); footstep(); }
  }

  // ------------------------------------------------------------------ UI helpers
  let toastTimer = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600); }
  function shake() { if (!settings.shake || settings.motion) return; game.classList.remove('shake'); void game.offsetWidth; game.classList.add('shake'); setTimeout(() => game.classList.remove('shake'), 360); }
  function anyDialogOpen() { return dialogs.some((d) => d.open); }
  function openDialog(d) { dialogs.forEach((x) => { if (x.open && x !== d) x.close(); }); if (!d.open) d.showModal(); const f = d.querySelector('[data-focus]') || d.querySelector('button, [href], input, select'); if (f) f.focus(); uiTick(); }
  function updateGoal() {
    const n = DISTRICTS.filter((d) => state.visited.has(d.id)).length;
    goalCount.textContent = `${n} / 5 districts · ${state.found.size} / ${SITES.length} postcards`;
    document.querySelectorAll('.districts button').forEach((b) => b.classList.toggle('done', state.visited.has(b.dataset.go)));
  }
  function applySettings() {
    root.classList.toggle('reduce-motion', !!settings.motion);
    root.classList.toggle('contrast', !!settings.contrast);
    root.classList.toggle('large-text', !!settings.large);
    $('s-sound').checked = settings.sound; $('s-music').value = settings.music; $('s-amb').value = settings.amb;
    $('s-motion').checked = settings.motion; $('s-shake').checked = settings.shake; $('s-contrast').checked = settings.contrast;
    $('s-large').checked = settings.large; $('s-time').value = settings.time;
    const sb = $('btn-sound'); sb.setAttribute('aria-pressed', String(settings.sound)); sb.setAttribute('aria-label', settings.sound ? 'Sound on' : 'Sound off');
    sb.classList.toggle('muted', !settings.sound);
    if (settings.time !== 'cycle') tod = FIXED[settings.time];
    applyVolumes();
  }
  function setSound(on) {
    settings.sound = on;
    if (on) { initAudio(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); }
    applySettings(); autosave();
    toast(on ? 'Sound on' : 'Sound off');
  }

  // ------------------------------------------------------------------ postcards
  function paintPostcard(canvasEl, s) {
    const g = canvasEl.getContext('2d');
    const cw = canvasEl.width, ch = canvasEl.height;
    const z = s.kind === 'district' ? 1.15 : 1.5;
    const c = { x: clamp(s.x, cw / 2 / z, W - cw / 2 / z), y: clamp(s.y - 70, ch / 2 / z, H - ch / 2 / z), zoom: z };
    renderScene(g, cw, ch, c, { t: time, tod: 0.7, scale: 1, player: false });
    // painted vignette and title band
    const v = g.createRadialGradient(cw / 2, ch / 2, ch * 0.3, cw / 2, ch / 2, ch * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,40,20,0.35)');
    g.fillStyle = v; g.fillRect(0, 0, cw, ch);
    g.font = `italic 700 ${Math.round(ch * 0.1)}px "Iowan Old Style", Palatino, Georgia, serif`;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(58,36,23,0.6)'; g.fillText(`Greetings from ${s.name}`, 16, ch - 14);
    g.fillStyle = '#fff6e6'; g.fillText(`Greetings from ${s.name}`, 14, ch - 16);
  }
  function showPostcard(id, award) {
    const s = byId[id], a = cards[id]; if (!s || !a) return;
    $('pc-h').textContent = a.querySelector('h2').textContent;
    $('pc-stamp').textContent = s.layer;
    const bodyEl = $('pc-body'); bodyEl.replaceChildren();
    [...a.children].forEach((ch) => { if (ch.tagName !== 'H2') bodyEl.appendChild(ch.cloneNode(true)); });
    paintPostcard($('pc-canvas'), s);
    openDialog($('dlg-postcard'));
    if (!award) return;
    const firstFind = !state.found.has(id);
    state.found.add(id);
    if (s.kind === 'district' && !state.visited.has(id)) {
      state.visited.add(id);
      splashes.push({ x: s.x, y: s.y - 30, age: 0 });
      chime(); shake();
      setTimeout(() => toast(`Water flows to ${s.name}`), 300);
    } else if (firstFind) {
      splashes.push({ x: s.x, y: s.y - 30, age: 0 });
      chime(); shake();
      setTimeout(() => toast(`Hidden landmark found: ${s.name}`), 300);
    }
    updateGoal(); autosave();
  }
  $('dlg-postcard').addEventListener('close', () => {
    if (!state.completedShown && DISTRICTS.every((d) => state.visited.has(d.id))) {
      state.completedShown = true; autosave();
      setTimeout(showResults, 900);
    }
  });
  function showResults() {
    $('r-postcards').textContent = `${state.found.size}/${SITES.length}`;
    const m = Math.floor(state.playTime / 60), sec = Math.floor(state.playTime % 60);
    $('r-time').textContent = `${m}:${String(sec).padStart(2, '0')}`;
    $('r-photos').textContent = String(photos.length);
    openDialog($('dlg-results'));
  }

  function showGallery() {
    const list = $('gal-list'); list.replaceChildren();
    const tmp = document.createElement('canvas'); tmp.width = 320; tmp.height = 180;
    SITES.forEach((s) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      if (state.found.has(s.id)) {
        paintPostcard(tmp, s);
        const img = document.createElement('img'); img.src = tmp.toDataURL('image/jpeg', 0.82); img.alt = '';
        btn.append(img, document.createTextNode(s.name));
        btn.addEventListener('click', () => showPostcard(s.id, false));
      } else {
        const lock = document.createElement('span'); lock.className = 'locked'; lock.textContent = '?'; lock.setAttribute('aria-hidden', 'true');
        btn.append(lock, document.createTextNode(s.kind === 'district' ? `${s.name} (not visited)` : 'Hidden landmark'));
        btn.disabled = true;
      }
      li.appendChild(btn); list.appendChild(li);
    });
    $('gal-count').textContent = `${state.found.size} of ${SITES.length} postcards collected.`;
    const pl = $('gal-photos'); pl.replaceChildren();
    photos.forEach((p, i) => { const li = document.createElement('li'); const a = document.createElement('a'); a.href = p.url; a.download = `oasis-photo-${i + 1}.png`; const img = document.createElement('img'); img.src = p.url; img.alt = `Photo ${i + 1}`; a.appendChild(img); li.appendChild(a); pl.appendChild(li); });
    $('gal-photos-empty').hidden = photos.length > 0;
    openDialog($('dlg-gallery'));
  }

  // ------------------------------------------------------------------ modes
  let mode = 'title'; // title | play | photo | page
  let time = 0;
  function startPlay(fromSave) {
    mode = 'play';
    titleEl.classList.add('leaving');
    setTimeout(() => { titleEl.hidden = true; titleEl.classList.remove('leaving'); }, 550);
    $('hud').hidden = false;
    cam.follow = true;
    if (settings.sound) { initAudio(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); }
    canvas.focus({ preventScroll: true });
    if (!state.tutorialSeen) { state.tutorialSeen = true; autosave(); setTimeout(() => openDialog($('dlg-tutorial')), 450); }
    else toast(fromSave ? 'Welcome back to the camp' : 'Find the five districts');
  }
  function toTitle() {
    dialogs.forEach((d) => d.open && d.close());
    mode = 'title'; titleEl.hidden = false; $('hud').hidden = true;
    $('m-continue').hidden = state.found.size === 0;
    $('m-start').textContent = state.found.size ? 'New game' : 'Begin';
    $('m-start').classList.toggle('primary', state.found.size === 0);
    ($('m-continue').hidden ? $('m-start') : $('m-continue')).focus();
  }
  function toPage() {
    dialogs.forEach((d) => d.open && d.close());
    mode = 'page';
    body.classList.remove('game-on'); game.hidden = true; titleEl.hidden = true;
    $('back-to-game').hidden = false;
    if (audio.ctx) audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
    $('content').focus();
    window.scrollTo(0, 0);
  }
  function fromPage() {
    body.classList.add('game-on'); game.hidden = false; $('back-to-game').hidden = true;
    applyVolumes(); toTitle();
  }
  function resetGame() {
    state.visited.clear(); state.found.clear(); state.completedShown = false; state.playTime = 0;
    DISTRICTS.forEach((d) => { flow[d.id] = 0; growth[d.id] = 0; });
    player.x = POND.x + 40; player.y = POND.y + 150; player.target = null; player.pending = null;
    updateGoal(); autosave();
  }
  function enterPhoto() {
    if (mode !== 'play') return;
    mode = 'photo'; game.classList.add('photo'); $('photobar').hidden = false;
    photoTod = curTod(); $('photo-time').value = String(Math.round(photoTod * 1000));
    cam.follow = false; $('photo-save').focus();
    toast('Photo mode: drag to frame, then save');
  }
  function exitPhoto() {
    mode = 'play'; game.classList.remove('photo'); $('photobar').hidden = true;
    if (settings.time === 'cycle') photoTod = null; else { tod = FIXED[settings.time]; photoTod = null; }
    canvas.focus({ preventScroll: true });
  }
  function savePhoto() {
    canvas.toBlob((blob) => {
      if (!blob) { toast('Could not save this photo'); return; }
      const url = URL.createObjectURL(blob);
      photos.push({ url });
      const a = document.createElement('a'); a.href = url; a.download = `oasis-photo-${photos.length}.png`; document.body.appendChild(a); a.click(); a.remove();
      splashes.push({ x: cam.x, y: cam.y, age: 0 }); chime();
      toast('Postcard saved to your downloads and the gallery');
    }, 'image/png');
  }

  // ------------------------------------------------------------------ input
  const keys = new Set();
  const pointers = new Map();
  let drag = null, pinch = null;
  function goTo(id) {
    const s = byId[id]; if (!s) return;
    player.target = { x: s.x, y: s.y + (s.kind === 'district' ? (id === 'bridge' ? 48 : 58) : 36) };
    player.pending = id; cam.follow = true;
  }
  function interact() {
    if (nearSite) { player.target = null; player.pending = null; showPostcard(nearSite.id, true); }
  }
  window.addEventListener('keydown', (e) => {
    if (mode === 'page') return;
    const k = e.key.toLowerCase();
    if (anyDialogOpen()) return; // dialogs handle their own keys (Esc closes)
    if (mode === 'title') return;
    const onCtl = document.activeElement && /^(BUTTON|INPUT|SELECT|A)$/.test(document.activeElement.tagName);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k) && !(onCtl && document.activeElement.tagName === 'INPUT')) {
      keys.add(k); e.preventDefault(); if (onCtl) canvas.focus({ preventScroll: true }); return;
    }
    if (k === 'escape') { if (mode === 'photo') exitPhoto(); else openDialog($('dlg-pause')); e.preventDefault(); return; }
    if ((k === 'enter' || k === ' ') && !onCtl && mode === 'play') { interact(); e.preventDefault(); return; }
    if (onCtl) return;
    if (k === 'g') showGallery();
    else if (k === 'f') { if (mode === 'photo') exitPhoto(); else enterPhoto(); }
    else if (k === 'm') setSound(!settings.sound);
    else if (k === '+' || k === '=' || k === 'e') zoomBy(1.15);
    else if (k === '-' || k === 'q') zoomBy(1 / 1.15);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  function zoomBy(f, sx, sy) {
    const before = sx != null ? toWorld(sx, sy) : null;
    cam.zoom = clamp(cam.zoom * f, cam.minZoom, cam.maxZoom);
    if (before) { const after = toWorld(sx, sy); cam.x += before.x - after.x; cam.y += before.y - after.y; cam.follow = false; }
    clampCam();
  }
  canvas.addEventListener('wheel', (e) => { if (mode === 'title' || mode === 'page') return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' && mode !== 'photo') return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); cam.zoom = clamp(pinch.z * (d / pinch.d), cam.minZoom, cam.maxZoom); cam.follow = false; clampCam(); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; canvas.classList.add('dragging'); }
    if (drag.moved) { cam.x = drag.cx - dx / cam.zoom; cam.y = drag.cy - dy / cam.zoom; cam.follow = false; clampCam(); }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    canvas.classList.remove('dragging');
    if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
    if (drag && !drag.moved && mode === 'play') {
      const w = toWorld(e.clientX, e.clientY);
      let hit = null, best = 1e9;
      SITES.forEach((s) => { const rad = s.kind === 'district' ? 110 : 70; const d = Math.hypot(w.x - s.x, (w.y - (s.y - 50)) * 0.8); if (d < rad && d < best) { best = d; hit = s; } });
      if (hit) { if (nearSite === hit) interact(); else goTo(hit.id); }
      else { player.target = { x: w.x, y: w.y }; player.pending = null; cam.follow = true; }
    }
    drag = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.tabIndex = 0;

  // gamepad: stick or d-pad moves; A reads/confirms; B backs out; Start pauses; Y photo; X gallery
  const padPrev = [];
  function focusables() {
    const open = dialogs.find((d) => d.open);
    const scope = open || (mode === 'title' ? titleEl : (mode === 'photo' ? $('photobar') : null));
    return scope ? [...scope.querySelectorAll('button:not([disabled]), a[href], input, select')].filter((el) => el.offsetParent !== null) : [];
  }
  function moveFocus(dir) { const f = focusables(); if (!f.length) return; const i = f.indexOf(document.activeElement); f[(i + dir + f.length) % f.length].focus(); uiTick(); }
  let padAxis = { x: 0, y: 0 }, padNavAt = 0;
  function pollPad() {
    padAxis = { x: 0, y: 0 };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected); if (!gp) return;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const pressed = (i) => b(i) && !padPrev[i];
    let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) < 0.2) ax = 0; if (Math.abs(ay) < 0.2) ay = 0;
    if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
    const inMenu = anyDialogOpen() || mode === 'title';
    if (inMenu) {
      const now = performance.now();
      if ((ay || ax) && now - padNavAt > 220) { moveFocus(ay > 0 || ax > 0 ? 1 : -1); padNavAt = now; }
      if (!ay && !ax) padNavAt = 0;
      if (pressed(0)) { const el = document.activeElement; if (el && el.click) el.click(); }
      if (pressed(1)) { const d = dialogs.find((x) => x.open); if (d) d.close(); }
    } else {
      padAxis = { x: ax, y: ay };
      if (pressed(0)) { if (mode === 'photo') savePhoto(); else interact(); }
      if (pressed(1) && mode === 'photo') exitPhoto();
      if (pressed(3)) { if (mode === 'photo') exitPhoto(); else enterPhoto(); }
      if (pressed(2) && mode === 'play') showGallery();
      if (pressed(4)) zoomBy(1 / 1.15); if (pressed(5)) zoomBy(1.15);
      const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
      if (Math.abs(rx) > 0.25 || Math.abs(ry) > 0.25) { cam.x += rx * 9 / cam.zoom; cam.y += ry * 9 / cam.zoom; cam.follow = false; clampCam(); }
    }
    if (pressed(9)) { if (mode === 'title') $('m-continue').hidden ? $('m-start').click() : $('m-continue').click(); else if ($('dlg-pause').open) $('dlg-pause').close(); else if (!anyDialogOpen() && mode === 'play') openDialog($('dlg-pause')); }
    gp.buttons.forEach((btn, i) => { padPrev[i] = btn.pressed; });
  }
  window.addEventListener('gamepadconnected', () => toast('Gamepad connected'));

  // ------------------------------------------------------------------ update loop
  let nearSite = null, lastNear = null, autosaveAt = 0;
  function update(dt) {
    time += dt;
    if (settings.time === 'cycle' && photoTod == null && !settings.motion) tod = (tod + dt / 300) % 1;
    const L = light(curTod());
    pollPad();
    const playing = mode === 'play' && !anyDialogOpen();
    if (playing) state.playTime += dt;

    // player movement
    let mx = 0, my = 0;
    if (playing) {
      if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
      if (keys.has('arrowright') || keys.has('d')) mx += 1;
      if (keys.has('arrowup') || keys.has('w')) my -= 1;
      if (keys.has('arrowdown') || keys.has('s')) my += 1;
      mx += padAxis.x; my += padAxis.y;
      if (mx || my) { player.target = null; player.pending = null; cam.follow = true; }
      else if (player.target) {
        const dx = player.target.x - player.x, dy = player.target.y - player.y, d = Math.hypot(dx, dy);
        if (d < 6) { player.target = null; if (player.pending) { const id = player.pending; player.pending = null; showPostcard(id, true); } }
        else { mx = dx / d; my = dy / d; }
      }
    }
    const ml = Math.hypot(mx, my);
    player.moving = ml > 0.05;
    if (player.moving) {
      const sp = 250 * Math.min(1, ml);
      player.x += (mx / ml) * sp * dt; player.y += (my / ml) * sp * dt;
      if (mx) player.face = mx > 0 ? 1 : -1;
      player.walk += dt;
    }
    player.x = clamp(player.x, 50, W - 50); player.y = clamp(player.y, HORIZON + 40, H - 30);
    const pe = Math.hypot((player.x - POND.x) / (POND.rx + 18), (player.y - POND.y) / (POND.ry + 14));
    if (pe < 1) { const a = Math.atan2((player.y - POND.y) / (POND.ry + 14), (player.x - POND.x) / (POND.rx + 18)); player.x = POND.x + Math.cos(a) * (POND.rx + 18); player.y = POND.y + Math.sin(a) * (POND.ry + 14); }

    // proximity
    nearSite = null; let best = 1e9;
    SITES.forEach((s) => { const d = Math.hypot(player.x - s.x, (player.y - (s.y + 40)) * 1.1); const r = s.kind === 'district' ? 95 : 75; if (d < r && d < best) { best = d; nearSite = s; } });
    interactBtn.hidden = !(nearSite && mode === 'play');
    if (nearSite) interactBtn.textContent = state.found.has(nearSite.id) ? `Reread: ${nearSite.name}` : `Read: ${nearSite.name}`;
    if (nearSite !== lastNear && nearSite && mode === 'play' && !player.pending) toast(`${nearSite.name}: press Enter or tap Read`);
    lastNear = nearSite;

    // camera
    if (mode === 'title') {
      cam.drift += dt * (settings.motion ? 0 : 0.03);
      cam.x = W / 2 + Math.sin(cam.drift) * 380; cam.y = H / 2 + Math.cos(cam.drift * 0.7) * 120; clampCam();
    } else if (cam.follow) {
      const k = settings.motion ? 1 : 1 - Math.pow(0.0025, dt);
      cam.x = lerp(cam.x, player.x, k); cam.y = lerp(cam.y, player.y - 40, k); clampCam();
    }

    // water and gardens
    DISTRICTS.forEach((d) => {
      const target = state.visited.has(d.id) ? 1 : 0;
      flow[d.id] = target ? Math.min(1, flow[d.id] + dt / (settings.motion ? 0.01 : 2.6)) : Math.max(0, flow[d.id] - dt);
      const gt = flow[d.id] >= 0.98 ? target : 0;
      growth[d.id] = gt ? Math.min(1, growth[d.id] + dt / (settings.motion ? 0.01 : 3)) : Math.max(0, growth[d.id] - dt);
    });

    // residents keep daily routines: wander by day, head home at night
    residents.forEach((p) => {
      if (p.wait > 0) { p.wait -= dt; p.moving = false; return; }
      if (!p.tx) {
        const home = byId[p.home];
        const dest = L.night > 0.6 ? home : SITES[(Math.random() * SITES.length) | 0];
        p.tx = dest.x + (Math.random() - 0.5) * 80; p.ty = dest.y + 50 + Math.random() * 40;
      }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 4) { p.tx = 0; p.wait = 2 + Math.random() * 6; p.moving = false; return; }
      p.x += (dx / d) * p.speed * dt; p.y += (dy / d) * p.speed * dt; p.moving = true; p.walk += dt * 0.8; p.face = dx > 0 ? 1 : -1;
      const e = Math.hypot((p.x - POND.x) / (POND.rx + 12), (p.y - POND.y) / (POND.ry + 10));
      if (e < 1) { const a = Math.atan2(p.y - POND.y, p.x - POND.x); p.x = POND.x + Math.cos(a) * (POND.rx + 14); p.y = POND.y + Math.sin(a) * (POND.ry + 12); }
    });

    // particles
    if (!settings.motion) particles.forEach((p) => {
      if (p.type === 'sand') { p.x += p.v * dt; p.y += Math.sin(time * 2 + p.ph) * 8 * dt; if (p.x > W + 10) { p.x = -10; p.y = HORIZON + Math.random() * (H - HORIZON); } }
      else if (p.type === 'mote') { p.x += Math.sin(time * 0.3 + p.ph) * p.v * dt; p.y += Math.cos(time * 0.4 + p.ph) * p.v * dt; }
      else { p.x = p.cx + Math.sin(time * p.sp + p.ph) * p.rad * 0.6 + Math.sin(time * 1.7 + p.ph) * 14; p.y = p.cy + Math.cos(time * p.sp * 0.8 + p.ph) * p.rad * 0.35; }
    });
    for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].age += dt / 0.9; if (splashes[i].age >= 1) splashes.splice(i, 1); }

    updateAudio(dt, L);
    if (playing && time - autosaveAt > 15) { autosaveAt = time; autosave(); }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderScene(ctx, view.w, view.h, cam, { t: time, tod: curTod(), scale: view.dpr, player: mode !== 'title' });
    if (mode === 'play') drawLabels(ctx);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (mode !== 'page' && !document.hidden) { update(dt); render(); }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ wiring
  $('m-start').addEventListener('click', () => { if (state.found.size) resetGame(); startPlay(false); });
  $('m-continue').addEventListener('click', () => startPlay(true));
  $('m-gallery').addEventListener('click', showGallery);
  $('m-settings').addEventListener('click', () => openDialog($('dlg-settings')));
  $('m-read').addEventListener('click', toPage);
  $('back-to-game').addEventListener('click', fromPage);
  $('btn-pause').addEventListener('click', () => openDialog($('dlg-pause')));
  $('btn-gallery').addEventListener('click', showGallery);
  $('btn-photo').addEventListener('click', enterPhoto);
  $('btn-sound').addEventListener('click', () => setSound(!settings.sound));
  interactBtn.addEventListener('click', interact);
  document.querySelectorAll('.districts button').forEach((b) => b.addEventListener('click', () => { goTo(b.dataset.go); toast(`Walking to ${byId[b.dataset.go].name}`); canvas.focus({ preventScroll: true }); }));
  $('p-resume').addEventListener('click', () => $('dlg-pause').close());
  $('p-save').addEventListener('click', () => { toast(writeSave(snapshot()) ? 'Progress saved' : 'This browser blocked saving'); $('dlg-pause').close(); });
  $('p-load').addEventListener('click', () => {
    const s = readSave();
    $('dlg-pause').close();
    if (!s) { toast('No saved game yet'); return; }
    state.visited = new Set(s.visited || []); state.found = new Set(s.found || []); state.playTime = s.playTime || 0; state.completedShown = !!s.completedShown;
    if (s.player) { player.x = s.player.x; player.y = s.player.y; }
    DISTRICTS.forEach((d) => { if (!state.visited.has(d.id)) { flow[d.id] = 0; growth[d.id] = 0; } });
    player.target = null; player.pending = null; cam.follow = true; updateGoal(); toast('Saved game loaded');
  });
  $('p-settings').addEventListener('click', () => openDialog($('dlg-settings')));
  $('p-gallery').addEventListener('click', showGallery);
  $('p-read').addEventListener('click', toPage);
  let newArm = 0;
  $('p-new').addEventListener('click', (e) => {
    const now = performance.now();
    if (now - newArm > 3000) { newArm = now; e.currentTarget.textContent = 'Press again to start over'; setTimeout(() => { $('p-new').textContent = 'New game'; }, 3000); return; }
    newArm = 0; $('p-new').textContent = 'New game'; resetGame(); $('dlg-pause').close(); toast('A fresh start at the spring');
  });
  $('p-title').addEventListener('click', toTitle);
  $('r-copy').addEventListener('click', async () => {
    const text = $('r-cmd').textContent;
    try { await navigator.clipboard.writeText(text); toast('Commands copied'); }
    catch (e) { const sel = window.getSelection(); const rng2 = document.createRange(); rng2.selectNodeContents($('r-cmd')); sel.removeAllRanges(); sel.addRange(rng2); toast('Selected: press Ctrl+C to copy'); }
  });
  $('r-gallery').addEventListener('click', showGallery);
  $('photo-time').addEventListener('input', (e) => { photoTod = Number(e.target.value) / 1000; });
  $('photo-save').addEventListener('click', savePhoto);
  $('photo-exit').addEventListener('click', exitPhoto);
  $('dlg-tutorial').addEventListener('close', () => { toast('Find the five districts'); canvas.focus({ preventScroll: true }); });
  dialogs.forEach((d) => d.addEventListener('close', () => { if (!anyDialogOpen()) { if (mode === 'title') { const f = $('m-continue').hidden ? $('m-start') : $('m-continue'); f.focus(); } else if (mode !== 'page') canvas.focus({ preventScroll: true }); } }));

  const bind = (id, key, conv) => $(id).addEventListener('input', (e) => { settings[key] = conv(e.target); if (key === 'sound' && settings.sound) initAudio(); if (key === 'sound' && audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); applySettings(); autosave(); });
  bind('s-sound', 'sound', (el) => el.checked);
  bind('s-music', 'music', (el) => Number(el.value));
  bind('s-amb', 'amb', (el) => Number(el.value));
  bind('s-motion', 'motion', (el) => el.checked);
  bind('s-shake', 'shake', (el) => el.checked);
  bind('s-contrast', 'contrast', (el) => el.checked);
  bind('s-large', 'large', (el) => el.checked);
  $('s-time').addEventListener('change', (e) => { settings.time = e.target.value; applySettings(); autosave(); });

  document.addEventListener('visibilitychange', () => { if (document.hidden) { autosave(); if (audio.ctx) audio.ctx.suspend(); } else if (audio.ctx && settings.sound && mode !== 'page') audio.ctx.resume(); });
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', autosave);

  // ------------------------------------------------------------------ boot
  try {
    terrain = paintTerrain();
  } catch (e) {
    return; // leave the written guide in place if the canvas can't paint
  }
  body.classList.add('game-on');
  game.hidden = false;
  resize();
  applySettings();
  updateGoal();
  if (location.hash === '#content' || location.hash === '#read') { toPage(); }
  else toTitle();
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });

  // tiny hook for automated playtests (read-only state + travel helper)
  window.__oasis = Object.freeze({
    state: () => ({ mode, visited: [...state.visited], found: [...state.found], player: { x: Math.round(player.x), y: Math.round(player.y) }, near: nearSite && nearSite.id, zoom: cam.zoom, dialogs: dialogs.filter((d) => d.open).map((d) => d.id) }),
    sites: () => SITES.map((s) => ({ id: s.id, x: Math.round(s.x), y: Math.round(s.y), kind: s.kind })),
    screenOf: (id) => { const s = byId[id]; return s ? toScreen(s.x, s.y - 40) : null; },
  });
})();
