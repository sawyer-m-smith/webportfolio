// The optional 3D view of the home page: a 370Z parked under a night sky, with paper-cut
// dunes behind it and the site's sections as a constellation overhead.
// No post-processing and no lighting tricks, so it stays fast on ordinary hardware.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const low = coarse || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const canvas = document.getElementById('z3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: false, stencil: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

let ceiling = Infinity;
const MIN = 0.55;
const budget = low ? 1.3e6 : 2.4e6;
const pick = () => Math.max(MIN, Math.min(devicePixelRatio, low ? 1.5 : 2, ceiling, Math.sqrt(budget / (innerWidth * innerHeight))));
let dpr = pick();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
const clock = { t: 0 };
const color = (h) => new THREE.Color(h);

/* ---------- Sky ---------- */
const sky = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `varying vec2 v;
      void main(){
        vec3 top = vec3(0.075, 0.03, 0.05);
        vec3 mid = vec3(0.26, 0.06, 0.11);
        vec3 glow = vec3(0.86, 0.42, 0.30);
        float y = v.y;
        vec3 c = mix(glow, mid, smoothstep(0.26, 0.5, y));
        c = mix(c, top, smoothstep(0.42, 0.9, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
);
sky.frustumCulled = false;
sky.renderOrder = -10;
scene.add(sky);

const starUniforms = { uT: { value: 0 }, uPx: { value: dpr } };
function makeStars(n) {
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 1.1 - Math.PI * 0.05;
    const r = 90 + Math.random() * 60;
    pos.set([Math.cos(a) * r * 1.6, 4 + Math.random() * 62, -30 - Math.random() * 40], i * 3);
    const b = Math.pow(Math.random(), 5);
    size[i] = 1.3 + b * 3.6;
    phase[i] = Math.random() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aP', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: starUniforms,
    vertexShader: `attribute float aS, aP; uniform float uT, uPx; varying float vA;
      void main(){ vA = .62 + .38 * sin(uT * (.7 + aP * .22) + aP);
        gl_PointSize = aS * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float a = max(1. - dot(c, c) * 4., 0.); a *= a;
        gl_FragColor = vec4(vec3(1., .93, .84) * a * vA, 1.); }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}
const stars = makeStars(low ? 900 : 2200);
scene.add(stars);

/* ---------- Paper-cut dunes ---------- */
const DUNES = [
  { z: -52, y: 7.2, amp: 2.3, f: .10, ph: 1.1, c: '#e8896a' },
  { z: -40, y: 5.1, amp: 2.2, f: .13, ph: 3.4, c: '#c9543f' },
  { z: -30, y: 3.2, amp: 1.9, f: .17, ph: 5.2, c: '#9c2b2f' },
  { z: -20, y: 1.5, amp: 1.5, f: .21, ph: 2.0, c: '#651a29' },
  { z: -10, y: 0.2, amp: .8, f: .27, ph: 4.2, c: '#340e18' },
];
DUNES.forEach((d) => {
  const shape = new THREE.Shape();
  const W = 150;
  shape.moveTo(-W, -30);
  for (let x = -W; x <= W; x += 1.2) {
    shape.lineTo(x, d.y + Math.sin(x * d.f + d.ph) * d.amp + Math.sin(x * d.f * 2.3 + d.ph * 2) * d.amp * .3);
  }
  shape.lineTo(W, -30);
  const g = new THREE.ShapeGeometry(shape);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color(d.c) }));
  m.position.z = d.z;
  scene.add(m);
  // A soft contact shadow on the layer behind, like cut paper
  const s = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false }));
  s.position.set(0, .38, d.z - .05);
  scene.add(s);
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshBasicMaterial({ color: color('#1a0a0f') }));
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -.01, 190);
scene.add(floor);

/* ---------- The 370Z: the site's outline, given thickness ---------- */
const fx = (x) => (x - 945) / 100;
const fy = (y) => (698 - y) / 100;
const shape = new THREE.Shape();
shape.moveTo(fx(157), fy(520));
const C = (a, b, c, d, e, f) => shape.bezierCurveTo(fx(a), fy(b), fx(c), fy(d), fx(e), fy(f));
const L = (a, b) => shape.lineTo(fx(a), fy(b));
C(170, 480, 215, 445, 300, 412); C(370, 388, 470, 368, 690, 360); L(885, 256);
C(930, 236, 1000, 230, 1060, 232); C(1130, 235, 1190, 248, 1240, 262); C(1330, 295, 1430, 335, 1520, 360);
C(1570, 362, 1620, 355, 1655, 342); C(1650, 360, 1648, 375, 1650, 390); C(1675, 420, 1695, 470, 1705, 520);
C(1720, 560, 1732, 590, 1728, 615); C(1720, 640, 1690, 650, 1640, 652); L(1538, 652);
shape.absarc(fx(1430), fy(578), 1.3, Math.atan2(-.74, 1.08), Math.PI - Math.atan2(-.74, 1.08), false);
L(1290, 665); L(600, 665); L(548, 660);
shape.absarc(fx(450), fy(578), 1.3, Math.atan2(-.82, .98), Math.PI - Math.atan2(-.82, .98), false);
L(180, 660); shape.quadraticCurveTo(fx(157), fy(655), fx(157), fy(625)); shape.closePath();

function shapeOf(points) {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i ? s.lineTo(fx(p[0]), fy(p[1])) : s.moveTo(fx(p[0]), fy(p[1]))));
  s.closePath();
  return s;
}
const WIDTH = 3.4;
const car = new THREE.Group();
const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: WIDTH, bevelEnabled: true, bevelThickness: .34, bevelSize: .12, bevelSegments: low ? 2 : 4, curveSegments: low ? 8 : 16 });
bodyGeo.translate(0, 0, -WIDTH / 2);
const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhongMaterial({ color: color('#8a1c30'), specular: color('#ffd9c4'), shininess: 46 }));
car.add(body);
car.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 32), new THREE.LineBasicMaterial({ color: color('#f2ebe2'), transparent: true, opacity: .62 })));

const glassM = new THREE.MeshBasicMaterial({ color: color('#10060a') });
const glassParts = [
  [[695, 360], [905, 255], [935, 258], [800, 368]],
  [[805, 372], [870, 330], [950, 260], [1060, 258], [1192, 280], [1175, 372], [1000, 378]],
  [[1232, 306], [1330, 316], [1290, 345], [1228, 366]],
];
glassParts.forEach((pts) => {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: WIDTH + .76, bevelEnabled: false });
  g.translate(0, 0, -(WIDTH + .76) / 2);
  car.add(new THREE.Mesh(g, glassM));
});
const lampM = new THREE.MeshBasicMaterial({ color: color('#ffd2b0') });
const tailM = new THREE.MeshBasicMaterial({ color: color('#ff5a48') });
const lamp = (pts, m) => {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: WIDTH + .8, bevelEnabled: false });
  g.translate(0, 0, -(WIDTH + .8) / 2);
  car.add(new THREE.Mesh(g, m));
};
lamp([[200, 490], [300, 432], [395, 402], [340, 445], [270, 470]], lampM);
lamp([[1515, 364], [1622, 372], [1690, 446], [1612, 438]], tailM);

const wheels = [];
const tireG = new THREE.CylinderGeometry(1.2, 1.2, .95, low ? 20 : 36);
tireG.rotateX(Math.PI / 2);
const tireM = new THREE.MeshBasicMaterial({ color: color('#0c0507') });
const rimM = new THREE.MeshBasicMaterial({ color: color('#e8896a') });
const lipG = new THREE.TorusGeometry(.8, .055, 8, low ? 24 : 40);
const spokeG = new THREE.BoxGeometry(.13, .78, .06);
spokeG.translate(0, .4, 0);
[[fx(450), fy(578)], [fx(1430), fy(578)]].forEach(([x, y]) => {
  [1, -1].forEach((side) => {
    const w = new THREE.Group();
    w.position.set(x, y, side * (WIDTH / 2 + .02));
    w.add(new THREE.Mesh(tireG, tireM));
    const rim = new THREE.Group();
    rim.position.z = side * .49;
    rim.add(new THREE.Mesh(lipG, rimM));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeG, rimM);
      s.rotation.z = (i / 5) * Math.PI * 2;
      rim.add(s);
    }
    w.add(rim);
    wheels.push(rim);
    car.add(w);
  });
});
car.position.y = .02;
scene.add(car);

// A fading reflection on the ground: the same car, mirrored and dimmed
const mirror = new THREE.Group();
mirror.add(new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: color('#5e1422'), transparent: true, opacity: .26, depthWrite: false, depthTest: false })));
mirror.scale.y = -1;
mirror.position.y = -.02;
scene.add(mirror);

scene.add(new THREE.HemisphereLight(0xffc9a8, 0x2c0a12, 1.15));
const key = new THREE.DirectionalLight(0xffe0c8, 2.2);
key.position.set(-10, 14, 10);
const rimL = new THREE.DirectionalLight(0xff8a6a, 1.5);
rimL.position.set(9, 5, -14);
scene.add(rimL);
scene.add(key);

/* ---------- Sections as a constellation ---------- */
const SECTIONS = [
  ['cars', 'Cars', 'Buying, fixing, selling', [-11.5, 7.9, -7]],
  ['code', 'Code', 'Computers and data', [-6.4, 10.6, -9]],
  ['creative', 'Creative', 'Games and sewing', [0, 12, -10]],
  ['outdoors', 'Outdoors', 'Snow and trails', [6.4, 10.6, -9]],
  ['career', 'Career', 'Experience and now', [11.5, 7.9, -7]],
].map(([id, label, note, at]) => ({ id, label, note, home: at, at: new THREE.Vector3(...at) }));

const lineG = new THREE.BufferGeometry().setFromPoints(SECTIONS.map((s) => s.at));
const line = new THREE.Line(lineG, new THREE.LineBasicMaterial({ color: color('#f2ebe2'), transparent: true, opacity: .32 }));
scene.add(line);
const nodeG = new THREE.CircleGeometry(.2, 20);
SECTIONS.forEach((s) => {
  s.node = new THREE.Mesh(nodeG, new THREE.MeshBasicMaterial({ color: color('#fff3e4') }));
  s.node.position.copy(s.at);
  scene.add(s.node);
  const a = document.createElement('a');
  a.className = 'z-label';
  a.href = s.id + '.html';
  a.innerHTML = `<strong>${s.label}</strong><small>${s.note}</small>`;
  a.addEventListener('pointerenter', () => { hover = s; });
  a.addEventListener('pointerleave', () => { if (hover === s) hover = null; });
  a.addEventListener('focus', () => { hover = s; });
  a.addEventListener('blur', () => { if (hover === s) hover = null; });
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (reduced) { location.href = a.href; return; }
    leaving = { s, t: 0, href: a.href };
  });
  document.getElementById('z-labels').append(a);
  s.el = a;
});

/* ---------- Camera and input ---------- */
let hover = null;
let leaving = null;
let px = 0, py = 0, sx = 0, sy = 0, drag = 0, dragV = 0, dragging = false, lastX = 0;
let W = 1, H = 1, baseDist = 20;
const camPos = new THREE.Vector3();
const look = new THREE.Vector3(0, 2.6, 0);
const v = new THREE.Vector3();

function layout() {
  W = innerWidth;
  H = innerHeight;
  dpr = pick();
  starUniforms.uPx.value = dpr;
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  // Keep the whole car and every section in frame, whatever the window shape
  const tall = camera.aspect < 1;
  baseDist = Math.max(23, (tall ? 9 : 14.5) / (Math.tan(THREE.MathUtils.degToRad(18)) * camera.aspect));
  // On tall screens the constellation narrows and rises so its labels don't collide
  SECTIONS.forEach((s) => {
    s.at.set(s.home[0] * (tall ? .6 : 1), s.home[1] * (tall ? 1.3 : 1) + (tall ? 3 : 0), s.home[2]);
    s.node.position.copy(s.at);
  });
  lineG.setFromPoints(SECTIONS.map((s) => s.at));
}
addEventListener('resize', layout);
addEventListener('pointermove', (e) => {
  px = (e.clientX / W) * 2 - 1;
  py = (e.clientY / H) * 2 - 1;
  if (dragging) { dragV = (e.clientX - lastX) * .004; drag += dragV; lastX = e.clientX; }
}, { passive: true });
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
addEventListener('pointerup', () => { dragging = false; });

/* ---------- Speed governor: trades sharpness, then detail, for smoothness ---------- */
const gov = { at: 0, n: 0, good: 0, thin: false };
function govern(now) {
  if (!gov.at) { gov.at = now; gov.n = 0; return; }
  gov.n += 1;
  const spent = now - gov.at;
  if (spent < 1000) return;
  const fps = (gov.n / spent) * 1000;
  gov.at = now;
  gov.n = 0;
  window.Z3D_FPS = Math.round(fps);
  if (fps < 45) {
    gov.good = 0;
    if (dpr > MIN + .01) { ceiling = Math.max(MIN, dpr * Math.max(.65, Math.min(.92, Math.sqrt(fps / 55)))); layout(); } else if (!gov.thin) {
      gov.thin = true;
      mirror.visible = false;
      stars.geometry.setDrawRange(0, Math.floor(stars.geometry.attributes.position.count * .4));
    }
  }
}
document.addEventListener('visibilitychange', () => { gov.at = 0; });

/* ---------- Frame ---------- */
let last = 0, spin = 0, intro = reduced ? 1 : 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < 15.5) return;
  const dt = Math.min((now - last) / 1000, .1);
  last = now;
  clock.t += dt;
  starUniforms.uT.value = clock.t;

  intro = Math.min(1, intro + dt / 1.8);
  const k = 1 - Math.pow(1 - intro, 3);
  const damp = 1 - Math.exp(-3 * dt);
  sx += (px - sx) * damp;
  sy += (py - sy) * damp;
  if (!dragging) { drag += dragV; dragV *= .92; }
  const idle = reduced ? 0 : Math.sin(clock.t * .17) * .1;
  const yaw = .5 + sx * .24 + drag + idle;
  car.rotation.y = yaw;
  mirror.rotation.y = yaw;
  const dist = baseDist * (1.35 - .35 * k);
  camPos.set(reduced ? 0 : sx * 1.5, 4.9 + (reduced ? 0 : sy * -.8) + (1 - k) * 4, dist);
  look.set(0, 4.6, 0);

  if (leaving) {
    leaving.t = Math.min(1, leaving.t + dt / .75);
    const e = leaving.t * leaving.t * (3 - 2 * leaving.t);
    camPos.lerp(leaving.s.at, e * .86);
    look.lerp(leaving.s.at, e);
    document.body.style.setProperty('--fade', e);
    if (leaving.t >= 1) { const h = leaving.href; leaving = null; location.href = h; }
  }
  camera.position.copy(camPos);
  camera.lookAt(look);
  camera.updateMatrixWorld();

  // Wheels idle slowly, and rev when you point at Cars
  const goal = hover && hover.id === 'cars' ? 9 : leaving ? 14 : (reduced ? 0 : .35);
  spin += (goal - spin) * (1 - Math.exp(-2.5 * dt));
  wheels.forEach((r) => { r.rotation.z += spin * dt; });

  SECTIONS.forEach((s) => {
    const on = hover === s;
    const t = on ? 2.3 : 1;
    s.node.scale.x += (t - s.node.scale.x) * damp;
    s.node.scale.y = s.node.scale.x;
    s.node.lookAt(camera.position);
    v.copy(s.at).project(camera);
    const x = (v.x + 1) * .5 * W, y = (1 - v.y) * .5 * H;
    s.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,16px)`;
    s.el.classList.toggle('on', on);
  });
  line.material.opacity = hover ? .55 : .32;

  renderer.render(scene, camera);
  govern(now);
}

layout();
camPos.set(0, 8, baseDist * 1.35);
renderer.compile(scene, camera);
document.documentElement.classList.add('z-ready');
requestAnimationFrame(frame);
