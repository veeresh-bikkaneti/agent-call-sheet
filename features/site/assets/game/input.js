// input.js: mouse, keyboard, touch and gamepad. Turns raw input into camera
// moves on view.cam and into calls on the api the game passes in:
//   api.mode()      -> 'play' | 'photo' | 'menu' | 'title' | 'tour'
//   api.settings()  -> { camSpeed, invertY }
//   api.hover(pt)   pt = { x, z } on the terrain, or null
//   api.press(pt), api.drag(pt), api.release()
//   api.cmd(name, arg)
//   api.menuNav(dir), api.menuActivate()

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export function createInput({ canvas, view, api }) {
  const cam = view.cam;
  const keys = new Set();
  const pointers = new Map();          // pointerId -> { x, y, type }
  let drag = null;                     // { kind: 'tool' | 'orbit' | 'pan', lastX, lastY }
  let gesture = null;                  // two-finger state
  let lastHover = { x: innerWidth / 2, y: innerHeight / 2 };
  const speed = () => api.settings().camSpeed || 1;
  const invert = () => (api.settings().invertY ? -1 : 1);

  function orbit(dx, dy) {
    cam.goal = null;
    cam.yaw -= dx * 0.006 * speed();
    cam.pitch = clamp(cam.pitch + dy * 0.005 * speed() * invert(), 0.18, 1.35);
  }
  function pan(dx, dy) {
    cam.goal = null;
    const k = cam.dist * 0.0016 * speed();
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    cam.tx -= (dx * c - dy * s) * k;
    cam.tz -= (-dx * s - dy * c) * k;
  }
  function zoom(f) { cam.goal = null; cam.dist = clamp(cam.dist * f, 6, 70); }
  const pickAt = (x, y) => view.pick(x, y);

  // ---------- pointer (mouse, pen and touch) ----------
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    api.cmd('gesture');
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const mode = api.mode();
    if (e.pointerType === 'touch' && pointers.size === 2) {
      if (drag && drag.kind === 'tool') api.release();
      drag = null;
      const [a, b] = [...pointers.values()];
      gesture = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
      return;
    }
    if (pointers.size > 1) return;
    let kind;
    if (e.button === 2) kind = 'orbit';
    else if (e.button === 1 || (e.button === 0 && e.shiftKey)) kind = 'pan';
    else if (mode === 'play') kind = 'tool';
    else if (mode === 'photo' || mode === 'title') kind = 'orbit';
    else return;
    drag = { kind, lastX: e.clientX, lastY: e.clientY };
    if (kind === 'tool') { const pt = pickAt(e.clientX, e.clientY); api.hover(pt); if (pt) api.press(pt); else drag = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (gesture && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      pan(cx - gesture.cx, cy - gesture.cy);
      if (d > 10 && gesture.d > 10) zoom(gesture.d / d);
      let da = ang - gesture.ang;
      if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
      cam.yaw -= da;
      Object.assign(gesture, { cx, cy, d, ang });
      return;
    }
    if (e.pointerType !== 'touch' || drag) lastHover = { x: e.clientX, y: e.clientY };
    if (!drag) { if (api.mode() === 'play' && e.pointerType !== 'touch') api.hover(pickAt(e.clientX, e.clientY)); return; }
    const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX; drag.lastY = e.clientY;
    if (drag.kind === 'orbit') orbit(dx, dy);
    else if (drag.kind === 'pan') pan(dx, dy);
    else { const pt = pickAt(e.clientX, e.clientY); api.hover(pt); if (pt) api.drag(pt); }
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) gesture = null;
    if (drag && drag.kind === 'tool') api.release();
    if (pointers.size === 0) drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) api.hover(null); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const m = api.mode();
    if (m === 'play' || m === 'photo' || m === 'title') zoom(Math.exp(clamp(e.deltaY, -200, 200) * 0.0012));
  }, { passive: false });

  // ---------- keyboard ----------
  let kbHeld = false;
  // Only take Space/Enter when focus is on the scene, so focused buttons and links keep them.
  const onScene = (t) => !t || t === document.body || t === document.documentElement || t === canvas;
  const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  window.addEventListener('keydown', (e) => {
    api.cmd('gesture');
    const mode = api.mode();
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { e.preventDefault(); api.cmd('escape'); return; }
    if (typing(e.target)) return;
    if (mode === 'play') {
      // Space or Enter presses at the hover point (screen centre until the mouse moves);
      // hold it and pan with WASD or the arrows to drag, let go to release.
      if ((e.code === 'Space' || e.code === 'Enter') && !ctrl && onScene(e.target)) {
        e.preventDefault();
        if (!e.repeat && !kbHeld) { const pt = pickAt(lastHover.x, lastHover.y); if (pt) { api.hover(pt); api.press(pt); kbHeld = true; } }
        return;
      }
      if (ctrl && (e.code === 'KeyZ')) { e.preventDefault(); api.cmd(e.shiftKey ? 'redo' : 'undo'); return; }
      if (ctrl && e.code === 'KeyY') { e.preventDefault(); api.cmd('redo'); return; }
      if (ctrl && e.code === 'KeyD') { e.preventDefault(); api.cmd('duplicate'); return; }
      if (ctrl) return;
      if (/^Digit[1-7]$/.test(e.code)) { api.cmd('toolIndex', Number(e.code.slice(5)) - 1); return; }
      switch (e.code) {
        case 'KeyB': api.cmd('tray'); return;
        case 'KeyR': api.cmd('rotate', e.shiftKey ? -1 : 1); return;
        case 'Delete': case 'Backspace': e.preventDefault(); api.cmd('delete'); return;
        case 'KeyG': api.cmd('snap'); return;
        case 'BracketLeft': api.cmd('brush', -1); return;
        case 'BracketRight': api.cmd('brush', 1); return;
        case 'KeyP': api.cmd('photo'); return;
        case 'KeyH': api.cmd('history'); return;
        default: break;
      }
    } else if (mode === 'photo') {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); api.cmd('capture'); return; }
      if (e.code === 'KeyP') { api.cmd('photo-exit'); return; }
    }
    if (/^(Arrow|Key[WASDQE]$)/.test(e.code) && (mode === 'play' || mode === 'photo')) {
      e.preventDefault();
      keys.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if ((e.code === 'Space' || e.code === 'Enter') && kbHeld) { kbHeld = false; api.release(); }
  });
  window.addEventListener('blur', () => { keys.clear(); if (kbHeld) { kbHeld = false; api.release(); } });
  window.addEventListener('blur', () => keys.clear());

  // ---------- gamepad ----------
  const padPrev = [];
  let padCursor = null, padActive = false, padHeld = false, repeatT = 0;
  // X: tap rotates (on release), hold for HOLD_DUP seconds duplicates.
  const HOLD_DUP = 0.45;
  let xT = 0, xDup = false;
  const pc = { x: innerWidth / 2, y: innerHeight / 2 };
  function ensureCursor() {
    if (padCursor) return;
    padCursor = document.createElement('div');
    padCursor.className = 'pad-cursor';
    padCursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(padCursor);
  }
  function readPad() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch { pads = []; }
    for (const p of pads || []) if (p && p.connected !== false) return p;
    return null;
  }
  function pollPad(dt) {
    const p = readPad();
    if (!p) { if (padCursor) padCursor.hidden = true; return; }
    const b = (k) => !!(p.buttons[k] && (p.buttons[k].pressed || p.buttons[k].value > 0.5));
    const v = (k) => (p.buttons[k] ? p.buttons[k].value || (p.buttons[k].pressed ? 1 : 0) : 0);
    const now = p.buttons.map((_, k) => b(k));
    const hit = (k) => now[k] && !padPrev[k];
    const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
    const any = now.some(Boolean) || lx || ly || rx || ry;
    if (any && !padActive) { padActive = true; api.cmd('gesture'); }
    const mode = api.mode();

    if (hit(9)) api.cmd('escape');
    if (mode === 'menu' || mode === 'title') {
      if (padCursor) padCursor.hidden = true;
      repeatT -= dt;
      const dir = now[12] || ly < -0.5 ? -1 : now[13] || ly > 0.5 ? 1 : now[14] || lx < -0.5 ? -1 : now[15] || lx > 0.5 ? 1 : 0;
      if (dir && repeatT <= 0) { api.menuNav(dir); repeatT = 0.22; }
      if (!dir) repeatT = 0;
      if (hit(0)) api.menuActivate();
      if (hit(1)) api.cmd('escape');
      if (mode === 'title' && rx) orbit(rx * dt * 400, 0);
    } else {
      // Right stick turns and tilts; triggers zoom.
      if (rx || ry) orbit(rx * dt * 420, ry * dt * 300);
      const zt = v(7) - v(6);
      if (Math.abs(zt) > 0.05) zoom(Math.exp(-zt * dt * 1.6));
      if (mode === 'play') {
        ensureCursor();
        padCursor.hidden = !padActive;
        pc.x = clamp(pc.x + lx * dt * 620, 0, innerWidth);
        pc.y = clamp(pc.y + ly * dt * 620, 0, innerHeight);
        // Push against the screen edge to pan.
        const ex = pc.x < 40 ? -1 : pc.x > innerWidth - 40 ? 1 : 0, ey = pc.y < 40 ? -1 : pc.y > innerHeight - 40 ? 1 : 0;
        if (ex || ey) pan(-ex * dt * 500, -ey * dt * 500);
        padCursor.style.left = pc.x + 'px';
        padCursor.style.top = pc.y + 'px';
        const pt = (lx || ly || ex || ey || hit(0) || now[0]) ? pickAt(pc.x, pc.y) : null;
        if (pt) api.hover(pt);
        if (hit(0) && pt) { api.press(pt); padHeld = true; }
        else if (now[0] && padHeld && pt) api.drag(pt);
        if (!now[0] && padHeld) { api.release(); padHeld = false; }
        if (hit(1)) api.cmd('back');
        if (hit(2)) { xT = 0; xDup = false; }
        if (now[2]) { xT += dt; if (xT >= HOLD_DUP && !xDup) { xDup = true; api.cmd('duplicate'); } }
        else if (padPrev[2] && !xDup) api.cmd('rotate', 1);
        if (hit(3)) api.cmd('delete');
        if (hit(4)) api.cmd('toolNext', -1);
        if (hit(5)) api.cmd('toolNext', 1);
        if (hit(8)) api.cmd('undo');
        if (hit(10)) api.cmd('redo');
        if (hit(11)) api.cmd('photo');
        if (hit(12)) api.cmd('brush', 1);
        if (hit(13)) api.cmd('brush', -1);
        if (hit(14)) api.cmd('itemNext', -1);
        if (hit(15)) api.cmd('itemNext', 1);
      } else if (mode === 'photo') {
        if (padCursor) padCursor.hidden = true;
        if (lx || ly) pan(-lx * dt * 500, -ly * dt * 500);
        if (hit(0)) api.cmd('capture');
        if (hit(1) || hit(11)) api.cmd('photo-exit');
        if (hit(14)) api.cmd('filterNext', -1);
        if (hit(15)) api.cmd('filterNext', 1);
      }
    }
    for (let k = 0; k < now.length; k++) padPrev[k] = now[k];
  }

  // Called every frame by the game loop.
  function update(dt) {
    const mode = api.mode();
    if (mode === 'play' || mode === 'photo') {
      let mx = 0, my = 0, turn = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyQ')) turn += 1;
      if (keys.has('KeyE')) turn -= 1;
      if (mx || my) pan(-mx * dt * 520, -my * dt * 520);
      if (turn) { cam.goal = null; cam.yaw += turn * dt * 1.4 * speed(); }
      if ((mx || my || turn) && mode === 'play' && !padActive) {
        const pt = pickAt(lastHover.x, lastHover.y);
        api.hover(pt);
        if (kbHeld && pt) api.drag(pt);
      }
    }
    pollPad(dt);
  }
  return { update, usingPad: () => padActive };
}
