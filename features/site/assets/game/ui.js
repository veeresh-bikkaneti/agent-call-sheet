// ui.js: the HTML interface. Panels and their back stack, toasts, captions,
// the toolbar and build tray, goals and meters, saves, gallery, results,
// settings and the tutorial card. Builds DOM with textContent only.

import { TOOLS, ITEMS, CATEGORIES, UNLOCK_LABELS, POSTCARDS, CHAPTERS } from './config.js';

const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'type' || k === 'title' || k === 'href' || k === 'download' || k === 'src' || k === 'alt' || k === 'role') e.setAttribute(k, v === true ? '' : String(v));
    else e[k] = v;
  }
  if (text !== undefined) e.textContent = text;
  return e;
}
const fmtHours = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return hh + ':' + String(mm).padStart(2, '0'); };
const WEATHER_LABEL = { clear: 'Clear', hazy: 'Hazy', breezy: 'Breezy', rain: 'Rain' };

export function createUI({ onAct, onSetting, onFilter }) {
  const stack = [];
  const panelIds = ['title', 'chapters', 'sandbox-setup', 'pause', 'saves', 'settings', 'gallery', 'results', 'help', 'about', 'watch'];
  let lastFocus = null;

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act], [data-filter]');
    if (!t || t.disabled) return;
    if (t.dataset.filter) { onFilter(t.dataset.filter); return; }
    onAct(t.dataset.act, t.dataset.arg, t);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.set) onSetting(t.dataset.set, t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value);
  });

  function focusFirst(id) {
    const root = $(id);
    if (!root) return;
    const b = root.querySelector('button.primary:not([hidden]):not([disabled]), button:not([hidden]):not([disabled]), input, select');
    if (b) b.focus({ preventScroll: true });
  }
  function show(id) { const p = $(id); if (p) { p.hidden = false; focusFirst(id); } }
  function hide(id) { const p = $(id); if (p) p.hidden = true; }
  const top = () => stack[stack.length - 1] || null;
  function open(id) {
    if (top() === id) return;
    if (!stack.length) lastFocus = document.activeElement;
    if (top()) hide(top());
    stack.push(id);
    show(id);
  }
  function back() {
    const t = stack.pop();
    if (t) hide(t);
    if (top()) show(top());
    else if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch { /* gone */ } }
    return top();
  }
  function closeAll() { while (stack.length) hide(stack.pop()); }
  function reset(base) { closeAll(); for (const id of panelIds) hide(id); if (base) open(base); }

  // Gamepad and arrow navigation inside the open panel.
  function menuNav(dir) {
    const root = top() ? $(top()) : null;
    if (!root) return;
    const list = [...root.querySelectorAll('button, input, select, a[href]')].filter((b) => !b.disabled && !b.closest('[hidden]') && b.offsetParent !== null);
    if (!list.length) return;
    let k = list.indexOf(document.activeElement);
    k = k < 0 ? 0 : (k + dir + list.length) % list.length;
    list[k].focus({ preventScroll: false });
  }
  function menuActivate() {
    const a = document.activeElement;
    if (!a || a === document.body) { menuNav(1); return; }
    if (a.tagName === 'BUTTON' || a.tagName === 'A') a.click();
    else if (a.type === 'checkbox') { a.checked = !a.checked; a.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  // ---------- toasts and captions ----------
  function toast(text, kind = '') {
    const box = $('toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const t = el('div', { class: 'toast ' + kind, role: 'status' }, text);
    box.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }
  let capTimer = 0;
  function caption(text) {
    const c = $('captions');
    c.textContent = '[' + text + ']';
    c.hidden = false;
    clearTimeout(capTimer);
    capTimer = setTimeout(() => { c.hidden = true; }, 1800);
  }
  function hint(text) { $('hint').textContent = text || ''; }

  // ---------- HUD ----------
  function renderToolbar(current) {
    const bar = $('toolbar');
    if (!bar.children.length) for (const t of TOOLS) {
      const b = el('button', { 'data-act': 'tool', 'data-arg': t.id, title: t.label + ' (' + t.key + ')', 'aria-pressed': 'false' });
      b.append(el('span', {}, t.label), el('kbd', {}, t.key));
      bar.appendChild(b);
    }
    for (const b of bar.children) b.setAttribute('aria-pressed', b.dataset.arg === current ? 'true' : 'false');
  }
  function renderTray(open, cat, item, unlocked) {
    const tray = $('tray');
    tray.hidden = !open;
    if (!open) return;
    const cats = $('tray-cats');
    cats.textContent = '';
    for (const c of CATEGORIES) cats.appendChild(el('button', { 'data-act': 'cat', 'data-arg': c, role: 'tab', 'aria-selected': c === cat ? 'true' : 'false', 'aria-pressed': c === cat ? 'true' : 'false' }, c));
    const items = $('tray-items');
    items.textContent = '';
    for (const [id, d] of Object.entries(ITEMS)) {
      if (d.cat !== cat) continue;
      const locked = d.unlock && !unlocked.includes(d.unlock);
      const b = el('button', { 'data-act': 'item', 'data-arg': id, 'aria-pressed': id === item ? 'true' : 'false', class: locked ? 'locked' : '', title: locked ? 'Unlocks later in the campaign' : d.label + ' (' + d.size[0] + ' by ' + d.size[1] + ')' }, locked ? d.label + ' (locked)' : d.label);
      if (locked) b.disabled = true;
      items.appendChild(b);
    }
  }
  let lastGoalsKey = '';
  function renderGoals(title, goals) {
    $('hud-chapter').textContent = title;
    const key = JSON.stringify(goals);
    if (key === lastGoalsKey) return;
    lastGoalsKey = key;
    const ul = $('goal-list');
    ul.textContent = '';
    for (const g of goals) {
      const li = el('li', { class: g.done ? 'done' : '' });
      li.append(el('span', {}, g.text), el('span', { class: 'n' }, g.done ? 'done' : g.have + '/' + g.need));
      ul.appendChild(li);
    }
  }
  function renderMeters({ hours, weather, water, waterMax, beauty, pop }) {
    $('clock').textContent = fmtHours(hours);
    $('weather-label').textContent = WEATHER_LABEL[weather] || '';
    $('m-water').textContent = String(water);
    $('m-water-bar').style.width = Math.min(100, Math.round((water / Math.max(1, waterMax)) * 100)) + '%';
    $('m-beauty').textContent = String(beauty);
    $('m-beauty-bar').style.width = beauty + '%';
    $('m-pop').textContent = String(pop);
  }
  function renderHistory(labels, redoLabels) {
    const ol = $('history-list');
    ol.textContent = '';
    ol.appendChild(el('li', { 'data-act': 'history-jump', 'data-arg': String(-labels.length), class: labels.length ? '' : 'now', tabIndex: 0 }, 'Start'));
    labels.forEach((l, k) => ol.appendChild(el('li', { 'data-act': 'history-jump', 'data-arg': String(k + 1 - labels.length), class: k === labels.length - 1 ? 'now' : '', tabIndex: 0 }, l)));
    redoLabels.slice().reverse().forEach((l, k) => ol.appendChild(el('li', { 'data-act': 'history-jump', 'data-arg': String(k + 1), class: 'future', tabIndex: 0 }, l)));
  }

  // ---------- menus ----------
  function renderChapters(progress) {
    const ol = $('chapter-list');
    ol.textContent = '';
    CHAPTERS.forEach((c, k) => {
      const open = k === 0 || progress.chapters.includes(CHAPTERS[k - 1].id) || progress.chapters.includes(c.id);
      const li = el('li');
      li.append(el('b', {}, (k + 1) + '. ' + c.title + (progress.chapters.includes(c.id) ? '  (complete)' : '')));
      li.append(el('p', {}, open ? c.intro : 'Finish the chapter before to open this one.'));
      const b = el('button', { 'data-act': 'chapter', 'data-arg': String(k), class: open ? 'primary' : '' }, progress.chapters.includes(c.id) ? 'Replay' : 'Play');
      if (!open) b.disabled = true;
      li.appendChild(b);
      ol.appendChild(li);
    });
  }
  function renderSaves(mode, slots) {
    $('saves-h').textContent = mode === 'save' ? 'Save the oasis' : 'Load an oasis';
    const ul = $('save-slots');
    ul.textContent = '';
    for (const s of slots) {
      const li = el('li');
      const desc = s.data ? s.name + ': ' + s.label + ', ' + new Date(s.data.savedAt || 0).toLocaleString() : s.name + ': empty';
      li.appendChild(el('span', {}, desc));
      const row = el('span');
      if (mode === 'save' && s.slot !== 'auto') row.appendChild(el('button', { 'data-act': 'slot-save', 'data-arg': s.slot, class: 'primary' }, s.data ? 'Overwrite' : 'Save here'));
      if (mode === 'load' && s.data) row.appendChild(el('button', { 'data-act': 'slot-load', 'data-arg': s.slot, class: 'primary' }, 'Load'));
      if (s.data && s.slot !== 'auto') row.appendChild(el('button', { 'data-act': 'slot-delete', 'data-arg': s.slot }, 'Delete'));
      li.appendChild(row);
      ul.appendChild(li);
    }
  }
  function renderGallery(found, photos) {
    $('pc-count').textContent = '(' + found.length + ' of ' + POSTCARDS.length + ')';
    const pc = $('postcards');
    pc.textContent = '';
    for (const p of POSTCARDS) {
      const got = found.includes(p.id);
      const li = el('li', { class: got ? 'found' : '' });
      li.append(el('b', {}, got ? p.title : 'Undiscovered postcard'), el('span', {}, p.hint));
      pc.appendChild(li);
    }
    const ul = $('photos');
    ul.textContent = '';
    $('no-photos').hidden = photos.length > 0;
    photos.slice().reverse().forEach((ph) => {
      const li = el('li');
      li.appendChild(el('img', { src: ph.src, alt: 'Your photo of the oasis' + (ph.cards && ph.cards.length ? ': ' + ph.cards.join(', ') : '') }));
      li.appendChild(el('div', {}, ph.label));
      const row = el('div', { class: 'row' });
      row.append(el('a', { href: ph.src, download: 'saffron-spring-' + ph.id + '.jpg', class: 'small' }, 'Download'),
        el('button', { 'data-act': 'photo-delete', 'data-arg': ph.id }, 'Remove'));
      li.appendChild(row);
      ul.appendChild(li);
    });
  }
  function renderResults(title, stats, unlocks, hasNext) {
    $('results-h').textContent = title;
    const dl = $('results-stats');
    dl.textContent = '';
    for (const [k, v] of stats) dl.append(el('dt', {}, k), el('dd', {}, String(v)));
    $('results-unlocks').textContent = unlocks.length ? 'New to build: ' + unlocks.map((u) => UNLOCK_LABELS[u] || u).join(', ') + '.' : 'Every building is yours to use.';
    $('btn-next').hidden = !hasNext;
  }
  function bindSettings(s) {
    document.querySelectorAll('[data-set]').forEach((i) => {
      const v = s[i.dataset.set];
      if (i.type === 'checkbox') i.checked = !!v; else i.value = String(v);
    });
  }
  function applySettingsClasses(s) {
    const h = document.documentElement;
    h.classList.toggle('contrast', !!s.highContrast);
    h.classList.toggle('reduce-motion', !!s.reduceMotion);
    h.classList.toggle('text-large', s.textSize === 'large');
    h.classList.toggle('text-larger', s.textSize === 'larger');
    $('btn-sound').setAttribute('aria-pressed', s.muted ? 'false' : 'true');
    $('btn-sound').textContent = s.muted ? 'Sound off' : 'Sound';
    $('btn-snap').setAttribute('aria-pressed', s.gridSnap ? 'true' : 'false');
    $('btn-snap').textContent = s.gridSnap ? 'Grid' : 'Free';
  }
  function tutorial(step) {
    const t = $('tutorial');
    if (!step) { t.hidden = true; return; }
    t.hidden = false;
    $('tut-step').textContent = 'Step ' + step.n + ' of ' + step.of;
    $('tut-title').textContent = step.title;
    $('tut-text').textContent = step.text;
    t.querySelector('[data-act="tut-next"]').textContent = step.n === step.of ? 'Start building' : 'Next';
  }
  function setFilterButtons(f) {
    document.querySelectorAll('#filters [data-filter]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === f ? 'true' : 'false'));
  }

  return {
    $, el, open, back, closeAll, reset, top, menuNav, menuActivate, toast, caption, hint,
    renderToolbar, renderTray, renderGoals, renderMeters, renderHistory,
    renderChapters, renderSaves, renderGallery, renderResults, bindSettings, applySettingsClasses, tutorial, setFilterButtons, fmtHours,
  };
}
