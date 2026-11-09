// models.js: procedural low-poly models in a warm, hand-painted style.
// Every piece carries vertex colours with a little per-face jitter, so surfaces
// read like brushwork under the sun. Origin is at ground centre, +Y up, 1 unit = 1 cell.

import * as THREE from '../vendor/three/three.module.js';

const tmpColor = new THREE.Color();

// Jitter each triangle's colour a little: the painterly look.
function paint(geo, hex, jitter = 0.06, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const base = new THREE.Color(hex);
  let s = seed * 9301 + 49297;
  for (let t = 0; t < n; t += 3) {
    s = (s * 9301 + 49297) % 233280;
    const k = 1 + (s / 233280 - 0.5) * 2 * jitter;
    tmpColor.copy(base).multiplyScalar(k);
    for (let v = 0; v < 3 && t + v < n; v++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (t + v) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}
// Shade a geometry from bottom colour to top colour (sun-bleached tops, darker feet).
function gradient(geo, bottomHex, topHex, jitter = 0.05) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const pos = g.attributes.position, n = pos.count;
  const colors = new Float32Array(n * 3);
  const a = new THREE.Color(bottomHex), b = new THREE.Color(topHex);
  for (let t = 0; t < n; t += 3) {
    const y = (pos.getY(t) + pos.getY(Math.min(t + 1, n - 1)) + pos.getY(Math.min(t + 2, n - 1))) / 3;
    const f = (y - min.y) / Math.max(1e-6, max.y - min.y);
    tmpColor.copy(a).lerp(b, f).multiplyScalar(1 + (((t * 7919) % 101) / 101 - 0.5) * 2 * jitter);
    for (let v = 0; v < 3 && t + v < n; v++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (t + v) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), SC = new THREE.Vector3();
function at(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz); Q.setFromEuler(E); P.set(x, y, z); SC.set(sx, sy, sz);
  M.compose(P, Q, SC);
  geo.applyMatrix4(M);
  return geo;
}
// Merge non-indexed coloured geometries into one.
export function merge(list) {
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
const box = (w, h, d, c, j) => paint(new THREE.BoxGeometry(w, h, d), c, j);
const cyl = (rt, rb, h, seg, c, j) => paint(new THREE.CylinderGeometry(rt, rb, h, seg), c, j);
const cone = (r, h, seg, c, j) => paint(new THREE.ConeGeometry(r, h, seg), c, j);
const ico = (r, det, c, j) => paint(new THREE.IcosahedronGeometry(r, det), c, j);
const dome = (r, c, j, seg = 10) => paint(new THREE.SphereGeometry(r, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, j);

// Shared materials. Plants clone theirs so each can show its own thirst.
export const MAT = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 }),
  cloth: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffc56b }),
  window: new THREE.MeshStandardMaterial({ color: 0x3a2618, emissive: 0xffa040, emissiveIntensity: 0, roughness: 1 }),
};
export function plantMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, color: 0xffffff });
}

const ADOBE = [0xd9a066, 0xe2b07a, 0xc98b58, 0xe6bf8c];
const CLOTHS = [0xc0452f, 0x2f7f8f, 0xd9a42b, 0x8a3f7a, 0x3f7f4f, 0xe07a3a];

// Each builder returns { group, sway, cloth, water, glow, windows, plantMat }
function result(group) { return { group, sway: [], cloth: [], water: [], glow: [], windows: [], plantMat: null, spray: null }; }
function mesh(geo, mat = MAT.solid) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }

function windowsFor(r, parent, list) {
  // list of [x, y, z, ry, w, h]
  for (const [x, y, z, ry, w, h] of list) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.window);
    m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); r.windows.push(m);
  }
}

function adobeHome(variant, kind) {
  const g = new THREE.Group(), r = result(g);
  const c = ADOBE[variant % ADOBE.length];
  const parts = [
    gradient(at(new THREE.BoxGeometry(1.6, 1.1, 1.6), 0, 0.55, 0), 0xb57c4a, c),
    gradient(at(new THREE.BoxGeometry(1.7, 0.12, 1.7), 0, 1.16, 0), c, 0xf0d2a4),
    box(0.4, 0.62, 0.06, 0x5a3a22).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.31, 0.81)),
  ];
  // Roof parapet notches and protruding beams (vigas).
  for (let k = -2; k <= 2; k++) parts.push(at(box(0.08, 0.08, 0.36, 0x8a5a36), k * 0.32, 0.98, 0.86));
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) parts.push(at(box(0.26, 0.2, 0.26, c, 0.04), x, 1.3, z));
  if (kind === 'dome') parts.push(at(dome(0.62, 0xf3e3c8, 0.03), 0, 1.22, 0), at(cyl(0.05, 0.05, 0.3, 5, 0xc79a4a), 0, 1.95, 0));
  if (kind === 'tile') {
    parts.push(at(dome(0.64, 0x2c7d8f, 0.08, 12), 0, 1.22, 0), at(cyl(0.67, 0.67, 0.12, 12, 0xe8d9b8), 0, 1.22, 0));
    parts.push(at(box(1.62, 0.1, 1.62, 0x3c95a6, 0.05), 0, 0.82, 0));
  }
  if (kind === 'plain' && variant % 2 === 0) parts.push(at(box(0.7, 0.55, 0.7, c, 0.05), 0.35, 1.45, -0.35));
  g.add(mesh(merge(parts)));
  windowsFor(r, g, [[-0.45, 0.68, 0.81, 0, 0.22, 0.26], [0.45, 0.68, 0.81, 0, 0.22, 0.26], [0.81, 0.68, 0, Math.PI / 2, 0.22, 0.26]]);
  // A small cloth awning over the door.
  const aw = new THREE.Mesh(paint(new THREE.PlaneGeometry(0.7, 0.4, 4, 2), CLOTHS[variant % CLOTHS.length], 0.04), MAT.cloth);
  aw.position.set(0, 0.74, 0.98); aw.rotation.x = -1.0; aw.castShadow = true; g.add(aw); r.cloth.push(aw);
  return r;
}
function windTower() {
  const g = new THREE.Group(), r = result(g);
  const parts = [gradient(at(new THREE.BoxGeometry(0.72, 2.6, 0.72), 0, 1.3, 0), 0xb57c4a, 0xeac08e),
    at(box(0.82, 0.12, 0.82, 0xf0d2a4), 0, 2.66, 0)];
  for (let s = 0; s < 4; s++) for (let k = 0; k < 3; k++) {
    const a = s * Math.PI / 2, x = Math.sin(a) * 0.37, z = Math.cos(a) * 0.37;
    parts.push(at(box(0.1, 0.5, 0.04, 0x3d2616), x + Math.cos(a) * (k - 1) * 0.18, 2.25, z - Math.sin(a) * (k - 1) * 0.18, 0, a));
  }
  g.add(mesh(merge(parts)));
  return r;
}
function clothCanopy(r, g, w, d, y, color, segs = 6) {
  const m = new THREE.Mesh(paint(new THREE.PlaneGeometry(w, d, segs, segs), color, 0.05), MAT.cloth);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = true; m.receiveShadow = true;
  g.add(m); r.cloth.push(m);
  return m;
}
function courtyard() {
  const g = new THREE.Group(), r = result(g);
  const parts = [paint(at(new THREE.BoxGeometry(2.9, 0.06, 2.9), 0, 0.03, 0), 0xc76f4a, 0.1)];
  // Low walls with an entrance on the south side.
  const wall = (x, z, w, d) => parts.push(gradient(at(new THREE.BoxGeometry(w, 0.7, d), x, 0.35, z), 0xb57c4a, 0xe8bf8c));
  wall(0, -1.4, 2.9, 0.18); wall(-1.4, 0, 0.18, 2.9); wall(1.4, 0, 0.18, 2.9); wall(-0.95, 1.4, 1.0, 0.18); wall(0.95, 1.4, 1.0, 0.18);
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) parts.push(at(cyl(0.07, 0.08, 1.7, 6, 0x7b5434), x, 0.85, z));
  parts.push(at(cyl(0.38, 0.42, 0.35, 8, 0xd9a066), 0, 0.18, 0), at(ico(0.36, 0, 0x5e8c3a, 0.12), 0, 0.55, 0));
  g.add(mesh(merge(parts)));
  clothCanopy(r, g, 2.6, 2.6, 1.7, 0xf2e2c4, 8);
  return r;
}
function market(variant) {
  const g = new THREE.Group(), r = result(g);
  const parts = [paint(at(new THREE.BoxGeometry(2.9, 0.05, 1.9), 0, 0.025, 0), 0xd9b98a, 0.08)];
  for (let s = 0; s < 3; s++) {
    const x = (s - 1) * 0.95;
    for (const [dx, dz] of [[-0.4, -0.7], [0.4, -0.7], [-0.4, 0.7], [0.4, 0.7]]) parts.push(at(cyl(0.04, 0.04, 1.3, 5, 0x6d4a2c), x + dx, 0.65, dz));
    parts.push(at(box(0.8, 0.4, 0.5, 0x8a5a36), x, 0.2, 0.2));
    const goods = [0xd9732b, 0xc23b2b, 0x6b8f3a, 0xe8c547, 0x8a3f7a];
    for (let k = 0; k < 4; k++) parts.push(at(ico(0.09, 0, goods[(s + k + variant) % goods.length], 0.1), x - 0.27 + k * 0.18, 0.48, 0.2));
    parts.push(at(cyl(0.12, 0.09, 0.26, 7, 0x2f6f8f), x + 0.25, 0.13, -0.45), at(cyl(0.1, 0.08, 0.22, 7, 0xc76f4a), x - 0.25, 0.11, -0.45));
    const aw = new THREE.Mesh(paint(new THREE.PlaneGeometry(0.95, 1.6, 4, 4), CLOTHS[(s + variant) % CLOTHS.length], 0.05), MAT.cloth);
    aw.rotation.x = -Math.PI / 2 + 0.12; aw.position.set(x, 1.32, 0); aw.castShadow = true; g.add(aw); r.cloth.push(aw);
  }
  g.add(mesh(merge(parts)));
  return r;
}
function bathhouse() {
  const g = new THREE.Group(), r = result(g);
  const parts = [gradient(at(new THREE.BoxGeometry(2.8, 1.0, 1.7), 0, 0.5, -0.55), 0xb57c4a, 0xead1a8)];
  parts.push(at(dome(0.55, 0xf2e6d0, 0.03), -0.7, 1.0, -0.55), at(dome(0.7, 0xf2e6d0, 0.03), 0.45, 1.0, -0.55));
  for (const [x, z] of [[-0.7, -0.55], [0.45, -0.55]]) parts.push(at(cyl(0.06, 0.06, 0.18, 6, 0xf6d36b), x, x < 0 ? 1.6 : 1.75, z));
  parts.push(paint(at(new THREE.BoxGeometry(2.8, 0.25, 1.1), 0, 0.12, 0.85), 0xe8d9b8, 0.05));
  g.add(mesh(merge(parts)));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), null);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.26, 0.85); g.add(water); r.water.push(water);
  windowsFor(r, g, [[-1.0, 0.55, 0.31, 0, 0.24, 0.3], [0, 0.55, 0.31, 0, 0.3, 0.42], [1.0, 0.55, 0.31, 0, 0.24, 0.3]]);
  return r;
}
function well() {
  const g = new THREE.Group(), r = result(g);
  const parts = [paint(new THREE.CylinderGeometry(0.42, 0.46, 0.5, 10, 1, true), 0xb8a07a, 0.12)];
  parts[0].applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.25, 0));
  parts.push(at(cyl(0.48, 0.48, 0.08, 10, 0xd8c4a0), 0, 0.5, 0));
  for (const x of [-0.42, 0.42]) parts.push(at(box(0.07, 1.1, 0.07, 0x6d4a2c), x, 0.85, 0));
  parts.push(at(cyl(0.035, 0.035, 0.95, 5, 0x5a3a22), 0, 1.3, 0, 0, 0, Math.PI / 2), at(cyl(0.09, 0.07, 0.14, 6, 0x8a5a36), 0.1, 0.95, 0));
  parts.push(at(cone(0.62, 0.35, 4, 0xc76f4a, 0.06), 0, 1.55, 0, 0, Math.PI / 4));
  g.add(mesh(merge(parts)));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10), null);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.36; g.add(water); r.water.push(water);
  return r;
}
export function aqueduct(deck) {
  const g = new THREE.Group(), r = result(g);
  const h = Math.max(0.6, deck);
  const parts = [];
  for (const x of [-0.38, 0.38]) parts.push(gradient(at(new THREE.BoxGeometry(0.22, h, 0.9), x, h / 2, 0), 0xa9784a, 0xe2c08e));
  parts.push(gradient(at(new THREE.BoxGeometry(1.0, 0.22, 1.0), 0, h + 0.05, 0), 0xc99a62, 0xeccb98));
  parts.push(at(box(1.0, 0.14, 0.12, 0xd8b480), 0, h + 0.22, 0.44), at(box(1.0, 0.14, 0.12, 0xd8b480), 0, h + 0.22, -0.44));
  g.add(mesh(merge(parts)));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.76), null);
  water.rotation.x = -Math.PI / 2; water.position.y = h + 0.2; g.add(water); r.water.push(water);
  return r;
}
function bridge() {
  const g = new THREE.Group(), r = result(g);
  const parts = [];
  const seg = 7;
  for (let k = 0; k < seg; k++) {
    const t = k / (seg - 1), x = (t - 0.5) * 1.2, y = 0.18 + Math.sin(t * Math.PI) * 0.22;
    parts.push(at(box(0.2, 0.07, 0.62, k % 2 ? 0x8a5a36 : 0x9c6a40, 0.06), x, y, 0, 0, 0, Math.cos(t * Math.PI) * 0.35));
  }
  for (const z of [-0.31, 0.31]) for (const x of [-0.5, 0, 0.5]) parts.push(at(cyl(0.025, 0.025, 0.42, 4, 0x5a3a22), x, 0.4 + (x === 0 ? 0.2 : 0.05), z));
  for (const z of [-0.31, 0.31]) parts.push(at(cyl(0.02, 0.02, 1.2, 4, 0x6d4a2c), 0, 0.62, z, 0, 0, Math.PI / 2));
  g.add(mesh(merge(parts)));
  return r;
}
function fountain() {
  const g = new THREE.Group(), r = result(g);
  const parts = [paint(at(new THREE.CylinderGeometry(0.95, 1.0, 0.36, 8, 1, true), 0, 0.18, 0), 0xe8d9b8, 0.06),
    at(cyl(1.02, 1.02, 0.07, 8, 0xf2e6d0), 0, 0.37, 0), at(cyl(0.12, 0.18, 0.9, 8, 0xe2cfa8), 0, 0.45, 0),
    at(cyl(0.38, 0.25, 0.1, 8, 0x3c95a6, 0.08), 0, 0.9, 0), at(cyl(0.06, 0.08, 0.3, 6, 0xe2cfa8), 0, 1.05, 0)];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; parts.push(at(box(0.16, 0.08, 0.06, 0x2c7d8f), Math.cos(a) * 0.99, 0.3, Math.sin(a) * 0.99, 0, -a)); }
  g.add(mesh(merge(parts)));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.93, 8), null);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.3; g.add(water); r.water.push(water);
  r.spray = new THREE.Vector3(0, 1.2, 0);
  return r;
}
function pool() {
  const g = new THREE.Group(), r = result(g);
  const parts = [paint(at(new THREE.BoxGeometry(1.9, 0.16, 2.9), 0, 0.02, 0), 0xe8d9b8, 0.05)];
  for (const [x, z, w, d] of [[0, -1.45, 2.0, 0.14], [0, 1.45, 2.0, 0.14], [-0.95, 0, 0.14, 2.9], [0.95, 0, 0.14, 2.9]]) parts.push(at(box(w, 0.2, d, 0xf2e6d0, 0.04), x, 0.12, z));
  g.add(mesh(merge(parts)));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.75), null);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.16; g.add(water); r.water.push(water);
  return r;
}
function palm(variant) {
  const g = new THREE.Group(), r = result(g);
  const mat = plantMaterial(); r.plantMat = mat;
  const trunk = [];
  const H = 2.2 + (variant % 3) * 0.35, segs = 7, lean = 0.18 + (variant % 4) * 0.05;
  let x = 0, y = 0;
  for (let k = 0; k < segs; k++) {
    const t = k / segs, len = H / segs;
    const ang = lean * t;
    trunk.push(at(cyl(0.09 - t * 0.03, 0.11 - t * 0.03, len * 1.05, 6, k % 2 ? 0x8a6a44 : 0x7a5a38, 0.05), x, y + len / 2, 0, 0, 0, -ang));
    x += Math.sin(ang) * len; y += Math.cos(ang) * len;
  }
  g.add(mesh(merge(trunk)));
  const crown = new THREE.Group(); crown.position.set(x, y, 0); g.add(crown);
  const fr = [];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + variant;
    const leaf = paint(new THREE.ConeGeometry(0.16, 1.25, 3), k % 2 ? 0x4f8a35 : 0x5f9a3c, 0.08);
    leaf.scale(1, 1, 0.25);
    fr.push(at(leaf, Math.cos(a) * 0.5, -0.12, Math.sin(a) * 0.5, 0, -a, 0).applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -1.25)));
  }
  fr.push(at(ico(0.12, 0, 0xb5782a, 0.1), 0.06, -0.2, 0.05), at(ico(0.1, 0, 0xa0662a, 0.1), -0.06, -0.24, -0.04));
  const cm = new THREE.Mesh(merge(fr), mat); cm.castShadow = true; crown.add(cm);
  r.sway.push(crown);
  return r;
}
function crops(variant) {
  const g = new THREE.Group(), r = result(g);
  const mat = plantMaterial(); r.plantMat = mat;
  const parts = [paint(at(new THREE.BoxGeometry(0.92, 0.06, 0.92), 0, 0.03, 0), 0x7a5232, 0.1)];
  const tuft = variant % 2 ? 0x7aa83f : 0x8fb04a;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) parts.push(at(cone(0.08, 0.32, 4, tuft, 0.12), -0.3 + a * 0.3, 0.2, -0.33 + b * 0.22));
  const m = new THREE.Mesh(merge(parts), mat); m.receiveShadow = true; m.castShadow = true; g.add(m);
  r.sway.push(m);
  return r;
}
function gardenBed() {
  const g = new THREE.Group(), r = result(g);
  const mat = plantMaterial(); r.plantMat = mat;
  const parts = [paint(at(new THREE.BoxGeometry(1.9, 0.14, 1.9), 0, 0.07, 0), 0x6f4a2c, 0.1)];
  for (let k = 0; k < 6; k++) {
    const x = ((k % 3) - 1) * 0.6, z = (k < 3 ? -0.45 : 0.45);
    parts.push(at(ico(0.34, 0, 0x4a7f36, 0.12), x, 0.42, z, 0, k, 0, 1, 0.8, 1));
    for (let f = 0; f < 4; f++) parts.push(at(ico(0.06, 0, f % 2 ? 0xe86fa0 : 0xf2a0c0, 0.05), x + Math.cos(f * 1.7 + k) * 0.25, 0.62 + (f % 2) * 0.06, z + Math.sin(f * 1.7 + k) * 0.25));
  }
  const m = new THREE.Mesh(merge(parts), mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  r.sway.push(m);
  return r;
}
function pomegranate() {
  const g = new THREE.Group(), r = result(g);
  const mat = plantMaterial(); r.plantMat = mat;
  g.add(mesh(merge([at(cyl(0.06, 0.09, 0.8, 6, 0x6d4a2c), 0, 0.4, 0)])));
  const canopy = new THREE.Group(); canopy.position.y = 0.9; g.add(canopy);
  const parts = [at(ico(0.5, 1, 0x3f7a3a, 0.12), 0, 0.15, 0, 0, 0, 0, 1, 0.8, 1)];
  for (let k = 0; k < 7; k++) parts.push(at(ico(0.07, 0, 0xc0302a, 0.05), Math.cos(k * 0.9) * 0.42, Math.sin(k * 1.7) * 0.2 + 0.05, Math.sin(k * 0.9) * 0.42));
  const m = new THREE.Mesh(merge(parts), mat); m.castShadow = true; canopy.add(m);
  r.sway.push(canopy);
  return r;
}
let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,220,150,1)'); grd.addColorStop(0.35, 'rgba(255,170,80,0.5)'); grd.addColorStop(1, 'rgba(255,140,40,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}
function lantern() {
  const g = new THREE.Group(), r = result(g);
  g.add(mesh(merge([at(cyl(0.035, 0.05, 1.3, 5, 0x3d2a1a), 0, 0.65, 0), at(box(0.3, 0.04, 0.04, 0x3d2a1a), 0.12, 1.28, 0),
    at(cone(0.12, 0.12, 6, 0x5a3a22), 0.24, 1.2, 0)])));
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), MAT.glow);
  lamp.position.set(0.24, 1.07, 0); g.add(lamp);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.scale.set(1.4, 1.4, 1); halo.position.copy(lamp.position); g.add(halo);
  r.glow.push(halo);
  return r;
}
function ceramics(variant) {
  const g = new THREE.Group(), r = result(g);
  const jar = (h, c) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector2(0.04 + Math.sin(t * Math.PI) * 0.16 * h + (t > 0.85 ? 0.02 : 0), t * 0.5 * h)); }
    return paint(new THREE.LatheGeometry(pts, 8), c, 0.06);
  };
  const cols = [0x2c7d8f, 0xc76f4a, 0xe8d9b8, 0x3c95a6];
  g.add(mesh(merge([at(jar(1.2, cols[variant % 4]), -0.18, 0, -0.1), at(jar(0.9, cols[(variant + 1) % 4]), 0.2, 0, 0.05), at(jar(0.7, cols[(variant + 2) % 4]), -0.05, 0, 0.25)])));
  return r;
}
function textiles(variant) {
  const g = new THREE.Group(), r = result(g);
  g.add(mesh(merge([at(cyl(0.03, 0.03, 1.4, 5, 0x5a3a22), -0.4, 0.7, 0), at(cyl(0.03, 0.03, 1.4, 5, 0x5a3a22), 0.4, 0.7, 0),
    at(cyl(0.025, 0.025, 0.85, 5, 0x5a3a22), 0, 1.38, 0, 0, 0, Math.PI / 2)])));
  for (let k = 0; k < 2; k++) {
    const m = new THREE.Mesh(paint(new THREE.PlaneGeometry(0.36, 0.95, 2, 6), CLOTHS[(variant + k * 2) % CLOTHS.length], 0.05), MAT.cloth);
    m.position.set(-0.19 + k * 0.38, 0.88, 0); m.castShadow = true; g.add(m); r.cloth.push(m);
  }
  return r;
}
function bench() {
  const g = new THREE.Group(), r = result(g);
  g.add(mesh(merge([at(box(0.8, 0.1, 0.3, 0xd8c4a0), 0, 0.35, 0), at(box(0.12, 0.32, 0.26, 0xc4ad86), -0.3, 0.16, 0), at(box(0.12, 0.32, 0.26, 0xc4ad86), 0.3, 0.16, 0)])));
  return r;
}
function spring() {
  const g = new THREE.Group(), r = result(g);
  const parts = [];
  for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2; parts.push(at(ico(0.22 + (k % 3) * 0.05, 0, k % 2 ? 0xa48a68 : 0x8f7656, 0.1), Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95, k, k * 2, 0, 1, 0.6, 1)); }
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3; parts.push(at(cone(0.04, 0.7, 3, 0x5f8a35, 0.15), Math.cos(a) * 1.05, 0.35, Math.sin(a) * 1.05, Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2)); }
  g.add(mesh(merge(parts)));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), null);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.05; g.add(water); r.water.push(water);
  r.spray = new THREE.Vector3(0, 0.2, 0);
  return r;
}

export function buildItem(type, variant = 0) {
  switch (type) {
    case 'home': return adobeHome(variant, 'plain');
    case 'domeHome': return adobeHome(variant, 'dome');
    case 'tileHome': return adobeHome(variant, 'tile');
    case 'windTower': return windTower();
    case 'courtyard': return courtyard();
    case 'market': return market(variant);
    case 'bathhouse': return bathhouse();
    case 'well': return well();
    case 'aqueduct': return aqueduct(0.9);
    case 'bridge': return bridge();
    case 'fountain': return fountain();
    case 'pool': return pool();
    case 'palm': return palm(variant);
    case 'crops': return crops(variant);
    case 'garden': return gardenBed();
    case 'pomegranate': return pomegranate();
    case 'lantern': return lantern();
    case 'ceramics': return ceramics(variant);
    case 'textiles': return textiles(variant);
    case 'bench': return bench();
    case 'spring': return spring();
    default: return result(new THREE.Group());
  }
}

// Hidden marvels.
export function buildHidden(kind) {
  const g = new THREE.Group(), r = result(g);
  if (kind === 'ruin') {
    const parts = [];
    const cols = [[-0.6, 1.4], [0.5, 0.7], [0.6, 1.8], [-0.4, 0.5]];
    cols.forEach(([x, h], k) => parts.push(at(cyl(0.16, 0.19, h, 8, 0xd8bf96, 0.08), x, h / 2, (k % 2 ? 0.5 : -0.5))));
    parts.push(at(box(1.4, 0.25, 0.32, 0xcfb488, 0.06), 0.05, 1.9, 0.5, 0, 0, 0.05), at(box(0.9, 0.3, 0.4, 0xc4a87c), 0.3, 0.12, -0.9, 0.2, 0.6, 0));
    parts.push(at(ico(0.25, 0, 0xb89c74), -1.0, 0.1, 0.3));
    g.add(mesh(merge(parts)));
  } else if (kind === 'overlook') {
    const parts = [];
    for (let k = 0; k < 5; k++) parts.push(at(ico(0.28 - k * 0.04, 0, k % 2 ? 0xa89070 : 0x968060, 0.1), (k % 2) * 0.05, 0.18 + k * 0.32, 0, k, k, 0, 1, 0.7, 1));
    parts.push(at(cyl(0.02, 0.02, 1.2, 4, 0x5a3a22), 0.1, 2.0, 0));
    g.add(mesh(merge(parts)));
    const flag = new THREE.Mesh(paint(new THREE.PlaneGeometry(0.5, 0.3, 3, 1), 0xc0452f, 0.03), MAT.cloth);
    flag.position.set(0.36, 2.45, 0); g.add(flag); r.cloth.push(flag);
  } else {
    const parts = [];
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; parts.push(at(cone(0.05, 0.35, 3, 0x4f7a35), Math.cos(a) * 0.15, 0.17, Math.sin(a) * 0.15, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4)); }
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; parts.push(at(ico(0.08, 0, 0xd83a9a, 0.05), Math.cos(a) * 0.18, 0.4, Math.sin(a) * 0.18)); }
    parts.push(at(ico(0.07, 0, 0xffe066), 0, 0.42, 0));
    g.add(mesh(merge(parts)));
  }
  return r;
}

// A resident: robe, head and headscarf. Colours vary per person.
export function buildResident(seed) {
  const robes = [0xf2e6d0, 0x2f6f8f, 0xc0452f, 0xd9a42b, 0x6b4a7a, 0x3f7f4f, 0xe8b07a];
  const scarves = [0xffffff, 0xc0452f, 0x2c7d8f, 0xe8c547, 0x3d2a1a];
  const geo = merge([
    at(cone(0.16, 0.62, 6, robes[seed % robes.length], 0.05), 0, 0.31, 0),
    at(ico(0.1, 0, 0x8a5a3a, 0.04), 0, 0.68, 0),
    at(cone(0.12, 0.16, 6, scarves[(seed * 3) % scarves.length], 0.05), 0, 0.78, 0),
  ]);
  const m = new THREE.Mesh(geo, MAT.solid); m.castShadow = true;
  return m;
}
