// main.js: Saffron Spring. Wires the simulation, the 3D view, sound, input and
// interface together, runs the loop, keeps saves and settings, and exposes
// window.__oasisTest for the automated playtest when the page has ?test=1.

import * as S from './sim.js';
import { createView, nightAmount } from './world.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';
import { buildShowcase, createTour, makePlan } from './tour.js';
import { TOOLS, ITEMS, CHAPTERS, DEFAULT_SETTINGS, POSTCARDS } from './config.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const NS = TEST ? 'saffron-test.' : 'saffron.';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const $ = (id) => document.getElementById(id);

// ---------- storage (everything read back is validated) ----------
const store = {
  get(k) { try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(NS + k); } catch { /* storage off */ } },
};
if (TEST) { try { for (const k of Object.keys(localStorage)) if (k.startsWith(NS)) localStorage.removeItem(k); } catch { /* storage off */ } }

// A player whose system asks for less motion starts with reduced motion on and shake off.
// A saved choice in Settings still wins.
const OS_REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
function cleanSettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  if (OS_REDUCE) { s.reduceMotion = true; s.shake = false; }
  if (raw && typeof raw === 'object') for (const [k, d] of Object.entries(DEFAULT_SETTINGS)) {
    const v = raw[k];
    if (typeof d === 'number' && typeof v === 'number' && Number.isFinite(v)) s[k] = clamp(v, 0, 2);
    else if (typeof d === 'boolean' && typeof v === 'boolean') s[k] = v;
    else if (k === 'quality' && ['low', 'medium', 'high'].includes(v)) s[k] = v;
    else if (k === 'textSize' && ['normal', 'large', 'larger'].includes(v)) s[k] = v;
  }
  return s;
}
function cleanProgress(raw) {
  const ids = CHAPTERS.map((c) => c.id), pcs = POSTCARDS.map((p) => p.id);
  const p = { chapters: [], postcards: [], tutorialDone: false };
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.chapters)) p.chapters = raw.chapters.filter((x) => ids.includes(x));
    if (Array.isArray(raw.postcards)) p.postcards = raw.postcards.filter((x) => pcs.includes(x));
    p.tutorialDone = raw.tutorialDone === true;
  }
  return p;
}
function cleanPhotos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && typeof p.id === 'string' && /^[a-z0-9]{1,16}$/.test(p.id) && typeof p.src === 'string' && p.src.startsWith('data:image/jpeg;base64,') && p.src.length < 600000 && /^[A-Za-z0-9+/=]+$/.test(p.src.slice(23)))
    .slice(-12).map((p) => ({ id: p.id, src: p.src, label: typeof p.label === 'string' ? p.label.slice(0, 80) : 'Photo', cards: Array.isArray(p.cards) ? p.cards.filter((c) => typeof c === 'string').slice(0, 10).map((c) => c.slice(0, 40)) : [] }));
}

let settings = cleanSettings(store.get('settings'));
const qParam = params.get('quality');
const quality = ['low', 'medium', 'high'].includes(qParam) ? qParam : settings.quality;
let progress = cleanProgress(store.get('progress'));
let photos = cleanPhotos(store.get('photos'));
const saveSettings = () => store.set('settings', settings);
const saveProgress = () => store.set('progress', progress);

// ---------- set up ----------
const canvas = $('view');
canvas.tabIndex = 0;
const w = S.createWorld();
const view = createView(canvas, { quality });

if (!view) {
  $('fallback').hidden = false;
  const v = $('fallback-video');
  v.poster = 'assets/media/walkthrough-poster.jpg';
  v.src = 'assets/media/walkthrough.mp4';
  if (TEST) window.__oasisTest = { ready: true, info: () => ({ webgl: false }), frameVariance: () => 0, state: () => ({}), step: () => ({}), run: () => null };
} else {
  start();
}

function start() {
  const G = {
    screen: 'title', tool: 'select', item: 'home', cat: 'Homes', rot: 0, brush: 1.6, trayOpen: false, dupe: false,
    selected: null, cursor: { x: 0, z: 0, show: false, valid: false, why: '' }, stroke: null,
    hours: 17.2, filter: 'none', tut: -1, chapterTime: 0, autosaveT: 0, hintT: 0, hudT: 0, audioT: 0,
    histLabels: [], redoLabels: [], resultsT: -1, flockWas: false, waterSfxT: 0, day: 0, tour: null, tourCursor: null, historyOpen: false,
  };

  const audio = createAudio({ onCaption: (t) => { if (settings.captions) ui.caption(t); } });
  let audioReady = false;
  const sfx = (name, o) => { if (audioReady) audio.sfx(name, o); };

  const ui = createUI({ onAct, onSetting, onFilter });

  const input = createInput({
    canvas, view,
    api: {
      mode: () => (G.screen === 'tour' ? 'tour' : ui.top() === 'title' ? 'title' : ui.top() ? 'menu' : G.screen === 'photo' ? 'photo' : G.screen === 'play' ? 'play' : 'menu'),
      settings: () => settings,
      hover, press, drag, release: releaseTool, cmd,
      menuNav: (d) => ui.menuNav(d), menuActivate: () => ui.menuActivate(),
    },
  });
  view.onFootstep(() => sfx('footstep', { intensity: 0.35 }));

  function applySettings() {
    ui.applySettingsClasses(settings);
    audio.setVolumes({ master: settings.master, music: settings.music, ambience: settings.ambience, sfx: settings.sfx });
    audio.setMuted(settings.muted);
  }
  applySettings();

  // ---------- history labels (one per undo step) ----------
  function act(label, fn) {
    const before = w.undo[w.undo.length - 1];
    const r = fn();
    if (w.undo[w.undo.length - 1] !== before) {
      G.histLabels.push(label);
      G.redoLabels = [];
      while (G.histLabels.length > w.undo.length) G.histLabels.shift();
      refreshHistory();
    }
    return r;
  }
  function doUndo() {
    if (!S.undo(w)) { ui.hint('Nothing to undo'); G.hintT = 1.5; return; }
    G.redoLabels.push(G.histLabels.pop() || 'Change');
    sfx('undo'); refreshHistory();
  }
  function doRedo() {
    if (!S.redo(w)) { ui.hint('Nothing to redo'); G.hintT = 1.5; return; }
    G.histLabels.push(G.redoLabels.pop() || 'Change');
    sfx('undo'); refreshHistory();
  }
  // A stroke pushes its undo snapshot when it starts; label it only if it is kept.
  function commitStroke(tool, ref) {
    S.endStroke(w, tool);
    if (ref && w.undo[w.undo.length - 1] === ref) {
      G.histLabels.push(LABEL[tool]);
      G.redoLabels = [];
      while (G.histLabels.length > w.undo.length) G.histLabels.shift();
      refreshHistory();
    }
  }
  function refreshHistory() { if (G.historyOpen) ui.renderHistory(G.histLabels, G.redoLabels); }

  // ---------- screens ----------
  function setHud(on) { $('hud').hidden = !on; }
  function startTitle() {
    exitPhoto();
    G.screen = 'title';
    buildShowcase(S, w);
    G.hours = 17.2; G.selected = null; G.stroke = null;
    Object.assign(view.cam, { tx: 3, tz: 2, dist: 34, yaw: 0.65, pitch: 0.72, goal: null });
    setHud(false); ui.tutorial(null); closeHistory();
    $('btn-continue').hidden = !store.get('save.auto');
    ui.reset('title');
  }
  function enterPlay() {
    G.screen = 'play';
    G.hours = w.hours; G.day = 0; G.chapterTime = 0; G.autosaveT = 0; G.resultsT = -1;
    G.selected = null; G.stroke = null; G.dupe = false; G.rot = 0;
    G.histLabels = []; G.redoLabels = [];
    ui.reset(null); setHud(true); closeHistory();
    setTool('select', true);
    const sp = w.objects.find((o) => o.type === 'spring') || { x: 0, z: 0 };
    view.cam.goal = { tx: sp.x + 2, tz: sp.z + 1, dist: 26, yaw: 0.65, pitch: 0.85 };
    renderHud(true);
  }
  function startGame(mode, chapter = 0, options = {}) {
    S.newGame(w, { mode, chapter, options });
    enterPlay();
    if (mode === 'campaign') {
      ui.toast(CHAPTERS[w.chapter].title, 'goal');
      if (w.chapter === 0 && !progress.tutorialDone) showTutorial(0);
      else ui.toast(CHAPTERS[w.chapter].intro);
    } else ui.toast('Sandbox: everything is unlocked');
    sfx('unlock');
  }

  // ---------- tutorial ----------
  const TUT = [
    { title: 'Welcome to the spring', text: 'Right-drag, or drag with two fingers, to look around. The wheel or a pinch zooms. Water bubbles up from the spring in the middle.' },
    { title: 'Carve a canal', text: 'Canal is selected. Drag outward from the end of the little stream by the spring. Water follows the canal, but it cannot run uphill.', show: () => setTool('carve'), until: (e) => e.type === 'stroke' && e.tool === 'carve' },
    { title: 'Raise a home', text: 'Pick the adobe home in the build tray and click beside the water. Homes near water fill with residents.', show: () => { G.cat = 'Homes'; G.item = 'home'; setTool('build'); }, until: (e) => e.type === 'placed' && e.item === 'home' },
    { title: 'Plant palms', text: 'Now plant date palms right next to the canal. Watered plantings grow lush and green.', show: () => { G.cat = 'Gardens'; G.item = 'palm'; setTool('build'); }, until: (e) => e.type === 'placed' && e.item === 'palm' },
    { title: 'Gentle goals', text: 'Goals sit at the top left, and each one opens a new district. There is no way to fail, so take your time. Ctrl + Z undoes anything.' },
  ];
  function showTutorial(n) {
    G.tut = n;
    if (n < 0 || n >= TUT.length) { G.tut = -1; ui.tutorial(null); progress.tutorialDone = true; saveProgress(); return; }
    ui.tutorial({ n: n + 1, of: TUT.length, title: TUT[n].title, text: TUT[n].text });
    if (TUT[n].show) TUT[n].show();
  }

  // ---------- tools ----------
  const toolDef = (id) => TOOLS.find((t) => t.id === id);
  function setTool(id, quiet = false) {
    if (!toolDef(id)) return;
    if (G.stroke) releaseTool();
    G.tool = id; G.dupe = false;
    G.trayOpen = id === 'build';
    if (id !== 'select' && id !== 'build') G.selected = null;
    if (!quiet) sfx('ui');
    ui.hint(toolDef(id).hint); G.hintT = 4;
    renderHud(true);
  }
  function isSculpt(t) { return t === 'raise' || t === 'lower' || t === 'smooth'; }
  function isBrush(t) { return isSculpt(t) || t === 'carve' || t === 'path'; }
  const LABEL = { raise: 'Raise dunes', lower: 'Lower sand', smooth: 'Smooth slopes', carve: 'Carve canal', path: 'Lay path' };

  function hover(pt) {
    if (!pt) { G.cursor.show = false; return; }
    G.cursor.x = pt.x; G.cursor.z = pt.z; G.cursor.show = true;
    if (G.tool === 'build') {
      const c = S.canPlace(w, G.item, pt.x, pt.z, G.rot);
      G.cursor.valid = c.ok; G.cursor.why = c.ok ? '' : c.why;
      if (!c.ok && G.hintT <= 0) ui.hint(c.why);
      else if (c.ok && G.hintT <= 0) ui.hint(ITEMS[G.item].label + (G.dupe ? ': click where the copy should go' : ': click to place, R rotates'));
    } else if (G.tool === 'select' && G.hintT <= 0) {
      const near = w.hidden.find((h) => !h.found && Math.hypot(h.x - pt.x, h.z - pt.z) < 2.2);
      const o = S.objectAt(w, pt.x, pt.z);
      ui.hint(near ? 'Something glints in the sand here. Click to look closer.' : o && !ITEMS[o.type].fixed ? ITEMS[o.type].label + ': click to select' : '');
    }
  }
  function press(pt) {
    hover(pt);
    if (isBrush(G.tool)) {
      S.beginStroke(w);
      G.stroke = { tool: G.tool, x: pt.x, z: pt.z, ref: w.undo[w.undo.length - 1] };
      if (!isSculpt(G.tool)) S.strokePoint(w, G.tool, pt.x, pt.z, G.brush, 1);
      else S.strokePoint(w, G.tool, pt.x, pt.z, G.brush, 0.3);
      return;
    }
    if (G.tool === 'build') { placeAt(pt.x, pt.z); return; }
    // Select: pick a building, or look closer at something hidden.
    const o = S.objectAt(w, pt.x, pt.z);
    if (o && !ITEMS[o.type].fixed) { G.selected = o.id; sfx('ui'); ui.hint(ITEMS[o.type].label + ': R rotates, Ctrl + D copies, Delete removes'); G.hintT = 3; return; }
    const h = S.tryDiscover(w, pt.x, pt.z, 2.2);
    if (!h) G.selected = null;
  }
  function drag(pt) {
    hover(pt);
    if (!G.stroke) return;
    if (!isSculpt(G.stroke.tool)) {
      // Fill the gap between pointer samples so canals and paths stay unbroken.
      const dx = pt.x - G.stroke.x, dz = pt.z - G.stroke.z, d = Math.hypot(dx, dz);
      const n = Math.max(1, Math.ceil(d / 0.4));
      for (let k = 1; k <= n; k++) S.strokePoint(w, G.stroke.tool, G.stroke.x + dx * k / n, G.stroke.z + dz * k / n, G.brush, 1);
    }
    G.stroke.x = pt.x; G.stroke.z = pt.z;
  }
  function releaseTool() {
    if (!G.stroke) return;
    const { tool, ref } = G.stroke;
    G.stroke = null;
    commitStroke(tool, ref);
  }
  function placeAt(x, z) {
    const item = G.item;
    const free = !settings.gridSnap;
    const obj = act('Place ' + ITEMS[item].label.toLowerCase(), () => S.place(w, item, x, z, G.rot, (w.nextId * 7) % 4, free));
    if (!obj) return null;
    view.burst(obj.x, S.heightAt(w, obj.x, obj.z) + 0.4, obj.z, 22);
    sfx('place', { intensity: Math.min(1, ITEMS[item].size[0] * ITEMS[item].size[1] / 6 + 0.3) });
    G.selected = obj.id;
    if (G.dupe) { G.dupe = false; G.tool = 'select'; G.trayOpen = false; renderHud(true); }
    return obj;
  }
  const selectedObj = () => w.objects.find((o) => o.id === G.selected) || null;
  function rotateSel(dir) {
    const step = (settings.gridSnap ? Math.PI / 2 : Math.PI / 12) * dir;
    if (G.tool === 'build') { G.rot += step; sfx('ui'); if (G.cursor.show) hover(G.cursor); return; }
    const o = selectedObj();
    if (!o) return;
    const n = act('Turn ' + ITEMS[o.type].label.toLowerCase(), () => S.rotate(w, o.id, step));
    if (n) { G.selected = n.id; sfx('ui'); }
  }
  function cycleItem(d) {
    const list = Object.keys(ITEMS).filter((id) => ITEMS[id].cat && (!ITEMS[id].unlock || w.unlocked.includes(ITEMS[id].unlock)));
    let k = list.indexOf(G.item);
    k = (k + d + list.length) % list.length;
    G.item = list[k]; G.cat = ITEMS[G.item].cat;
    if (G.tool !== 'build') setTool('build'); else renderHud(true);
    ui.hint(ITEMS[G.item].label); G.hintT = 1.5;
  }
  function cmd(name, arg) {
    switch (name) {
      case 'gesture':
        if (!audioReady && !TEST) { audio.init(); audioReady = audio.available; applySettings(); }
        return;
      case 'escape': return escape();
      case 'back':
        if (G.selected) G.selected = null; else if (G.trayOpen) { G.trayOpen = false; renderHud(true); }
        return;
      case 'toolIndex': if (TOOLS[arg]) setTool(TOOLS[arg].id); return;
      case 'tool': return setTool(arg);
      case 'toolNext': { const k = TOOLS.findIndex((t) => t.id === G.tool); return setTool(TOOLS[(k + arg + TOOLS.length) % TOOLS.length].id); }
      case 'tray': if (G.tool !== 'build') setTool('build'); else { G.trayOpen = !G.trayOpen; renderHud(true); } return;
      case 'rotate': return rotateSel(arg || 1);
      case 'duplicate': {
        const o = selectedObj();
        if (!o) { ui.hint('Select something to copy first'); G.hintT = 2; return; }
        G.item = o.type; G.cat = ITEMS[o.type].cat; G.rot = o.rot;
        setTool('build'); G.trayOpen = false; G.dupe = true; renderHud(true);
        ui.hint(ITEMS[o.type].label + ': click where the copy should go'); G.hintT = 3;
        return;
      }
      case 'delete': {
        const o = selectedObj();
        if (!o) return;
        if (act('Remove ' + ITEMS[o.type].label.toLowerCase(), () => S.remove(w, o.id))) { G.selected = null; sfx('delete'); view.burst(o.x, S.heightAt(w, o.x, o.z) + 0.3, o.z, 14, 0xd8b07a); }
        return;
      }
      case 'undo': return doUndo();
      case 'redo': return doRedo();
      case 'snap': settings.gridSnap = !settings.gridSnap; saveSettings(); applySettings(); return;
      case 'brush': G.brush = clamp(Math.round((G.brush + arg * 0.4) * 10) / 10, 0.6, 5); $('brush').value = String(G.brush); return;
      case 'photo': return enterPhoto();
      case 'photo-exit': return exitPhoto();
      case 'capture': return capture();
      case 'history': return toggleHistory();
      case 'itemNext': return cycleItem(arg);
      case 'filterNext': { const f = ['none', 'warm', 'faded', 'golden', 'dusk']; return onFilter(f[(f.indexOf(G.filter) + arg + f.length) % f.length]); }
      default: return undefined;
    }
  }
  function escape() {
    if (G.screen === 'tour') return;
    const t = ui.top();
    if (t === 'title') return;
    if (t === 'pause') { ui.closeAll(); sfx('uiBack'); return; }
    if (t === 'results') { ui.closeAll(); return; }
    if (t) { onAct('back'); return; }
    if (G.screen === 'photo') { exitPhoto(); return; }
    if (G.historyOpen) { closeHistory(); return; }
    if (G.screen === 'play') { if (G.stroke) releaseTool(); ui.open('pause'); sfx('ui'); }
  }
  function toggleHistory() { if (G.historyOpen) closeHistory(); else { G.historyOpen = true; $('history').hidden = false; ui.renderHistory(G.histLabels, G.redoLabels); } }
  function closeHistory() { G.historyOpen = false; $('history').hidden = true; }

  // ---------- photo mode ----------
  const FILTER_CSS = { none: 'none', warm: 'saturate(1.15) sepia(0.18) contrast(1.04)', faded: 'saturate(0.7) contrast(0.88) brightness(1.06) sepia(0.12)', golden: 'sepia(0.38) saturate(1.3) hue-rotate(-8deg) brightness(1.05)', dusk: 'saturate(0.9) hue-rotate(12deg) brightness(0.92) contrast(1.08)' };
  function enterPhoto() {
    if (G.screen !== 'play') return;
    if (G.stroke) releaseTool();
    ui.closeAll(); closeHistory();
    G.screen = 'photo'; G.trayOpen = false;
    document.body.classList.add('photo');
    $('photo-hud').hidden = false; $('vignette').hidden = false;
    $('photo-time').value = String(G.hours);
    ui.tutorial(null);
    sfx('ui');
  }
  function exitPhoto() {
    if (G.screen !== 'photo') return;
    G.screen = 'play';
    document.body.classList.remove('photo');
    $('photo-hud').hidden = true; $('vignette').hidden = true;
    onFilter('none');
    if (G.tut >= 0) showTutorial(G.tut);
  }
  function onFilter(f) {
    if (!FILTER_CSS[f]) return;
    G.filter = f;
    canvas.className = f === 'none' ? '' : 'f-' + f;
    ui.setFilterButtons(f);
  }
  function flash() {
    if (settings.reduceMotion) return;
    const f = $('flash');
    f.hidden = true; void f.offsetWidth; f.hidden = false;
    setTimeout(() => { f.hidden = true; }, 480);
  }
  function capture() {
    if (G.screen !== 'photo') return { saved: false };
    view.frame(w, 0, frameOpts());
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    const ctx = c.getContext('2d');
    const src = view.renderer.domElement, sw = src.width, sh = src.height;
    let cw = sw, ch = sw * 9 / 16;
    if (ch > sh) { ch = sh; cw = sh * 16 / 9; }
    ctx.filter = FILTER_CSS[G.filter];
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 640, 360);
    const data = c.toDataURL('image/jpeg', 0.8);
    const got = S.judgePostcards(w, view.viewInfo(w, G.hours, w.weather));
    const titles = got.map((id) => POSTCARDS.find((p) => p.id === id).title);
    for (const id of w.postcards) if (!progress.postcards.includes(id)) progress.postcards.push(id);
    saveProgress();
    const where = w.mode === 'campaign' ? CHAPTERS[w.chapter].title : 'Sandbox';
    photos.push({ id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), src: data, label: where + ', ' + ui.fmtHours(G.hours), cards: titles });
    photos = photos.slice(-12);
    while (photos.length && !store.set('photos', photos)) photos.shift();
    flash(); sfx('photo');
    if (titles.length) { for (const t of titles) ui.toast('Postcard found: ' + t, 'discover'); sfx('discover'); }
    else ui.toast('Photo saved to the gallery');
    return { saved: true, postcards: got };
  }

  // ---------- saves ----------
  const SLOTS = ['auto', '1', '2', '3'];
  const slotName = (s) => (s === 'auto' ? 'Autosave' : 'Slot ' + s);
  function slotList() {
    return SLOTS.map((s) => { const d = store.get('save.' + s); return { slot: s, name: slotName(s), data: d && typeof d === 'object' ? d : null, label: d && typeof d.label === 'string' ? d.label.slice(0, 40) : '' }; });
  }
  function saveSlot(slot) {
    if (G.screen !== 'play' && G.screen !== 'photo') return false;
    w.hours = G.hours;
    const data = S.serialize(w);
    data.label = w.mode === 'campaign' ? CHAPTERS[w.chapter].title : 'Sandbox';
    return store.set('save.' + slot, data);
  }
  function loadSlot(slot) {
    const raw = store.get('save.' + slot);
    try { S.deserialize(w, raw); }
    catch (e) { ui.toast('That save could not be read, so it was left alone.'); sfx('uiBack'); return false; }
    exitPhoto();
    enterPlay();
    ui.toast('Loaded ' + slotName(slot).toLowerCase());
    return true;
  }

  // ---------- results ----------
  function showResults() {
    const mins = Math.floor(G.chapterTime / 60), secs = Math.floor(G.chapterTime % 60);
    const d = w.derived;
    const def = w.mode === 'campaign' ? CHAPTERS[w.chapter] : null;
    ui.renderResults(def ? def.title : 'Your oasis', [
      ['Residents', d.population], ['Beauty', d.beauty + ' of 100'], ['Flowing water', d.wetCells + ' squares'],
      ['Buildings and plantings', w.objects.length - 1], ['Postcards in this chapter', w.postcards.length], ['Time', mins + ' min ' + secs + ' s'],
    ], def ? def.unlocks : [], !!def && w.chapter < CHAPTERS.length - 1);
    exitPhoto();
    ui.closeAll(); ui.open('results');
    G.resultsT = -1;
  }

  // ---------- interface actions ----------
  function onAct(name, arg) {
    switch (name) {
      case 'continue': loadSlot('auto'); break;
      case 'chapters': ui.renderChapters(progress); ui.open('chapters'); break;
      case 'chapter': startGame('campaign', Number(arg) || 0); break;
      case 'sandbox-setup': ui.open('sandbox-setup'); break;
      case 'sandbox-start': startGame('sandbox', 0, { hours: Number($('sb-hours').value), weather: $('sb-weather').value, water: $('sb-water').value, boundary: $('sb-boundary').value }); break;
      case 'saves-load': ui.renderSaves('load', slotList()); ui.open('saves'); break;
      case 'saves-save': ui.renderSaves('save', slotList()); ui.open('saves'); break;
      case 'slot-save': if (saveSlot(arg)) { ui.toast('Saved to ' + slotName(arg).toLowerCase()); sfx('ui'); } else ui.toast('This browser would not store the save.'); ui.renderSaves('save', slotList()); break;
      case 'slot-load': loadSlot(arg); break;
      case 'slot-delete': store.del('save.' + arg); ui.renderSaves($('saves-h').textContent.startsWith('Save') ? 'save' : 'load', slotList()); break;
      case 'gallery': exitPhoto(); ui.renderGallery(progress.postcards, photos); ui.open('gallery'); break;
      case 'photo-delete': photos = photos.filter((p) => p.id !== arg); store.set('photos', photos); ui.renderGallery(progress.postcards, photos); break;
      case 'settings': ui.bindSettings(settings); ui.open('settings'); break;
      case 'help': case 'about': ui.open(name); break;
      case 'watch': { const v = $('watch-video'); if (!v.src) { v.poster = 'assets/media/walkthrough-poster.jpg'; v.src = 'assets/media/walkthrough.mp4'; } ui.open('watch'); break; }
      case 'back': { if (ui.top() === 'watch') $('watch-video').pause(); ui.back(); sfx('uiBack'); break; }
      case 'pause': if (G.screen === 'play') { ui.open('pause'); sfx('ui'); } break;
      case 'resume': ui.closeAll(); break;
      case 'quit': saveSlot('auto'); startTitle(); break;
      case 'photo': ui.closeAll(); enterPhoto(); break;
      case 'photo-exit': exitPhoto(); break;
      case 'capture': capture(); break;
      case 'sound': settings.muted = !settings.muted; saveSettings(); applySettings(); cmd('gesture'); break;
      case 'tool': setTool(arg); break;
      case 'cat': G.cat = arg; renderHud(true); break;
      case 'item': G.item = arg; G.cat = ITEMS[arg].cat; G.dupe = false; renderHud(true); sfx('ui'); ui.hint(ITEMS[arg].label + ': click to place, R rotates'); G.hintT = 2; break;
      case 'snap': case 'undo': case 'redo': case 'history': cmd(name); break;
      case 'rotate': cmd('rotate', 1); break;
      case 'history-jump': { const n = Number(arg) || 0; for (let k = 0; k < Math.abs(n); k++) (n < 0 ? doUndo : doRedo)(); break; }
      case 'tut-next': showTutorial(G.tut + 1); break;
      case 'tut-skip': showTutorial(-1); break;
      case 'keep-building': ui.closeAll(); break;
      case 'next-chapter': startGame('campaign', w.chapter + 1); break;
      case 'reset-settings': settings = { ...DEFAULT_SETTINGS }; saveSettings(); applySettings(); ui.bindSettings(settings); view.setQuality(settings.quality); break;
      default: break;
    }
  }
  function onSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    if (key === 'timeSpeed') value = Number(value);
    settings = cleanSettings({ ...settings, [key]: value });
    saveSettings(); applySettings();
    if (key === 'quality') view.setQuality(settings.quality);
    if (key === 'sfx') sfx('ui');
  }
  $('sb-hours').addEventListener('input', () => { $('sb-hours-out').textContent = ui.fmtHours(Number($('sb-hours').value)); });
  $('photo-time').addEventListener('input', () => { G.hours = Number($('photo-time').value); });
  $('brush').addEventListener('input', () => { G.brush = Number($('brush').value); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (G.screen === 'play' || G.screen === 'photo')) saveSlot('auto'); });

  // ---------- events from the simulation ----------
  const KIND_NAME = { ruin: 'an old caravan ruin', overlook: 'a scenic overlook', bloom: 'a rare desert bloom' };
  function drainEvents(dt) {
    G.waterSfxT -= dt;
    const evs = w.events.splice(0);
    if (G.screen !== 'play' && G.screen !== 'photo') return;
    for (const e of evs) {
      if (G.tut >= 0 && TUT[G.tut].until && TUT[G.tut].until(e)) showTutorial(G.tut + 1);
      switch (e.type) {
        case 'blocked': ui.hint(e.why); G.hintT = 2.2; sfx('uiBack'); break;
        case 'stroke': sfx(e.tool === 'carve' ? 'carve' : 'sculpt'); break;
        case 'waterArrive': w._dirtyTerrain = true; if (G.waterSfxT <= 0) { G.waterSfxT = 0.7; sfx('water', { intensity: 0.5 }); } break;
        case 'restored': w._dirtyTerrain = true; break;
        case 'bloomSeen': view.celebrate(e.x, e.z, w); sfx('bloom'); ui.toast('A desert bloom opened beside a thriving planting', 'discover'); break;
        case 'goal': {
          ui.toast('Goal complete: ' + e.text + '. A new district opens.', 'goal'); sfx('goal');
          const sp = w.objects.find((o) => o.type === 'spring');
          if (sp) view.celebrate(sp.x, sp.z, w);
          if (settings.shake) view.shake(0.25);
          break;
        }
        case 'chapterComplete': {
          const id = CHAPTERS[e.chapter].id;
          if (!progress.chapters.includes(id)) { progress.chapters.push(id); saveProgress(); }
          sfx('chapter'); if (settings.shake) view.shake(0.5);
          ui.toast('Chapter complete!', 'goal');
          if (!TEST) G.resultsT = 3;   // scripted checks open results themselves
          break;
        }
        case 'discover': {
          ui.toast('You found ' + KIND_NAME[e.kind], 'discover'); sfx('discover');
          view.focus(e.x, e.z, e.kind === 'overlook' ? 22 : 14);
          view.celebrate(e.x, e.z, w);
          if (settings.shake) view.shake(0.2);
          break;
        }
        default: break;
      }
    }
  }

  // ---------- HUD ----------
  let trayKey = '';
  function renderHud(force) {
    if (G.screen !== 'play') return;
    ui.renderToolbar(G.tool);
    const key = [G.trayOpen, G.cat, G.item, w.unlocked.join()].join('|');
    if (force || key !== trayKey) { trayKey = key; ui.renderTray(G.trayOpen, G.cat, G.item, w.unlocked); }
    const goals = S.goalsStatus(w);
    ui.renderGoals(w.mode === 'campaign' ? (w.chapter + 1) + '. ' + CHAPTERS[w.chapter].title : 'Sandbox', goals.length ? goals : [{ text: 'Build freely. Every building is unlocked.', have: 0, need: 0, done: false }]);
    const d = w.derived;
    ui.renderMeters({ hours: G.hours, weather: w.weather, water: d.wetCells, waterMax: d.wetCells * (d.supply > 0 ? d.supply / Math.max(1, d.used) : 1), beauty: d.beauty, pop: d.population });
    $('brush-label').hidden = !isBrush(G.tool);
  }

  function frameOpts() {
    const playing = G.screen === 'play' && !ui.top();
    return {
      hours: G.hours, weather: w.weather, reduceMotion: settings.reduceMotion, particles: true, waterPattern: settings.waterPattern,
      cursor: G.screen === 'tour' ? (G.tourCursor || {}) : {
        tool: G.tool, x: G.cursor.x, z: G.cursor.z, valid: G.cursor.valid, radius: G.brush, item: G.item, rot: G.rot,
        selected: G.screen === 'play' ? G.selected : null, show: playing && G.cursor.show, snap: settings.gridSnap,
      },
    };
  }

  // ---------- the loop ----------
  function update(dt) {
    input.update(dt);
    const paused = G.screen === 'play' && !!ui.top();
    if (G.screen === 'title') {
      view.cam.yaw += dt * 0.04;
      S.tick(w, dt);
      w.events.length = 0;
    } else if (G.screen === 'tour' && G.tour) {
      G.tour.update(dt);
      G.hours = G.tour.hours();
      w.events.length = 0;
    } else if (G.screen === 'play' || G.screen === 'photo') {
      if (!paused) {
        if (G.stroke && isSculpt(G.stroke.tool)) S.strokePoint(w, G.stroke.tool, G.stroke.x, G.stroke.z, G.brush, Math.min(1, dt * 5));
        S.tick(w, dt);
        if (G.screen === 'play') {
          G.chapterTime += dt;
          const before = G.hours;
          G.hours = (G.hours + dt * 0.05 * settings.timeSpeed) % 24;
          if (before < 6 && G.hours >= 6) newDay();
          w.hours = G.hours;
          G.autosaveT += dt;
          if (G.autosaveT > 45) { G.autosaveT = 0; saveSlot('auto'); }
        }
        if (G.resultsT > 0) { G.resultsT -= dt; if (G.resultsT <= 0) showResults(); }
      }
      drainEvents(dt);
      if (G.selected && !selectedObj()) G.selected = null;
      G.hintT -= dt;
      G.hudT -= dt;
      if (G.hudT <= 0) { G.hudT = 0.2; renderHud(false); }
    }
    // Birds, and the ambience bed about ten times a second.
    const flock = view.isFlockActive();
    if (flock && !G.flockWas) sfx('birds');
    G.flockWas = flock;
    G.audioT -= dt;
    if (G.audioT <= 0 && audioReady) {
      G.audioT = 0.1;
      const markets = w.objects.filter((o) => o.type === 'market').length;
      audio.update({ timeOfDay: G.hours, water: clamp(w.derived.wetCells / 40, 0, 1), market: markets ? clamp(0.35 + w.derived.population / 60, 0, 1) * (1 - nightAmount(G.hours)) : 0, wind: w.weather === 'breezy' ? 0.85 : w.weather === 'hazy' ? 0.5 : 0.25, rain: w.weather === 'rain' ? 1 : 0, insects: nightAmount(G.hours) });
    }
    view.frame(w, dt, frameOpts());
  }
  function newDay() {
    G.day++;
    if (w.mode !== 'campaign' || w.chapter === 0) return;
    const r = S.rng(w.chapter * 131 + G.day * 17)();
    w.weather = r < 0.55 ? 'clear' : r < 0.7 ? 'hazy' : r < 0.9 ? 'breezy' : 'rain';
    if (w.weather !== 'clear') ui.toast(w.weather === 'rain' ? 'A rare shower drifts over the oasis' : w.weather === 'breezy' ? 'A warm breeze lifts the sand' : 'A soft haze settles over the dunes');
  }

  function resize() { view.resize(innerWidth, innerHeight); }
  addEventListener('resize', resize);
  resize();
  startTitle();

  if (!TEST) {
    let last = performance.now();
    const raf = (now) => { const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; update(dt); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // ---------- automated playtest hooks (?test=1 only) ----------
  if (TEST) {
    const state = () => ({
      wetCells: w.derived.wetCells, objects: w.objects.length, irrigated: w.derived.irrigated, residents: w.derived.population,
      beauty: w.derived.beauty, mode: w.mode, chapter: w.chapter, weather: w.weather, waterAbundance: w.abundance, boundary: w.boundaryName,
      tool: G.tool, screen: G.screen, top: ui.top(), goalsDone: w.goalsDone.slice(), hours: G.hours,
      undoDepth: w.undo.length, redoDepth: w.redo.length,
    });
    const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); };
    const run = (a) => {
      switch (a.type) {
        case 'newGame': startGame(a.mode, a.chapter || 0, a.options || {}); return state();
        case 'tutorialSkip': showTutorial(-1); return true;
        case 'stroke': {
          setTool(a.tool, true);
          S.beginStroke(w);
          const ref = w.undo[w.undo.length - 1];
          for (const [x, z] of a.path) S.strokePoint(w, a.tool, x, z, a.radius || 1, 1);
          commitStroke(a.tool, ref);
          return state();
        }
        case 'place': { G.item = a.item; G.rot = a.rot || 0; return !!act('Place ' + a.item, () => S.place(w, a.item, a.x, a.z, a.rot || 0)); }
        case 'select': { setTool('select', true); const o = S.objectAt(w, a.x, a.z); G.selected = o ? o.id : null; return !!o; }
        case 'placeGhostAt': press({ x: a.x, z: a.z }); releaseTool(); return state();
        case 'undo': doUndo(); return state();
        case 'redo': doRedo(); return state();
        case 'save': return saveSlot(String(a.slot));
        case 'load': return loadSlot(String(a.slot));
        case 'setTime': G.hours = a.hours; w.hours = a.hours; return true;
        case 'ui':
          if (a.open === 'photo') { ui.closeAll(); enterPhoto(); }
          else if (a.open === 'gallery') onAct('gallery');
          else if (a.open === 'pause') { exitPhoto(); ui.closeAll(); onAct('pause'); }
          else if (a.open === 'settings') onAct('settings');
          else { exitPhoto(); ui.closeAll(); }
          return state();
        case 'photo': return capture();
        case 'completeChapter': {
          if (w.mode === 'campaign') { for (const g of CHAPTERS[w.chapter].goals) if (!w.goalsDone.includes(g.id)) w.goalsDone.push(g.id); S.checkGoals(w); drainEvents(0); }
          showResults();
          return { shown: !$('results').hidden };
        }
        default: return null;
      }
    };
    window.__oasisTest = {
      ready: true,
      info: () => view.info(),
      frameVariance: () => view.frameVariance(),
      state,
      step(n = 1, dt = 1 / 24) { for (let k = 0; k < n; k++) update(dt); return state(); },
      run,
      samplePlan: () => makePlan(S, w, {}),
      heightAt: (x, z) => S.heightAt(w, x, z),
      selectedRotation: () => { const o = selectedObj(); return o ? o.rot : null; },
      loadCorrupt() {
        const before = w.objects.length;
        store.set('save.3', { v: 1, mode: 'campaign', chapter: 0, heights: 'not-a-grid', kinds: '', objects: [['home', 0, 0, 0, 0, 1]] });
        const ok = loadSlot('3');
        update(1 / 24);
        return { rejected: !ok, stillRunning: G.screen === 'play' && w.objects.length === before };
      },
      tourStart() {
        exitPhoto(); ui.reset(null); setHud(false); ui.tutorial(null); closeHistory();
        document.body.classList.add('tour');
        G.screen = 'tour';
        let capEl = null;
        G.tour = createTour({
          S, w, view,
          setHours: (h) => { G.hours = h; },
          setCursor: (c) => { G.tourCursor = c; },
          caption: (t) => { if (capEl) capEl.remove(); capEl = null; if (t) { capEl = document.createElement('div'); capEl.className = 'tour-caption'; capEl.textContent = t; document.body.appendChild(capEl); } },
          sfx: () => {},
          flash: () => flash(),
        });
        return true;
      },
      tourEvents: () => (G.tour ? G.tour.events.slice() : []),
      audioWav: (sec, events) => audio.renderOffline(sec, { timeOfDay: 17, water: 0.8, market: 0.6, wind: 0.3, rain: 0, insects: 0.4 }, events).then(b64),
    };
  }
}
