// world.js: the three.js view of the simulation. Terrain, water, sky and the
// day-to-night cycle, buildings, residents, particles, birds, the camera, the
// placement ghost and the brush cursor. Reads the sim; never changes game rules.

import * as THREE from '../vendor/three/three.module.js';
import { N, HALF, KIND, ITEMS } from './config.js';
import { cellBed, heightAt, cidx, worldToCell, footprint } from './sim.js';
import { buildItem, buildHidden, buildResident, aqueduct as buildAqueduct, MAT, getGlowTexture } from './models.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

// Sky palette through the day: [hour, zenith, horizon, sun colour, sun intensity, ambient sky, ambient ground, hemi intensity]
const PALETTE = [
  [0, 0x0b1430, 0x1d2850, 0x6f86c8, 0.12, 0x2a3a6a, 0x1a1620, 0.35],
  [4.8, 0x101a3a, 0x3a3560, 0x8090c0, 0.12, 0x34406a, 0x221a22, 0.38],
  [6.0, 0x46598f, 0xf0a070, 0xffa060, 0.9, 0x8090b0, 0x6a4a34, 0.6],
  [7.5, 0x5f8fc8, 0xf6cf9a, 0xffd2a0, 1.6, 0xa9c0e0, 0x9a6e44, 0.75],
  [12, 0x3f86d0, 0xd8e6ee, 0xfff1dc, 2.4, 0xbcd8f0, 0xb8875a, 0.85],
  [16.3, 0x4f86c4, 0xf2d6a6, 0xffd9a0, 2.0, 0xb0c8e0, 0xb07a4a, 0.8],
  [18.0, 0x5a6fa8, 0xf7a462, 0xff9a50, 1.4, 0xa09ab8, 0x8a5634, 0.7],
  [19.2, 0x2f3870, 0xd86a50, 0xff7040, 0.5, 0x5a5a88, 0x4a2e28, 0.5],
  [20.5, 0x111a40, 0x2e2c58, 0x7088c8, 0.14, 0x303c6c, 0x1c1620, 0.38],
  [24, 0x0b1430, 0x1d2850, 0x6f86c8, 0.12, 0x2a3a6a, 0x1a1620, 0.35],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function samplePalette(h) {
  let k = 0;
  while (k < PALETTE.length - 2 && PALETTE[k + 1][0] <= h) k++;
  const a = PALETTE[k], b = PALETTE[k + 1];
  const t = smooth(clamp((h - a[0]) / (b[0] - a[0]), 0, 1));
  const col = (i) => new THREE.Color().copy(cA.set(a[i])).lerp(cB.set(b[i]), t);
  return { zenith: col(1), horizon: col(2), sun: col(3), sunI: lerp(a[4], b[4], t), sky: col(5), ground: col(6), hemiI: lerp(a[7], b[7], t) };
}
export function nightAmount(h) {
  if (h >= 20.5 || h < 4.8) return 1;
  if (h >= 18.6) return smooth((h - 18.6) / 1.9);
  if (h < 6.3) return 1 - smooth((h - 4.8) / 1.5);
  return 0;
}

const WATER_VERT = `
  attribute float aWet;
  varying float vWet; varying vec3 vPos;
  void main(){ vWet = aWet; vec4 wp = modelMatrix * vec4(position,1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WATER_FRAG = `
  uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform float uNight; uniform float uPattern;
  varying float vWet; varying vec3 vPos;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
  void main(){
    vec2 p = vPos.xz * 1.6;
    float r = n(p + vec2(uTime*0.35, uTime*0.22)) * 0.6 + n(p*2.3 - vec2(uTime*0.5, -uTime*0.3)) * 0.4;
    vec3 col = mix(uDeep, uShallow, r);
    float spark = smoothstep(0.78, 0.95, n(p*3.1 + uTime*0.8)) * (1.0 - uNight*0.7);
    col += uSky * 0.18 + vec3(1.0, 0.95, 0.8) * spark * 0.45;
    if (uPattern > 0.5) { float stripe = step(0.5, fract((vPos.x + vPos.z) * 2.0)); col = mix(col, vec3(0.05,0.2,0.55), stripe*0.35); }
    col *= 1.0 - uNight * 0.55;
    gl_FragColor = vec4(col, clamp(vWet, 0.0, 1.0) * 0.86);
  }`;
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = `
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uHaze;
  varying vec3 vDir;
  void main(){
    float y = max(vDir.y, 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(y, 0.55));
    float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
    col = mix(col, uHorizon, uHaze * (1.0 - y));
    if (vDir.y < 0.0) col = uHorizon * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createView(canvas, { quality = 'high' } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: true });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
  scene.fog = new THREE.Fog(0xf2d6a6, 60, 190);

  // ---------- sky, sun, stars ----------
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uHaze: { value: 0 } },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let k = 0; k < 900; k++) {
    const u = Math.random(), v = Math.random() * 0.9 + 0.08;
    const th = u * Math.PI * 2, ph = Math.acos(v);
    sp.push(Math.sin(ph) * Math.cos(th) * 450, Math.cos(ph) * 450, Math.sin(ph) * Math.sin(th) * 450);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfff6e0, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const hemi = new THREE.HemisphereLight(0xbcd8f0, 0xb8875a, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  // ---------- terrain ----------
  const TV = N * N * 6;
  const tPos = new Float32Array(TV * 3), tCol = new Float32Array(TV * 3);
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.97, metalness: 0 });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);
  // A ring of far dunes so the world does not end at a hard edge.
  const farGeo = new THREE.RingGeometry(HALF * 1.35, 420, 48, 6);
  farGeo.rotateX(-Math.PI / 2);
  { const p = farGeo.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); const d = Math.hypot(x, z); p.setY(k, Math.sin(x * 0.05) * Math.cos(z * 0.04) * 3 + Math.max(0, d - 60) * 0.04 + 1.2); } farGeo.computeVertexNormals(); }
  const far = new THREE.Mesh(farGeo, new THREE.MeshStandardMaterial({ color: 0xd9a46a, roughness: 1, flatShading: true }));
  far.receiveShadow = true; scene.add(far);
  const farSkirt = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2.8, HALF * 2.8, 24, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd49c62, roughness: 1, flatShading: true }));
  farSkirt.position.y = -0.6; scene.add(farSkirt);

  const SAND = [new THREE.Color(0xe8b878), new THREE.Color(0xd9a060), new THREE.Color(0xf0c890)];
  const tmp = new THREE.Color();
  function cellColor(w, i, j, tri) {
    const c = cidx(i, j), k = w.kinds[c], bed = cellBed(w, i, j);
    const nseed = ((i * 73856093) ^ (j * 19349663) ^ (tri * 83492791)) >>> 0;
    const jit = ((nseed % 1000) / 1000 - 0.5) * 0.07;
    if (k === KIND.CHANNEL) tmp.set(w.wet[c] > 0.3 ? 0x7a6046 : 0xa4825c);
    else if (k === KIND.PATH) tmp.set(0xead6b0);
    else if (k === KIND.GARDEN || k === KIND.RESTORED) tmp.set(0x8a6a40).lerp(cA.set(0x6f8a3a), 0.25);
    else if (k === KIND.DRY) tmp.set(0xb88a5c);
    else if (k === KIND.ROCK) tmp.set(0x9a8268);
    else {
      tmp.copy(SAND[0]).lerp(SAND[1], clamp(0.5 - bed * 0.12, 0, 1)).lerp(SAND[2], clamp((bed - 1.4) * 0.25, 0, 0.8));
      // Damp sand near water darkens slightly; irrigated ground greens.
      let damp = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < N && jj < N && w.wet[cidx(ii, jj)] > 0.5) damp++; }
      if (damp) tmp.lerp(cA.set(0xa88458), Math.min(0.5, damp * 0.08));
    }
    const [cx, cz] = [i - HALF + 0.5, j - HALF + 0.5];
    const outside = Math.hypot(cx - w.boundary.cx, cz - w.boundary.cz) > w.boundary.r + 0.5;
    tmp.multiplyScalar(1 + jit - (outside ? 0.1 : 0));
    return tmp;
  }
  function rebuildTerrain(w) {
    let o = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x0 = i - HALF, z0 = j - HALF;
      const h00 = w.heights[j * (N + 1) + i], h10 = w.heights[j * (N + 1) + i + 1], h01 = w.heights[(j + 1) * (N + 1) + i], h11 = w.heights[(j + 1) * (N + 1) + i + 1];
      const flip = (i + j) % 2 === 0;
      const tris = flip
        ? [[x0, h00, z0], [x0, h01, z0 + 1], [x0 + 1, h10, z0], [x0 + 1, h10, z0], [x0, h01, z0 + 1], [x0 + 1, h11, z0 + 1]]
        : [[x0, h00, z0], [x0, h01, z0 + 1], [x0 + 1, h11, z0 + 1], [x0, h00, z0], [x0 + 1, h11, z0 + 1], [x0 + 1, h10, z0]];
      for (let t = 0; t < 2; t++) {
        const col = cellColor(w, i, j, t);
        for (let v = 0; v < 3; v++) {
          const p = tris[t * 3 + v];
          tPos[o * 3] = p[0]; tPos[o * 3 + 1] = p[1]; tPos[o * 3 + 2] = p[2];
          tCol[o * 3] = col.r; tCol[o * 3 + 1] = col.g; tCol[o * 3 + 2] = col.b;
          o++;
        }
      }
    }
    terrainGeo.attributes.position.needsUpdate = true;
    terrainGeo.attributes.color.needsUpdate = true;
    terrainGeo.computeVertexNormals();
    terrainGeo.computeBoundingSphere();
    terrainGeo.computeBoundingBox();
  }

  // ---------- water ----------
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x1f7f8c) }, uShallow: { value: new THREE.Color(0x5fc4c0) }, uSky: { value: new THREE.Color() }, uNight: { value: 0 }, uPattern: { value: 0 } },
  });
  const waterGeo = new THREE.BufferGeometry();
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.renderOrder = 2;
  scene.add(water);
  let waterKey = '';
  function rebuildWater(w) {
    const pos = [], wet = [];
    let key = '';
    for (let c = 0; c < N * N; c++) {
      const v = w.wet[c];
      if (v <= 0.02) continue;
      const i = c % N, j = (c / N) | 0;
      key += c + ':' + Math.round(v * 10) + ',';
      const y = cellBed(w, i, j) + 0.06 + 0.22 * v;
      const x0 = i - HALF, z0 = j - HALF;
      pos.push(x0, y, z0, x0, y, z0 + 1, x0 + 1, y, z0, x0 + 1, y, z0, x0, y, z0 + 1, x0 + 1, y, z0 + 1);
      for (let k = 0; k < 6; k++) wet.push(v);
    }
    if (key === waterKey) return;
    waterKey = key;
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    waterGeo.setAttribute('aWet', new THREE.Float32BufferAttribute(wet, 1));
    waterGeo.computeBoundingSphere();
  }
  const featureWaterMat = waterMat.clone();
  featureWaterMat.uniforms = waterMat.uniforms;
  featureWaterMat.vertexShader = `varying vec3 vPos; varying float vWet; void main(){ vWet = 1.0; vec4 wp = modelMatrix * vec4(position,1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

  // ---------- objects ----------
  const objRoot = new THREE.Group(); scene.add(objRoot);
  const views = new Map(); // id -> { obj, model, group }
  const hiddenRoot = new THREE.Group(); scene.add(hiddenRoot);
  const hiddenViews = [];
  const thirstyColor = new THREE.Color(0xc9a066), lushColor = new THREE.Color(0xffffff);

  function deckHeightFor(w, o) {
    let hi = -Infinity;
    const [i, j] = worldToCell(o.x, o.z);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const ii = clamp(i + a, 0, N - 1), jj = clamp(j + b, 0, N - 1);
      hi = Math.max(hi, cellBed(w, ii, jj));
    }
    return hi - cellBed(w, i, j) + 0.25;
  }
  function makeObjectView(w, o) {
    const model = o.type === 'aqueduct' ? buildAqueduct(deckHeightFor(w, o)) : buildItem(o.type, o.variant || (o.id % 7));
    for (const m of model.water) m.material = featureWaterMat;
    const g = model.group;
    g.userData.id = o.id;
    objRoot.add(g);
    return { obj: o, model, group: g, appear: 0, deck: o.type === 'aqueduct' ? deckHeightFor(w, o) : 0 };
  }
  function placeGroup(w, v) {
    const o = v.obj;
    const base = ITEMS[o.type].overCanal ? Math.max(...o.cells.map((c) => cellBed(w, c % N, (c / N) | 0))) + 0.1
      : o.cells.reduce((s, c) => s + cellBed(w, c % N, (c / N) | 0), 0) / o.cells.length;
    v.group.position.set(o.x, base, o.z);
    v.group.rotation.y = -o.rot;
  }
  function syncObjects(w) {
    const live = new Set();
    for (const o of w.objects) {
      live.add(o.id);
      let v = views.get(o.id);
      if (v && v.obj.type === 'aqueduct' && Math.abs(v.deck - deckHeightFor(w, o)) > 0.05) { objRoot.remove(v.group); views.delete(o.id); v = null; }
      if (!v) { v = makeObjectView(w, o); views.set(o.id, v); }
      v.obj = o;
      placeGroup(w, v);
    }
    for (const [id, v] of views) if (!live.has(id)) { objRoot.remove(v.group); views.delete(id); }
    // Hidden marvels.
    while (hiddenViews.length < w.hidden.length) {
      const h = w.hidden[hiddenViews.length];
      const m = buildHidden(h.kind);
      hiddenRoot.add(m.group);
      hiddenViews.push({ h, model: m });
    }
    while (hiddenViews.length > w.hidden.length) { const hv = hiddenViews.pop(); hiddenRoot.remove(hv.model.group); }
    hiddenViews.forEach((hv, k) => {
      hv.h = w.hidden[k];
      const y = heightAt(w, hv.h.x, hv.h.z);
      hv.model.group.position.set(hv.h.x, y - (hv.h.kind === 'ruin' && !hv.h.found ? 0.5 : 0), hv.h.z);
      hv.model.group.rotation.y = (hv.h.x * 13 + hv.h.z * 7) % 6;
    });
    syncBoundary(w);
  }

  // ---------- boundary ----------
  const boundaryLine = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xfff1d0, dashSize: 0.6, gapSize: 0.5, transparent: true, opacity: 0.75 }));
  scene.add(boundaryLine);
  let boundaryKey = '';
  function syncBoundary(w) {
    const b = w.boundary;
    const key = b.cx + ',' + b.cz + ',' + b.r.toFixed(2) + ',' + (w._terrainVersion || 0);
    if (key === boundaryKey) return;
    boundaryKey = key;
    const pts = [];
    for (let k = 0; k < 128; k++) {
      const a = k / 128 * Math.PI * 2;
      const x = clamp(b.cx + Math.cos(a) * b.r, -HALF + 0.01, HALF - 0.01), z = clamp(b.cz + Math.sin(a) * b.r, -HALF + 0.01, HALF - 0.01);
      pts.push(new THREE.Vector3(x, heightAt(w, x, z) + 0.12, z));
    }
    boundaryLine.geometry.dispose();
    boundaryLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    boundaryLine.computeLineDistances();
  }

  // ---------- residents ----------
  const residentRoot = new THREE.Group(); scene.add(residentRoot);
  const residents = [];
  function syncResidents(w) {
    const homes = w.objects.filter((o) => ITEMS[o.type].residents && o._housed);
    const wanted = [];
    for (const h of homes) for (let k = 0; k < ITEMS[h.type].residents; k++) wanted.push([h, k]);
    while (residents.length > Math.min(wanted.length, 70)) { const r = residents.pop(); residentRoot.remove(r.mesh); }
    for (let n = 0; n < Math.min(wanted.length, 70); n++) {
      const [h, k] = wanted[n];
      let r = residents[n];
      if (!r) {
        const mesh = buildResident(n * 7 + 3);
        residentRoot.add(mesh);
        r = residents[n] = { mesh, x: h.x, z: h.z, tx: h.x, tz: h.z, wait: Math.random() * 3, seed: n, step: 0 };
      }
      r.home = h; r.k = k;
    }
  }
  function pickDestination(w, r, hours) {
    const pick = (list) => list.length ? list[(r.seed + Math.floor(hours * 1.7)) % list.length] : null;
    let target = null;
    if (hours >= 6 && hours < 11) target = pick(w.objects.filter((o) => ITEMS[o.type].plant || o.type === 'well' || o.type === 'spring'));
    else if (hours >= 11 && hours < 15) target = pick(w.objects.filter((o) => ITEMS[o.type].publicSpace || ITEMS[o.type].shade));
    else if (hours >= 15 && hours < 18.5) target = pick(w.objects.filter((o) => o.type === 'market' || o.type === 'courtyard' || o.type === 'fountain' || o.type === 'bridge'));
    else if (hours >= 18.5 && hours < 21) target = pick(w.objects.filter((o) => o.type === 'lantern' || o.type === 'courtyard' || o.type === 'bench'));
    if (!target) target = r.home;
    const a = (r.seed * 2.39996) % (Math.PI * 2), d = 0.8 + (r.seed % 3) * 0.35;
    r.tx = clamp(target.x + Math.cos(a) * d, -HALF + 1, HALF - 1);
    r.tz = clamp(target.z + Math.sin(a) * d, -HALF + 1, HALF - 1);
  }
  let footstepCb = null;
  function stepResidents(w, dt, hours, camTarget) {
    const indoors = hours >= 21.5 || hours < 5.5;
    let visibleNear = 0;
    for (const r of residents) {
      if (!r.home) continue;
      if (indoors) { r.mesh.visible = false; r.x = r.home.x; r.z = r.home.z; continue; }
      r.mesh.visible = true;
      const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz);
      if (d < 0.08) {
        r.wait -= dt;
        if (r.wait <= 0) { pickDestination(w, r, hours + r.seed * 0.13); r.wait = 2 + (r.seed % 5); }
        r.mesh.position.y = heightAt(w, r.x, r.z);
      } else {
        const sp = Math.min(d, dt * 1.05);
        r.x += dx / d * sp; r.z += dz / d * sp;
        r.step += dt * 9;
        r.mesh.position.y = heightAt(w, r.x, r.z) + Math.abs(Math.sin(r.step)) * 0.05;
        r.mesh.rotation.y = Math.atan2(dx, dz);
        if (camTarget && Math.hypot(r.x - camTarget.x, r.z - camTarget.z) < 5) visibleNear++;
      }
      r.mesh.position.x = r.x; r.mesh.position.z = r.z;
    }
    if (visibleNear && footstepCb && Math.random() < dt * 0.6) footstepCb();
  }

  // ---------- particles ----------
  function points(count, color, size, opacity, additive = false) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
    if (additive) mat.map = getGlowTexture();
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    scene.add(p);
    return p;
  }
  const dust = points(160, 0xfff0c8, 0.07, 0.5);
  const sand = points(420, 0xe9c08a, 0.09, 0.0);
  const flies = points(90, 0xffe28a, 0.35, 0, true);
  const spray = points(160, 0xd8f4ff, 0.08, 0.8);
  const puff = points(120, 0xe8c896, 0.16, 0.0);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 6), 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe4f4, transparent: true, opacity: 0 }));
  rain.frustumCulled = false; scene.add(rain);
  const dustSeed = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random()]);
  const sandSeed = Array.from({ length: 420 }, () => [Math.random() * 64 - 32, Math.random() * 64 - 32, Math.random()]);
  const flySeed = Array.from({ length: 90 }, () => [Math.random(), Math.random(), Math.random() * 6]);
  const puffState = Array.from({ length: 120 }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
  let puffCursor = 0;
  function burst(x, y, z, n = 26, color = 0xe8c896) {
    puff.material.color.set(color);
    for (let k = 0; k < n; k++) {
      const p = puffState[puffCursor++ % puffState.length];
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.4;
      p.life = 1; p.x = x; p.y = y + 0.1; p.z = z; p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 0.6 + Math.random() * 1.2;
    }
  }

  // ---------- birds ----------
  const flock = new THREE.Group(); scene.add(flock);
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, -0.42, 0.06, -0.08, 0, 0, -0.1, 0, 0, 0.18, 0, 0, -0.1, 0.42, 0.06, -0.08], 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x3a2a24, side: THREE.DoubleSide });
  const birds = [];
  for (let k = 0; k < 15; k++) { const b = new THREE.Mesh(birdGeo, birdMat); const row = Math.ceil(k / 2), side = k % 2 ? 1 : -1; b.userData.off = new THREE.Vector3(side * row * 0.9, (k % 3) * 0.2, -row * 0.8); flock.add(b); birds.push(b); }
  flock.visible = false;
  let flockT = -1, flockFrom = new THREE.Vector3(), flockTo = new THREE.Vector3();
  function launchFlock() {
    const a = Math.random() * Math.PI * 2;
    flockFrom.set(Math.cos(a) * 70, 14 + Math.random() * 6, Math.sin(a) * 70);
    flockTo.set(-flockFrom.x, flockFrom.y + 2, -flockFrom.z);
    flockT = 0; flock.visible = true;
  }

  // ---------- ghost, brush and selection ----------
  const ghostRoot = new THREE.Group(); scene.add(ghostRoot);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fe08a, transparent: true, opacity: 0.45, depthWrite: false });
  let ghostType = null, ghostModel = null;
  function setGhost(type, variant = 0) {
    if (ghostType === type && ghostModel) return;
    if (ghostModel) ghostRoot.remove(ghostModel.group);
    ghostModel = null; ghostType = type;
    if (!type) return;
    ghostModel = buildItem(type, variant);
    ghostModel.group.traverse((m) => { if (m.isMesh || m.isSprite) { m.material = ghostMat; m.castShadow = false; } });
    ghostRoot.add(ghostModel.group);
  }
  const footprintMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fe08a, transparent: true, opacity: 0.25, depthWrite: false }));
  scene.add(footprintMesh);
  const brush = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.8, depthWrite: false }));
  brush.renderOrder = 5; scene.add(brush);
  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.visible = false; scene.add(selRing);
  const sparkle = points(40, 0xfff2b0, 0.5, 0, true);
  let sparkleT = 0, sparkleAt = new THREE.Vector3();

  function updateCursor(w, s) {
    // s: { tool, x, z, valid, radius, item, rot, selected, show }
    brush.visible = false; footprintMesh.visible = false; ghostRoot.visible = false; selRing.visible = false;
    if (s.selected) {
      const v = views.get(s.selected);
      if (v) { selRing.visible = true; const r = Math.max(...ITEMS[v.obj.type].size) * 0.75 + 0.3; selRing.scale.set(r, 1, r); selRing.position.set(v.obj.x, v.group.position.y + 0.06, v.obj.z); }
    }
    if (!s.show) return;
    if (s.tool === 'build' && s.item) {
      setGhost(s.item);
      ghostRoot.visible = true;
      const f = footprint(s.item, s.x, s.z, s.rot);
      const px = s.snap ? f.cx : s.x, pz = s.snap ? f.cz : s.z;
      ghostModel.group.position.set(px, heightAt(w, px, pz), pz);
      ghostModel.group.rotation.y = -s.rot;
      ghostMat.color.set(s.valid ? 0x8fe08a : 0xff7a6a);
      footprintMesh.visible = true;
      footprintMesh.scale.set(f.fw, 1, f.fd);
      footprintMesh.position.set(f.cx, heightAt(w, f.cx, f.cz) + 0.08, f.cz);
      footprintMesh.material.color.set(s.valid ? 0x8fe08a : 0xff7a6a);
    } else if (s.tool !== 'select') {
      brush.visible = true;
      const r = s.tool === 'carve' || s.tool === 'path' ? Math.max(0.5, Math.round(s.radius - 0.5) + 0.5) : s.radius;
      brush.scale.set(r, 1, r);
      brush.position.set(s.x, heightAt(w, s.x, s.z) + 0.1, s.z);
      brush.material.color.set(s.tool === 'carve' ? 0x9fe8ff : s.tool === 'lower' ? 0xffc89a : 0xfff6dc);
    }
  }

  // ---------- camera ----------
  const cam = { tx: 0, tz: 2, dist: 30, yaw: 0.65, pitch: 0.82, vx: 0, vz: 0, shake: 0, goal: null };
  const camNow = { tx: 0, tz: 2, dist: 30, yaw: 0.65, pitch: 0.82 };
  function updateCamera(w, dt, reduceMotion) {
    const k = 1 - Math.exp(-dt * (reduceMotion ? 5 : 7));
    if (cam.goal) {
      const g = cam.goal; const kk = 1 - Math.exp(-dt * 2.2);
      cam.tx = lerp(cam.tx, g.tx, kk); cam.tz = lerp(cam.tz, g.tz, kk); cam.dist = lerp(cam.dist, g.dist, kk);
      cam.yaw = lerp(cam.yaw, g.yaw, kk); cam.pitch = lerp(cam.pitch, g.pitch, kk);
      if (Math.abs(cam.dist - g.dist) < 0.05 && Math.hypot(cam.tx - g.tx, cam.tz - g.tz) < 0.05) cam.goal = null;
    }
    cam.tx = clamp(cam.tx, -HALF + 2, HALF - 2); cam.tz = clamp(cam.tz, -HALF + 2, HALF - 2);
    cam.dist = clamp(cam.dist, 6, 70); cam.pitch = clamp(cam.pitch, 0.18, 1.35);
    for (const key of ['tx', 'tz', 'dist', 'yaw', 'pitch']) camNow[key] = lerp(camNow[key], cam[key], k);
    const ty = heightAt(w, camNow.tx, camNow.tz);
    const cx = camNow.tx + Math.sin(camNow.yaw) * Math.cos(camNow.pitch) * camNow.dist;
    const cz = camNow.tz + Math.cos(camNow.yaw) * Math.cos(camNow.pitch) * camNow.dist;
    let cy = ty + Math.sin(camNow.pitch) * camNow.dist;
    cy = Math.max(cy, heightAt(w, clamp(cx, -HALF, HALF), clamp(cz, -HALF, HALF)) + 1.2);
    camera.position.set(cx, cy, cz);
    if (cam.shake > 0 && !reduceMotion) {
      cam.shake = Math.max(0, cam.shake - dt * 2.5);
      const a = cam.shake * cam.shake * 0.18;
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a;
    }
    camera.lookAt(camNow.tx, ty + 0.6, camNow.tz);
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(terrain, false)[0];
    return hit ? { x: hit.point.x, z: hit.point.z, y: hit.point.y } : null;
  }

  // ---------- frame ----------
  let time = 0, lastSyncKey = '', waterTimer = 0;
  const sunDir = new THREE.Vector3();
  function frame(w, dt, opts) {
    // opts: { hours, weather, reduceMotion, particles, cursor, waterPattern, photoFilter }
    time += dt;
    const h = opts.hours;
    const pal = samplePalette(h);
    const night = nightAmount(h);
    const hazy = opts.weather === 'hazy' ? 0.6 : opts.weather === 'rain' ? 0.5 : opts.weather === 'breezy' ? 0.35 : 0.08;
    // Sun path: rises in the east (+x), sets in the west.
    const sa = ((h - 6) / 12) * Math.PI;
    sunDir.set(Math.cos(sa), Math.sin(sa), 0.35).normalize();
    const lightDir = night > 0.5 ? new THREE.Vector3(-0.4, 0.8, -0.3).normalize() : sunDir.clone().setY(Math.max(0.12, sunDir.y));
    sun.position.set(cam.tx + lightDir.x * 60, lightDir.y * 60, cam.tz + lightDir.z * 60);
    sun.target.position.set(cam.tx, 0, cam.tz);
    sun.color.copy(pal.sun);
    sun.intensity = pal.sunI * (opts.weather === 'rain' ? 0.55 : opts.weather === 'hazy' ? 0.8 : 1);
    hemi.color.copy(pal.sky); hemi.groundColor.copy(pal.ground); hemi.intensity = pal.hemiI * 1.1;
    skyMat.uniforms.uZenith.value.copy(pal.zenith); skyMat.uniforms.uHorizon.value.copy(pal.horizon);
    skyMat.uniforms.uSunDir.value.copy(sunDir); skyMat.uniforms.uSunCol.value.copy(pal.sun).multiplyScalar(1 - night);
    skyMat.uniforms.uHaze.value = hazy;
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    starMat.opacity = night * (opts.weather === 'clear' ? 0.95 : 0.4);
    scene.fog.color.copy(pal.horizon);
    scene.fog.near = lerp(70, 25, hazy); scene.fog.far = lerp(210, 110, hazy);
    renderer.toneMappingExposure = 1.05 + night * 0.25;

    // Sync scene with the sim.
    const key = w.objects.length + ':' + w.nextId + ':' + (w._terrainVersion || 0) + ':' + w.hidden.map((x) => x.found ? 1 : 0).join('');
    if (w._dirtyTerrain || key !== lastSyncKey) {
      if (w._dirtyTerrain) { w._terrainVersion = (w._terrainVersion || 0) + 1; w._dirtyTerrain = false; }
      rebuildTerrain(w);
      syncObjects(w);
      syncResidents(w);
      lastSyncKey = w.objects.length + ':' + w.nextId + ':' + (w._terrainVersion || 0) + ':' + w.hidden.map((x) => x.found ? 1 : 0).join('');
      waterKey = '';
    }
    waterTimer -= dt;
    if (waterTimer <= 0) { waterTimer = 0.1; rebuildWater(w); if (w._wetChangedColors) rebuildTerrain(w); }
    waterMat.uniforms.uTime.value = time;
    waterMat.uniforms.uNight.value = night;
    waterMat.uniforms.uSky.value.copy(pal.zenith);
    waterMat.uniforms.uPattern.value = opts.waterPattern ? 1 : 0;

    // Objects: growth colour, sway, cloth, glow, windows, feature water.
    const wind = (opts.weather === 'breezy' ? 1.8 : opts.weather === 'rain' ? 1.3 : 1) * (opts.reduceMotion ? 0.4 : 1);
    const lit = night > 0.3 ? 1 : 0;
    for (const v of views.values()) {
      const o = v.obj, m = v.model;
      if (v.appear < 1) { v.appear = Math.min(1, v.appear + dt * (opts.reduceMotion ? 6 : 3.2)); const s = 0.6 + 0.4 * (1 - Math.pow(1 - v.appear, 3)) + Math.sin(v.appear * Math.PI) * 0.08; v.group.scale.setScalar(s); }
      if (m.plantMat) {
        m.plantMat.color.copy(thirstyColor).lerp(lushColor, o.thrive);
        const gs = 0.55 + 0.45 * o.thrive;
        for (const s of m.sway) s.scale.setScalar(gs);
      }
      for (const s of m.sway) { s.rotation.z = Math.sin(time * 1.3 + o.id) * 0.05 * wind; s.rotation.x = Math.cos(time * 1.1 + o.id * 0.7) * 0.035 * wind; }
      for (const c of m.cloth) {
        const p = c.geometry.attributes.position;
        if (!c.userData.base) c.userData.base = Float32Array.from(p.array);
        const b = c.userData.base;
        for (let q = 0; q < p.count; q++) {
          const x = b[q * 3], y = b[q * 3 + 1];
          p.array[q * 3 + 2] = b[q * 3 + 2] + Math.sin(time * 2.4 * wind + x * 3 + y * 2 + o.id) * 0.035 * wind * (0.4 + Math.abs(x) + Math.abs(y));
        }
        p.needsUpdate = true;
      }
      for (const g of m.glow) g.material.opacity = lerp(g.material.opacity, lit * 0.95, dt * 2);
      for (const win of m.windows) win.material.emissiveIntensity = night * 1.4;
      if (m.water.length) { const run = ITEMS[o.type].src || o._running || ITEMS[o.type].carries && o.cells.some((c) => w.wet[c] > 0.6); for (const wm of m.water) wm.visible = !!run; }
    }
    MAT.window.emissiveIntensity = night * 1.4;
    for (const hv of hiddenViews) {
      for (const c of hv.model.cloth) c.rotation.y = Math.sin(time * 3) * 0.2;
      hv.model.group.visible = hv.h.kind !== 'bloom' || hv.h.found || true;
    }

    // Particles.
    const tx = camNow.tx, tz = camNow.tz;
    {
      const p = dust.geometry.attributes.position;
      for (let k = 0; k < dustSeed.length; k++) {
        const s = dustSeed[k];
        const x = tx + (s[0] - 0.5) * 22 + Math.sin(time * 0.2 + k) * 0.6, z = tz + (s[1] - 0.5) * 22 + Math.cos(time * 0.17 + k) * 0.6;
        p.setXYZ(k, x, heightAt(w, clamp(x, -HALF, HALF), clamp(z, -HALF, HALF)) + 0.5 + ((s[2] + time * 0.03) % 1) * 4, z);
      }
      p.needsUpdate = true;
      dust.material.opacity = opts.particles ? (1 - night) * 0.45 : 0;
    }
    {
      const p = sand.geometry.attributes.position;
      const strength = opts.weather === 'breezy' ? 1 : opts.weather === 'hazy' ? 0.45 : 0.18;
      for (let k = 0; k < sandSeed.length; k++) {
        const s = sandSeed[k];
        s[0] += dt * (3 + s[2] * 5) * strength; s[1] += dt * 1.1 * strength;
        if (s[0] > 32) { s[0] = -32; s[1] = Math.random() * 64 - 32; }
        if (s[1] > 32) s[1] = -32;
        p.setXYZ(k, s[0], heightAt(w, s[0], s[1]) + 0.08 + s[2] * 0.35, s[1]);
      }
      p.needsUpdate = true;
      sand.material.opacity = opts.particles ? strength * 0.55 : 0;
    }
    {
      const p = flies.geometry.attributes.position;
      const spots = w.objects.filter((o) => ITEMS[o.type].plant || ITEMS[o.type].waterFeature || o.type === 'spring');
      for (let k = 0; k < flySeed.length; k++) {
        const s = flySeed[k];
        const o = spots.length ? spots[k % spots.length] : { x: 0, z: 0 };
        const x = o.x + Math.sin(time * 0.6 + s[2]) * (0.6 + s[0]), z = o.z + Math.cos(time * 0.5 + s[2] * 1.3) * (0.6 + s[1]);
        p.setXYZ(k, x, heightAt(w, x, z) + 0.4 + Math.sin(time * 1.3 + s[2]) * 0.3 + s[1], z);
      }
      p.needsUpdate = true;
      flies.material.opacity = opts.particles && spots.length ? night * (0.55 + 0.45 * Math.sin(time * 3)) : 0;
    }
    {
      const p = spray.geometry.attributes.position;
      const fts = [...views.values()].filter((v) => v.model.spray && (ITEMS[v.obj.type].src || v.obj._running));
      for (let k = 0; k < 160; k++) {
        const v = fts.length ? fts[k % fts.length] : null;
        if (!v) { p.setXYZ(k, 0, -50, 0); continue; }
        const t = ((time * 0.9 + k * 0.137) % 1);
        const a = k * 2.399, r = t * (v.obj.type === 'spring' ? 0.3 : 0.55);
        const base = v.group.position;
        p.setXYZ(k, base.x + Math.cos(a) * r, base.y + v.model.spray.y + (v.obj.type === 'spring' ? t * 0.15 : 0.5 * t - 1.6 * t * t), base.z + Math.sin(a) * r);
      }
      p.needsUpdate = true;
      spray.material.opacity = opts.particles ? 0.75 : 0.4;
    }
    {
      const p = puff.geometry.attributes.position;
      let alive = 0;
      for (let k = 0; k < puffState.length; k++) {
        const s = puffState[k];
        if (s.life > 0) {
          s.life -= dt * 1.4; s.vy -= dt * 2.4; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vx *= 0.96; s.vz *= 0.96;
          p.setXYZ(k, s.x, s.y, s.z); alive++;
        } else p.setXYZ(k, 0, -50, 0);
      }
      p.needsUpdate = true;
      puff.material.opacity = alive ? 0.7 : 0;
    }
    {
      const p = rain.geometry.attributes.position;
      const on = opts.weather === 'rain';
      rain.material.opacity = on ? 0.45 : 0;
      if (on) for (let k = 0; k < 600; k++) {
        const x = tx + ((k * 37.1) % 40) - 20, z = tz + ((k * 53.7) % 40) - 20;
        const y = 18 - ((time * 14 + k * 0.731) % 18);
        p.setXYZ(k * 2, x, y, z); p.setXYZ(k * 2 + 1, x + 0.05, y - 0.5, z + 0.02);
      }
      p.needsUpdate = on;
    }
    if (sparkleT > 0) {
      sparkleT -= dt;
      const p = sparkle.geometry.attributes.position;
      for (let k = 0; k < 40; k++) { const a = k * 2.399 + time, r = 0.4 + (k % 5) * 0.25; p.setXYZ(k, sparkleAt.x + Math.cos(a) * r, sparkleAt.y + 0.5 + ((k * 0.13 + time * 0.6) % 1.8), sparkleAt.z + Math.sin(a) * r); }
      p.needsUpdate = true;
      sparkle.material.opacity = Math.min(1, sparkleT);
    } else sparkle.material.opacity = 0;

    // Birds: a flock crosses at dawn and now and then.
    if (flockT < 0 && ((h > 5.6 && h < 7.5 && Math.random() < dt * 0.05) || Math.random() < dt * 0.004)) launchFlock();
    if (flockT >= 0) {
      flockT += dt / 28;
      const pos = new THREE.Vector3().lerpVectors(flockFrom, flockTo, flockT);
      flock.position.copy(pos);
      flock.lookAt(flockTo);
      birds.forEach((b, k) => { b.position.copy(b.userData.off); b.scale.y = 0.6 + Math.sin(time * 9 + k) * 0.5; });
      if (flockT >= 1) { flockT = -1; flock.visible = false; }
    }

    stepResidents(w, dt, h, { x: tx, z: tz });
    updateCamera(w, dt, opts.reduceMotion);
    updateCursor(w, opts.cursor || {});
    renderer.render(scene, camera);
  }

  function resize(wpx, hpx) {
    renderer.setSize(wpx, hpx, false);
    camera.aspect = wpx / Math.max(1, hpx);
    camera.updateProjectionMatrix();
  }

  // What is in frame, for postcards.
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), vtmp = new THREE.Vector3();
  function viewInfo(w, hours, weather) {
    camera.updateMatrixWorld();
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    const inView = (x, y, z) => frustum.containsPoint(vtmp.set(x, y, z)) && camera.position.distanceTo(vtmp) < 75;
    const visible = {}, runningVisible = {}, foundVisible = {};
    let thrivingVisible = 0, wetVisible = 0, residentsVisible = 0;
    for (const v of views.values()) {
      const p = v.group.position;
      if (!inView(p.x, p.y + 0.5, p.z)) continue;
      visible[v.obj.type] = (visible[v.obj.type] || 0) + 1;
      if (v.obj._running) runningVisible[v.obj.type] = (runningVisible[v.obj.type] || 0) + 1;
      if (ITEMS[v.obj.type].plant && v.obj.thrive > 0.8) thrivingVisible++;
    }
    for (let c = 0; c < N * N; c++) if (w.wet[c] > 0.6) { const i = c % N, j = (c / N) | 0; if (inView(i - HALF + 0.5, cellBed(w, i, j), j - HALF + 0.5)) wetVisible++; }
    for (const r of residents) if (r.mesh.visible && inView(r.x, r.mesh.position.y + 0.4, r.z)) residentsVisible++;
    for (const hv of hiddenViews) if (hv.h.found && inView(hv.h.x, hv.model.group.position.y + 0.8, hv.h.z)) foundVisible[hv.h.kind] = (foundVisible[hv.h.kind] || 0) + 1;
    let flockVisible = false;
    if (flock.visible) for (const b of birds) { b.getWorldPosition(vtmp); if (frustum.containsPoint(vtmp)) { flockVisible = true; break; } }
    return { hours, weather, visible, runningVisible, foundVisible, thrivingVisible, wetVisible, residentsVisible, flockVisible };
  }

  function focus(x, z, dist = 14) { cam.goal = { tx: x, tz: z, dist, yaw: cam.yaw, pitch: Math.min(cam.pitch, 0.7) }; }
  function shake(amount = 0.6) { cam.shake = Math.max(cam.shake, amount); }
  function celebrate(x, z, w) { sparkleAt.set(x, heightAt(w, x, z), z); sparkleT = 2.4; }
  function snapshotData(width = 320, height = 180, type = 'image/jpeg', q = 0.82) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    const src = renderer.domElement;
    const sw = src.width, sh = src.height, ar = width / height;
    let cw = sw, ch = sw / ar;
    if (ch > sh) { ch = sh; cw = sh * ar; }
    ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, width, height);
    return c.toDataURL(type, q);
  }
  // Pixel variance of the last frame: proves something other than a flat colour rendered.
  function frameVariance() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const ctx = c.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, 64, 36);
    const d = ctx.getImageData(0, 0, 64, 36).data;
    let s = 0, s2 = 0, n = 0;
    for (let k = 0; k < d.length; k += 4) { const l = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; s += l; s2 += l * l; n++; }
    return s2 / n - (s / n) * (s / n);
  }
  function info() {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { webgl: true, webgl2: renderer.capabilities.isWebGL2, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), three: THREE.REVISION };
  }
  function setQuality(q) {
    renderer.shadowMap.enabled = q !== 'low'; sun.castShadow = q !== 'low';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1));
  }
  return {
    renderer, scene, camera, cam, frame, resize, pick, viewInfo, focus, shake, celebrate, burst, launchFlock,
    snapshotData, frameVariance, info, setQuality, isFlockActive: () => flockT >= 0,
    onFootstep: (cb) => { footstepCb = cb; }, residentsCount: () => residents.filter((r) => r.mesh.visible).length,
    selectedRotation: (id) => { const v = views.get(id); return v ? v.obj.rot : null; },
  };
}
