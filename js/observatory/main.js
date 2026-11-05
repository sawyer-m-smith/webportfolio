// The 3D Observatory: one continuous world in which you begin inside a dome, rise into
// the night sky, fly to constellations that hold the work, and walk the trail through space.
// All the words are real HTML layered over the canvas, so they stay crisp, selectable,
// keyboard reachable, and readable by screen readers.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ROOMS, WAYPOINTS } from './data.js';
import { bakeSky, makeEnvironment, makeFarStars, makeNearStars, makeStreaks, pointCloud, starMaterial } from './sky.js';
import { makeArmillary, makeDome, makeFigureLines } from './instruments.js';
import { createAudio } from './audio.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const low = coarse || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const audio = createAudio();
const ROOM_IDS = Object.keys(ROOMS);
const clamp = THREE.MathUtils.clamp;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const TAN25 = Math.tan(THREE.MathUtils.degToRad(25));

/* ---------- Renderer ---------- */

const canvas = document.createElement('canvas');
canvas.className = 'obs-canvas';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 is required');
let dpr = Math.min(devicePixelRatio, low ? 1.5 : 2);
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const shared = { uTime: { value: 0 }, uPx: { value: dpr }, uTwinkle: { value: reduced ? 0 : 1 } };
const scene = new THREE.Scene();
scene.background = bakeSky(renderer, low);
scene.environment = makeEnvironment(renderer);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);

const farStars = makeFarStars(shared, low);
scene.add(farStars, makeNearStars(shared, low));
const streaks = makeStreaks(low);
scene.add(streaks);

const key = new THREE.DirectionalLight(0xffe2b8, 2.2);
key.position.set(20, 30, 40);
const rim = new THREE.DirectionalLight(0x7fa6ff, 1.4);
rim.position.set(-30, 10, -20);
scene.add(key, rim);

const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
const composer = new EffectComposer(renderer, target);
composer.setPixelRatio(dpr);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.55, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- Figures ---------- */

function makeFigure(strokes, hex, bright) {
  const group = new THREE.Group();
  const lines = makeFigureLines(strokes, hex);
  group.add(lines);

  const seen = new Set();
  const pts = [];
  strokes.forEach((s) => s.forEach((p) => {
    const k = `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    if (!seen.has(k)) { seen.add(k); pts.push(p); }
  }));
  const isBright = (p) => bright.some((b) => Math.hypot(b[0] - p[0], b[1] - p[1]) < 0.1);
  const n = pts.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const main = new THREE.Color(hex);
  const pale = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.55);
  pts.forEach((p, i) => {
    pos.set([p[0], p[1], 0], i * 3);
    const hot = isBright(p);
    const c = (hot ? main : pale).clone().multiplyScalar(hot ? 5 : 1.5);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = hot ? 15 : 4.4;
  });
  const material = starMaterial(shared, { perspective: true });
  group.add(pointCloud(pos, col, size, material));
  return { group, lines, material };
}

const rooms = {};
ROOM_IDS.forEach((id) => {
  const data = ROOMS[id];
  const fig = makeFigure(data.strokes, data.color, data.projects.map((p) => p.at));
  fig.base = data.scale || 1;
  fig.center = new THREE.Vector3();
  fig.glow = 0;
  fig.reveal = reduced ? 1 : 0;
  rooms[id] = fig;
  scene.add(fig.group);
});

/* ---------- The trail ---------- */

const ANCHORS = [
  [-34, 14, -230],
  [46, -20, -380],
  [-44, 24, -530],
  [36, -8, -680],
  [0, 12, -840],
].map((a) => new THREE.Vector3(...a));

const trailWorld = new THREE.Group();
trailWorld.visible = false;
scene.add(trailWorld);
const stops = [];
WAYPOINTS.forEach((w, i) => {
  const fig = makeFigure(w.strokes, w.color, []);
  fig.group.position.copy(ANCHORS[i]);
  fig.lines.material.uniforms.uOpacity.value = 1.3;
  trailWorld.add(fig.group);
  stops.push(fig);
});

const beaconPos = new Float32Array(ANCHORS.length * 3);
const beaconCol = new Float32Array(ANCHORS.length * 3);
const beaconSize = new Float32Array(ANCHORS.length).fill(10);
const pathPoints = [new THREE.Vector3(-30, -46, 70)];
ANCHORS.forEach((a, i) => {
  const p = a.clone().add(new THREE.Vector3(0, -21, 0));
  pathPoints.push(p);
  beaconPos.set([p.x, p.y, p.z], i * 3);
  const c = new THREE.Color(WAYPOINTS[i].color).multiplyScalar(5);
  beaconCol.set([c.r, c.g, c.b], i * 3);
});
trailWorld.add(pointCloud(beaconPos, beaconCol, beaconSize, starMaterial(shared, { perspective: true })));

const pathCurve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5);
const pathMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uP: { value: 0 } },
  vertexShader: 'varying float vX; void main(){ vX = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying float vX; uniform float uP;
    void main(){
      float walked = smoothstep(uP + 0.015, uP - 0.015, vX);
      float dash = step(0.42, fract(vX * 170.0));
      vec3 gold = vec3(0.90, 0.56, 0.18);
      gl_FragColor = vec4(gold * mix(dash * 0.30, 0.95, walked), 1.0);
    }`,
});
const pathLengths = pathCurve.getLengths(600);
const pathFraction = (t) => pathLengths[Math.round(clamp(t, 0, 1) * 600)] / pathLengths[600];
const path = new THREE.Mesh(new THREE.TubeGeometry(pathCurve, 500, 0.16, 6, false), pathMaterial);
path.frustumCulled = false;
trailWorld.add(path);

/* ---------- Instruments ---------- */

const armillary = makeArmillary();
scene.add(armillary.root);
const DOME_AT = new THREE.Vector3(0, -86, 62);
const dome = makeDome();
dome.root.position.copy(DOME_AT);
scene.add(dome.root);

/* ---------- Page furniture ---------- */

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const ui = el('div', 'obs-ui');
document.body.append(ui);
const nav = document.querySelector('.site-nav');

const curtain = el('div', 'obs-curtain');
const hero = el('section', 'obs-hero', `
  <h1>A map of what I've built.</h1>
  <p>I designed my own high school curriculum from scratch: restoring a car for profit, building a game in Unreal Engine, running a computer-refurbishing business, analyzing 800 data points from fatal avalanches. Along the way I learned that how I feel about a hard problem is a choice, not a given, and that's shaped how I build everything since.</p>
  <div class="obs-actions">
    <a class="btn" href="#trail">Walk the trail</a>
    <button class="obs-ghost" data-reading type="button">Reading view</button>
  </div>`);
const introBar = el('div', 'obs-intro', `<span>Opening the dome</span><button class="obs-text-btn" type="button">Skip</button>`);
const hint = el('p', 'obs-hint', coarse ? 'Tap a constellation. Swipe up to walk the trail.' : 'Choose a constellation, drag to look around, or scroll to walk the trail.');
const readout = el('div', 'obs-readout', '<span class="ra"></span><span class="dec"></span>');
const tools = el('div', 'obs-tools', `
  <button class="obs-text-btn" data-sound type="button" aria-pressed="false">Sound off</button>
  <a class="obs-text-btn" href="https://github.com/sawyer-m-smith" target="_blank" rel="noopener">GitHub</a>`);
const panel = el('aside', 'obs-panel');
panel.setAttribute('aria-live', 'polite');
const card = el('article', 'obs-card');
card.setAttribute('aria-live', 'polite');
const rail = el('nav', 'obs-rail');
rail.setAttribute('aria-label', 'Stops along the trail');
rail.innerHTML = `<button class="obs-text-btn obs-rail-exit" type="button">Leave the trail</button><div class="obs-rail-track"><span class="obs-rail-fill"></span></div>`;
const railTrack = rail.querySelector('.obs-rail-track');
const railFill = rail.querySelector('.obs-rail-fill');
const railStops = WAYPOINTS.map((w, i) => {
  const b = el('button', 'obs-rail-stop', `<span>${w.when}</span>`);
  b.type = 'button';
  b.style.left = `${(i / (WAYPOINTS.length - 1)) * 100}%`;
  b.setAttribute('aria-label', `${w.when}: ${w.title}`);
  b.addEventListener('click', () => { trail.goal = i / (WAYPOINTS.length - 1); });
  railTrack.append(b);
  return b;
});
const reticle = el('div', 'obs-reticle');
ui.append(curtain, hero, hint, readout, tools, panel, card, rail, introBar);
if (!coarse) ui.append(reticle);

const roomLabels = {};
ROOM_IDS.forEach((id) => {
  const a = el('a', 'obs-label obs-label--room', `<strong>${ROOMS[id].title}</strong><small>${countLabel(ROOMS[id])}</small>`);
  a.href = `#${id}`;
  a.style.setProperty('--c', ROOMS[id].color);
  a.addEventListener('pointerenter', () => setHover(id));
  a.addEventListener('pointerleave', () => setHover(null));
  a.addEventListener('focus', () => setHover(id));
  a.addEventListener('blur', () => setHover(null));
  ui.append(a);
  roomLabels[id] = a;
});
function countLabel(r) {
  if (!r.projects.length) return 'Notes in progress';
  return r.projects.length === 1 ? '1 project' : `${r.projects.length} projects`;
}
const projectLabels = [];
ROOM_IDS.forEach((id) => ROOMS[id].projects.forEach((p) => {
  const a = el('a', 'obs-label obs-label--project', `<span>${p.title}</span>`);
  a.href = p.page;
  a.style.setProperty('--c', ROOMS[id].color);
  ui.append(a);
  projectLabels.push({ room: id, at: p.at, node: a });
}));

/* ---------- Camera rig ---------- */

const rig = { pos: new THREE.Vector3(), look: new THREE.Vector3(), swoop: 0 };
let tween = null;
function flyTo(pos, look, dur = 1.9, done) {
  if (reduced || dur === 0) {
    rig.pos.copy(pos);
    rig.look.copy(look);
    tween = null;
    if (done) done();
    return;
  }
  audio.whoosh();
  tween = { fromP: rig.pos.clone(), fromL: rig.look.clone(), toP: pos.clone(), toL: look.clone(), t: 0, dur, done };
}

const drag = { active: false, moved: 0, x: 0, y: 0, yaw: 0, pitch: 0, idle: 0 };
const pointer = { x: 0, y: 0, sx: innerWidth / 2, sy: innerHeight / 2, smoothX: 0, smoothY: 0, seen: false };
let W = 1, H = 1, portrait = false;
const home = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

const trail = { p: 0, goal: 0, idle: 0, stand: null, aim: null, active: false, shown: -1 };

function layout() {
  W = innerWidth;
  H = innerHeight;
  const aspect = W / H;
  portrait = aspect < 1.15;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  composer.setSize(W, H);
  bloom.setSize(W * dpr * 0.5, H * dpr * 0.5);

  const spots = portrait
    ? { code: [12, -9, 0.62], cars: [-13, -35, 0.62], creative: [13, -60, 0.62], atlas: [-25, -9, 0.42] }
    : { code: [44, 23, 1], cars: [14, -23, 1], creative: [68, -21, 1], atlas: [87, 33, 0.62] };
  // Keep the wide layout inside the frame on narrower windows.
  const fit = portrait ? 1 : clamp(aspect / 1.78, 0.72, 1.15);
  ROOM_IDS.forEach((id) => {
    const r = rooms[id];
    const [x, y, s] = spots[id];
    r.group.position.set(x * fit, y, -60);
    r.group.scale.setScalar(s * Math.min(fit, 1));
    r.center.copy(r.group.position);
  });
  home.pos.set(0, 0, portrait ? 118 : 60);
  home.look.set(0, 0, -60);
  armillary.root.position.copy(portrait ? new THREE.Vector3(-19, -38, 26) : new THREE.Vector3(-21, -14.5, 20));
  armillary.root.scale.setScalar(portrait ? 0.8 : 1);

  // On portrait screens the words sit below, so aim low enough to lift the figure above them.
  const tall = 30 / (TAN25 * aspect);
  const standOff = portrait ? new THREE.Vector3(0, -0.5 * TAN25 * tall, tall) : new THREE.Vector3(24, 0, 66);
  const aimOff = portrait ? new THREE.Vector3(0, -0.5 * TAN25 * tall, 0) : new THREE.Vector3(24, 0, 0);
  const standPts = [home.pos.clone(), ...ANCHORS.map((a) => a.clone().add(standOff))];
  const aimPts = [home.look.clone(), ...ANCHORS.map((a) => a.clone().add(aimOff))];
  trail.stand = new THREE.CatmullRomCurve3(standPts.slice(1), false, 'catmullrom', 0.5);
  trail.aim = new THREE.CatmullRomCurve3(aimPts.slice(1), false, 'catmullrom', 0.5);
  applyRoute(true);
}

/* ---------- Routes ---------- */

let mode = 'intro';
let route = '';
let hover = null;

function setHover(id) {
  if (hover === id) return;
  hover = id;
  if (id) audio.ping(id === 'code' ? 880 : id === 'cars' ? 660 : id === 'creative' ? 990 : 1180);
  reticle.classList.toggle('is-hot', !!id);
  canvas.classList.toggle('is-hot', !!id);
}

function setMode(next) {
  mode = next;
  trailWorld.visible = next === 'trail';
  document.body.dataset.obs = next;
}

function roomCamera(id) {
  const c = rooms[id].center;
  const s = rooms[id].group.scale.x;
  if (portrait) {
    const fitDist = (32 * s) / (TAN25 * camera.aspect);
    const drop = 0.58 * TAN25 * fitDist;
    return { pos: c.clone().add(new THREE.Vector3(0, -drop, fitDist)), look: c.clone().add(new THREE.Vector3(0, -drop, 0)) };
  }
  const dist = 76 * s;
  const halfW = TAN25 * dist * camera.aspect;
  const shift = (Math.min(440, W) / W) * halfW;
  return { pos: c.clone().add(new THREE.Vector3(shift, 0, dist)), look: c.clone().add(new THREE.Vector3(shift, 0, 0)) };
}

function fillPanel(id) {
  const r = ROOMS[id];
  const items = r.projects.map((p, i) => `
    <a class="obs-project" href="${p.page}" data-i="${i}" style="--c:${r.color}">
      <span class="obs-project-tag">${p.tag}</span>
      <h3>${p.title}</h3>
      <p>${p.hook}</p>
      <span class="obs-project-meta">${p.meta}</span>
    </a>`).join('');
  panel.innerHTML = `
    <p class="obs-eyebrow" style="color:${r.color}">Constellation: ${r.figure}</p>
    <h2 tabindex="-1">${r.title}</h2>
    <p class="obs-panel-intro">${r.intro}</p>
    <div class="obs-projects">${items}</div>
    <div class="obs-panel-foot">
      <a class="obs-text-btn" href="${r.page}">Open the full page</a>
      <a class="obs-text-btn" href="#">Back to the sky</a>
    </div>`;
  panel.querySelector('h2').focus({ preventScroll: true });
}

function applyRoute(instant) {
  const dur = instant ? 0 : undefined;
  if (mode === 'intro') return;
  trail.active = false;
  if (ROOMS[route]) {
    setMode('room');
    fillPanel(route);
    if (!instant) rooms[route].reveal = reduced ? 1 : 0;
    const v = roomCamera(route);
    flyTo(v.pos, v.look, dur);
  } else if (route === 'trail') {
    setMode('trail');
    trail.goal = Math.max(trail.goal, 0);
    const go = () => { trail.active = true; };
    const pos = trail.stand.getPoint(trail.p);
    const look = trail.aim.getPoint(trail.p);
    if (instant) { rig.pos.copy(pos); rig.look.copy(look); tween = null; go(); } else flyTo(pos, look, 2.6, go);
  } else {
    setMode('home');
    flyTo(home.pos, home.look, dur);
  }
}

function readRoute() {
  const h = location.hash.replace('#', '');
  route = ROOMS[h] || h === 'trail' ? h : '';
}

addEventListener('hashchange', () => {
  readRoute();
  if (mode === 'intro') finishIntro();
  drag.idle = 99;
  setHover(null);
  applyRoute(false);
});

nav.querySelectorAll('a').forEach((a) => {
  const page = a.getAttribute('href').replace('.html', '');
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (page === 'index') { e.preventDefault(); location.hash = ''; return; }
    if (ROOMS[page] || page === 'trail') { e.preventDefault(); location.hash = page; }
  });
});

/* ---------- Opening sequence ---------- */

const intro = { t: 0, dur: 9, start: new THREE.Vector3(), startLook: new THREE.Vector3() };
intro.start.copy(DOME_AT).add(new THREE.Vector3(-8.5, -3.5, 15));
intro.startLook.copy(DOME_AT).add(new THREE.Vector3(0.6, 14, -8));

function finishIntro() {
  if (mode !== 'intro') return;
  sessionStorage.setItem('obs-intro-seen', '1');
  dome.open(1);
  dome.root.visible = false;
  curtain.style.opacity = 0;
  setMode('home');
  rig.pos.copy(home.pos);
  rig.look.copy(home.look);
  ROOM_IDS.forEach((id) => { rooms[id].reveal = reduced ? 1 : 0; });
}

function updateIntro(dt) {
  intro.t += dt;
  const t = intro.t;
  curtain.style.opacity = 1 - span(t, 0.2, 1.8);
  dome.open(ease(span(t, 1.6, 5.2)));
  const rise = ease(span(t, 3.6, intro.dur));
  const bow = new THREE.Vector3(-6 * Math.sin(rise * Math.PI), 0, 8 * Math.sin(rise * Math.PI));
  rig.pos.lerpVectors(intro.start, home.pos, rise).add(bow);
  rig.look.lerpVectors(intro.startLook, home.look, ease(span(t, 4.4, intro.dur)));
  if (t > intro.dur) finishIntro();
}

introBar.querySelector('button').addEventListener('click', () => {
  finishIntro();
  applyRoute(true);
});

/* ---------- Input ---------- */

canvas.addEventListener('pointerdown', (e) => {
  drag.active = true;
  drag.moved = 0;
  drag.x = e.clientX;
  drag.y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  drag.active = false;
  if (drag.moved < 7 && mode === 'home' && hover) location.hash = hover;
  else if (drag.moved < 7 && coarse && mode === 'home') {
    const hit = roomAt(e.clientX, e.clientY);
    if (hit) location.hash = hit;
  }
  drag.idle = 0;
});
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / W) * 2 - 1;
  pointer.y = (e.clientY / H) * 2 - 1;
  pointer.sx = e.clientX;
  pointer.sy = e.clientY;
  pointer.seen = true;
  reticle.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  if (drag.active) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!coarse || mode !== 'trail') {
      drag.yaw += dx * 0.0032;
      drag.pitch = clamp(drag.pitch + dy * 0.0026, -0.75, 0.75);
    }
    spin += Math.abs(dx) * 0.0007;
  } else if (mode === 'home' && e.target === canvas) {
    setHover(roomAt(e.clientX, e.clientY));
  }
});

const v3 = new THREE.Vector3();
function toScreen(world) {
  v3.copy(world).project(camera);
  return { x: (v3.x + 1) * 0.5 * W, y: (1 - v3.y) * 0.5 * H, front: v3.z < 1 };
}
function roomAt(x, y) {
  let best = null;
  let bestD = Infinity;
  ROOM_IDS.forEach((id) => {
    const r = rooms[id];
    const c = toScreen(r.center);
    if (!c.front) return;
    const e = toScreen(v3.clone().copy(r.center).add(new THREE.Vector3(26 * r.group.scale.x, 0, 0)));
    const radius = Math.abs(e.x - c.x);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < radius && d < bestD) { best = id; bestD = d; }
  });
  return best;
}

let wheelBank = 0;
let wheelAt = 0;
function nudge(delta) {
  const now = performance.now();
  if (now - wheelAt > 500) wheelBank = 0;
  wheelAt = now;
  spin += Math.abs(delta) * 0.00016;
  if (mode === 'home') {
    wheelBank += delta;
    if (wheelBank > 130) { wheelBank = 0; location.hash = 'trail'; }
  } else if (mode === 'trail' && trail.active) {
    trail.idle = 0;
    if (trail.goal <= 0 && delta < 0) {
      wheelBank += delta;
      if (wheelBank < -160) { wheelBank = 0; location.hash = ''; }
      return;
    }
    trail.goal = clamp(trail.goal + delta * 0.00052, 0, 1);
  }
}
addEventListener('wheel', (e) => {
  if (e.target.closest && e.target.closest('.obs-panel')) return;
  nudge(e.deltaY);
}, { passive: true });

let touchY = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (touchY === null || (e.target.closest && e.target.closest('.obs-panel'))) return;
  const y = e.touches[0].clientY;
  nudge((touchY - y) * 2.2);
  touchY = y;
}, { passive: true });

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mode !== 'home') {
    if (mode === 'intro') { finishIntro(); applyRoute(true); } else location.hash = '';
    return;
  }
  if (mode !== 'trail') return;
  const step = 1 / (WAYPOINTS.length - 1);
  const at = Math.round(trail.goal / step);
  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
    if (e.target.tagName === 'BUTTON' && e.key === ' ') return;
    e.preventDefault();
    trail.goal = Math.min(1, (at + 1) * step);
  } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
    e.preventDefault();
    if (at === 0) location.hash = '';
    else trail.goal = (at - 1) * step;
  }
});

rail.querySelector('.obs-rail-exit').addEventListener('click', () => { location.hash = ''; });
tools.querySelector('[data-sound]').addEventListener('click', (e) => {
  const on = audio.toggle();
  e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
  e.currentTarget.setAttribute('aria-pressed', String(on));
});
hero.querySelector('[data-reading]').addEventListener('click', () => {
  localStorage.setItem('obs-view', 'reading');
  location.href = location.pathname;
});

/* ---------- Frame ---------- */

let spin = 0;
const needleGoal = new THREE.Quaternion();
const needleFrom = new THREE.Object3D();
const tmp = new THREE.Vector3();
const prevPos = new THREE.Vector3();
const timer = new THREE.Timer();
let shownCard = -1;

function fillCard(i) {
  const w = WAYPOINTS[i];
  card.style.setProperty('--c', w.color);
  card.innerHTML = `
    <p class="obs-eyebrow" style="color:${w.color}">${w.when}</p>
    <h2>${w.title}</h2>
    <p>${w.text}</p>
    ${w.page ? `<a class="obs-text-btn" href="${w.page}">${w.linkText}</a>` : ''}`;
}

function updateTrail(dt) {
  trail.idle += dt;
  const n = WAYPOINTS.length - 1;
  if (trail.idle > 0.55) {
    const snap = Math.round(trail.goal * n) / n;
    trail.goal = damp(trail.goal, snap, 3.2, dt);
  }
  trail.p = damp(trail.p, trail.goal, reduced ? 60 : 2.6, dt);
  if (trail.active && !tween) {
    trail.stand.getPoint(trail.p, rig.pos);
    trail.aim.getPoint(trail.p, rig.look);
  }
  const near = Math.round(trail.p * n);
  const close = Math.abs(trail.p - near / n) < 0.035 && trail.active;
  if (close && shownCard !== near) { shownCard = near; fillCard(near); audio.ping(620 + near * 110); }
  card.classList.toggle('is-on', close);
  railFill.style.width = `${trail.p * 100}%`;
  railStops.forEach((b, i) => b.classList.toggle('is-here', i === near));
  pathMaterial.uniforms.uP.value = pathFraction((1 + trail.p * n) / (pathPoints.length - 1));
  // Only the stop you're standing at is lit; the others wait in the distance.
  stops.forEach((fig, i) => {
    const near2 = 1 - clamp(Math.abs(trail.p - i / n) * n * 1.4, 0, 1);
    fig.lines.material.uniforms.uOpacity.value = 0.06 + near2 * 1.25;
    fig.material.uniforms.uFade.value = 0.08 + near2;
  });
}

function updateLabels() {
  const showRooms = mode === 'home';
  ROOM_IDS.forEach((id) => {
    const node = roomLabels[id];
    const r = rooms[id];
    const s = toScreen(tmp.copy(r.center).add(v3.set(0, -18 * r.group.scale.x, 0)));
    const inView = s.front && s.x > -60 && s.x < W + 60 && s.y > -40 && s.y < H + 40;
    node.classList.toggle('is-on', showRooms && inView && r.reveal > 0.25 && !tween);
    node.classList.toggle('is-hot', hover === id);
    if (showRooms) node.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,0)`;
  });
  projectLabels.forEach((l) => {
    const show = mode === 'room' && route === l.room && !tween && !portrait;
    l.node.classList.toggle('is-on', show);
    if (!show) return;
    const r = rooms[l.room];
    const s = toScreen(tmp.set(l.at[0], l.at[1], 0).multiplyScalar(r.group.scale.x).add(r.center));
    const below = portrait ? 18 : -11;
    const half = l.node.offsetWidth / 2 + 8;
    const x = half * 2 < W ? clamp(s.x, half, W - half) : W / 2;
    l.node.style.transform = `translate(${x}px,${s.y + below}px) translate(-50%,-100%)`;
  });
}

let readoutAt = 0;
function updateReadout(now) {
  if (now - readoutAt < 90) return;
  readoutAt = now;
  const ndcX = pointer.seen ? pointer.x : 0;
  const ndcY = pointer.seen ? -pointer.y : 0;
  tmp.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
  const dec = Math.asin(clamp(tmp.y, -1, 1)) * THREE.MathUtils.RAD2DEG;
  const ra = ((Math.atan2(tmp.x, -tmp.z) + Math.PI * 2) % (Math.PI * 2)) * (12 / Math.PI);
  const h = Math.floor(ra);
  const m = Math.floor((ra - h) * 60);
  const ad = Math.abs(dec);
  readout.firstChild.textContent = `Right ascension ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  readout.lastChild.textContent = `Declination ${dec < 0 ? '-' : '+'}${String(Math.floor(ad)).padStart(2, '0')}° ${String(Math.floor((ad % 1) * 60)).padStart(2, '0')}′`;
}

let slowFrames = 0;
let checked = 0;

function frame(now) {
  requestAnimationFrame(frame);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  shared.uTime.value += dt;

  if (mode === 'intro') updateIntro(dt);
  if (mode === 'trail') updateTrail(dt);

  rig.swoop = 0;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const k = ease(tween.t);
    rig.pos.lerpVectors(tween.fromP, tween.toP, k);
    rig.look.lerpVectors(tween.fromL, tween.toL, ease(Math.min(1, tween.t * 1.25)));
    rig.swoop = Math.sin(tween.t * Math.PI);
    if (tween.t >= 1) {
      const done = tween.done;
      tween = null;
      if (done) done();
    }
  }

  // Figures brighten when they matter, and draw themselves on as you arrive.
  ROOM_IDS.forEach((id, i) => {
    const r = rooms[id];
    const focus = mode === 'room' && route === id;
    const dim = mode === 'room' && !focus;
    const goal = mode === 'trail' ? 0.08 : focus ? 1.3 : hover === id ? 1.5 : dim ? 0.1 : 0.82;
    r.glow = damp(r.glow, goal, 5, dt);
    r.lines.material.uniforms.uOpacity.value = r.glow;
    r.material.uniforms.uFade.value = clamp(r.glow * 1.6, 0.05, 1.2);
    if (mode !== 'intro' && !tween) r.reveal = Math.min(1, r.reveal + dt / (1.1 + i * 0.3));
    r.lines.material.uniforms.uReveal.value = r.reveal;
        r.group.visible = mode !== 'intro' || intro.t > 5;
  });

  // Camera: the route, plus a little parallax and whatever the visitor dragged.
  pointer.smoothX = damp(pointer.smoothX, reduced ? 0 : pointer.x, 2.5, dt);
  pointer.smoothY = damp(pointer.smoothY, reduced ? 0 : pointer.y, 2.5, dt);
  if (!drag.active) {
    drag.idle += dt;
    if (mode !== 'home' || drag.idle > 4) {
      drag.yaw = damp(drag.yaw, 0, 1.6, dt);
      drag.pitch = damp(drag.pitch, 0, 1.6, dt);
    }
  }
  camera.position.copy(rig.pos);
  camera.position.x += pointer.smoothX * 2.4;
  camera.position.y -= pointer.smoothY * 1.5;
  camera.lookAt(rig.look);
  camera.rotateY(drag.yaw);
  camera.rotateX(drag.pitch);
  camera.fov = 50 + rig.swoop * 13;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  farStars.position.copy(camera.position);

  // Light streaks stretch with speed.
  tmp.copy(camera.position).sub(prevPos);
  const speed = tmp.length() / Math.max(dt, 0.001);
  prevPos.copy(camera.position);
  const u = streaks.material.uniforms;
  u.uCam.value.copy(camera.position);
  u.uVel.value.copy(tmp).multiplyScalar(reduced ? 0 : 2.4);
  u.uI.value = reduced ? 0 : clamp(speed / 260, 0, 0.9);
  bloom.strength = 0.55 + rig.swoop * 0.4;

  // The armillary keeps turning, faster when you stir it, and its needle aims.
  spin = damp(spin, 0, 1.4, dt);
  if (!reduced) {
    const a = armillary;
    a.outer.rotation.y += dt * (0.08 + spin);
    a.middle.rotation.x += dt * (0.13 + spin * 1.3);
    a.inner.rotation.y -= dt * (0.17 + spin * 1.6);
    a.root.rotation.x = damp(a.root.rotation.x, 0.32 + pointer.smoothY * 0.22, 3, dt);
    a.root.rotation.z = damp(a.root.rotation.z, -0.28 - pointer.smoothX * 0.22, 3, dt);
    const aim = hover || (mode === 'room' ? route : null);
    tmp.copy(aim ? rooms[aim].center : v3.set(Math.sin(shared.uTime.value * 0.2) * 30, 40, -30));
    a.root.getWorldPosition(needleFrom.position);
    needleFrom.lookAt(tmp);
    needleGoal.copy(needleFrom.quaternion).premultiply(a.root.getWorldQuaternion(new THREE.Quaternion()).invert());
    a.needle.quaternion.slerp(needleGoal, 1 - Math.exp(-5 * dt));
  }

  updateLabels();
  updateReadout(now);
  composer.render(dt);

  // If this machine is struggling, quietly trade away the most expensive effects.
  if (mode !== 'intro' && checked < 2) {
    slowFrames = dt > 0.034 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 70) {
      slowFrames = 0;
      checked += 1;
      if (checked === 1) {
        dpr = Math.min(dpr, 1);
        shared.uPx.value = dpr;
        renderer.setPixelRatio(dpr);
        composer.setPixelRatio(dpr);
        layout();
      } else {
        bloom.enabled = false;
      }
    }
  }
}

/* ---------- Begin ---------- */

addEventListener('resize', layout);
readRoute();
const skipIntro = reduced || sessionStorage.getItem('obs-intro-seen') || route;
setMode('intro');
layout();
if (skipIntro) {
  finishIntro();
  curtain.style.opacity = 0;
  applyRoute(true);
} else {
  dome.open(0);
  curtain.style.opacity = 1;
  rig.pos.copy(intro.start);
  rig.look.copy(intro.startLook);
}
prevPos.copy(rig.pos);
document.documentElement.classList.add('obs-ready');
requestAnimationFrame(frame);
