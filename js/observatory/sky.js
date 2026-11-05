import * as THREE from 'three';

const GALAXY_NORMAL = new THREE.Vector3(0.38, 0.82, 0.43).normalize();

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uNormal;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; }
    return v;
  }
  void main() {
    vec3 d = normalize(vDir);
    float lat = dot(d, uNormal);
    float warp = fbm(d * 2.4 + 3.0);
    float band = exp(-pow(lat + (warp - 0.5) * 0.28, 2.0) * 16.0);
    float wide = exp(-lat * lat * 3.2);
    float clouds = fbm(d * 4.2 + warp * 1.6);
    float lanes = smoothstep(0.46, 0.68, fbm(d * 7.5 + 9.0 + warp));

    vec3 col = vec3(0.0045, 0.0075, 0.019);
    col += vec3(0.010, 0.016, 0.040) * wide;
    col += mix(vec3(0.03, 0.036, 0.08), vec3(0.12, 0.095, 0.11), clouds) * band * clouds * (1.0 - lanes * 0.82);

    float violet = smoothstep(0.54, 0.78, fbm(d * 2.1 + vec3(5.0, 1.0, 9.0)));
    float teal = smoothstep(0.56, 0.80, fbm(d * 2.6 + vec3(21.0, 7.0, 2.0)));
    float ember = smoothstep(0.60, 0.82, fbm(d * 3.1 + vec3(2.0, 31.0, 12.0)));
    col += vec3(0.042, 0.022, 0.085) * violet;
    col += vec3(0.007, 0.042, 0.044) * teal;
    col += vec3(0.11, 0.045, 0.02) * ember * band;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Paints the nebula once into a cube map, so it costs nothing per frame. */
export function bakeSky(renderer, low) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uNormal: { value: GALAXY_NORMAL } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: SKY_FRAG,
    }),
  ));
  const rt = new THREE.WebGLCubeRenderTarget(low ? 768 : 1536, { type: THREE.HalfFloatType, generateMipmaps: false });
  new THREE.CubeCamera(0.1, 100, rt).update(renderer, scene);
  return rt.texture;
}

/** A soft warm and cool studio, reflected only by the brass. */
export function makeEnvironment(renderer) {
  const scene = new THREE.Scene();
  const add = (hex, intensity, w, h, x, y, z) => {
    const c = new THREE.Color(hex).multiplyScalar(intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50), new THREE.MeshBasicMaterial({ color: 0x0a0f20, side: THREE.BackSide })));
  add('#ffd9a0', 7, 30, 12, 18, 26, 14);
  add('#8fb4ff', 3.5, 22, 34, -30, 4, 10);
  add('#ffb37a', 2.2, 40, 8, 0, -28, 10);
  add('#c9d2f0', 1.6, 16, 16, 10, 8, -30);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(scene, 0.03).texture;
  pm.dispose();
  return tex;
}

const STAR_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime, uPx, uPersp, uTwinkle;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 1.0 + uTwinkle * 0.34 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
    float s = aSize * uPx * tw;
    if (uPersp > 0.5) s *= 170.0 / max(-mv.z, 1.0);
    gl_PointSize = clamp(s, 1.0, 96.0 * uPx);
    vColor = aColor * tw;
    gl_Position = projectionMatrix * mv;
  }
`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  uniform float uFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = pow(1.0 - d, 3.2);
    float halo = pow(1.0 - d, 1.4) * 0.22;
    gl_FragColor = vec4(vColor * (core + halo) * uFade, 1.0);
  }
`;

export function starMaterial(shared, { perspective = false, fade = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: shared.uTime,
      uPx: shared.uPx,
      uTwinkle: shared.uTwinkle,
      uPersp: { value: perspective ? 1 : 0 },
      uFade: { value: fade },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
  });
}

const TEMPS = ['#9db8ff', '#c4d4ff', '#f4f3ff', '#ffffff', '#ffefd2', '#ffd9a3', '#ffb978'];

export function pointCloud(positions, colors, sizes, material) {
  const n = sizes.length;
  const phases = new Float32Array(n);
  for (let i = 0; i < n; i++) phases[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  return p;
}

/** The far sky. It follows the camera, so it stays infinitely distant. */
export function makeFarStars(shared, low) {
  const n = low ? 6000 : 16000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    v.randomDirection();
    if (Math.random() < 0.55) {
      const lat = v.dot(GALAXY_NORMAL);
      v.addScaledVector(GALAXY_NORMAL, -lat * (0.75 + Math.random() * 0.25)).normalize();
    }
    v.multiplyScalar(1500);
    pos.set([v.x, v.y, v.z], i * 3);
    const bright = Math.pow(Math.random(), 16);
    c.set(TEMPS[Math.floor(Math.random() * TEMPS.length)]).multiplyScalar(0.45 + bright * 2.2);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 1.4 + bright * 5.5;
  }
  return pointCloud(pos, col, size, starMaterial(shared));
}

/** Nearer stars scattered along the trail, which is what makes flying feel like flying. */
export function makeNearStars(shared, low) {
  const n = low ? 1500 : 4200;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos.set([(Math.random() - 0.5) * 760, (Math.random() - 0.5) * 460, 200 - Math.random() * 1150], i * 3);
    const bright = Math.pow(Math.random(), 7);
    c.set(TEMPS[Math.floor(Math.random() * TEMPS.length)]).multiplyScalar(0.38 + bright * 1.1);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 0.9 + bright * 2.6;
  }
  return pointCloud(pos, col, size, starMaterial(shared, { perspective: true }));
}

/** Light streaks that stretch along the direction of travel during a flight. */
export function makeStreaks(low) {
  const n = low ? 220 : 520;
  const pos = new Float32Array(n * 6);
  const end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 180, y = Math.random() * 180, z = Math.random() * 180;
    pos.set([x, y, z, x, y, z], i * 6);
    end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uCam: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() }, uI: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aEnd;
      uniform vec3 uCam, uVel;
      varying float vA;
      void main() {
        vec3 p = mod(position - uCam, 180.0) - 90.0 + uCam;
        p -= uVel * aEnd;
        vA = 1.0 - aEnd;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uI;
      varying float vA;
      void main() { gl_FragColor = vec4(vec3(0.75, 0.82, 1.0) * uI * (0.25 + vA), 1.0); }`,
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  return lines;
}
