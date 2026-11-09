// main.js — boot sequence + Three.js container-terminal scene.
// Conventions match features/site/index.html: importmap-pinned three@0.158.0 with SRI,
// prefers-reduced-motion respected, passive listeners, no eval/innerHTML.
import { initUI, log } from './ui.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bootFill = document.getElementById('boot-fill');
const bootStatus = document.getElementById('boot-status');
function bootStep(pct, text) {
  bootFill.style.width = pct + '%';
  bootStatus.textContent = text;
}

function finishBoot() {
  bootStep(100, 'Sync complete — entering the briefing room.');
  const boot = document.getElementById('boot');
  boot.classList.add('done');
  const app = document.getElementById('app');
  app.hidden = false;
  setTimeout(() => { boot.style.display = 'none'; }, 600);
}

async function main() {
  initUI();

  if (reducedMotion) {
    bootStep(30, 'Reduced motion detected — static briefing mode.');
    const fb = document.getElementById('static-fallback');
    document.getElementById('fallback-reason').textContent =
      'prefers-reduced-motion is set: the 3D terminal is replaced by this static panel.';
    fb.hidden = false;
    finishBoot();
    log('STATIC MODE: 3D disabled via prefers-reduced-motion; all panels work.', 'sys');
    window.__ready = true;
    return;
  }

  let mod;
  try {
    bootStep(15, 'Loading Three.js 0.158.0 (importmap + SRI)…');
    const [THREE, oc, ec, rp, bp, fp, sp] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/FilmPass.js'),
      import('three/addons/postprocessing/ShaderPass.js')
    ]);
    mod = { THREE, OrbitControls: oc.OrbitControls, EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, UnrealBloomPass: bp.UnrealBloomPass, FilmPass: fp.FilmPass, ShaderPass: sp.ShaderPass };
  } catch (err) {
    window.__errors.push('three.js load failed: ' + String(err));
    bootStep(100, 'CDN load failed — falling back to static mode.');
    const fb = document.getElementById('static-fallback');
    document.getElementById('fallback-reason').textContent =
      'The vendored Three.js module failed to load (file missing or blocked). Static mode below.';
    fb.hidden = false;
    finishBoot();
    log('FALLBACK: three.js load failed — static mode.', 'sys');
    window.__ready = true;
    return;
  }

  const { THREE, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, FilmPass, ShaderPass } = mod;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    window.__errors.push('WebGL unavailable: ' + String(err));
    document.getElementById('fallback-reason').textContent = 'WebGL is not available in this browser.';
    document.getElementById('static-fallback').hidden = false;
    finishBoot();
    window.__ready = true;
    return;
  }

  bootStep(35, 'Building container terminal…');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d16);
  scene.fog = new THREE.FogExp2(0x1b1219, 0.0095);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 8.5, 21);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0c12, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 6;
  controls.maxDistance = 45;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.target.set(0, 2.5, -1);

  // --- sunset lighting (restrained) ---
  bootStep(55, 'Rigging sunset lights…');
  scene.add(new THREE.AmbientLight(0xffa050, 0.42));
  // Sky/ground bounce so the container sides do not fall into pure black.
  scene.add(new THREE.HemisphereLight(0x6f86b8, 0x3a2415, 0.55));
  const sun = new THREE.DirectionalLight(0xff8c00, 1.6);
  sun.position.set(-25, 12, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 120;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x4a5f96, 0.55);
  fill.position.set(20, 15, -20);
  scene.add(fill);
  // Warm terminal lamps: each stack gets its own pool of light.
  for (let i = 0; i < 6; i++) {
    const p = new THREE.PointLight(0xffa040, 34, 26, 1.6);
    p.position.set(-9 + (i % 3) * 9, 5.5, -5 + Math.floor(i / 3) * 10);
    scene.add(p);
  }
  // Rim light on the crane so it reads as a silhouette against the sunset, not a void.
  const craneLamp = new THREE.PointLight(0xffb060, 90, 30, 1.5);
  craneLamp.position.set(0, 11, -9);
  scene.add(craneLamp);

  // --- container stacks ---
  // Preferred path: Blender-built GLB (features/site/tools/make_models.py) gives
  // corrugated walls, locking rods, corner castings and a lattice crane. If the GLB
  // is missing or fails to load, we fall back to the procedural boxes below so the
  // page still renders. Nothing here reaches the network beyond our own origin.
  const MODEL_DIR = 'assets/models/';
  let gltfLoader = null;
  let containerModel = null;
  let craneModel = null;
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    gltfLoader = new GLTFLoader();
    const [cont, cran] = await Promise.all([
      gltfLoader.loadAsync(MODEL_DIR + 'container.glb'),
      gltfLoader.loadAsync(MODEL_DIR + 'crane.glb')
    ]);
    containerModel = cont.scene;
    craneModel = cran.scene;
    window.__modelsLoaded = true;
  } catch (err) {
    window.__errors.push('GLB load failed (procedural fallback): ' + String(err));
  }

  const containerGroup = new THREE.Group();
  scene.add(containerGroup);
  const palette = [0x8b4513, 0x7a3c10, 0x946b2d, 0x6e3b1f, 0x7f5539];
  const boxGeo = new THREE.BoxGeometry(2.4, 2.4, 6);
  let code = 1;
  const makeLabelPlate = (label) => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(20,14,8,0.85)'; cx.fillRect(0, 0, 256, 128);
    cx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < 256; x += 16) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 128); cx.stroke(); }
    cx.fillStyle = '#ffb347';
    cx.font = 'bold 34px monospace'; cx.textAlign = 'center';
    cx.fillText(label, 128, 56);
    cx.font = '18px monospace'; cx.fillStyle = '#c9b896';
    cx.fillText('AGENT CALL SHEET', 128, 92);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
  };
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      if ((row + col) % 4 === 3) continue; // gaps so the yard reads as a yard
      const h = (row + col) % 3 === 0 ? 2 : 1; // some stacks two high
      for (let lvl = 0; lvl < h; lvl++) {
        const label = 'ACS-' + String(code++).padStart(2, '0');
        const px = col * 3.1 - 6.2;
        const py = lvl * 2.62;
        const pz = row * 7 - 7;
        const rot = (Math.random() - 0.5) * 0.06;
        if (containerModel) {
          const m = containerModel.clone(true);
          m.position.set(px, py, pz);
          m.rotation.y = rot;
          m.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
          // The Blender model's ribbed end wall protrudes to local z = +3.09;
          // sit the decal just in front of it so the ribs cannot cut through the text.
          const plate = makeLabelPlate(label);
          plate.position.set(0, 1.3, 3.13);
          m.add(plate);
          containerGroup.add(m);
        } else {
          const mat = new THREE.MeshStandardMaterial({
            color: palette[(row * 5 + col + lvl) % palette.length],
            metalness: 0.35, roughness: 0.75
          });
          const m = new THREE.Mesh(boxGeo, mat);
          m.position.set(px, 1.2 + lvl * 2.42, pz);
          m.rotation.y = rot;
          m.castShadow = true; m.receiveShadow = true;
          const plate = makeLabelPlate(label);
          plate.position.set(0, 0, 3.01);
          m.add(plate);
          containerGroup.add(m);
        }
      }
    }
  }

  // --- sunset sky dome ---
  // A real dome (not a background texture) so the warm band sits on the 3D horizon
  // instead of being stretched behind the HUD panels.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 8; skyCanvas.height = 512;
  const skyCtx = skyCanvas.getContext('2d');
  const grad = skyCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#070912');   // zenith
  grad.addColorStop(0.30, '#111528');
  grad.addColorStop(0.46, '#3a2334');
  grad.addColorStop(0.53, '#8a3f1c');   // horizon glow
  grad.addColorStop(0.56, '#c9621a');
  grad.addColorStop(0.60, '#5a3018');
  grad.addColorStop(0.78, '#1b1218');
  grad.addColorStop(1.00, '#0b0a10');   // nadir
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, 8, 512);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.needsUpdate = true;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 24),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // --- gantry crane ---
  let hook = null;      // animated hook block (procedural fallback)
  let cable = null;     // animated cable (procedural fallback)
  let crane = null;
  if (craneModel) {
    crane = craneModel;
    crane.position.set(0, 0, -14);
    crane.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    scene.add(crane);
  } else {
    crane = new THREE.Group();
    const craneMat = new THREE.MeshStandardMaterial({ color: 0x2e2e34, metalness: 0.8, roughness: 0.35 });
    const legG = new THREE.BoxGeometry(0.8, 14, 0.8);
    [-4.6, 4.6].forEach(x => {
      const leg = new THREE.Mesh(legG, craneMat);
      leg.position.set(x, 7, -14); leg.castShadow = true; crane.add(leg);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 1.2), craneMat);
    beam.position.set(0, 14.2, -14); beam.castShadow = true; crane.add(beam);
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.6), new THREE.MeshStandardMaterial({ color: 0xff8c00, metalness: 0.4, roughness: 0.5, emissive: 0x552200 }));
    trolley.position.set(0, 13.4, -14); crane.add(trolley);
    cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5, 6), craneMat);
    cable.position.set(0, 10.8, -14); crane.add(cable);
    hook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), craneMat);
    hook.position.set(0, 8.2, -14); crane.add(hook);
    scene.add(crane);
  }

  // --- wet concrete ground ---
  bootStep(70, 'Pouring wet concrete…');
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.55, roughness: 0.35 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // puddles (restrained reflections via low roughness + metalness)
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x141a2c, metalness: 0.9, roughness: 0.06 });
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.7 + Math.random() * 1.3, 24), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(Math.random() * 30 - 15, 0.02, Math.random() * 26 - 13);
    scene.add(p);
  }

  // --- drizzle particles ---
  bootStep(85, 'Spawning drizzle…');
  const COUNT = 600;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 30;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x9aa4b8, size: 0.06, transparent: true, opacity: 0.55, sizeAttenuation: true
  }));
  scene.add(rain);

  // --- post-processing (same passes + SRI hashes as the landing page) ---
  bootStep(93, 'Wiring post-processing…');
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new FilmPass(0.12, 0.02, 648, false));
  const vignette = {
    uniforms: { tDiffuse: { value: null }, intensity: { value: 0.45 }, smoothness: { value: 0.6 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float intensity; uniform float smoothness; varying vec2 vUv; void main(){ vec4 color = texture2D(tDiffuse, vUv); float dist = length(vUv - 0.5); float v = smoothstep(0.5, 1.0 - smoothness, dist); color.rgb = mix(color.rgb, vec3(0.0), intensity * v); gl_FragColor = color; }'
  };
  composer.addPass(new ShaderPass(vignette));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  const positions = rainGeo.attributes.position.array;
  function animate() {
    requestAnimationFrame(animate);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] -= 0.12 + (i % 5) * 0.02;
      if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 30;
    }
    rainGeo.attributes.position.needsUpdate = true;
    if (hook) hook.position.y = 8.2 + Math.sin(performance.now() * 0.0012) * 0.5;
    if (cable) cable.scale.y = 1 + Math.sin(performance.now() * 0.0012) * 0.12;
    if (crane) crane.rotation.y = Math.sin(performance.now() * 0.00012) * 0.05;
    controls.update();
    composer.render();
  }

  finishBoot();
  log('SCENE: container terminal online — ' + (containerModel ? 'Blender GLB containers + gantry crane' : 'procedural containers + crane') + ', drizzle', 'sys');
  // Test hook: lets an automated check measure the scene graph (bounds, orientations).
  window.__scene = { scene, camera, controls, renderer, containerGroup, crane, containerModel, craneModel };
  animate();
  window.__ready = true;
}

main().catch((err) => {
  window.__errors.push('boot failed: ' + String(err && err.stack || err));
  bootStatus.textContent = 'Boot error — see console. Static panels may still work.';
  document.getElementById('static-fallback').hidden = false;
  finishBoot();
  window.__ready = true;
});
