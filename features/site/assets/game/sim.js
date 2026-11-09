// sim.js: the settlement simulation. Pure data and rules, no DOM and no three.js,
// so it runs in node for tests. Terrain heights live on the (N+1)^2 vertex grid;
// cell data (kind, water, irrigation, occupancy) lives on the N^2 cell grid.

import {
  N, HALF, KIND, ITEMS, ITEM_IDS, CHAPTERS, CHANNEL_DEPTH, FLOW_CLIMB, CELL_FILL_RATE,
  HISTORY_LIMIT, SAVE_VERSION, ABUNDANCE, BOUNDARIES, WEATHERS, ALL_UNLOCKS, POSTCARDS,
} from './config.js';

const V = N + 1;
export const vidx = (i, j) => j * V + i;
export const cidx = (i, j) => j * N + i;
export const cellCenter = (i, j) => [i - HALF + 0.5, j - HALF + 0.5];
export const worldToCell = (x, z) => [Math.floor(x + HALF), Math.floor(z + HALF)];
const inCells = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function valueNoise(seed) {
  const r = rng(seed);
  const G = 17, grid = new Float32Array(G * G);
  for (let k = 0; k < grid.length; k++) grid[k] = r();
  const at = (x, y) => grid[((y % G + G) % G) * G + ((x % G + G) % G)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export function createWorld() {
  return {
    mode: 'campaign', chapter: 0,
    heights: new Float32Array(V * V),
    kinds: new Uint8Array(N * N),
    wet: new Float32Array(N * N),
    supplied: new Uint8Array(N * N),
    occ: new Int32Array(N * N).fill(-1),
    objects: [], nextId: 1,
    goalsDone: [], unlocked: [], discovered: [], postcards: [],
    hidden: [],                 // [{ kind, x, z, found }]
    hours: 9, weather: 'clear', abundance: 'normal', boundaryName: 'medium',
    boundary: { cx: 0, cz: 0, r: 12 },
    stats: { placed: 0, sculpted: 0, photos: 0, played: 0 },
    derived: { wetCells: 0, irrigated: 0, restored: 0, population: 0, beauty: 0, shadedPublic: 0, connectedHomes: 0, supply: 0, used: 0 },
    undo: [], redo: [],
    events: [],                 // queued notifications for the UI and audio
  };
}

// ---------- terrain generation ----------
export function generateTerrain(w, chapterDef, seed) {
  const n1 = valueNoise(seed * 7 + 1), n2 = valueNoise(seed * 13 + 5), n3 = valueNoise(seed * 3 + 9);
  const [sx, sz] = chapterDef ? chapterDef.spring : [0, 0];
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const x = i - HALF, z = j - HALF;
    // Long dune ridges running diagonally plus softer rolling noise.
    const ridge = Math.abs(Math.sin((x * 0.16 + z * 0.09) + n1(x * 0.06, z * 0.06) * 3.2));
    let h = (1 - ridge) * 2.2 * n2(x * 0.05 + 3, z * 0.05 + 7) + n3(x * 0.12, z * 0.12) * 0.9;
    const dEdge = Math.max(Math.abs(x), Math.abs(z));
    h += Math.max(0, dEdge - 22) * 0.25;                        // dunes rise toward the map edge
    const dSpring = Math.hypot(x - sx, z - sz);
    h *= clamp((dSpring - 2) / 9, 0.08, 1);                      // a gentle hollow around the spring
    if (chapterDef && chapterDef.ridge) h += Math.max(0, 2.4 - Math.abs(x - z * 0.25 - 2) * 0.55);
    w.heights[vidx(i, j)] = h;
  }
}

export function vertexHeight(w, i, j) { return w.heights[vidx(clamp(i, 0, N), clamp(j, 0, N))]; }
export function cellBed(w, i, j) {
  const a = w.heights[vidx(i, j)], b = w.heights[vidx(i + 1, j)], c = w.heights[vidx(i, j + 1)], d = w.heights[vidx(i + 1, j + 1)];
  return (a + b + c + d) / 4;
}
export function heightAt(w, x, z) {
  const fx = clamp(x + HALF, 0, N - 1e-6), fz = clamp(z + HALF, 0, N - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = w.heights[vidx(i, j)], b = w.heights[vidx(i + 1, j)], c = w.heights[vidx(i, j + 1)], d = w.heights[vidx(i + 1, j + 1)];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

// ---------- world setup ----------
export function newGame(w, { mode = 'campaign', chapter = 0, options = {} } = {}) {
  const fresh = createWorld();
  for (const k of Object.keys(fresh)) if (k !== 'stats') w[k] = fresh[k];
  w.stats = w.stats || fresh.stats;
  w.mode = mode === 'sandbox' ? 'sandbox' : 'campaign';
  w.chapter = clamp(chapter | 0, 0, CHAPTERS.length - 1);
  const def = w.mode === 'campaign' ? CHAPTERS[w.chapter] : null;
  generateTerrain(w, def || { spring: [0, 0] }, def ? def.seed : 71);
  const [sx, sz] = def ? def.spring : [0, 0];
  if (w.mode === 'campaign') {
    w.unlocked = def.start.unlocked.slice();
    w.boundary = { cx: sx, cz: sz, r: def.boundary[0] };
    w.hours = 8.5;
    for (const [x, z, ww, dd] of def.dry) for (let a = 0; a < ww; a++) for (let b = 0; b < dd; b++) {
      const [i, j] = worldToCell(x + a, z + b);
      if (inCells(i, j)) w.kinds[cidx(i, j)] = KIND.DRY;
    }
    for (const [x, z] of def.ruins) w.hidden.push({ kind: 'ruin', x, z, found: false });
    for (const [x, z] of def.overlooks) w.hidden.push({ kind: 'overlook', x, z, found: false });
    for (const [x, z] of def.blooms) w.hidden.push({ kind: 'bloom', x, z, found: false });
  } else {
    w.unlocked = ALL_UNLOCKS.slice();
    w.weather = WEATHERS.includes(options.weather) ? options.weather : 'clear';
    w.abundance = ABUNDANCE[options.water] ? options.water : 'normal';
    w.boundaryName = BOUNDARIES[options.boundary] ? options.boundary : 'medium';
    w.boundary = { cx: 0, cz: 0, r: BOUNDARIES[w.boundaryName] };
    w.hours = Number.isFinite(options.hours) ? clamp(options.hours, 0, 23.99) : 9;
    const r = rng(97);
    for (let k = 0; k < 3; k++) w.hidden.push({ kind: ['ruin', 'overlook', 'bloom'][k], x: Math.round((r() - 0.5) * 36), z: Math.round((r() - 0.5) * 36), found: false });
  }
  // The spring: a small pool with a short stub of canal already flowing.
  placeRaw(w, 'spring', sx, sz, 0);
  const [ci, cj] = worldToCell(sx + 1.5, sz);
  for (let k = 0; k < 2; k++) carveCell(w, ci + k, cj);
  recompute(w, true);
  w.undo = []; w.redo = [];
  w.events.push({ type: 'newGame', mode: w.mode, chapter: w.chapter });
  return w;
}

// ---------- footprint and placement ----------
export function footprint(type, x, z, rot) {
  const def = ITEMS[type];
  let [fw, fd] = def.size;
  if (((Math.round(rot / (Math.PI / 2)) % 2) + 2) % 2 === 1) [fw, fd] = [fd, fw];
  const i0 = Math.round(x + HALF - fw / 2), j0 = Math.round(z + HALF - fd / 2);
  const cells = [];
  for (let a = 0; a < fw; a++) for (let b = 0; b < fd; b++) cells.push([i0 + a, j0 + b]);
  return { cells, i0, j0, fw, fd, cx: i0 + fw / 2 - HALF, cz: j0 + fd / 2 - HALF };
}
export function snapPosition(type, x, z, rot) {
  const f = footprint(type, x, z, rot);
  return [f.cx, f.cz];
}
export function inBoundary(w, x, z) {
  return Math.hypot(x - w.boundary.cx, z - w.boundary.cz) <= w.boundary.r + 0.5;
}
export function canPlace(w, type, x, z, rot) {
  const def = ITEMS[type];
  if (!def) return { ok: false, why: 'Unknown item' };
  if (def.unlock && !w.unlocked.includes(def.unlock)) return { ok: false, why: 'Not unlocked yet' };
  const f = footprint(type, x, z, rot);
  for (const [i, j] of f.cells) {
    if (!inCells(i, j)) return { ok: false, why: 'Off the map' };
    const [cx, cz] = cellCenter(i, j);
    if (!def.fixed && !inBoundary(w, cx, cz)) return { ok: false, why: 'Outside the settlement boundary' };
    const c = cidx(i, j);
    if (w.occ[c] !== -1) return { ok: false, why: 'Something is already here' };
    const k = w.kinds[c];
    if (def.overCanal) { if (k !== KIND.CHANNEL) return { ok: false, why: 'Bridges go across a canal' }; }
    else if (def.carries) { /* aqueducts may stand anywhere */ }
    else if (k === KIND.CHANNEL) return { ok: false, why: 'That is a canal' };
  }
  // Large buildings want fairly level ground.
  if (f.cells.length > 1 && !def.fixed) {
    let lo = Infinity, hi = -Infinity;
    for (const [i, j] of f.cells) { const b = cellBed(w, i, j); lo = Math.min(lo, b); hi = Math.max(hi, b); }
    if (hi - lo > 1.6) return { ok: false, why: 'Too steep: smooth the ground first' };
  }
  return { ok: true, f };
}
// free: keep the exact position for the model (freeform placement); the
// footprint still decides which cells are occupied.
function placeRaw(w, type, x, z, rot, variant = 0, free = false) {
  const f = footprint(type, x, z, rot);
  const obj = { id: w.nextId++, type, x: free ? x : f.cx, z: free ? z : f.cz, rot, variant, cells: f.cells.map(([i, j]) => cidx(i, j)), thrive: ITEMS[type].plant ? 0.15 : 1 };
  for (const c of obj.cells) w.occ[c] = obj.id;
  if (ITEMS[type].carries) for (const c of obj.cells) w.kinds[c] = KIND.CHANNEL;
  if (ITEMS[type].plant || ITEMS[type].waterFeature) for (const c of obj.cells) if (w.kinds[c] === KIND.SAND) w.kinds[c] = KIND.GARDEN;
  w.objects.push(obj);
  return obj;
}
export function place(w, type, x, z, rot = 0, variant = 0, free = false) {
  const chk = canPlace(w, type, x, z, rot);
  if (!chk.ok) { w.events.push({ type: 'blocked', why: chk.why }); return null; }
  pushHistory(w);
  const obj = placeRaw(w, type, x, z, rot, variant, free);
  w.stats.placed++;
  w.events.push({ type: 'placed', item: type, x: obj.x, z: obj.z });
  recompute(w, true);
  return obj;
}
export function objectAt(w, x, z) {
  const [i, j] = worldToCell(x, z);
  if (!inCells(i, j)) return null;
  const id = w.occ[cidx(i, j)];
  return id === -1 ? null : w.objects.find((o) => o.id === id) || null;
}
function removeRaw(w, obj) {
  for (const c of obj.cells) {
    if (w.occ[c] === obj.id) w.occ[c] = -1;
    if (ITEMS[obj.type].carries && w.kinds[c] === KIND.CHANNEL) w.kinds[c] = KIND.SAND;
  }
  w.objects = w.objects.filter((o) => o !== obj);
}
export function remove(w, id) {
  const obj = w.objects.find((o) => o.id === id);
  if (!obj || ITEMS[obj.type].fixed) return false;
  pushHistory(w);
  removeRaw(w, obj);
  w.events.push({ type: 'removed', item: obj.type });
  recompute(w, true);
  return true;
}
export function rotate(w, id, step = Math.PI / 2) {
  const obj = w.objects.find((o) => o.id === id);
  if (!obj || ITEMS[obj.type].fixed) return false;
  pushHistory(w);
  removeRaw(w, obj);
  const nr = obj.rot + step;
  const chk = canPlace(w, obj.type, obj.x, obj.z, nr);
  const r = chk.ok ? nr : obj.rot;
  const again = placeRaw(w, obj.type, obj.x, obj.z, r, obj.variant, true);
  again.thrive = obj.thrive;
  if (!chk.ok) { w.undo.pop(); w.events.push({ type: 'blocked', why: 'No room to turn it here' }); }
  recompute(w, true);
  return again;
}

// ---------- terrain tools ----------
function carveCell(w, i, j) {
  if (!inCells(i, j)) return;
  const c = cidx(i, j);
  if (w.occ[c] !== -1 && !ITEMS[(w.objects.find((o) => o.id === w.occ[c]) || {}).type || 'home'].overCanal) return;
  if (w.kinds[c] === KIND.ROCK) return;
  w.kinds[c] = KIND.CHANNEL;
  // Lower the four corners to make a trough relative to the neighbourhood.
  let ref = Infinity;
  for (let a = -1; a <= 2; a++) for (let b = -1; b <= 2; b++) ref = Math.min(ref, vertexHeight(w, i + a, j + b));
  const target = ref - CHANNEL_DEPTH * 0.5;
  for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const v = vidx(clamp(i + a, 0, N), clamp(j + b, 0, N));
    if (w.heights[v] > target) w.heights[v] = target;
  }
}
// One brush application. Returns true if anything changed.
export function applyBrush(w, tool, x, z, radius = 1.5, strength = 1) {
  if (tool === 'carve' || tool === 'path') {
    const [i, j] = worldToCell(x, z);
    const rr = Math.max(0, Math.round(radius - 0.5));
    let changed = false;
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
      const ii = i + a, jj = j + b;
      if (!inCells(ii, jj)) continue;
      const [cx, cz] = cellCenter(ii, jj);
      if (!inBoundary(w, cx, cz)) continue;
      const c = cidx(ii, jj);
      if (tool === 'carve') { if (w.kinds[c] !== KIND.CHANNEL) { carveCell(w, ii, jj); changed = true; } }
      else if (w.occ[c] === -1 && (w.kinds[c] === KIND.SAND || w.kinds[c] === KIND.DRY)) { w.kinds[c] = KIND.PATH; changed = true; }
    }
    return changed;
  }
  const r = Math.max(0.6, radius);
  const i0 = Math.floor(x + HALF - r - 1), i1 = Math.ceil(x + HALF + r + 1);
  const j0 = Math.floor(z + HALF - r - 1), j1 = Math.ceil(z + HALF + r + 1);
  let changed = false;
  const src = tool === 'smooth' ? w.heights.slice() : null;
  for (let j = Math.max(0, j0); j <= Math.min(N, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N, i1); i++) {
    const vx = i - HALF, vz = j - HALF;
    const d = Math.hypot(vx - x, vz - z);
    if (d > r) continue;
    if (!inBoundary(w, vx, vz) && w.mode === 'campaign') continue;
    const fall = 0.5 + 0.5 * Math.cos(Math.PI * d / r);
    const v = vidx(i, j);
    if (tool === 'raise') w.heights[v] = Math.min(6, w.heights[v] + 0.22 * fall * strength);
    else if (tool === 'lower') w.heights[v] = Math.max(-2.5, w.heights[v] - 0.22 * fall * strength);
    else if (tool === 'smooth') {
      let s = 0, n = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii <= N && jj <= N) { s += src[vidx(ii, jj)]; n++; } }
      w.heights[v] += (s / n - w.heights[v]) * 0.5 * fall * strength;
    }
    changed = true;
  }
  return changed;
}
// A whole stroke (press, drag, release) is one undo step.
export function beginStroke(w) { pushHistory(w); w._strokeChanged = false; }
export function strokePoint(w, tool, x, z, radius, strength) {
  if (applyBrush(w, tool, x, z, radius, strength)) w._strokeChanged = true;
  if (w._strokeChanged) w._dirtyTerrain = true;
}
export function endStroke(w, tool) {
  if (!w._strokeChanged) w.undo.pop();
  else {
    w.stats.sculpted++;
    w.events.push({ type: 'stroke', tool });
    recompute(w, true);
  }
  w._strokeChanged = false;
}

// ---------- undo / redo ----------
function snapshot(w) {
  return { heights: w.heights.slice(), kinds: w.kinds.slice(), objects: w.objects.map((o) => ({ ...o, cells: o.cells.slice() })), nextId: w.nextId };
}
function restore(w, s) {
  w.heights.set(s.heights); w.kinds.set(s.kinds); w.nextId = s.nextId;
  w.objects = s.objects.map((o) => ({ ...o, cells: o.cells.slice() }));
  w.occ.fill(-1);
  for (const o of w.objects) for (const c of o.cells) w.occ[c] = o.id;
}
export function pushHistory(w) {
  w.undo.push(snapshot(w));
  if (w.undo.length > HISTORY_LIMIT) w.undo.shift();
  w.redo.length = 0;
}
export function undo(w) {
  if (!w.undo.length) return false;
  w.redo.push(snapshot(w)); restore(w, w.undo.pop());
  w.events.push({ type: 'undo' }); recompute(w, true); w._dirtyTerrain = true; return true;
}
export function redo(w) {
  if (!w.redo.length) return false;
  w.undo.push(snapshot(w)); restore(w, w.redo.pop());
  w.events.push({ type: 'redo' }); recompute(w, true); w._dirtyTerrain = true; return true;
}

// ---------- water ----------
function neighbors4(i, j) { return [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]; }
export function computeSupply(w) {
  const mult = ABUNDANCE[w.abundance] || 1;
  w.supplied.fill(0);
  const sources = w.objects.filter((o) => ITEMS[o.type].src);
  let supply = 0;
  const queue = [], dist = new Int32Array(N * N).fill(-1);
  for (const s of sources) {
    supply += ITEMS[s.type].src * mult;
    for (const c of s.cells) {
      const i = c % N, j = (c / N) | 0;
      for (const [a, b] of neighbors4(i, j)) {
        if (!inCells(a, b)) continue;
        const n = cidx(a, b);
        if (w.kinds[n] === KIND.CHANNEL && dist[n] === -1) { dist[n] = 0; queue.push(n); }
      }
    }
  }
  const isCarrier = (c) => { const id = w.occ[c]; if (id === -1) return false; const o = w.objects.find((q) => q.id === id); return !!(o && ITEMS[o.type].carries); };
  const bedOf = (c) => cellBed(w, c % N, (c / N) | 0);
  let used = 0;
  for (let q = 0; q < queue.length && used < supply; q++) {
    const c = queue[q];
    w.supplied[c] = 1; used++;
    const i = c % N, j = (c / N) | 0;
    const hb = isCarrier(c) ? Infinity : bedOf(c);
    for (const [a, b] of neighbors4(i, j)) {
      if (!inCells(a, b)) continue;
      const n = cidx(a, b);
      if (dist[n] !== -1 || w.kinds[n] !== KIND.CHANNEL) continue;
      const nb = isCarrier(n) ? -Infinity : bedOf(n);
      if (nb <= hb + FLOW_CLIMB) { dist[n] = dist[c] + 1; queue.push(n); }
    }
  }
  w.derived.supply = Math.round(supply);
  w.derived.used = used;
}
function isSourceAdjacent(w, c) {
  const i = c % N, j = (c / N) | 0;
  for (const [a, b] of neighbors4(i, j)) {
    if (!inCells(a, b)) continue;
    const id = w.occ[cidx(a, b)];
    if (id !== -1) { const o = w.objects.find((q) => q.id === id); if (o && ITEMS[o.type].src) return true; }
  }
  return false;
}
export function stepWater(w, dt) {
  let wetCount = 0;
  const next = w.wet;
  for (let c = 0; c < N * N; c++) {
    if (w.supplied[c]) {
      if (next[c] < 1) {
        const i = c % N, j = (c / N) | 0;
        let fed = isSourceAdjacent(w, c);
        if (!fed) for (const [a, b] of neighbors4(i, j)) { if (inCells(a, b) && w.wet[cidx(a, b)] > 0.75 && w.supplied[cidx(a, b)]) { fed = true; break; } }
        if (fed) {
          const before = next[c];
          next[c] = Math.min(1, next[c] + dt * CELL_FILL_RATE);
          if (before < 0.5 && next[c] >= 0.5) w.events.push({ type: 'waterArrive', c });
        }
      }
    } else if (next[c] > 0) next[c] = Math.max(0, next[c] - dt * 1.2);
    if (next[c] > 0.6) wetCount++;
  }
  w.derived.wetCells = wetCount;
}

// ---------- derived scores ----------
function nearWater(w, cells, r) {
  for (const c of cells) {
    const i = c % N, j = (c / N) | 0;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      const ii = i + a, jj = j + b;
      if (inCells(ii, jj) && w.wet[cidx(ii, jj)] > 0.6) return true;
    }
  }
  return false;
}
function isWatered(w, o) {
  const def = ITEMS[o.type];
  if (def.src) return true;
  if (nearWater(w, o.cells, def.waterFeature ? 1 : 2)) return true;
  // Running fountains and pools water the plantings around them.
  for (const f of w.objects) {
    if (f === o || !ITEMS[f.type].waterFeature || !f._running) continue;
    if (Math.hypot(f.x - o.x, f.z - o.z) <= 3.2) return true;
  }
  return false;
}
export function stepGrowth(w, dt) {
  const rain = w.weather === 'rain' ? 1 : 0;
  for (const o of w.objects) {
    const def = ITEMS[o.type];
    if (def.waterFeature || def.needsWater) o._running = nearWater(w, o.cells, 1);
  }
  let irrigated = 0;
  for (const o of w.objects) {
    const def = ITEMS[o.type];
    if (!def.plant) continue;
    const watered = isWatered(w, o) || (rain && o.thrive > 0.3);
    o._watered = watered;
    if (watered) { irrigated++; o.thrive = Math.min(1, o.thrive + dt * 0.18); }
    else o.thrive = Math.max(0.12, o.thrive - dt * 0.015);
    // A thriving planting brings a dry plot back.
    if (o.thrive > 0.8) for (const c of o.cells) if (w.kinds[c] === KIND.DRY) { w.kinds[c] = KIND.RESTORED; w.events.push({ type: 'restored', c }); w._dirtyTerrain = true; }
    // Rarely, a thriving garden reveals a rare desert bloom.
    if (o.thrive >= 1 && !o._bloomChecked) {
      o._bloomChecked = true;
      if ((o.id * 2654435761 >>> 0) % 9 === 0) w.events.push({ type: 'bloomSeen', x: o.x, z: o.z });
    }
  }
  w.derived.irrigated = irrigated;
}

function shadeAround(w, x, z) {
  let s = 0;
  for (const o of w.objects) {
    const sh = ITEMS[o.type].shade;
    if (!sh) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (d <= sh + 1.5) s += 1;
  }
  return s;
}
function pathConnected(w) {
  // Flood the path network (paths, bridges and the cells of public buildings).
  const seen = new Uint8Array(N * N), queue = [];
  const publicIds = new Set(w.objects.filter((o) => ITEMS[o.type].publicSpace || o.type === 'spring').map((o) => o.id));
  const walkable = (c) => w.kinds[c] === KIND.PATH || (w.occ[c] !== -1 && (publicIds.has(w.occ[c]) || (w.objects.find((o) => o.id === w.occ[c]) || {}).type === 'bridge'));
  for (const o of w.objects) if (publicIds.has(o.id)) for (const c of o.cells) { if (!seen[c]) { seen[c] = 1; queue.push(c); } }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], i = c % N, j = (c / N) | 0;
    for (const [a, b] of neighbors4(i, j)) {
      if (!inCells(a, b)) continue;
      const n = cidx(a, b);
      if (!seen[n] && walkable(n)) { seen[n] = 1; queue.push(n); }
    }
  }
  let connected = 0;
  for (const o of w.objects) {
    if (!ITEMS[o.type].residents) continue;
    let ok = false;
    for (const c of o.cells) {
      const i = c % N, j = (c / N) | 0;
      for (const [a, b] of neighbors4(i, j)) if (inCells(a, b) && seen[cidx(a, b)]) { ok = true; break; }
      if (ok) break;
    }
    o._connected = ok;
    if (ok) connected++;
  }
  return connected;
}
export function recompute(w, full = false) {
  if (full) computeSupply(w);
  const d = w.derived;
  d.restored = 0;
  for (let c = 0; c < N * N; c++) if (w.kinds[c] === KIND.RESTORED) d.restored++;
  d.connectedHomes = pathConnected(w);
  // Population: homes near water or a well house their families.
  let pop = 0;
  for (const o of w.objects) {
    const res = ITEMS[o.type].residents;
    if (!res) continue;
    const water = nearWater(w, o.cells, 6) || w.objects.some((s) => ITEMS[s.type].src && Math.hypot(s.x - o.x, s.z - o.z) < 8);
    o._housed = water;
    if (water) pop += res + (o._connected ? 1 : 0);
  }
  d.population = pop;
  // Shaded public spaces.
  let shaded = 0;
  for (const o of w.objects) if (ITEMS[o.type].publicSpace && o.type !== 'spring') { o._shaded = shadeAround(w, o.x, o.z) >= 2; if (o._shaded) shaded++; }
  d.shadedPublic = shaded;
  // Beauty: thriving plantings, running water features, decor and variety.
  let b = 0;
  const types = new Set();
  for (const o of w.objects) {
    const def = ITEMS[o.type];
    let v = def.beauty || 0;
    if (def.plant) v *= 0.4 + 0.6 * o.thrive;
    if (def.waterFeature && !o._running) v *= 0.3;
    b += v; types.add(o.type);
  }
  b += types.size * 2 + Math.min(20, d.wetCells * 0.4);
  d.beauty = Math.round(Math.min(100, 100 * (1 - Math.exp(-b / 140))));
}

// ---------- goals, discoveries, postcards ----------
function goalProgress(w, g) {
  const d = w.derived;
  switch (g.type) {
    case 'wetCells': return [d.wetCells, g.n];
    case 'count': {
      const n = w.objects.filter((o) => o.type === g.item && (!ITEMS[o.type].waterFeature || o._running)).length;
      return [n, g.n];
    }
    case 'irrigated': return [d.irrigated, g.n];
    case 'restored': return [d.restored, g.n];
    case 'connectedHomes': return [d.connectedHomes, g.n];
    case 'shadedPublic': return [d.shadedPublic, g.n];
    case 'population': return [d.population, g.n];
    case 'beauty': return [d.beauty, g.n];
    case 'discover': return [w.hidden.filter((h) => h.found).length, g.n];
    case 'postcard': return [w.postcards.length, g.n];
    case 'aqueductFlow': return [w.objects.some((o) => ITEMS[o.type].carries && o.cells.some((c) => w.wet[c] > 0.6)) ? 1 : 0, 1];
    case 'bridgeOverCanal': return [w.objects.some((o) => o.type === 'bridge' && o.cells.some((c) => w.wet[c] > 0.6)) ? 1 : 0, 1];
    default: return [0, 1];
  }
}
export function goalsStatus(w) {
  if (w.mode !== 'campaign') return [];
  return CHAPTERS[w.chapter].goals.map((g) => {
    const [have, need] = goalProgress(w, g);
    return { id: g.id, text: g.text, have: Math.min(have, need), need, done: w.goalsDone.includes(g.id) };
  });
}
export function checkGoals(w) {
  if (w.mode !== 'campaign') return;
  const def = CHAPTERS[w.chapter];
  for (const g of def.goals) {
    if (w.goalsDone.includes(g.id)) continue;
    const [have, need] = goalProgress(w, g);
    if (have >= need) {
      w.goalsDone.push(g.id);
      w.boundary.r = Math.min(30, w.boundary.r + def.boundary[1]);   // a new district opens
      w.events.push({ type: 'goal', id: g.id, text: g.text });
    }
  }
  if (!w._chapterDone && w.goalsDone.length === def.goals.length) {
    w._chapterDone = true;
    for (const u of def.unlocks) if (!w.unlocked.includes(u)) w.unlocked.push(u);
    w.events.push({ type: 'chapterComplete', chapter: w.chapter, unlocks: def.unlocks.slice() });
  }
}
export function tryDiscover(w, x, z, radius = 1.8) {
  for (const h of w.hidden) {
    if (h.found) continue;
    if (Math.hypot(h.x - x, h.z - z) <= radius) {
      h.found = true;
      w.discovered.push(h.kind + '@' + h.x + ',' + h.z);
      w.events.push({ type: 'discover', kind: h.kind, x: h.x, z: h.z });
      return h;
    }
  }
  return null;
}
// view: { hours, weather, visible: { type: count }, wetVisible, flockVisible, foundVisible: { ruin, overlook } , thrivingVisible, residentsVisible }
export function judgePostcards(w, view) {
  const v = view.visible || {}, h = view.hours;
  const night = h >= 19.5 || h < 5;
  const got = [];
  const ok = {
    'golden-canal': h >= 16.3 && h <= 19.2 && view.wetVisible >= 6 && (v.palm || 0) >= 2,
    'lantern-night': night && (v.lantern || 0) >= 4,
    'market-morning': h >= 6.5 && h <= 11 && (v.market || 0) >= 1 && view.residentsVisible >= 3,
    'birds-over-oasis': !!view.flockVisible,
    'ruins-dusk': h >= 16.8 && h <= 20.2 && (view.foundVisible && view.foundVisible.ruin) > 0,
    'reflecting-pool': (view.runningVisible && view.runningVisible.pool) > 0 && (v.palm || 0) >= 1,
    'courtyard-shade': h >= 11 && h <= 15 && (v.courtyard || 0) >= 1 && ((v.palm || 0) + (v.windTower || 0)) >= 1,
    'sand-drift': view.weather === 'breezy' && view.wetVisible >= 3,
    'rain-gardens': view.weather === 'rain' && view.thrivingVisible >= 3,
    'starry-overlook': night && (view.foundVisible && view.foundVisible.overlook) > 0,
  };
  for (const p of POSTCARDS) if (ok[p.id] && !w.postcards.includes(p.id)) { w.postcards.push(p.id); got.push(p.id); w.events.push({ type: 'postcard', id: p.id }); }
  w.stats.photos++;
  return got;
}

// ---------- tick ----------
export function tick(w, dt) {
  stepWater(w, dt);
  w._acc = (w._acc || 0) + dt;
  if (w._acc >= 0.25) {
    stepGrowth(w, w._acc);
    w._acc = 0;
    w._acc2 = (w._acc2 || 0) + 1;
    if (w._acc2 % 2 === 0) { computeSupply(w); recompute(w); checkGoals(w); }
  }
}

// ---------- save / load ----------
function b64(bytes) {
  let s = '';
  for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
function unb64(str) {
  const s = typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
  const out = new Uint8Array(s.length);
  for (let k = 0; k < s.length; k++) out[k] = s.charCodeAt(k);
  return out;
}
export function serialize(w) {
  const q = new Int16Array(V * V);
  for (let k = 0; k < q.length; k++) q[k] = Math.round(clamp(w.heights[k], -3, 7) * 1000);
  return {
    v: SAVE_VERSION, mode: w.mode, chapter: w.chapter,
    heights: b64(new Uint8Array(q.buffer)), kinds: b64(w.kinds),
    objects: w.objects.map((o) => [o.type, +o.x.toFixed(3), +o.z.toFixed(3), +o.rot.toFixed(4), o.variant | 0, +o.thrive.toFixed(3)]),
    goalsDone: w.goalsDone.slice(), unlocked: w.unlocked.slice(), postcards: w.postcards.slice(),
    hidden: w.hidden.map((h) => [h.kind, h.x, h.z, h.found ? 1 : 0]),
    hours: +w.hours.toFixed(3), weather: w.weather, abundance: w.abundance, boundaryName: w.boundaryName,
    boundary: [w.boundary.cx, w.boundary.cz, w.boundary.r], chapterDone: !!w._chapterDone,
    savedAt: Date.now(),
  };
}
// Validate everything: a save is untrusted input (it can be edited in storage).
export function deserialize(w, raw) {
  const fail = (why) => { throw new Error('Save rejected: ' + why); };
  if (!raw || typeof raw !== 'object') fail('not an object');
  if (raw.v !== SAVE_VERSION) fail('unknown version');
  if (raw.mode !== 'campaign' && raw.mode !== 'sandbox') fail('mode');
  const chapter = Number.isInteger(raw.chapter) && raw.chapter >= 0 && raw.chapter < CHAPTERS.length ? raw.chapter : fail('chapter');
  if (typeof raw.heights !== 'string' || typeof raw.kinds !== 'string') fail('grids');
  let hb, kb;
  try { hb = unb64(raw.heights); kb = unb64(raw.kinds); } catch { fail('grid encoding'); }
  if (hb.length !== V * V * 2 || kb.length !== N * N) fail('grid size');
  for (let k = 0; k < kb.length; k++) if (kb[k] > KIND.RESTORED) fail('cell kind');
  if (!Array.isArray(raw.objects) || raw.objects.length > 4000) fail('objects');
  const strList = (a, allowed, max) => Array.isArray(a) && a.length <= max && a.every((x) => typeof x === 'string' && (!allowed || allowed.includes(x)));
  const goalIds = CHAPTERS[chapter].goals.map((g) => g.id);
  if (!strList(raw.goalsDone, goalIds, goalIds.length)) fail('goals');
  if (!strList(raw.unlocked, ALL_UNLOCKS, ALL_UNLOCKS.length)) fail('unlocks');
  if (!strList(raw.postcards, POSTCARDS.map((p) => p.id), POSTCARDS.length)) fail('postcards');
  if (!Array.isArray(raw.hidden) || raw.hidden.length > 12) fail('hidden');
  const num = (x, lo, hi) => (typeof x === 'number' && Number.isFinite(x) ? clamp(x, lo, hi) : fail('number'));

  const nw = createWorld();
  nw.stats = w.stats;
  nw.mode = raw.mode; nw.chapter = chapter;
  const q = new Int16Array(hb.buffer.slice(hb.byteOffset, hb.byteOffset + hb.byteLength));
  for (let k = 0; k < q.length; k++) nw.heights[k] = clamp(q[k] / 1000, -3, 7);
  nw.kinds.set(kb);
  nw.goalsDone = raw.goalsDone.slice(); nw.unlocked = raw.unlocked.slice(); nw.postcards = raw.postcards.slice();
  nw.hidden = raw.hidden.map((h) => {
    if (!Array.isArray(h) || !['ruin', 'overlook', 'bloom'].includes(h[0])) fail('hidden entry');
    return { kind: h[0], x: num(h[1], -HALF, HALF), z: num(h[2], -HALF, HALF), found: h[3] === 1 };
  });
  nw.hours = num(raw.hours, 0, 23.999);
  nw.weather = WEATHERS.includes(raw.weather) ? raw.weather : fail('weather');
  nw.abundance = ABUNDANCE[raw.abundance] ? raw.abundance : fail('abundance');
  nw.boundaryName = BOUNDARIES[raw.boundaryName] ? raw.boundaryName : fail('boundary name');
  if (!Array.isArray(raw.boundary) || raw.boundary.length !== 3) fail('boundary');
  nw.boundary = { cx: num(raw.boundary[0], -HALF, HALF), cz: num(raw.boundary[1], -HALF, HALF), r: num(raw.boundary[2], 4, 40) };
  nw._chapterDone = raw.chapterDone === true;
  for (const o of raw.objects) {
    if (!Array.isArray(o) || o.length !== 6 || !ITEM_IDS.includes(o[0])) fail('object entry');
    const f = footprint(o[0], num(o[1], -HALF, HALF), num(o[2], -HALF, HALF), num(o[3], -100, 100));
    if (f.cells.some(([i, j]) => !inCells(i, j) || nw.occ[cidx(i, j)] !== -1)) fail('object overlaps');
    const obj = placeRaw(nw, o[0], o[1], o[2], o[3], clamp(o[4] | 0, 0, 7), true);
    obj.thrive = num(o[5], 0, 1);
  }
  for (const k of Object.keys(nw)) w[k] = nw[k];
  computeSupply(w);
  // Water that was flowing when saved flows again straight away.
  for (let c = 0; c < N * N; c++) if (w.supplied[c]) w.wet[c] = 1;
  stepWater(w, 0);
  stepGrowth(w, 0);
  recompute(w, true);
  w._dirtyTerrain = true;
  w.events.push({ type: 'loaded' });
  return w;
}
