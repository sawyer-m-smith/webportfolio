import * as THREE from 'three';

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
  const shell = new THREE.MeshStandardMaterial({ color: 0x1b2030, metalness: 0.75, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.15 });
  const rib = new THREE.MeshStandardMaterial({ color: 0x41362c, metalness: 0.9, roughness: 0.38, envMapIntensity: 0.3 });

  const half = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 24, Math.PI / 2, Math.PI, 0, Math.PI / 2), shell));
    for (let i = 0; i <= 8; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(R - 0.25, 0.14, 8, 48, Math.PI / 2), rib);
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

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 9, 64, 1, true), shell);
  wall.position.y = -4.5;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(R, 64),
    new THREE.MeshStandardMaterial({ color: 0x0e1018, metalness: 0.4, roughness: 0.62 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -9;
  root.add(wall, floor);

  const scope = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x8a8d96, metalness: 0.55, roughness: 0.38, side: THREE.DoubleSide, envMapIntensity: 0.1 });
  const brassy = brass();
  brassy.envMapIntensity = 0.3;
  scope.add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.1, 19, 40, 1, true), paint));
  [-8.8, -2.5, 3.5, 9].forEach((y) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(y > 0 ? 2.46 : 2.28, 0.17, 12, 48), brassy);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    scope.add(band);
  });
  scope.position.set(0, 4.5, -3);
  scope.rotation.x = -0.34;
  const fork = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.4, 1.4), paint);
  fork.position.set(0, -0.2, -2.4);
  const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.8, 8.8, 24), paint);
  pier.position.set(0, -4.6, -2.4);
  root.add(scope, fork, pier);

  [[-15, -2, 11], [15, -2, 11], [0, -3, -17]].forEach(([x, y, z]) => {
    const lamp = new THREE.PointLight(0xff2f1f, 230, 58, 1.7);
    lamp.position.set(x, y, z);
    root.add(lamp);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a26).multiplyScalar(5) }),
    );
    bulb.position.copy(lamp.position);
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
