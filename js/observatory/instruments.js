import * as THREE from 'three';

const LAMPS = [[-15, -2, 11], [15, -2, 11], [0, -3, -17]].map((a) => new THREE.Vector3(...a));
const LAMP_COLOR = new THREE.Color(1, 0.16, 0.09);
const VIEW = new THREE.Vector3(-8.5, -3.5, 15);

/**
 * Bakes the red lamplight into each vertex once, so the dome draws with the cheapest
 * material there is. It fills the whole screen, which made per-pixel lights very costly.
 */
function bakeLight(root) {
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const l = new THREE.Vector3();
  const v = new THREE.Vector3();
  const h = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    const base = mesh.userData.bake;
    if (!base) return;
    const g = mesh.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      v.copy(VIEW).sub(p).normalize();
      if (n.dot(v) < 0) n.negate();
      let r = base.r * 0.05;
      let gg = base.g * 0.055;
      let b = base.b * 0.09;
      LAMPS.forEach((lamp) => {
        l.copy(lamp).sub(p);
        const d2 = l.lengthSq();
        l.normalize();
        const fall = 90 / (30 + d2);
        const diff = Math.max(0, n.dot(l)) * fall;
        h.copy(l).add(v).normalize();
        const shine = Math.pow(Math.max(0, n.dot(h)), 26) * fall * mesh.userData.spec;
        r += (base.r * diff + shine) * LAMP_COLOR.r;
        gg += (base.g * diff + shine) * LAMP_COLOR.g;
        b += (base.b * diff + shine) * LAMP_COLOR.b;
      });
      col.set([r, gg, b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
  });
}

const brass = () => new THREE.MeshStandardMaterial({ color: 0xb98a3e, metalness: 1, roughness: 0.3 });

/** An armillary sphere. Its needle points at whichever part of the sky you're aiming for. */
export function makeArmillary() {
  const root = new THREE.Group();
  const metal = brass();
  const dark = new THREE.MeshStandardMaterial({ color: 0x6d5226, metalness: 1, roughness: 0.46 });
  const torus = (r, t, m = metal) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 16, 160), m);

  const outer = new THREE.Group();
  outer.add(torus(8, 0.17));
  outer.add(torus(7.55, 0.05, dark));
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.34, 0.1), metal, 120);
  const o = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    o.position.set(Math.cos(a) * 7.34, Math.sin(a) * 7.34, 0);
    o.rotation.z = a - Math.PI / 2;
    o.scale.y = i % 10 === 0 ? 1.8 : 1;
    o.updateMatrix();
    ticks.setMatrixAt(i, o.matrix);
  }
  outer.add(ticks);

  const horizon = torus(7.1, 0.13);
  horizon.rotation.x = Math.PI / 2;
  outer.add(horizon);

  const middle = new THREE.Group();
  middle.add(torus(6.1, 0.12));
  const equator = torus(6.1, 0.09, dark);
  equator.rotation.x = Math.PI / 2;
  middle.add(equator);

  const inner = new THREE.Group();
  const ecliptic = torus(4.8, 0.2);
  ecliptic.rotation.x = Math.PI / 2 + 0.41;
  inner.add(ecliptic);
  inner.add(torus(4.2, 0.06, dark));

  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 15.2, 12), metal);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62, 4),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color('#E8B95B').multiplyScalar(3.2) }),
  );

  const needle = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.08, 6.4, 10), metal);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 2.9;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 16), metal);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 6.3;
  needle.add(shaft, tip);

  root.add(outer, middle, inner, axis, core, needle);
  return { root, outer, middle, inner, needle };
}

/**
 * The building you begin inside: a dark dome that splits open like a clamshell,
 * lit with the dim red lamps real observatories use to protect night vision.
 */
export function makeDome() {
  const R = 24;
  const root = new THREE.Group();
  const lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const part = (geometry, hex, spec = 0) => {
    const m = new THREE.Mesh(geometry, lit);
    m.userData.bake = new THREE.Color(hex);
    m.userData.spec = spec;
    return m;
  };
  const SHELL = 0x454f6c;
  const RIB = 0x6b5a48;
  const PAINT = 0xa4a7b0;
  const BRASS = 0xc9973f;

  const half = () => {
    const g = new THREE.Group();
    g.add(part(new THREE.SphereGeometry(R, 72, 28, Math.PI / 2, Math.PI, 0, Math.PI / 2), SHELL));
    for (let i = 0; i <= 8; i++) {
      const m = part(new THREE.TorusGeometry(R - 0.25, 0.14, 6, 40, Math.PI / 2), RIB, 0.1);
      m.rotation.y = -Math.PI / 2 + (i / 8) * Math.PI;
      g.add(m);
    }
    return g;
  };

  const right = new THREE.Group();
  right.add(half());
  const left = new THREE.Group();
  const l = half();
  l.rotation.y = Math.PI;
  left.add(l);
  root.add(right, left);

  const wall = part(new THREE.CylinderGeometry(R, R, 9, 72, 4, true), SHELL);
  wall.position.y = -4.5;
  const floor = part(new THREE.CircleGeometry(R, 72), 0x171a24);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -9;
  root.add(wall, floor);

  const scope = new THREE.Group();
  scope.add(part(new THREE.CylinderGeometry(2.4, 2.1, 19, 48, 12, true), PAINT, 0.12));
  [-8.8, -2.5, 3.5, 9].forEach((y) => {
    const band = part(new THREE.TorusGeometry(y > 0 ? 2.46 : 2.28, 0.17, 10, 48), BRASS, 0.5);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    scope.add(band);
  });
  scope.position.set(0, 4.5, -3);
  scope.rotation.x = -0.34;
  const fork = part(new THREE.BoxGeometry(5.8, 1.4, 1.4), PAINT);
  fork.position.set(0, -0.2, -2.4);
  const pier = part(new THREE.CylinderGeometry(1.1, 1.8, 8.8, 24, 4), PAINT);
  pier.position.set(0, -4.6, -2.4);
  root.add(scope, fork, pier);

  bakeLight(root);

  LAMPS.forEach((at) => {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a26).multiplyScalar(5) }),
    );
    bulb.position.copy(at);
    root.add(bulb);
  });

  return {
    root,
    open(t) {
      const a = t * 1.42;
      right.rotation.z = -a;
      left.rotation.z = a;
    },
  };
}

/** Lines a figure from stroke data, drawing on progressively as uReveal rises. */
export function makeFigureLines(strokes, hex) {
  const pos = [];
  const along = [];
  let total = 0;
  strokes.forEach((s) => {
    for (let i = 1; i < s.length; i++) total += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  });
  let run = 0;
  strokes.forEach((s) => {
    for (let i = 1; i < s.length; i++) {
      const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      pos.push(s[i - 1][0], s[i - 1][1], 0, s[i][0], s[i][1], 0);
      along.push(run / total);
      run += d;
      along.push(run / total);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(along, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(hex) }, uOpacity: { value: 0.42 }, uReveal: { value: 1 } },
    vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uReveal; varying float vT;
      void main(){ if (vT > uReveal) discard; gl_FragColor = vec4(uColor * uOpacity, 1.0); }`,
  });
  return new THREE.LineSegments(g, m);
}
