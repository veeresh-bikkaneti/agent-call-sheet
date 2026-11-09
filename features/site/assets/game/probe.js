const out = document.getElementById('probe');
const lines = [];
try {
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2');
  const gl = gl2 || c.getContext('webgl');
  lines.push('webgl2=' + !!gl2 + ' webgl=' + !!gl);
  if (gl) { const e = gl.getExtension('WEBGL_debug_renderer_info'); lines.push('renderer=' + (e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))); }
} catch (e) { lines.push('ctx error ' + e.message); }
out.textContent = lines.join(' | ');
import('../vendor/three/three.module.js').then(T => {
  try {
    const r = new T.WebGLRenderer({ canvas: document.getElementById('c') });
    const s = new T.Scene(); s.background = new T.Color(0xd9a35b);
    const cam = new T.PerspectiveCamera(50, 1.6, 0.1, 50); cam.position.set(2, 2, 3); cam.lookAt(0, 0, 0);
    s.add(new T.Mesh(new T.BoxGeometry(), new T.MeshNormalMaterial()));
    r.render(s, cam);
    out.textContent += ' | three r' + T.REVISION + ' rendered OK';
  } catch (e) { out.textContent += ' | three error: ' + e.message; }
}, e => { out.textContent += ' | import failed: ' + e.message; });
