/* Tactical Operations — console logic.
 *
 * House rules honoured here:
 *  - No innerHTML, no eval, no new Function. Every node is built with
 *    createElement + textContent.
 *  - Nothing is fetched until the operator asks for the 3D terminal; scene.js
 *    is pulled in with a dynamic import at that moment and never before.
 *  - All state is local (localStorage) — no network, no server, no telemetry.
 *  - The console works completely with the 3D terminal switched off.
 */
import { OPS } from './ops-data.js';

const $ = (id) => document.getElementById(id);
const LS_KEY = 'agent-call-sheet.ops.v1';
const DEFECTS = OPS.defects.slice();
const WAVES = OPS.waves.slice();
const STATUS_ORDER = ['open', 'partial', 'mooted', 'resolved'];

/* ------------------------------------------------------------------ dom */
function el(tag, opts = {}, kids = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  for (const [k, v] of Object.entries(opts.attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  for (const [k, v] of Object.entries(opts.data || {})) node.dataset[k] = String(v);
  for (const [k, fn] of Object.entries(opts.on || {})) node.addEventListener(k, fn);
  for (const kid of [].concat(kids)) if (kid) node.appendChild(kid);
  return node;
}

/* ------------------------------------------------------------------ state */
const persisted = load();
const state = {
  triaged: new Set(persisted.triaged || []),
  walked: new Set(persisted.walked || []),
  loadout: persisted.loadout || null,
  sound: persisted.sound === true,
  mode: '2d',                                  // live mode this session
  pref: persisted.mode === '3d' ? '3d' : '2d', // what the operator asked to keep
  booted: false,
  selected: null,
  focusIndex: 0,
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      triaged: [...state.triaged],
      walked: [...state.walked],
      loadout: state.loadout,
      sound: state.sound,
      mode: state.pref,
    }));
  } catch { /* private mode — the console still works, it just forgets */ }
}

/* ------------------------------------------------------------------ audio */
/* Synthesised on demand with WebAudio. No files, no autoplay: the context is
   created on a user gesture and only ever while the operator has sound on. */
const Audio = (() => {
  let ctx = null;
  function ensure() {
    if (!state.sound) return null;
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function blip({ freq = 320, to = null, dur = 0.09, type = 'square', gain = 0.035 } = {}) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  return {
    read: () => blip({ freq: 440, to: 620, dur: 0.07, type: 'triangle' }),
    triage: () => { blip({ freq: 180, to: 90, dur: 0.14, type: 'sawtooth', gain: 0.05 }); },
    wave: () => { blip({ freq: 520, to: 880, dur: 0.18, type: 'triangle' }); setTimeout(() => blip({ freq: 760, to: 1180, dur: 0.2, type: 'triangle' }), 130); },
    deploy: () => blip({ freq: 90, to: 220, dur: 0.35, type: 'sawtooth', gain: 0.05 }),
    off: () => blip({ freq: 300, to: 140, dur: 0.1, type: 'square' }),
    resume: () => { ensure(); },
  };
})();

/* ------------------------------------------------------------------ log */
const logEl = $('log');
let logCount = 0;
function log(kind, message) {
  if (!logEl) return;
  const now = new Date();
  const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const line = el('li', { data: { kind } }, [
    el('span', { class: 't', text: `[${stamp}] ` }),
    el('span', { text: message }),
  ]);
  logEl.appendChild(line);
  while (logEl.children.length > 60) logEl.removeChild(logEl.firstElementChild);
  logEl.scrollTop = logEl.scrollHeight;
  logCount += 1;
}

/* ------------------------------------------------------------------ scene bridge
   scene.js is only ever imported from deploy3D(). Everything else in this file
   must keep working when WebGL, the network or the whole module is unavailable. */
let term = null;
let sceneBoot = null;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function deploy3D() {
  if (term || sceneBoot) return;
  const canvas = $('ops-canvas');
  if (!canvas) return;
  setModeHint('Loading three@0.158.0 …');
  sceneBoot = import('./scene.js').then(({ createTerminal }) => createTerminal(canvas, {
    defectIds: DEFECTS.map((d) => d.id),
    defectSeverity: Object.fromEntries(DEFECTS.map((d) => [d.id, d.severity])),
    defectLoadout: Object.fromEntries(DEFECTS.map((d) => [d.id, d.loadout])),
    loadouts: OPS.loadouts.map((l) => ({ id: l.id, name: l.name, targets: l.targets })),
    packs: OPS.packList.map((p) => ({ id: p.id, entries: p.entries })),
    containers: OPS.containers.map((c) => c.id),
    reducedMotion: reducedMotion(),
  })).then((api) => {
    term = api;
    for (const id of state.triaged) term.markTriaged(id);
    if (state.loadout) term.focusLoadout(state.loadout);
    if (state.selected) term.focusDefect(state.selected);
    setMode('3d');
    log('ok', `Terminal deployed: ${DEFECTS.length} defect containers, ${OPS.packList.length} pack stacks, gantry crane live.`);
    Audio.deploy();
  }).catch((err) => {
    log('warn', `3D terminal unavailable (${err && err.message ? err.message : 'unknown error'}). The console keeps working without it.`);
    setModeHint('3D unavailable — running the console headless.');
    setMode('2d', { silent: true });
    sceneBoot = null;
  });
  return sceneBoot;
}

function teardown3D() {
  if (term && typeof term.dispose === 'function') term.dispose();
  term = null;
  sceneBoot = null;
}

function setMode(mode, { silent = false, keepPref = false } = {}) {
  if (mode !== '3d') teardown3D();
  state.mode = mode;
  if (!keepPref) state.pref = mode;
  document.documentElement.dataset.opsMode = mode;
  const btn = $('btn-mode');
  if (btn) {
    btn.setAttribute('aria-pressed', String(mode === '3d'));
    btn.textContent = mode === '3d' ? '3D: on' : '3D: off';
  }
  if (mode === '2d') {
    setModeHint('Headless console. The yard stays dark; nothing third-party is loaded.');
  } else {
    setModeHint('Drag the backdrop to orbit · W/A/S/D and +/− work anywhere.');
  }
  save();
  if (!silent) log('ok', mode === '3d' ? 'Terminal online.' : 'Terminal stowed — headless console.');
}

function setModeHint(text) {
  const hint = $('mode-hint');
  if (hint) hint.textContent = text;
}

/* ------------------------------------------------------------------ renderers */
function renderChips() {
  const audit = $('chip-audit');
  if (audit) audit.textContent = `${state.triaged.size}/${DEFECTS.length}`;
  const auditWrap = $('chip-audit-wrap');
  if (auditWrap) auditWrap.dataset.tone = state.triaged.size === DEFECTS.length ? 'ok' : 'warn';
  const gate = $('chip-gate');
  if (gate) gate.textContent = OPS.gate.verdict || '—';
  const gateWrap = $('chip-gate-wrap');
  if (gateWrap) gateWrap.dataset.tone = (OPS.gate.verdict || '').toUpperCase() === 'PASS' ? 'ok' : 'bad';
  const current = currentWave();
  const wave = $('chip-wave');
  if (wave) wave.textContent = `${current.n}/${WAVES.length}`;
  const yard = $('chip-yard');
  if (yard) yard.textContent = `${OPS.manifest.entries} / ${OPS.manifest.installedFiles}`;
  const lo = $('chip-loadout');
  if (lo) {
    const found = OPS.loadouts.find((l) => l.id === state.loadout);
    lo.textContent = found ? found.name.replace(' Loadout', '') : 'none';
  }
  document.documentElement.dataset.opsAudit = String(state.triaged.size);
}

function renderBriefing() {
  const m = OPS.manifest;
  setText('b-entries', String(m.entries));
  setText('b-installed', String(m.installedFiles));
  setText('b-packs', String(m.packs));
  setText('b-date', (OPS.gate.date || '').slice(0, 10) || '—');
  setText('f-verdict', OPS.gate.verdict || '—');
  setText('f-verdict-commit', shortSha(OPS.gate.underTest));
  setText('f-head', shortSha(OPS.generatedFromCommit));
  setText('n-commit', shortSha(OPS.generatedFromCommit));
  const t1 = OPS.eval.counts.tier1 || {};
  const t2 = OPS.eval.counts.tier2 || {};
  const nc = OPS.eval.counts['negative-controls'] || {};
  const pass = (t1.PASS || 0) + (t2.PASS || 0) + (nc.PASS || 0);
  const fail = (t1.FAIL || 0) + (t2.FAIL || 0) + (nc.FAIL || 0);
  setText('f-eval', `${pass} pass`);
  setText('f-eval-notrun', `${(t1['NOT RUN'] || 0)} standing not-run in tier 1.`);
  const fEval = $('f-eval');
  if (fEval) fEval.style.color = fail > 0 ? 'var(--danger)' : 'var(--success)';
  const counts = OPS.defectStatus || {};
  const standing = (counts.open || 0) + (counts.partial || 0);
  setText('f-defects', String(DEFECTS.length));
  const fDef = $('f-defects');
  if (fDef) {
    fDef.appendChild(el('span', {
      class: 'unit',
      text: ` · ${standing} still standing · ${counts.resolved || 0} cleared`,
    }));
  }
  setText('stamp', `Baked from ${shortSha(OPS.generatedFromCommit)} · eval run ${OPS.eval.runAt || '—'} · gate verdict quoted from ${OPS.gate.seat || 'the independent gate'}.`);
}

function setText(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}

function shortSha(sha) {
  return sha ? String(sha).split(' ')[0].slice(0, 8) : '—';
}

function renderLoadouts() {
  const host = $('loadout-list');
  if (!host) return;
  host.textContent = '';
  OPS.loadouts.forEach((lo, i) => {
    const btn = el('button', {
      class: 'loadout',
      type: 'button',
      attrs: { 'aria-pressed': String(state.loadout === lo.id), title: lo.doctrine },
      data: { loadout: lo.id },
      on: { click: () => staffLoadout(lo.id) },
    }, [
      el('span', { class: 'nm', text: `${i + 1}. ${lo.name}` }),
      el('span', { class: 'pk', text: `${lo.pack} · ${lo.targets.length} target${lo.targets.length === 1 ? '' : 's'}` }),
    ]);
    host.appendChild(btn);
  });
  const keys = $('loadout-keys');
  if (keys) keys.textContent = `1–${OPS.loadouts.length}`;
}

function currentWave() {
  for (const w of WAVES) if (!state.walked.has(w.key)) return w;
  return WAVES[WAVES.length - 1];
}

function renderWaves() {
  const host = $('wave-list');
  if (!host) return;
  host.textContent = '';
  const cur = currentWave();
  WAVES.forEach((w) => {
    const li = el('li', {
      data: { done: String(state.walked.has(w.key)), current: String(w.key === cur.key) },
    }, [
      el('span', { class: 'n', text: `LVL ${String(w.n).padStart(2, '0')}` }),
      el('div', { text: w.name }),
      el('div', { class: 'sub', text: w.brief }),
      el('button', {
        type: 'button',
        text: state.walked.has(w.key) ? 'walked ✓' : 'mark walked',
        attrs: { 'aria-pressed': String(state.walked.has(w.key)) },
        on: { click: () => toggleWave(w) },
      }),
    ]);
    host.appendChild(li);
  });
  setText('arena-wave-n', String(cur.n));
  setText('arena-wave-name', cur.name);
  const chip = $('chip-wave');
  if (chip) chip.textContent = `${cur.n}/${WAVES.length}`;
}

function toggleWave(w) {
  if (state.walked.has(w.key)) {
    state.walked.delete(w.key);
    log('info', `Wave ${w.n} (${w.name}) reopened.`);
  } else {
    state.walked.add(w.key);
    log('ok', `Wave ${w.n} cleared: ${w.name}.`);
    Audio.wave();
  }
  renderWaves();
  renderChips();
  save();
}

function renderRoster() {
  const host = $('roster');
  if (!host) return;
  host.textContent = '';
  DEFECTS.forEach((d, i) => {
    const card = el('button', {
      class: 'dcard',
      type: 'button',
      data: {
        defect: d.id,
        sev: d.severity,
        status: d.status,
        triaged: String(state.triaged.has(d.id)),
      },
      attrs: {
        'aria-current': String(state.selected === d.id),
        tabindex: i === state.focusIndex ? '0' : '-1',
      },
      on: { click: () => selectDefect(d.id) },
    }, [
      el('div', { class: 'top' }, [
        el('span', { class: 'did', text: d.id }),
        el('span', { class: 'sev', text: d.severity }),
        el('span', { class: 'stat', text: statusLabel(d.status) }),
      ]),
      el('div', { class: 'ttl', text: d.title }),
      el('div', { class: 'cmp', text: d.component }),
    ]);
    host.appendChild(card);
  });
}

function statusLabel(status) {
  return ({ resolved: 'cleared', partial: 'partial', open: 'standing', mooted: 'mooted' })[status] || status;
}

function renderDossier() {
  const host = $('dossier');
  if (!host) return;
  host.textContent = '';
  host.appendChild(el('h3', { text: 'Dossier' }));
  const d = DEFECTS.find((x) => x.id === state.selected);
  if (!d) {
    host.appendChild(el('p', {
      class: 'none',
      text: 'Select a finding to read its component, ruling, fix and the probe output behind its status.',
    }));
    return;
  }
  const dl = el('dl');
  const row = (label, value, cls) => {
    dl.appendChild(el('dt', { text: label }));
    dl.appendChild(el('dd', { class: cls || '', text: value || '—' }));
  };
  row('Finding', `${d.id} · ${d.severity}`);
  row('Status today', `${statusLabel(d.status)} (${d.status})`);
  row('Component', d.component);
  row('Gate observed', d.observed);
  row('Gate ruling', d.ruling || 'none recorded', d.ruling ? '' : 'muted');
  row('Prescribed fix', d.fix || 'none recorded', d.fix ? '' : 'muted');
  host.appendChild(dl);

  if (d.repro && d.repro.length) {
    host.appendChild(el('h3', { text: 'Gate repro' }));
    const ul = el('ul');
    for (const step of d.repro) ul.appendChild(el('li', { text: step }));
    host.appendChild(ul);
  }

  host.appendChild(el('h3', { text: 'Probe output' }));
  host.appendChild(el('pre', { class: 'ev', text: d.evidence.join('\n') }));

  const lo = OPS.loadouts.find((l) => l.id === d.loadout);
  host.appendChild(el('h3', { text: 'Staffed from' }));
  host.appendChild(el('p', {
    class: 'ev',
    text: lo ? `${lo.name} (${lo.pack}) — ${lo.doctrine}` : d.loadout,
  }));

  host.appendChild(el('button', {
    class: 'btn ghost',
    type: 'button',
    text: state.triaged.has(d.id) ? 'Reopen finding' : 'Triage finding',
    attrs: { 'aria-pressed': String(state.triaged.has(d.id)) },
    on: { click: () => triage(d.id) },
  }));
}

function renderPhases() {
  const host = $('phases');
  if (!host) return;
  host.textContent = '';
  setText('boss-name', OPS.boss.name);
  for (const p of OPS.boss.phases) {
    host.appendChild(el('div', { class: 'phase', data: { status: p.status } }, [
      el('div', { class: 'top' }, [
        el('span', { class: 'rid', text: p.id }),
        el('span', { text: p.class }),
        el('span', { class: 'stat', text: statusLabel(p.status) }),
      ]),
      el('div', { class: 'txt', text: p.criteria }),
      el('div', { class: 'ev', text: p.evidence.join(' · ') }),
    ]));
  }
}

function renderYard() {
  const host = $('yard');
  if (!host) return;
  host.textContent = '';
  for (const c of OPS.containers) {
    host.appendChild(el('a', {
      class: 'box',
      attrs: { href: c.href, data: { kind: c.kind } },
      data: { container: c.id },
    }, [
      el('span', { class: 'cid', text: c.id }),
      el('span', { class: 'kind', text: c.kind }),
      el('span', { class: 'lbl', text: c.label }),
      el('span', { class: 'note', text: c.note }),
    ]));
  }
  const packs = $('packs');
  if (!packs) return;
  packs.textContent = '';
  for (const p of OPS.packList) {
    packs.appendChild(el('div', { class: 'pack', data: { pack: p.id } }, [
      el('div', { class: 'top' }, [
        el('span', { text: p.id }),
        el('span', { class: 'cnt', text: `${p.entries} entries` }),
      ]),
      el('p', { text: p.blurb }),
      el('p', { class: 'ev', text: `${p.files} file(s) in the catalogue column · ${p.include} included · ${p.link_only} link-only` }),
    ]));
  }
}

function renderNotes() {
  const verified = $('verified-list');
  if (verified) {
    verified.textContent = '';
    const lines = [
      `Every status badge on this page is a probe result, re-run by build-ops-data.py at commit ${shortSha(OPS.generatedFromCommit)}.`,
      `Gate verdict "${OPS.gate.verdict}" and the eight findings are quoted from ${OPS.gate.seat || 'the gate'}, reviewed at ${OPS.gate.underTest || '—'}.`,
      `Eval counts quoted verbatim from eval/results.json (run ${OPS.eval.runAt || '—'}).`,
      `Manifest totals (${OPS.manifest.entries} entries, ${OPS.manifest.installedFiles} installed files) recomputed from manifest.csv; ${OPS.manifest.linkOnly.rows} link-only rows reference ${OPS.manifest.linkOnly.filesAtUpstream} upstream files that are deliberately not vendored.`,
      'tests/test_tactical_ops_page.py re-checks this page: no innerHTML/eval, pinned import map, every referenced element id present, and byte-identical regeneration of ops-data.js.',
    ];
    for (const line of lines) verified.appendChild(el('li', { text: line }));
  }
  const limits = $('limits-list');
  if (limits) {
    limits.textContent = '';
    for (const line of OPS.gate.limitations || []) limits.appendChild(el('li', { text: line }));
  }
}

/* ------------------------------------------------------------------ actions */
function selectDefect(id) {
  state.selected = id;
  state.focusIndex = Math.max(0, DEFECTS.findIndex((d) => d.id === id));
  renderRoster();
  renderDossier();
  Audio.read();
  const d = DEFECTS.find((x) => x.id === id);
  if (d) log('info', `Read ${d.id} ${d.title} — ${statusLabel(d.status)}.`);
  if (term && term.focusDefect) term.focusDefect(id);
}

function triage(id) {
  const d = DEFECTS.find((x) => x.id === id);
  if (!d) return;
  if (state.triaged.has(id)) {
    state.triaged.delete(id);
    log('warn', `${id} reopened — still ${statusLabel(d.status)}.`);
  } else {
    state.triaged.add(id);
    log('hit', `${id} triaged. ${d.severity} · ${statusLabel(d.status)}. Fix on record: ${d.fix || 'none recorded'}`);
    Audio.triage();
  }
  renderRoster();
  renderDossier();
  renderChips();
  save();
  if (term && term.markTriaged) term.markTriaged(id);
}

function staffLoadout(id) {
  state.loadout = state.loadout === id ? null : id;
  renderLoadouts();
  renderChips();
  const lo = OPS.loadouts.find((l) => l.id === id);
  if (state.loadout && lo) {
    log('ok', `${lo.name} staffed from ${lo.pack} — targets ${lo.targets.join(', ')}.`);
    Audio.read();
    if (term && term.focusLoadout) term.focusLoadout(id);
  } else {
    log('info', 'Loadout stowed.');
  }
  save();
}

function resetRun() {
  state.triaged.clear();
  state.walked.clear();
  state.loadout = null;
  state.selected = null;
  state.focusIndex = 0;
  save();
  renderAll();
  if (term) for (const d of DEFECTS) term.markTriaged && term.markTriaged(d.id, false);
  log('warn', 'Run reset. Roster unread, waves rewound, loadout stowed.');
  Audio.off();
}

function toggleSound() {
  state.sound = !state.sound;
  const btn = $('btn-sound');
  if (btn) {
    btn.setAttribute('aria-pressed', String(state.sound));
    btn.textContent = state.sound ? 'Sound: on' : 'Sound: off';
  }
  save();
  if (state.sound) {
    Audio.resume();
    Audio.read();
    log('ok', 'Sound on — interface tones are synthesised in this browser, nothing is downloaded.');
  } else {
    log('info', 'Sound off.');
  }
}

function toggleKeys(force) {
  const panel = $('keys');
  const btn = $('btn-help');
  if (!panel) return;
  const open = force === undefined ? panel.hidden : force;
  panel.hidden = !open;
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

function moveFocus(delta) {
  state.focusIndex = (state.focusIndex + delta + DEFECTS.length) % DEFECTS.length;
  const d = DEFECTS[state.focusIndex];
  renderRoster();
  const card = document.querySelector(`.dcard[data-defect="${d.id}"]`);
  if (card) card.focus();
  Audio.read();
}

/* ------------------------------------------------------------------ wiring */
function renderAll() {
  renderChips();
  renderBriefing();
  renderLoadouts();
  renderWaves();
  renderRoster();
  renderDossier();
  renderPhases();
  renderYard();
  renderNotes();
}

function wire() {
  const deploy = $('btn-deploy');
  if (deploy) deploy.addEventListener('click', async () => {
    deploy.disabled = true;
    try { await deploy3D(); } finally { deploy.disabled = false; }
  });

  const console2d = $('btn-console');
  if (console2d) console2d.addEventListener('click', () => setMode('2d'));

  const mode = $('btn-mode');
  if (mode) mode.addEventListener('click', () => {
    if (state.mode === '3d') setMode('2d');
    else { setModeHint('Loading three@0.158.0 …'); deploy3D(); }
  });

  const sound = $('btn-sound');
  if (sound) sound.addEventListener('click', toggleSound);

  const help = $('btn-help');
  if (help) help.addEventListener('click', () => toggleKeys());

  const reset = $('btn-reset');
  if (reset) reset.addEventListener('click', resetRun);

  document.addEventListener('keydown', (ev) => {
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = ev.key;
    if (k >= '1' && k <= String(OPS.loadouts.length)) {
      const lo = OPS.loadouts[Number(k) - 1];
      if (lo) { staffLoadout(lo.id); ev.preventDefault(); }
      return;
    }
    switch (k) {
      case 'j': case 'J': moveFocus(1); break;
      case 'k': case 'K': moveFocus(-1); break;
      case 'Enter': {
        const d = DEFECTS[state.focusIndex];
        if (d && state.selected !== d.id) selectDefect(d.id);
        else if (d) triage(d.id);
        ev.preventDefault();
        break;
      }
      case 't': case 'T': {
        const d = DEFECTS.find((x) => x.id === state.selected) || DEFECTS[state.focusIndex];
        if (d) triage(d.id);
        break;
      }
      case 'Escape': state.selected = null; renderRoster(); renderDossier(); break;
      case 'm': case 'M': if (state.mode === '3d') setMode('2d'); else deploy3D(); break;
      case 'n': case 'N': toggleSound(); break;
      case 'l': case 'L': { const l = $('log'); if (l) l.scrollTop = l.scrollHeight; break; }
      case '?': toggleKeys(); break;
      case 'r': case 'R': resetRun(); break;
      case 'a': case 'A': if (term && term.orbitBy) term.orbitBy(-0.12, 0); break;
      case 'd': case 'D': if (term && term.orbitBy) term.orbitBy(0.12, 0); break;
      case 'w': case 'W': if (term && term.orbitBy) term.orbitBy(0, -0.08); break;
      case 's': case 'S': if (term && term.orbitBy) term.orbitBy(0, 0.08); break;
      case '+': case '=': if (term && term.dolly) term.dolly(-2.5); break;
      case '-': case '_': if (term && term.dolly) term.dolly(2.5); break;
      default: return;
    }
  });

  // Scroll gently raises the yard until the operator takes the camera themselves.
  window.addEventListener('scroll', () => {
    if (!term || !term.setScroll || term.userTookControl && term.userTookControl()) return;
    const max = Math.max(1, document.body.scrollHeight - window.innerHeight);
    term.setScroll(window.scrollY / max);
  }, { passive: true });
}

/* ------------------------------------------------------------------ boot */
function boot() {
  if (state.booted) return;
  state.booted = true;
  renderAll();
  wire();
  const btn = $('btn-sound');
  if (btn) {
    btn.setAttribute('aria-pressed', String(state.sound));
    btn.textContent = state.sound ? 'Sound: on' : 'Sound: off';
  }
  document.documentElement.dataset.opsMode = state.mode;
  log('info', `Console online. ${DEFECTS.length} findings loaded from the gate verdict; ${OPS.manifest.entries} catalogue entries on the yard.`);
  log('info', `Baked from ${shortSha(OPS.generatedFromCommit)}. Nothing behind this page is live.`);
  const wantsThree = state.pref === '3d';
  setMode('2d', { silent: true, keepPref: true });
  if (reducedMotion()) {
    setModeHint('Your system asks for reduced motion, so the 3D terminal stays stowed. Deploy it yourself any time.');
    log('warn', 'prefers-reduced-motion respected — 3D terminal not started.');
  } else if (wantsThree) {
    deploy3D();
  }

  window.addEventListener('pagehide', () => { if (term) term.dispose(); }, { passive: true });
  document.documentElement.dataset.opsReady = 'true';
}

boot();

/* Exposed so a browser check can ask the console what it actually built. */
window.__ops = {
  state,
  defectIds: DEFECTS.map((d) => d.id),
  waveKeys: WAVES.map((w) => w.key),
  logCount: () => logCount,
  deploy3D,
  terminal: () => (term && term.debug ? term.debug() : null),
};
