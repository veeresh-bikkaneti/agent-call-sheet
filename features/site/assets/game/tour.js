// tour.js: settlement plans worked out on a copy of the world, the title-screen
// showcase oasis, and the scripted walkthrough used for the demo video.

import { ITEMS } from './config.js';

// Work out a canal and building spots that are valid in the given world,
// without changing it. Every position comes from canPlace on a scratch copy.
export function makePlan(S, src, want = {}) {
  const w = S.createWorld();
  S.deserialize(w, JSON.parse(JSON.stringify(S.serialize(src))));
  w.events = [];
  const spring = w.objects.find((o) => o.type === 'spring');
  const sx = spring.x, sz = spring.z + 0.5;
  const inside = (x, z) => Math.hypot(x - w.boundary.cx, z - w.boundary.cz) <= w.boundary.r - 0.6;
  // Main canal east from the stub, then a branch to the south.
  const canal = [];
  for (let x = sx + 3.5; inside(x, sz) && canal.length < (want.canal || 9); x += 1) canal.push([x, sz]);
  const end = canal[canal.length - 1] || [sx + 2.5, sz];
  const branch = [];
  for (let z = sz + 1; inside(end[0], z) && branch.length < (want.branch || 0); z += 1) branch.push([end[0], z]);
  S.beginStroke(w);
  for (const [x, z] of canal.concat(branch)) S.strokePoint(w, 'carve', x, z, 0.6, 1);
  S.endStroke(w, 'carve');
  const out = { canal: canal.concat(branch), spring: [sx, spring.z] };
  const tryPlace = (item, spots, n, rot = 0) => {
    const got = [];
    for (const [x, z] of spots) {
      if (got.length >= n) break;
      if (!inside(x, z)) continue;
      if (S.canPlace(w, item, x, z, rot).ok && S.place(w, item, x, z, rot)) got.push([x, z, rot]);
    }
    return got;
  };
  const along = (offsets, step = 1, from = 0) => {
    const spots = [];
    for (let k = from; k < out.canal.length; k += step) for (const [ox, oz] of offsets) spots.push([out.canal[k][0] + ox, out.canal[k][1] + oz]);
    return spots;
  };
  out.palms = tryPlace('palm', along([[0, -1], [0, 1]], 2), want.palms ?? 4);
  out.crops = tryPlace('crops', along([[0, 1], [0, -1]], 1, 1), want.crops ?? 3);
  out.homes = tryPlace('home', along([[0, -3], [0.5, 3], [0, -5.5], [0, 5.5]], 2), want.homes ?? 3);
  for (const item of ['market', 'windTower', 'courtyard', 'lantern', 'bench', 'textiles', 'ceramics', 'garden', 'fountain']) {
    if (!want[item]) continue;
    out[item] = tryPlace(item, along([[0, -3.5], [0.5, 3.5], [0, -2], [0, 2], [0, -6], [0, 6], [-1, -2], [1, 2]], 1), want[item]);
  }
  // A quiet patch for sculpting and a free spot for one more home.
  out.sculpt = [sx - 6, sz - 6];
  for (const [x, z] of [[sx - 5, sz + 4], [sx - 4, sz - 4], [sx + 2, sz + 5], [sx - 6, sz], [sx + 3, sz - 6]]) {
    if (inside(x, z) && S.canPlace(w, 'home', x, z, 0).ok) { out.free = [x, z]; break; }
  }
  if (!out.free) out.free = [sx - 3, sz + 6];
  return out;
}

// The title backdrop: a small thriving oasis at golden hour.
export function buildShowcase(S, w) {
  S.newGame(w, { mode: 'sandbox', options: { weather: 'clear', water: 'high', boundary: 'medium', hours: 17.2 } });
  const plan = makePlan(S, w, { canal: 10, branch: 5, palms: 8, crops: 6, homes: 5, market: 1, windTower: 2, courtyard: 1, lantern: 5, bench: 2, textiles: 2, garden: 1, fountain: 1 });
  applyPlan(S, w, plan);
  for (let k = 0; k < 240; k++) S.tick(w, 0.25);
  for (const o of w.objects) if (ITEMS[o.type].plant) o.thrive = Math.max(o.thrive, 0.85);
  w.undo = []; w.redo = []; w.events = [];
  return plan;
}
export function applyPlan(S, w, plan) {
  S.beginStroke(w);
  for (const [x, z] of plan.canal) S.strokePoint(w, 'carve', x, z, 0.6, 1);
  S.endStroke(w, 'carve');
  for (const key of ['homes', 'palms', 'crops', 'market', 'windTower', 'courtyard', 'lantern', 'bench', 'textiles', 'garden', 'fountain']) {
    const item = key === 'homes' ? 'home' : key === 'palms' ? 'palm' : key;
    for (const p of plan[key] || []) S.place(w, item, p[0], p[1], p[2] || 0);
  }
}

// ---------- the walkthrough ----------
// A timeline of steps. ctx gives the tour what it needs from the game:
//   { S, w, view, setHours(h), setCursor(c|null), caption(text|null), sfx(name), flash() }
export function createTour(ctx) {
  const { S, w, view } = ctx;
  S.newGame(w, { mode: 'sandbox', options: { weather: 'clear', water: 'high', boundary: 'medium', hours: 7.4 } });
  const plan = makePlan(S, w, { canal: 10, branch: 5, palms: 8, crops: 6, homes: 5, market: 1, windTower: 2, courtyard: 1, lantern: 6, bench: 2, textiles: 2, garden: 1, fountain: 1 });
  const [sx, sz] = plan.spring;
  const events = [];
  let t = 0, hours = 7.4;
  const cam = view.cam;
  Object.assign(cam, { tx: sx + 30, tz: sz + 22, dist: 64, yaw: 0.9, pitch: 1.05, goal: null });
  const goal = (tx, tz, dist, yaw, pitch) => { cam.goal = { tx, tz, dist, yaw, pitch }; };
  const say = (text) => ctx.caption(text);
  const sfx = (name) => { events.push({ t, name }); ctx.sfx(name); };
  const queue = [];
  const at = (time, fn) => queue.push({ time, fn, done: false });
  const placeAll = (item, list, t0, gap) => list.forEach((p, k) => at(t0 + k * gap, () => {
    ctx.setCursor({ tool: 'build', x: p[0], z: p[1], item, rot: p[2] || 0, valid: true, show: true, snap: true });
    if (S.place(w, item, p[0], p[1], p[2] || 0)) { view.burst(p[0], S.heightAt(w, p[0], p[1]) + 0.4, p[1], 18); sfx('place'); }
  }));

  at(0.2, () => { goal(sx + 4, sz + 2, 34, 0.7, 0.95); say('Saffron Spring: a tranquil desert oasis builder'); });
  at(2.6, () => { say('Carve a canal and the spring water follows'); goal(sx + 6, sz + 1, 20, 0.55, 0.85); });
  // Carve cell by cell so the water is seen travelling.
  plan.canal.forEach(([x, z], k) => at(3.0 + k * 0.22, () => {
    ctx.setCursor({ tool: 'carve', x, z, radius: 0.6, valid: true, show: true });
    S.beginStroke(w); S.strokePoint(w, 'carve', x, z, 0.6, 1); S.endStroke(w, 'carve');
    if (k % 3 === 0) sfx('carve');
  }));
  at(6.6, () => { say('Sculpt the dunes'); ctx.setCursor({ tool: 'raise', x: sx - 6, z: sz - 6, radius: 3, valid: true, show: true }); });
  for (let k = 0; k < 12; k++) at(6.7 + k * 0.08, () => { S.beginStroke(w); S.strokePoint(w, 'raise', sx - 6 + k * 0.25, sz - 6, 3, 1.2); S.endStroke(w, 'raise'); if (k % 4 === 0) sfx('sculpt'); });
  at(7.8, () => { say('Raise homes, palms and gardens beside the water'); goal(sx + 5, sz + 1, 22, 0.25, 0.8); });
  placeAll('home', plan.homes, 8.0, 0.35);
  placeAll('palm', plan.palms, 9.0, 0.18);
  placeAll('crops', plan.crops, 10.0, 0.14);
  at(11.0, () => { say('Markets, wind towers and lanterns bring the town to life'); goal(sx + 6, sz + 2, 18, -0.4, 0.75); });
  placeAll('market', plan.market || [], 11.1, 0.3);
  placeAll('courtyard', plan.courtyard || [], 11.4, 0.3);
  placeAll('windTower', plan.windTower || [], 11.7, 0.3);
  placeAll('fountain', plan.fountain || [], 12.2, 0.3);
  placeAll('garden', plan.garden || [], 12.4, 0.3);
  placeAll('textiles', plan.textiles || [], 12.6, 0.2);
  placeAll('bench', plan.bench || [], 12.9, 0.2);
  placeAll('lantern', plan.lantern || [], 13.1, 0.16);
  at(14.2, () => { ctx.setCursor(null); say('Golden hour'); goal(sx + 4, sz + 3, 26, -1.0, 0.55); });
  at(17.4, () => { say('Lanterns glow after dark'); goal(sx + 6, sz + 2, 20, -1.7, 0.7); });
  at(20.6, () => { say('Frame the moment in photo mode'); goal(sx + 5, sz + 1, 15, -2.2, 0.45); });
  at(21.9, () => { ctx.flash(); sfx('photo'); });
  at(22.4, () => { say(null); goal(sx + 4, sz + 2, 40, -2.5, 1.0); });

  return {
    events,
    hours: () => hours,
    done: () => t > 24.5,
    update(dt) {
      t += dt;
      for (const q of queue) if (!q.done && t >= q.time) { q.done = true; q.fn(); }
      // Time of day: morning while building, then a time-lapse to night.
      if (t < 14) hours = 7.4 + t * 0.12;
      else if (t < 21) hours = 9.1 + (t - 14) * 1.65;
      else hours = Math.min(21.4, hours + dt * 0.1);
      ctx.setHours(hours);
      // Plantings grow quickly in the video so gardens are seen thriving.
      for (const o of w.objects) if (ITEMS[o.type].plant && o._watered) o.thrive = Math.min(1, o.thrive + dt * 0.25);
      for (let k = 0; k < 2; k++) S.tick(w, dt);
    },
  };
}
