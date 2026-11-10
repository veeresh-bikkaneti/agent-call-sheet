// Rules test for the game simulation. Runs in node with no browser:
//   node features/site/tools/sim-test.mjs
// Exits 1 on the first broken rule.
import * as S from '../assets/game/sim.js';
import { makePlan } from '../assets/game/tour.js';
import { CHAPTERS, KIND } from '../assets/game/config.js';

let failed = 0;
const check = (name, ok, detail) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' ' + JSON.stringify(detail))); if (!ok) failed++; };
const ticks = (w, n, dt = 0.1) => { for (let k = 0; k < n; k++) S.tick(w, dt); };

for (let ch = 0; ch < CHAPTERS.length; ch++) {
  const w = S.createWorld();
  S.newGame(w, { mode: 'campaign', chapter: ch });
  ticks(w, 30);
  const wet0 = w.derived.wetCells;
  check(`chapter ${ch + 1} starts with water flowing from the spring`, wet0 > 0, wet0);
  const plan = makePlan(S, w, {});
  S.beginStroke(w);
  for (const [x, z] of plan.canal) S.strokePoint(w, 'carve', x, z, 0.6, 1);
  S.endStroke(w, 'carve');
  ticks(w, 80);
  check(`chapter ${ch + 1}: a carved canal fills with water`, w.derived.wetCells >= wet0 + 5, { wet0, now: w.derived.wetCells });
  let placed = 0;
  for (const p of plan.homes) placed += !!S.place(w, 'home', p[0], p[1], p[2] || 0);
  for (const p of plan.palms) placed += !!S.place(w, 'palm', p[0], p[1]);
  for (const p of plan.crops) placed += !!S.place(w, 'crops', p[0], p[1]);
  check(`chapter ${ch + 1}: planned buildings are all placeable`, placed === plan.homes.length + plan.palms.length + plan.crops.length && placed >= 10, placed);
  ticks(w, 120);
  check(`chapter ${ch + 1}: plantings by the canal are watered`, w.derived.irrigated >= 3, w.derived.irrigated);
  check(`chapter ${ch + 1}: homes by the water have residents`, w.derived.population > 0, w.derived.population);
}

// Chapter 1 can be finished, and finishing it widens the boundary and unlocks buildings.
{
  const w = S.createWorld();
  S.newGame(w, { mode: 'campaign', chapter: 0 });
  const r0 = w.boundary.r;
  const plan = makePlan(S, w, {});
  S.beginStroke(w); for (const [x, z] of plan.canal) S.strokePoint(w, 'carve', x, z, 0.6, 1); S.endStroke(w, 'carve');
  for (const p of plan.homes) S.place(w, 'home', p[0], p[1]);
  for (const p of plan.palms) S.place(w, 'palm', p[0], p[1]);
  for (const p of plan.crops) S.place(w, 'crops', p[0], p[1]);
  ticks(w, 200);
  check('chapter 1 goals complete', w.goalsDone.length === CHAPTERS[0].goals.length, w.goalsDone);
  check('each goal opens a new district', w.boundary.r > r0, { r0, r: w.boundary.r });
  check('finishing chapter 1 unlocks its buildings', CHAPTERS[0].unlocks.every((u) => w.unlocked.includes(u)), w.unlocked);
  check('a chapterComplete event is raised', w.events.some((e) => e.type === 'chapterComplete'));

  // Water cannot climb a raised dune: carve a canal, then heap sand on its middle.
  const blocked = S.createWorld();
  S.newGame(blocked, { mode: 'campaign', chapter: 0 });
  const sp = blocked.objects.find((o) => o.type === 'spring');
  S.beginStroke(blocked);
  for (const [x, z] of plan.canal) S.strokePoint(blocked, 'carve', x, z, 0.6, 1);
  S.endStroke(blocked, 'carve');
  const [hx, hz] = [sp.x + 5.5, sp.z + 0.5];
  for (let k = 0; k < 12; k++) S.applyBrush(blocked, 'raise', hx, hz, 1.6, 1);
  S.recompute(blocked, true);
  ticks(blocked, 150);
  const [hi, hj] = S.worldToCell(hx, hz), [bi, bj] = S.worldToCell(hx + 2, hz);
  const [ui, uj] = S.worldToCell(sp.x + 2.5, hz);
  check('water still reaches the canal before the dune', blocked.wet[S.cidx(ui, uj)] > 0.6, blocked.wet[S.cidx(ui, uj)]);
  check('water does not run uphill over a raised dune', blocked.wet[S.cidx(hi, hj)] < 0.5 && blocked.wet[S.cidx(bi, bj)] < 0.5, { hump: blocked.wet[S.cidx(hi, hj)], beyond: blocked.wet[S.cidx(bi, bj)] });
}

// Undo and redo are exact, one step per stroke.
{
  const w = S.createWorld();
  S.newGame(w, { mode: 'sandbox' });
  const h0 = S.heightAt(w, -6, -6);
  S.beginStroke(w); for (let k = 0; k < 5; k++) S.strokePoint(w, 'raise', -6, -6, 2, 1); S.endStroke(w, 'raise');
  const h1 = S.heightAt(w, -6, -6);
  S.undo(w); const h2 = S.heightAt(w, -6, -6);
  S.redo(w); const h3 = S.heightAt(w, -6, -6);
  check('a stroke raises the ground', h1 > h0 + 0.3, { h0, h1 });
  check('undo restores the exact height', Math.abs(h2 - h0) < 1e-6, { h0, h2 });
  check('redo restores the stroke', Math.abs(h3 - h1) < 1e-6, { h1, h3 });
  const n = w.objects.length;
  const o = S.place(w, 'home', -8, 6);
  const r = S.rotate(w, o.id);
  check('rotate turns a building', r && Math.abs(r.rot - Math.PI / 2) < 1e-9, r && r.rot);
  S.remove(w, r.id);
  check('remove deletes it', w.objects.length === n);
  S.undo(w);
  check('undo brings it back', w.objects.length === n + 1);
  check('the spring cannot be removed', !S.remove(w, w.objects.find((x) => x.type === 'spring').id));
  // A click that changes nothing (an empty stroke) must not throw away the redo step.
  S.undo(w);
  const redoBefore = w.redo.length;
  S.beginStroke(w); S.endStroke(w, 'raise');
  check('an empty stroke keeps redo', w.redo.length === redoBefore && redoBefore > 0, { redoBefore, now: w.redo.length });
  check('an empty stroke adds no undo step', S.redo(w) && w.objects.length === n + 1, w.objects.length);
}

// Removing an aqueduct puts the ground back the way it was.
{
  const w = S.createWorld();
  S.newGame(w, { mode: 'sandbox' });
  const [ai, aj] = S.worldToCell(-9, 7), [bi, bj] = S.worldToCell(-9, 9);
  S.beginStroke(w); S.strokePoint(w, 'carve', -9, 7, 0.4, 1); S.endStroke(w, 'carve');
  const kindA = w.kinds[S.cidx(ai, aj)], kindB = w.kinds[S.cidx(bi, bj)];
  const a = S.place(w, 'aqueduct', -9, 7), b = S.place(w, 'aqueduct', -9, 9);
  check('aqueducts can be placed on a channel and on open ground', a && b && kindA === KIND.CHANNEL && kindB !== KIND.CHANNEL, { a: !!a, b: !!b, kindA, kindB });
  if (a && b) {
    S.remove(w, a.id); S.remove(w, b.id);
    check('removing an aqueduct over a carved channel leaves the channel', w.kinds[S.cidx(ai, aj)] === KIND.CHANNEL, w.kinds[S.cidx(ai, aj)]);
    check('removing an aqueduct over open ground restores that ground', w.kinds[S.cidx(bi, bj)] === kindB, { was: kindB, now: w.kinds[S.cidx(bi, bj)] });
  }
}

// Saves round-trip and hostile saves are refused without touching the world.
{
  const w = S.createWorld();
  S.newGame(w, { mode: 'campaign', chapter: 1 });
  S.place(w, 'home', 3, -6);
  ticks(w, 40);
  const raw = JSON.parse(JSON.stringify(S.serialize(w)));
  const w2 = S.createWorld();
  S.deserialize(w2, raw);
  check('load restores every object', w2.objects.length === w.objects.length, { a: w.objects.length, b: w2.objects.length });
  check('load restores flowing water', w2.derived.wetCells >= w.derived.wetCells - 1, { a: w.derived.wetCells, b: w2.derived.wetCells });
  const bad = [null, 7, { ...raw, v: 99 }, { ...raw, kinds: 'AAAA' }, { ...raw, hours: 'noon' }, { ...raw, objects: [['home', 0, 0, 0, 0, 1], ['home', 0, 0, 0, 0, 1]] },
    { ...raw, objects: [['castle', 0, 0, 0, 0, 1]] }, { ...raw, unlocked: ['everything'] }, { ...raw, mode: 'god' }, { ...raw, hidden: [['portal', 0, 0, 1]] }];
  let refused = 0;
  for (const b of bad) {
    const before = S.serialize(w2).heights;
    try { S.deserialize(w2, b); } catch { refused++; }
    if (S.serialize(w2).heights !== before) refused = -100;
  }
  check('every hostile save is refused and the world is left as it was', refused === bad.length, refused);
}

// Sandbox options.
{
  const w = S.createWorld();
  S.newGame(w, { mode: 'sandbox', options: { weather: 'rain', water: 'low', boundary: 'open', hours: 21 } });
  check('sandbox options apply', w.weather === 'rain' && w.abundance === 'low' && w.boundaryName === 'open' && w.hours === 21 && w.unlocked.length > 10, w);
  S.newGame(w, { mode: 'sandbox', options: { weather: '<script>', water: 'flood', boundary: 'huge', hours: 'x' } });
  check('unknown sandbox options fall back to defaults', w.weather === 'clear' && w.abundance === 'normal' && w.boundaryName === 'medium' && w.hours === 9);
}

console.log(failed ? `\n${failed} rule checks failed` : '\nall rule checks passed');
process.exit(failed ? 1 : 0);
