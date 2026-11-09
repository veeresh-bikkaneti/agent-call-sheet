// ui.js — HUD, documentation containers, threat arena, combat loop, combat log, dossier.
// Security: no innerHTML / no eval anywhere; all DOM built with createElement + textContent.
import { AudioManager } from './audio.js';

const REPO = 'https://github.com/veeresh-bikkaneti/agent-call-sheet';

// Documentation containers — grounded in what pages.yml actually serves.
const CONTAINERS = [
  {
    id: 'beginner', label: 'Beginner Guide', icon: '📖',
    page: '/BEGINNER-GUIDE.md', repo: REPO + '/blob/main/features/docs/BEGINNER-GUIDE.md',
    blurb: '30-second zero-install test (open the board, click around), 5-minute quick start with git clone, then the full tour of the six packs. Start here if you cloned the repo five minutes ago.'
  },
  {
    id: 'manifest', label: 'Manifest', icon: '📦',
    page: '/MANIFEST.md', repo: REPO + '/blob/main/features/docs/MANIFEST.md',
    blurb: 'Every library entry with its provenance, license evidence, and whether files are included or linked. The honesty layer of the repo — every claim on this page is checked against it.'
  },
  {
    id: 'board', label: 'Live Board', icon: '🎮',
    page: '/board/', repo: REPO + '/blob/main/features/live-debugger/board.html',
    blurb: 'Offline-first live dashboard: an SSE stream from board_server.py with sample runs baked in. No install, no server needed for the demo data.'
  },
  {
    id: 'viz', label: '3D Visualization', icon: '🛰️',
    page: null, repo: REPO + '/blob/main/features/visualization/visualization.html',
    blurb: 'The five-layer architecture explorer: library → front door → bootstrap → live debugger → paperclip bridge, rendered as stacked slabs in Three.js. (Source page kept in the repo; the Pages site now serves the Tactical Operations briefing room.)'
  }
];

// Weapons = the real packs in features/library/packs/.
const WEAPONS = [
  { name: 'Rigor', icon: '⚔️', damage: 25, cooldown: 500, key: '1', desc: 'Discipline seat: gate review, eval harness, honesty checks. Precision damage.' },
  { name: 'Crew Personas', icon: '🎭', damage: 35, cooldown: 1000, key: '2', desc: 'Specialist seats with clear contracts. Heavy AoE hit.' },
  { name: 'SEO', icon: '🎯', damage: 20, cooldown: 300, key: '3', desc: 'Rapid-fire discoverability passes. Fast cooldown.' },
  { name: 'Design/Video/3D', icon: '🎬', damage: 15, cooldown: 200, key: '4', desc: 'Support fire: visuals, demos, trailers.' }
];

// Enemies = the four shame-index findings of gate-verdict.agent-readable.v1.json (commit b63cbdb).
// Each "solution" is what actually addresses it in the repo.
const ENEMIES = [
  {
    id: 'sri', icon: '🔓', name: 'CDN scripts without SRI', hp: 100,
    desc: 'Landing page shipped Three.js from unpkg pinned by version but with zero integrity hashes — a CDN compromise would inject code into every visitor.',
    solution: 'Pin the importmap AND add sha384 integrity hashes for every CDN module — this page does exactly that.',
    reward: 'Supply-chain integrity'
  },
  {
    id: 'ratelimit', icon: '🚦', name: 'No rate limit on board writes', hp: 150,
    desc: 'board_server.py accepts POST /events, /nudge, /intervene with no rate limiting and no auth beyond a loopback check.',
    solution: 'RateLimiter on write endpoints: 60 req/min + 10 burst, request-size cap, explicit auth.',
    reward: 'Write-endpoint protection'
  },
  {
    id: 'tests', icon: '🧪', name: 'Test theater (17% coverage)', hp: 120,
    desc: '4 tests, all for bootstrap.py. Zero tests for the 47KB landing page, board server, live_debugger, or the HTML pages.',
    solution: 'Run features/eval/eval/run_evals.py in CI and add tests for board_server.py, live_debugger.py, and the pages.',
    reward: 'Real coverage'
  },
  {
    id: 'claims', icon: '📣', name: 'Claim ≠ reality in hero', hp: 80,
    desc: 'Hero copy promised capabilities the demo never showed; the project\'s own honesty standard requires labels, not slogans.',
    solution: 'gate-verdict.agent-readable.v1.json: every user-facing claim marked PASS / CONCERN / BLOCKER against observed reality.',
    reward: 'Honest labels'
  }
];

const state = {
  audio: null,
  selectedWeapon: 0,
  xp: 0,
  level: 1,
  styleRank: 0,
  enemies: [],
  logEl: null,
  hud: {}
};

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function log(message, kind) {
  const entry = el('div', 'log-entry' + (kind ? ' ' + kind : ''),
    '[' + new Date().toLocaleTimeString() + '] ' + message);
  state.logEl.appendChild(entry);
  while (state.logEl.children.length > 24) state.logEl.removeChild(state.logEl.firstChild);
  state.logEl.scrollTop = state.logEl.scrollHeight;
}

function styleRankLabel() {
  const s = state.styleRank;
  if (s >= 90) return 'S+';
  if (s >= 80) return 'S';
  if (s >= 70) return 'A';
  if (s >= 60) return 'B';
  if (s >= 40) return 'C';
  if (s >= 20) return 'D';
  return 'F';
}

function updateHUD() {
  state.hud.armor.textContent = '150';
  state.hud.packs.textContent = '6'; // six packs in features/library/packs
  state.hud.style.textContent = styleRankLabel();
  const alive = state.enemies.filter(e => e.hp > 0).length;
  state.hud.mission.textContent = alive === 0 ? 'MISSION COMPLETE' : 'THREATS: ' + alive + '/' + state.enemies.length;
}

/* ----- containers ----- */
function buildContainers() {
  const grid = document.getElementById('terminal-grid');
  CONTAINERS.forEach((c) => {
    const btn = el('button', 'container');
    btn.type = 'button';
    btn.dataset.container = c.id;
    btn.setAttribute('aria-label', 'Open ' + c.label + ' dossier');
    btn.appendChild(el('span', 'container-icon', c.icon));
    btn.appendChild(el('span', 'container-label', c.label));
    btn.addEventListener('click', () => { state.audio.click(); openDossier(c); });
    grid.appendChild(btn);
  });
}

function openDossier(c) {
  state.audio.open();
  document.getElementById('dossier-title').textContent = c.label.toUpperCase();
  document.getElementById('dossier-blurb').textContent = c.blurb;
  const page = document.getElementById('dossier-page');
  if (c.page) {
    page.href = c.page;
    page.textContent = 'Open on this site (' + c.page + ')';
    page.style.display = '';
  } else {
    page.style.display = 'none';
  }
  const repo = document.getElementById('dossier-repo');
  repo.href = c.repo;
  document.getElementById('dossier').hidden = false;
  log('CONTAINER ' + c.label + ' opened');
  document.getElementById('dossier-close').focus();
}

function closeDossier() {
  document.getElementById('dossier').hidden = true;
}

/* ----- weapons ----- */
function buildWeapons() {
  const bar = document.getElementById('weapon-bar');
  WEAPONS.forEach((w, i) => {
    const b = el('button', 'weapon' + (i === 0 ? ' selected' : ''));
    b.type = 'button';
    b.title = w.desc;
    b.dataset.weapon = String(i);
    b.appendChild(el('span', 'w-icon', w.icon));
    b.appendChild(el('span', 'w-name', w.name));
    b.appendChild(el('span', 'w-key', 'key ' + w.key + ' · ' + w.damage + ' dmg'));
    b.addEventListener('click', () => selectWeapon(i, true));
    bar.appendChild(b);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= String(WEAPONS.length)) selectWeapon(Number(e.key) - 1, true);
    if (e.key === 'Escape') closeDossier();
  });
}

function selectWeapon(i, audible) {
  state.selectedWeapon = i;
  document.querySelectorAll('.weapon').forEach((b, j) => {
    b.classList.toggle('selected', j === i);
  });
  if (audible) { state.audio.select(); log('WEAPON → ' + WEAPONS[i].name + ' (' + WEAPONS[i].desc + ')'); }
}

/* ----- enemies / combat ----- */
function buildEnemies() {
  const list = document.getElementById('enemy-list');
  ENEMIES.forEach((spec) => {
    const enemy = { ...spec, maxHp: spec.hp };
    state.enemies.push(enemy);

    const card = el('div', 'enemy');
    card.dataset.enemy = enemy.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Attack ' + enemy.name);

    const head = el('div', 'enemy-head');
    head.appendChild(el('span', 'enemy-icon', enemy.icon));
    head.appendChild(el('span', 'enemy-name', enemy.name));
    head.appendChild(el('span', 'enemy-hp', enemy.hp + '/' + enemy.maxHp));
    card.appendChild(head);

    const bar = el('div', 'hp-bar');
    const fill = el('div', 'hp-fill');
    bar.appendChild(fill);
    card.appendChild(bar);

    const sol = el('div', 'enemy-solution', '✔ ' + enemy.solution + ' → ' + enemy.reward);
    card.appendChild(sol);

    const attack = () => attackEnemy(enemy, card);
    card.addEventListener('click', attack);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); attack(); } });
    list.appendChild(card);
  });
}

function attackEnemy(enemy, card) {
  if (enemy.hp <= 0) return;
  const w = WEAPONS[state.selectedWeapon];
  const btn = document.querySelector('.weapon[data-weapon="' + state.selectedWeapon + '"]');
  if (btn && btn.classList.contains('cooling')) { state.audio.denied(); log('COOLDOWN — ' + w.name + ' not ready'); return; }

  let dmg = Math.floor(w.damage * 1.25); // house rule: 1.25x multiplier
  const crit = Math.random() < 0.15;
  if (crit) { dmg += Math.floor(w.damage * 0.5); state.styleRank += 10; state.audio.crit(); log('CRITICAL HIT on ' + enemy.name + ' for ' + dmg, 'good'); }
  else { state.audio.hit(); log('HIT ' + enemy.name + ' for ' + dmg + ' (' + w.name + ')'); }

  enemy.hp = Math.max(0, enemy.hp - dmg);
  card.querySelector('.hp-fill').style.width = (enemy.hp / enemy.maxHp * 100) + '%';
  card.querySelector('.enemy-hp').textContent = enemy.hp + '/' + enemy.maxHp;

  if (btn) {
    btn.classList.add('cooling');
    setTimeout(() => btn.classList.remove('cooling'), w.cooldown);
  }

  if (enemy.hp <= 0) killEnemy(enemy, card);
  updateHUD();
}

function killEnemy(enemy, card) {
  card.classList.add('defeated');
  state.audio.kill();
  state.xp += 50;
  if (state.xp >= state.level * 100) { state.level++; log('LEVEL UP → ' + state.level, 'good'); }
  log('KILLED ' + enemy.name + ' — ' + enemy.solution, 'good');
  log('REWARD: ' + enemy.reward + ' (+50 XP)', 'good');
  checkObjective(enemy.id);
  if (state.enemies.every(e => e.hp <= 0)) {
    log('MISSION COMPLETE — all gate findings engaged. See gate-verdict.agent-readable.v1.json for the live verdict.', 'good');
  }
}

function buildObjectives() {
  const list = document.getElementById('objective-list');
  const first = el('li', 'complete', '✅ Ship bootstrap.py one-command install');
  list.appendChild(first);
  ENEMIES.forEach((e) => {
    const li = el('li', null, '⏳ Defeat: ' + e.name);
    li.id = 'objective-' + e.id;
    list.appendChild(li);
  });
}

function checkObjective(enemyId) {
  const li = document.getElementById('objective-' + enemyId);
  if (li) { li.classList.add('complete'); li.textContent = '✅ Defeated: ' + ENEMIES.find(e => e.id === enemyId).name; }
}

/* ----- init ----- */
export function initUI() {
  state.audio = new AudioManager();
  state.logEl = document.getElementById('combat-log');
  state.hud = {
    armor: document.getElementById('hud-armor'),
    packs: document.getElementById('hud-packs'),
    style: document.getElementById('hud-style'),
    mission: document.getElementById('hud-mission')
  };

  buildContainers();
  buildWeapons();
  buildEnemies();
  buildObjectives();

  document.getElementById('dossier-close').addEventListener('click', closeDossier);
  document.getElementById('dossier').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDossier();
  });

  const toggle = document.getElementById('audio-toggle');
  toggle.addEventListener('click', () => {
    const on = state.audio.toggle();
    toggle.setAttribute('aria-pressed', String(on));
    toggle.textContent = on ? '🔊 SOUND' : '🔇 SOUND';
    log(on ? 'Audio online (WebAudio synth, no files)' : 'Audio muted', 'sys');
  });

  updateHUD();
  log('SYSTEM: crew manifest loaded — 6 packs, 4 containers, 4 threats', 'sys');
  log('SYSTEM: select a pack (keys 1-4), click a threat to engage', 'sys');
}
