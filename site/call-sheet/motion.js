// motion.js — scroll-synced mission briefing animation
import { AGENDA, FIRST_CALL, WRAP_MAX, TOTAL_SPAN } from './agenda.js';

const cards = [];
const markers = [];
let rafId = null;
let rects = [];
let scrollHeight = 0;
let innerHeight = 0;

function normalize(t) {
  return (t - FIRST_CALL) / TOTAL_SPAN;
}

function getScrollProgress() {
  const maxScroll = scrollHeight - innerHeight;
  if (maxScroll <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / maxScroll));
}

function computeActiveIndex(progress) {
  let active = -1;
  for (let i = 0; i < AGENDA.length; i++) {
    if (normalize(AGENDA[i].startMin) <= progress) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

function updateStates() {
  const progress = getScrollProgress();
  const activeIndex = computeActiveIndex(progress);

  // Update rail fill
  const fill = document.querySelector('.rail-fill');
  if (fill) {
    fill.style.transform = `scaleY(${progress})`;
  }

  // Update cards and markers
  AGENDA.forEach((item, i) => {
    const wrap = document.getElementById(item.id);
    const marker = document.querySelector(`.rail-marker[data-index="${i}"]`);
    
    if (!wrap) return;

    const startNorm = normalize(item.startMin);
    let newState;

    if (i === activeIndex) {
      newState = 'active';
    } else if (startNorm < progress) {
      newState = 'complete';
    } else {
      newState = 'upcoming';
    }

    if (wrap.dataset.state !== newState) {
      wrap.dataset.state = newState;
    }

    if (marker) {
      marker.classList.toggle('active', i === activeIndex);
    }
  });
}

function onScroll() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    updateStates();
    rafId = null;
  });
}

function onResize() {
  // Recalculate cached dimensions
  scrollHeight = document.documentElement.scrollHeight;
  innerHeight = window.innerHeight;
  rects = cards.map(card => card.getBoundingClientRect());
}

function initRail() {
  const railTrack = document.querySelector('.rail-track');
  if (!railTrack) return;

  AGENDA.forEach((item, i) => {
    const marker = document.createElement('button');
    marker.className = 'rail-marker';
    marker.dataset.index = i;
    marker.dataset.time = formatTime(item.startMin);
    marker.setAttribute('aria-label', `Jump to ${formatTime(item.startMin)} call, ${item.name}`);
    marker.style.top = `${normalize(item.startMin) * 100}%`;
    
    marker.addEventListener('click', () => {
      const card = document.getElementById(item.id);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    railTrack.appendChild(marker);
    markers.push(marker);
  });
}

function initCards() {
  const board = document.querySelector('.board');
  if (!board) return;

  AGENDA.forEach((item, i) => {
    const wrap = document.createElement('article');
    wrap.className = 'card-wrap';
    wrap.id = item.id;
    wrap.dataset.state = 'upcoming';
    wrap.style.setProperty('--d', (i * 90).toString());

    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;

    // Scan texture
    const scan = document.createElement('div');
    scan.className = 'card__scan';

    // Tab with status chip
    const tab = document.createElement('div');
    tab.className = 'card__tab';
    
    const statusChip = document.createElement('span');
    statusChip.className = `status-chip ${item.status}`;
    statusChip.textContent = item.status.toUpperCase();
    
    const timeEl = document.createElement('span');
    timeEl.className = 'card__time';
    timeEl.textContent = `${formatTime(item.startMin)} – ${formatTime(item.endMin)}`;

    tab.appendChild(statusChip);
    tab.appendChild(timeEl);

    // Body
    const body = document.createElement('div');
    body.className = 'card__body';

    const fields = [
      { label: 'ROLE', value: item.role },
      { label: 'NAME', value: item.name, className: 'name' },
      { label: 'LOCATION', value: item.location },
      { label: 'PICKUP', value: item.pickup },
      { label: 'REPORT TO', value: item.reportTo }
    ];

    fields.forEach(f => {
      const field = document.createElement('div');
      field.className = 'field';
      
      const label = document.createElement('span');
      label.className = 'field-label';
      label.textContent = f.label;
      
      const value = document.createElement('span');
      value.className = `field-value ${f.className || ''}`;
      value.textContent = f.value;
      
      field.appendChild(label);
      field.appendChild(value);
      body.appendChild(field);
    });

    // Note
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = item.note;
    body.appendChild(note);

    // Check mark (SVG)
    const checkMark = document.createElement('div');
    checkMark.className = 'check-mark';
    checkMark.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10.5"/>
        <path d="M7 12l3 3 7-7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    `;

    card.appendChild(scan);
    card.appendChild(tab);
    card.appendChild(body);
    card.appendChild(checkMark);
    wrap.appendChild(card);
    board.appendChild(wrap);
    cards.push(wrap);
  });
}

function formatTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function initIntro() {
  // Eyebrow stagger
  const eyebrow = document.querySelector('.eyebrow');
  if (eyebrow) {
    eyebrow.style.animationDelay = '0ms';
  }

  // Meta chips stagger
  const chips = document.querySelectorAll('.chip');
  chips.forEach((chip, i) => {
    chip.style.animationDelay = `${120 + i * 70}ms`;
  });
}

function init() {
  initIntro();
  initRail();
  initCards();
  
  // Initial dimensions
  scrollHeight = document.documentElement.scrollHeight;
  innerHeight = window.innerHeight;
  
  // Initial state update
  updateStates();

  // Listeners
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(onResize, 150);
  });

  // Pointer tilt for cards
  if (window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerleave', onPointerLeave);
    });
  }

  // Keyboard: Enter/Space toggles note (if card expands)
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('expanded');
      }
    });
  });
}

function onPointerMove(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width - 0.5;
  const py = (e.clientY - rect.top) / rect.height - 0.5;
  
  const rotateY = px * 11;
  const rotateX = -py * 11;
  
  card.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  card.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
  card.style.setProperty('--my', `${(py + 0.5) * 100}%`);
  card.style.willChange = 'transform';
}

function onPointerLeave(e) {
  const card = e.currentTarget;
  card.style.transform = 'rotateY(0deg) rotateX(0deg)';
  card.style.removeProperty('--mx');
  card.style.removeProperty('--my');
  card.style.willChange = '';
}

document.addEventListener('DOMContentLoaded', init);