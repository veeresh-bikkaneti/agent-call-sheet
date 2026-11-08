/* Tactical Operations — the container yard.
 *
 * Procedural Three.js r158. Every object here is a primitive built at runtime:
 * there are no model files, no textures on disk and no external assets beyond
 * the pinned modules the import map names. The whole module is only imported
 * when the operator presses deploy (see ops.js).
 *
 * Three.js r158 notes honoured deliberately:
 *  - FilmPass in r158 takes (intensity, grayscale). The older four-argument
 *    (noise, scanlines, count, grayscale) call is dead — args 3 and 4 are
 *    ignored and arg 2 lands in the grayscale flag.
 *  - PointsMaterial has one size for the whole cloud; a per-point `size`
 *    attribute is not read.
 *  - Colours are set in sRGB via ColorManagement defaults, so hex values read
 *    the way the stylesheet's do.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const PALETTE = {
  night: 0x0a0c12,
  fog: 0x0d1018,
  yard: 0x14171f,
  line: 0x2a2e38,
  vermilion: 0xc43b5a,
  amber: 0xd4a843,
  success: 0x3fb950,
  warning: 0xd29922,
  danger: 0xf85149,
  steel: 0x3a3f4a,
  container: 0x6b4a2f,
  slate: 0x7a6f5f,
};

const SEVERITY_COLOR = {
  BLOCKER: PALETTE.danger,
  MAJOR: PALETTE.warning,
  MINOR: PALETTE.slate,
};

function hex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

const VIGNETTE = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.42 },
    smoothness: { value: 0.55 },
  },
  vertexShader: `varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float intensity; uniform float smoothness;
    varying vec2 vUv;
    void main(){
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = length(vUv - 0.5);
      float vignette = smoothstep(0.5, 1.0 - smoothness, dist);
      color.rgb = mix(color.rgb, vec3(0.0), intensity * vignette);
      gl_FragColor = color;
    }`,
};

function labelTexture(lines, accent) {
  const W = 512;
  const H = 160;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10,12,18,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = 'bold 62px Georgia, serif';
  ctx.fillText(lines[0], W / 2, lines[1] ? 58 : H / 2);
  if (lines[1]) {
    ctx.font = '34px "Courier New", monospace';
    ctx.fillStyle = '#c9c2b6';
    ctx.fillText(lines[1], W / 2, 116);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function createTerminal(canvas, opts = {}) {
  const reducedMotion = opts.reducedMotion === true;
  const defectIds = opts.defectIds || [];
  const severity = opts.defectSeverity || {};
  const loadouts = opts.loadouts || [];
  const packs = opts.packs || [];
  const containers = opts.containers || [];

  /* ---------------------------------------------------------------- renderer */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(PALETTE.night, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.night);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.014);

  /* ------------------------------------------------------------------- camera
     Driven by hand rather than OrbitControls: the console needs to fly the lens
     to a chosen container, and hand-rolled spherical coordinates make that a
     lerp instead of a fight. */
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);
  const cam = {
    theta: 0.72, phi: 1.16, dist: 34,
    target: new THREE.Vector3(0, 3, -3),
    want: { theta: 0.72, phi: 1.16, dist: 34, target: new THREE.Vector3(0, 3, -3) },
  };
  let stale = true;

  /* -------------------------------------------------------------------- lights */
  scene.add(new THREE.AmbientLight(PALETTE.amber, 0.32));

  const sun = new THREE.DirectionalLight(PALETTE.vermilion, 0.95);
  sun.position.set(24, 22, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -46;
  sun.shadow.camera.right = 46;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x4a6fa5, 0.35);
  rim.position.set(-18, 10, 16);
  scene.add(rim);

  const lamps = [];
  for (let i = 0; i < 5; i += 1) {
    const lamp = new THREE.PointLight(PALETTE.amber, 22, 26, 2);
    lamp.position.set(-16 + i * 8, 7.5, 6);
    scene.add(lamp);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshBasicMaterial({ color: PALETTE.amber }),
    );
    bulb.position.copy(lamp.position);
    scene.add(bulb);
    lamps.push({ lamp, bulb });
  }

  /* --------------------------------------------------------------------- ground */
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: PALETTE.yard, roughness: 0.72, metalness: 0.25 }),
  );
  yard.rotation.x = -Math.PI / 2;
  yard.receiveShadow = true;
  scene.add(yard);

  const lines = new THREE.Group();
  for (let i = -4; i <= 4; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 90),
      new THREE.MeshBasicMaterial({ color: 0x1d212b }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 5, 0.02, 0);
    lines.add(stripe);
  }
  scene.add(lines);

  const puddles = new THREE.Group();
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x101623, roughness: 0.08, metalness: 0.85, transparent: true, opacity: 0.85,
  });
  for (let i = 0; i < 14; i += 1) {
    const r = 0.9 + Math.random() * 2.4;
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set((Math.random() - 0.5) * 46, 0.015, (Math.random() - 0.5) * 30);
    puddles.add(p);
  }
  scene.add(puddles);

  /* ------------------------------------------------------------ defect containers
     One container per gate finding, stamped with its id and severity. */
  const defectNodes = new Map();
  const boxGeo = new THREE.BoxGeometry(3.4, 2.7, 6.4);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const perRow = Math.ceil(defectIds.length / 2);

  defectIds.forEach((id, index) => {
    const row = index < perRow ? 0 : 1;
    const col = row === 0 ? index : index - perRow;
    const x = (col - (perRow - 1) / 2) * 4.6;
    const z = row === 0 ? 2 : 9.5;
    const sev = severity[id] || 'MINOR';

    const group = new THREE.Group();
    group.position.set(x, 1.35, z);

    const body = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      color: PALETTE.container, roughness: 0.86, metalness: 0.3,
    }));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    group.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
      color: SEVERITY_COLOR[sev], transparent: true, opacity: 0.85,
    })));

    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 0.9),
      new THREE.MeshStandardMaterial({ color: SEVERITY_COLOR[sev], roughness: 0.5, metalness: 0.4 }),
    );
    plaque.position.set(0, 0.2, 3.22);
    group.add(plaque);

    const idleTex = labelTexture([id, sev], hex(SEVERITY_COLOR[sev]));
    const doneTex = labelTexture([id, 'TRIAGED'], '#3fb950');
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: idleTex, transparent: true, depthTest: false, depthWrite: false,
    }));
    sprite.scale.set(4.6, 1.44, 1);
    sprite.position.set(0, 3.1, 0);
    sprite.renderOrder = 3;
    group.add(sprite);

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.09, 10, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.success }),
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.set(0, 1.6, 0);
    marker.visible = false;
    group.add(marker);

    scene.add(group);
    defectNodes.set(id, { group, body, sprite, idleTex, doneTex, marker, base: group.position.clone() });
  });

  /* ---------------------------------------------------------------- pack stacks
     Six stacks of boxes: the cargo each pack carries. */
  const PACK_COLOR = [0xc43b5a, 0xd4a843, 0x2a7f6f, 0x9b59b6, 0x4a6fa5, 0x8b5a2b];
  const packNodes = new Map();
  const packGeo = new THREE.BoxGeometry(4.6, 2.3, 4.6);
  const packEdge = new THREE.EdgesGeometry(packGeo);

  packs.forEach((pack, i) => {
    const group = new THREE.Group();
    const x = (i - (packs.length - 1) / 2) * 6.6;
    group.position.set(x, 0, -19);
    const tint = PACK_COLOR[i % PACK_COLOR.length];
    const rows = 1 + (i % 3);
    for (let level = 0; level < rows; level += 1) {
      const box = new THREE.Mesh(packGeo, new THREE.MeshStandardMaterial({
        color: tint, roughness: 0.78, metalness: 0.35,
      }));
      box.position.y = 1.15 + level * 2.35;
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);
      const outline = new THREE.LineSegments(packEdge, new THREE.LineBasicMaterial({
        color: PALETTE.amber, transparent: true, opacity: 0.5,
      }));
      outline.position.copy(box.position);
      group.add(outline);
    }
    const tex = labelTexture([pack.id, `${pack.entries} entries`], '#d4a843');
    const plate = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false,
    }));
    plate.scale.set(6.4, 2, 1);
    plate.position.set(0, rows * 2.35 + 2.2, 0);
    plate.renderOrder = 3;
    group.add(plate);
    scene.add(group);
    packNodes.set(pack.id, { group, base: group.position.clone() });
  });

  /* -------------------------------------------------------------- gantry crane */
  const steel = new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.45, metalness: 0.85 });
  const crane = new THREE.Group();
  for (const x of [-23, 23]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 84), steel);
    rail.position.set(x, 0.25, 0);
    rail.receiveShadow = true;
    crane.add(rail);
  }
  const trolley = new THREE.Group();
  const legs = new THREE.Group();
  for (const x of [-23, 23]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 16, 1.2), steel);
    leg.position.set(x, 8, 0);
    leg.castShadow = true;
    legs.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(50, 1.4, 1.6), steel);
  beam.position.set(0, 16, 0);
  beam.castShadow = true;
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(50, 0.3, 2.6), steel);
  walkway.position.set(0, 15.2, 0);
  legs.add(beam, walkway);
  trolley.add(legs);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x22252c, metalness: 0.6, roughness: 0.5 }),
  );
  trolley.add(cable);
  const spreader = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 5.6), steel);
  trolley.add(spreader);
  crane.add(trolley);
  scene.add(crane);

  const craneSpan = 26;
  const hoistBase = 8.4;
  const hoistAmp = 4.2;

  /* ------------------------------------------------------------------ drizzle */
  const DROPS = 1300;
  const dropPos = new Float32Array(DROPS * 3);
  const dropVel = new Float32Array(DROPS);
  for (let i = 0; i < DROPS; i += 1) {
    dropPos[i * 3] = (Math.random() - 0.5) * 70;
    dropPos[i * 3 + 1] = Math.random() * 30;
    dropPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    dropVel[i] = 9 + Math.random() * 9;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x9aa3b2, size: 0.09, sizeAttenuation: true,
    transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(rain);

  /* -------------------------------------------------------- post-processing */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.55, 0.86,
  );
  composer.addPass(bloom);

  // r158 signature: (intensity, grayscale).
  composer.addPass(new FilmPass(0.32, false));
  composer.addPass(new ShaderPass(VIGNETTE));

  /* ------------------------------------------------------------------ camera api */
  const els = containers.map((id, i) => ({
    id,
    pos: new THREE.Vector3(((i % 3) - 1) * 10, 3, -14 + Math.floor(i / 3) * 9),
  }));

  // Keep the lens on the +z side of the yard and swing it a little towards the
  // container being read, so a dossier always arrives with its box in frame.
  function thetaToward(x, z) {
    return Math.atan2(x, Math.abs(z) + 16);
  }

  function focusDefect(id) {
    const node = defectNodes.get(id);
    if (!node) return;
    cam.want.target.copy(node.base).setY(2.4);
    cam.want.dist = Math.min(cam.want.dist, 15);
    cam.want.theta = thetaToward(node.base.x, node.base.z);
    stale = true;
    maybeRender();
  }

  function focusLoadout(loadoutId) {
    const lo = loadouts.find((l) => l.id === loadoutId);
    if (!lo) return;
    const node = packNodes.get(lo.pack);
    if (node) {
      cam.want.target.copy(node.base).setY(4);
      cam.want.dist = 22;
      cam.want.theta = thetaToward(node.base.x, node.base.z);
      stale = true;
      maybeRender();
    } else if (lo.targets && lo.targets.length) {
      focusDefect(lo.targets[0]);
    }
  }

  function markTriaged(id, on = true) {
    const node = defectNodes.get(id);
    if (!node) return;
    node.marker.visible = on === true;
    node.sprite.material.map = on === true ? node.doneTex : node.idleTex;
    node.sprite.material.needsUpdate = true;
    node.body.material.emissive = new THREE.Color(on === true ? PALETTE.success : 0x000000);
    node.body.material.emissiveIntensity = on === true ? 0.35 : 0;
    node.body.material.needsUpdate = true;
    stale = true;
    maybeRender();
  }

  let manual = false;
  function orbitBy(dTheta, dPhi) {
    manual = true;
    cam.want.theta += dTheta;
    cam.want.phi = THREE.MathUtils.clamp(cam.want.phi + dPhi, 0.35, 1.45);
    stale = true;
    maybeRender();
  }
  function dolly(delta) {
    manual = true;
    cam.want.dist = THREE.MathUtils.clamp(cam.want.dist + delta, 9, 70);
    stale = true;
    maybeRender();
  }
  function setScroll(frac) {
    if (manual) return;
    cam.want.target.y = 2.4 + frac * 5;
    cam.want.theta = 0.72 - frac * 0.5;
    stale = true;
    maybeRender();
  }
  function userTookControl() { return manual; }

  /* ------------------------------------------------------------------- input */
  const drag = { active: false, x: 0, y: 0, id: null };
  function onPointerDown(ev) {
    drag.active = true;
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    drag.id = ev.pointerId;
    if (canvas.setPointerCapture && ev.pointerId !== undefined) {
      try { canvas.setPointerCapture(ev.pointerId); } catch { /* not fatal */ }
    }
  }
  function onPointerMove(ev) {
    if (!drag.active) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    orbitBy(dx * 0.006, dy * 0.004);
  }
  function onPointerUp() { drag.active = false; }
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    stale = true;
    maybeRender();
  }
  window.addEventListener('resize', onResize, { passive: true });

  let contextLost = false;
  function onContextLost(ev) {
    ev.preventDefault();
    contextLost = true;
    console.warn('[tactical-ops] WebGL context lost — the yard stops rendering until reload.');
  }
  canvas.addEventListener('webglcontextlost', onContextLost);

  /* -------------------------------------------------------------------- loop */
  const clock = new THREE.Clock();
  let raf = 0;
  let frames = 0;

  function step() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // drizzle
    const pos = rainGeo.attributes.position;
    for (let i = 0; i < DROPS; i += 1) {
      let y = pos.array[i * 3 + 1] - dropVel[i] * dt;
      if (y < 0) {
        y = 30;
        pos.array[i * 3] = (Math.random() - 0.5) * 70;
        pos.array[i * 3 + 2] = (Math.random() - 0.5) * 70;
      }
      pos.array[i * 3 + 1] = y;
    }
    pos.needsUpdate = true;

    // crane traverse + hoist: the cable spans from the beam underside (y = 15.2)
    // down to the spreader, so its length and centre follow the hoist directly.
    const traverse = Math.sin(t * 0.16) * craneSpan;
    trolley.position.z = traverse;
    const hoist = hoistBase + Math.sin(t * 0.5) * hoistAmp;
    const cableLength = Math.max(0.5, 15.2 - hoist);
    cable.scale.y = cableLength;
    cable.position.set(0, hoist + cableLength / 2, 0);
    spreader.position.set(0, hoist - 0.25, 0);

    // lamps breathe
    lamps.forEach((entry, i) => {
      const flicker = 0.72 + Math.sin(t * 1.7 + i) * 0.05 + Math.sin(t * 11 + i * 2) * 0.02;
      entry.lamp.intensity = 22 * flicker;
      entry.bulb.material.color.setHex(PALETTE.amber);
    });

    // triaged containers idle-bob so the marker reads as "handled"
    defectNodes.forEach((node) => {
      if (node.marker.visible) node.marker.rotation.z += dt * 0.9;
    });

    settleCamera(dt);
    composer.render();
    stale = false;
    frames += 1;
    raf = requestAnimationFrame(step);
  }

  /* Reduced motion gets a still yard that still answers: every setter marks the
     frame dirty and paints once, instead of running a 60 Hz loop. */
  function maybeRender() {
    if (!reducedMotion || !stale) return;
    stale = false;
    renderOnce();
  }

  function settleCamera(dt) {
    const k = 1 - Math.pow(0.0015, dt);
    cam.theta += (cam.want.theta - cam.theta) * k;
    cam.phi += (cam.want.phi - cam.phi) * k;
    cam.dist += (cam.want.dist - cam.dist) * k;
    cam.target.lerp(cam.want.target, k);
    const sinPhi = Math.sin(cam.phi);
    camera.position.set(
      cam.target.x + cam.dist * sinPhi * Math.sin(cam.theta),
      cam.target.y + cam.dist * Math.cos(cam.phi),
      cam.target.z + cam.dist * sinPhi * Math.cos(cam.theta),
    );
    camera.lookAt(cam.target);
  }

  function renderOnce() {
    settleCamera(1);
    composer.render();
  }

  if (reducedMotion) {
    renderOnce();
  } else {
    raf = requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ disposal */
  function dispose() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    manual = false;
  }

  renderOnce();

  return {
    focusDefect,
    focusLoadout,
    markTriaged,
    orbitBy,
    dolly,
    setScroll,
    userTookControl,
    dispose,
    debug: () => ({
      frames,
      contextLost,
      defects: defectNodes.size,
      packs: packNodes.size,
      layers: els.length,
      camDist: Number(cam.dist.toFixed(2)),
    }),
  };
}
