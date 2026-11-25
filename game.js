import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Sound } from './audio.js';

// ---------------------------------------------------------------- rules
const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
const PLAYER_DEFS = [
  { name: 'Red', color: 0xff4d5e, css: '#ff4d5e' },
  { name: 'Blue', color: 0x3fa9ff, css: '#3fa9ff' },
  { name: 'Green', color: 0x3ddc84, css: '#3ddc84' },
  { name: 'Gold', color: 0xffc93c, css: '#ffc93c' },
];
const MODES = {
  cpu: [false, true], p2: [false, false], p3: [false, false, false],
  p4: [false, false, false, false], demo: [true, true, true],
};
const OFFSETS = [[-0.22, 0.22], [0.22, 0.22], [-0.22, -0.22], [0.22, -0.22]];
const TABLE_Y = -0.5;

const sound = new Sound();
let speed = 1;
const V3 = THREE.Vector3;

function cellXZ(n) {
  const row = Math.floor((n - 1) / 10);
  let col = (n - 1) % 10;
  if (row % 2) col = 9 - col;
  return { x: col - 4.5, z: 4.5 - row };
}

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = (() => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#3a3f8f'); grd.addColorStop(0.55, '#1d2050'); grd.addColorStop(1, '#0d0f26');
  g.fillStyle = grd; g.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
scene.fog = new THREE.Fog(0x161a3d, 28, 65);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.45;
controls.minDistance = 7;
controls.maxDistance = 32;
controls.target.set(0.9, 0, 0.4);
function frameCamera() {
  const a = innerWidth / innerHeight;
  const k = a < 1 ? 2.05 / a : (a < 1.4 ? 1.3 : 1);
  camera.position.set(0.9, 12.5 * k, 12 * k);
  camera.aspect = a; camera.updateProjectionMatrix();
}
frameCamera();

scene.add(new THREE.HemisphereLight(0xc6d6ff, 0x2a1d40, 0.55));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
const rim = new THREE.PointLight(0x8a7bff, 90, 0, 2);
rim.position.set(9, 5, -9);
scene.add(rim);

// ---------------------------------------------------------------- textures
function woodTexture(base = '#8a5a33') {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = `rgba(${50 + Math.random() * 40},${25 + Math.random() * 20},8,${0.12 + Math.random() * 0.22})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    const y = Math.random() * 512;
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 24) g.lineTo(x, y + Math.sin(x * 0.015 + i) * 7);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function boardTexture() {
  const S = 2048, cs = S / 10;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  for (let n = 1; n <= 100; n++) {
    const row = Math.floor((n - 1) / 10);
    let col = (n - 1) % 10; if (row % 2) col = 9 - col;
    const x = col * cs, y = (9 - row) * cs;
    const hue = (190 + row * 17 + col * 3) % 360;
    const light = (row + col) % 2 ? 66 : 79;
    const grd = g.createLinearGradient(x, y, x + cs, y + cs);
    grd.addColorStop(0, `hsl(${hue},75%,${light + 6}%)`);
    grd.addColorStop(1, `hsl(${hue},70%,${light - 4}%)`);
    g.fillStyle = grd; g.fillRect(x, y, cs, cs);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 5; g.strokeRect(x + 6, y + 6, cs - 12, cs - 12);
    g.fillStyle = 'rgba(28,22,60,0.78)';
    g.font = `700 ${cs * 0.27}px Fredoka, Arial, sans-serif`;
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(String(n), x + cs * 0.1, y + cs * 0.08);
    g.font = `700 ${cs * 0.15}px Fredoka, Arial, sans-serif`;
    g.textAlign = 'right'; g.textBaseline = 'bottom';
    if (LADDERS[n]) { g.fillStyle = '#0d7a3e'; g.fillText(`▲${LADDERS[n]}`, x + cs * 0.92, y + cs * 0.94); }
    if (SNAKES[n]) { g.fillStyle = '#b3122a'; g.fillText(`▼${SNAKES[n]}`, x + cs * 0.92, y + cs * 0.94); }
  }
  g.strokeStyle = 'rgba(30,20,70,0.35)'; g.lineWidth = 4;
  for (let i = 0; i <= 10; i++) {
    g.beginPath(); g.moveTo(i * cs, 0); g.lineTo(i * cs, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * cs); g.lineTo(S, i * cs); g.stroke();
  }
  const label = (n, text, color) => {
    const { x, z } = cellXZ(n);
    const px = (x + 5) * cs, py = (z + 5) * cs;
    g.fillStyle = color; g.font = `700 ${cs * 0.2}px Fredoka, Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, px + cs * 0.06, py + cs * 0.12);
  };
  label(1, 'START', '#14532d');
  label(100, '★ FINISH', '#7a1020');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// ---------------------------------------------------------------- board
await Promise.race([document.fonts.load('700 60px Fredoka'), new Promise(r => setTimeout(r, 2000))]);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(45, 72),
  new THREE.MeshStandardMaterial({ color: 0x2a2d5c, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2; ground.position.y = TABLE_Y; ground.receiveShadow = true;
scene.add(ground);

const frameMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55, metalness: 0.05 });
const frame = new THREE.Mesh(new RoundedBoxGeometry(10.9, 0.5, 10.9, 4, 0.15), frameMat);
frame.position.y = -0.25; frame.castShadow = true; frame.receiveShadow = true;
scene.add(frame);

const boardTop = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.5, metalness: 0.0 }),
);
boardTop.rotation.x = -Math.PI / 2; boardTop.position.y = 0.012; boardTop.receiveShadow = true;
scene.add(boardTop);

// ---------------------------------------------------------------- ladders
function cylinderBetween(p1, p2, r, mat) {
  const d = new V3().subVectors(p2, p1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), mat);
  m.position.copy(p1).add(p2).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const railMat = new THREE.MeshStandardMaterial({ map: woodTexture('#c98a42'), roughness: 0.45 });
const rungMat = new THREE.MeshStandardMaterial({ map: woodTexture('#e8c27e'), roughness: 0.45 });
for (const [a, b] of Object.entries(LADDERS)) {
  const A = cellXZ(+a), B = cellXZ(+b);
  const start = new V3(A.x, 0.11, A.z), end = new V3(B.x, 0.11, B.z);
  const dir = new V3().subVectors(end, start); const len = dir.length(); dir.normalize();
  const perp = new V3(-dir.z, 0, dir.x).multiplyScalar(0.21);
  const s = start.clone().addScaledVector(dir, -0.25), e = end.clone().addScaledVector(dir, 0.25);
  for (const k of [1, -1]) scene.add(cylinderBetween(s.clone().addScaledVector(perp, k), e.clone().addScaledVector(perp, k), 0.055, railMat));
  const rungs = Math.max(2, Math.floor((len + 0.5) / 0.36));
  for (let i = 0; i <= rungs; i++) {
    const p = s.clone().lerp(e, i / rungs);
    scene.add(cylinderBetween(p.clone().add(perp), p.clone().sub(perp), 0.035, rungMat));
  }
}

// ---------------------------------------------------------------- snakes
const SNAKE_COLORS = [
  [0x2ecc71, 0x145a32], [0xff7043, 0xffd54f], [0x9b59b6, 0xf5c6ff], [0x00bcd4, 0x004d61], [0xe53935, 0x1b1b1b],
  [0xfdd835, 0x33691e], [0xff4081, 0xffe0ec], [0x26a69a, 0xffee58], [0x5c6bc0, 0xf0f0ff], [0xff9800, 0x4e342e],
];
const snakes = [];
const sphereGeo = new THREE.SphereGeometry(1, 18, 12);
const dummy = new THREE.Object3D();
let snakeIdx = 0;
for (const [h, t] of Object.entries(SNAKES)) {
  const H = cellXZ(+h), T = cellXZ(+t);
  const p0 = new V3(H.x, 0.2, H.z), p1 = new V3(T.x, 0.2, T.z);
  const d = new V3().subVectors(p1, p0); const L = d.length();
  const perp = new V3(-d.z, 0, d.x).normalize();
  const waves = Math.max(1, Math.round(L / 2.6));
  const amp = Math.min(0.75, 0.32 + L * 0.045) * (snakeIdx % 2 ? 1 : -1);
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const k = i / 30;
    const p = p0.clone().lerp(p1, k);
    p.addScaledVector(perp, Math.sin(k * Math.PI * 2 * waves) * amp * Math.sin(k * Math.PI) * 1.2);
    p.y = 0.2 + Math.sin(k * Math.PI) * 0.1;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const count = Math.max(50, Math.round(curve.getLength() / 0.065));
  const [c1, c2] = SNAKE_COLORS[snakeIdx % SNAKE_COLORS.length];
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const mesh = new THREE.InstancedMesh(sphereGeo, mat, count);
  mesh.castShadow = true;
  const base = [], perps = [], radii = [];
  const col1 = new THREE.Color(c1), col2 = new THREE.Color(c2);
  for (let i = 0; i < count; i++) {
    const k = i / (count - 1);
    base.push(curve.getPointAt(k));
    const tg = curve.getTangentAt(k);
    perps.push(new V3(-tg.z, 0, tg.x).normalize());
    radii.push(THREE.MathUtils.lerp(0.15, 0.04, Math.pow(k, 0.9)) * (k < 0.04 ? 0.85 : 1));
    mesh.setColorAt(i, Math.floor(i / 5) % 2 ? col2 : col1);
  }
  scene.add(mesh);

  // head
  const head = new THREE.Group();
  const headMat = new THREE.MeshPhysicalMaterial({ color: c1, roughness: 0.3, clearcoat: 0.8 });
  const skull = new THREE.Mesh(sphereGeo, headMat); skull.scale.set(0.21, 0.15, 0.29); skull.castShadow = true;
  head.add(skull);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(sphereGeo, white); eye.scale.setScalar(0.06); eye.position.set(0.1 * sx, 0.09, 0.1);
    const pupil = new THREE.Mesh(sphereGeo, black); pupil.scale.setScalar(0.032); pupil.position.set(0.115 * sx, 0.115, 0.14);
    head.add(eye, pupil);
  }
  const tongue = new THREE.Group();
  const tMat = new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.4 });
  const tBase = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.16), tMat); tBase.position.z = 0.08;
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.07), tMat); f1.position.set(0.02, 0, 0.18); f1.rotation.y = 0.5;
  const f2 = f1.clone(); f2.position.x = -0.02; f2.rotation.y = -0.5;
  tongue.add(tBase, f1, f2); tongue.position.set(0, -0.03, 0.25);
  head.add(tongue);
  const fwd = new V3().subVectors(base[0], base[3]).setY(0).normalize();
  head.position.copy(base[0]).addScaledVector(fwd, 0.08);
  head.lookAt(head.position.clone().add(fwd));
  scene.add(head);

  snakes.push({ head: +h, tail: +t, curve, mesh, base, perps, radii, headObj: head, tongue, headY: head.position.y, phase: snakeIdx * 1.7 });
  snakeIdx++;
}
function updateSnakes(time) {
  for (const s of snakes) {
    const n = s.base.length;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const w = Math.sin(time * 2.2 - k * 14 + s.phase) * 0.05 * Math.sin(k * Math.PI);
      dummy.position.copy(s.base[i]).addScaledVector(s.perps[i], w);
      dummy.scale.setScalar(s.radii[i]);
      dummy.updateMatrix();
      s.mesh.setMatrixAt(i, dummy.matrix);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
    s.headObj.position.y = s.headY + 0.06 + Math.sin(time * 3 + s.phase) * 0.03;
    const flick = Math.max(0, Math.sin(time * 5 + s.phase * 3));
    s.tongue.scale.z = 0.2 + flick * 0.9;
  }
}

// ---------------------------------------------------------------- dice
function pipTexture(v) {
  const s = 256; const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, s, s);
  const P = {
    1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]],
    4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]],
    6: [[.28, .22], [.72, .22], [.28, .5], [.72, .5], [.28, .78], [.72, .78]],
  };
  for (const [px, py] of P[v]) {
    const r = v === 1 ? s * 0.13 : s * 0.085;
    const grd = g.createRadialGradient(px * s - r * 0.3, py * s - r * 0.3, r * 0.1, px * s, py * s, r);
    grd.addColorStop(0, v === 1 ? '#ff5a6a' : '#4a4a6a'); grd.addColorStop(1, v === 1 ? '#a3001a' : '#0d0d1a');
    g.fillStyle = grd; g.beginPath(); g.arc(px * s, py * s, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Box material order: +x, -x, +y, -y, +z, -z
const FACE_VALUES = [2, 5, 1, 6, 3, 4];
const FACE_EULER = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
const dice = new THREE.Mesh(
  new RoundedBoxGeometry(0.9, 0.9, 0.9, 5, 0.13),
  FACE_VALUES.map(v => new THREE.MeshPhysicalMaterial({ map: pipTexture(v), roughness: 0.25, clearcoat: 0.9 })),
);
dice.castShadow = true;
const DICE_REST = new V3(7.1, TABLE_Y + 0.45, 2.2);
dice.position.copy(DICE_REST);
scene.add(dice);
function faceQuat(v) {
  const [x, y, z] = FACE_EULER[v];
  const yaw = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.random() * Math.PI * 2);
  return yaw.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
}
dice.quaternion.copy(faceQuat(6));

// ---------------------------------------------------------------- tweens
const tweens = [];
function tween(duration, fn) {
  return new Promise(res => tweens.push({ t: 0, duration, fn, res }));
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.duration);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

async function rollDice(value) {
  sound.dice();
  const axis = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  const axis2 = new V3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
  await tween(0.8, k => {
    dice.position.x = DICE_REST.x + Math.sin(k * 7) * 0.35 * (1 - k);
    dice.position.z = DICE_REST.z + Math.cos(k * 5) * 0.3 * (1 - k);
    dice.position.y = DICE_REST.y + Math.abs(Math.sin(k * Math.PI * 2.5)) * 1.6 * (1 - k);
    dice.rotateOnWorldAxis(axis, 0.42 * (1 - k * 0.7));
    dice.rotateOnWorldAxis(axis2, 0.2 * (1 - k));
  });
  const from = dice.quaternion.clone(), target = faceQuat(value);
  await tween(0.32, k => {
    dice.quaternion.slerpQuaternions(from, target, easeOutBack(k));
    dice.position.lerp(DICE_REST, k);
  });
  dice.position.copy(DICE_REST);
  sound.land();
}

// ---------------------------------------------------------------- tokens
function makePawn(color) {
  const prof = [[0, 0], [0.27, 0], [0.29, 0.04], [0.27, 0.08], [0.2, 0.11], [0.15, 0.2], [0.11, 0.34],
    [0.1, 0.42], [0.18, 0.45], [0.18, 0.49], [0.09, 0.51], [0, 0.51]].map(([x, y]) => new THREE.Vector2(x, y));
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 32, 20), mat);
  head.position.y = 0.62;
  body.castShadow = head.castShadow = true;
  g.add(body, head);
  g.scale.setScalar(0.85);
  return g;
}
function tokenTarget(p, n) {
  const [ox, oz] = OFFSETS[p.index];
  if (n === 0) return new V3(-6.4 + ox * 1.4, TABLE_Y, 4.3 - p.index * 0.75);
  const { x, z } = cellXZ(n);
  return new V3(x + ox, 0.012, z + oz);
}
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.3, 0.4, 48),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);

// ---------------------------------------------------------------- particles
const sparkGeo = new THREE.BufferGeometry();
const SPARKS = 260;
const sparkPos = new Float32Array(SPARKS * 3);
for (let i = 0; i < SPARKS; i++) {
  sparkPos[i * 3] = (Math.random() - 0.5) * 18;
  sparkPos[i * 3 + 1] = Math.random() * 7;
  sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
}
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
  color: 0xfff1c4, size: 0.06, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(sparks);

const CONF = 600;
const confetti = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.14, 0.08),
  new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  CONF,
);
const confData = [];
const confColors = [0xff4d5e, 0x3fa9ff, 0x3ddc84, 0xffc93c, 0xc77dff, 0xffffff].map(c => new THREE.Color(c));
for (let i = 0; i < CONF; i++) {
  confData.push({ p: new V3(), v: new V3(), r: new THREE.Euler(), rv: new V3() });
  confetti.setColorAt(i, confColors[i % confColors.length]);
}
confetti.visible = false; confetti.frustumCulled = false;
scene.add(confetti);
let confettiTime = 0;
function burstConfetti(center) {
  confetti.visible = true; confettiTime = 0;
  for (const d of confData) {
    d.p.copy(center).add(new V3((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6));
    d.v.set((Math.random() - 0.5) * 7, 5 + Math.random() * 7, (Math.random() - 0.5) * 7);
    d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    d.rv.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  }
}
function updateParticles(dt, time) {
  const a = sparkGeo.attributes.position;
  for (let i = 0; i < SPARKS; i++) {
    let y = a.getY(i) + dt * 0.25;
    if (y > 7) y = 0;
    a.setY(i, y);
  }
  a.needsUpdate = true;
  sparks.material.opacity = 0.55 + Math.sin(time * 2) * 0.2;
  if (!confetti.visible) return;
  confettiTime += dt;
  confData.forEach((d, i) => {
    d.v.y -= 9 * dt; d.v.multiplyScalar(0.985);
    d.p.addScaledVector(d.v, dt);
    if (d.p.y < TABLE_Y + 0.02) { d.p.y = TABLE_Y + 0.02; d.v.set(0, 0, 0); }
    else { d.r.x += d.rv.x * dt; d.r.y += d.rv.y * dt; d.r.z += d.rv.z * dt; }
    dummy.position.copy(d.p); dummy.rotation.copy(d.r); dummy.scale.setScalar(1); dummy.updateMatrix();
    confetti.setMatrixAt(i, dummy.matrix);
  });
  confetti.instanceMatrix.needsUpdate = true;
  if (confettiTime > 9) confetti.visible = false;
}

// ---------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const ui = {
  players: $('players'), logList: $('logList'), roll: $('rollBtn'), turn: $('turnText'), toast: $('toast'),
  start: $('startScreen'), win: $('winScreen'), winText: $('winText'), winSub: $('winSub'),
};
let toastTimer = null;
function showToast(text, cls = 'good') {
  ui.toast.textContent = text;
  ui.toast.className = `show ${cls}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.className = cls; }, 1400 / Math.sqrt(speed));
}
function log(html, color) {
  const li = document.createElement('li');
  li.innerHTML = html;
  if (color) li.style.setProperty('--lc', color);
  ui.logList.prepend(li);
  while (ui.logList.children.length > 12) ui.logList.lastChild.remove();
}
function shake() {
  const app = $('app');
  app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
}

// ---------------------------------------------------------------- game state
const state = { mode: null, players: [], current: 0, busy: false, winner: null, turns: 0, gameId: 0 };
let cpuTimer = null, winTimer = null;

// Stops the running game: cancels timers and finishes pending animations so no stale turn continues.
function abortGame() {
  state.gameId++;
  state.mode = null; state.busy = false;
  clearTimeout(cpuTimer); clearTimeout(winTimer);
  const pending = tweens.splice(0);
  for (const tw of pending) tw.res();
  dice.position.copy(DICE_REST);
  updateUI();
}
function disposePawn(mesh) {
  scene.remove(mesh);
  mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}

function updateUI() {
  ui.players.innerHTML = state.players.map((p, i) => `
    <div class="pl ${i === state.current && !state.winner ? 'active' : ''}" style="--pc:${p.css}" data-player="${i}">
      <div class="row"><span class="dot"></span><span class="nm">${p.name}</span><span class="pos">${p.pos || 'Start'}</span></div>
      <div class="bar"><i style="width:${p.pos}%"></i></div>
    </div>`).join('');
  const cur = state.players[state.current];
  const canRoll = !!cur && !state.busy && !state.winner && !cur.cpu;
  ui.roll.disabled = !canRoll;
  if (state.winner) ui.turn.innerHTML = `<span style="color:${state.winner.css}">${state.winner.name} wins!</span>`;
  else if (cur) ui.turn.innerHTML = `<span style="color:${cur.css}">${cur.name}</span>${cur.cpu ? ' is thinking…' : "'s turn"}`;
}

function startGame(mode) {
  abortGame();
  for (const p of state.players) disposePawn(p.mesh);
  dice.quaternion.copy(faceQuat(6));
  const cfg = MODES[mode];
  state.mode = mode; state.current = 0; state.busy = false; state.winner = null; state.turns = 0;
  state.players = cfg.map((cpu, i) => {
    const d = PLAYER_DEFS[i];
    const p = { index: i, name: d.name + (cpu ? ' 🤖' : ''), color: d.color, css: d.css, cpu, pos: 0, mesh: makePawn(d.color) };
    p.mesh.position.copy(tokenTarget(p, 0));
    scene.add(p.mesh);
    return p;
  });
  ui.logList.innerHTML = '';
  confetti.visible = false;
  log(`New game — ${state.players.length} players. Good luck!`);
  ui.start.classList.add('hidden');
  ui.win.classList.add('hidden');
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  sound.ensure(); sound.startMusic(); sound.click();
  updateUI();
  scheduleCpu();
}

async function hop(p, n, i) {
  const a = p.mesh.position.clone(), b = tokenTarget(p, n);
  sound.step(i);
  await tween(0.24, k => {
    p.mesh.position.lerpVectors(a, b, k);
    p.mesh.position.y += Math.sin(k * Math.PI) * 0.6;
    const sq = 1 + Math.sin(k * Math.PI * 2) * 0.08;
    p.mesh.scale.set(0.85 / Math.sqrt(sq), 0.85 * sq, 0.85 / Math.sqrt(sq));
  });
  p.mesh.scale.setScalar(0.85);
  p.pos = n;
  updateUI();
}

async function climb(p, to) {
  const a = tokenTarget(p, p.pos), b = tokenTarget(p, to);
  sound.ladder();
  await tween(1.1, k => {
    const e = easeInOut(k);
    p.mesh.position.lerpVectors(a, b, e);
    p.mesh.position.y += 0.15 + Math.sin(k * Math.PI) * 0.7 + Math.abs(Math.sin(k * Math.PI * 8)) * 0.12;
  });
  p.mesh.position.copy(b);
  p.pos = to;
}

async function slide(p, to) {
  const s = snakes.find(x => x.head === p.pos);
  const [ox, oz] = OFFSETS[p.index];
  sound.snake();
  shake();
  await tween(1.5, k => {
    const c = s.curve.getPointAt(easeInOut(k));
    p.mesh.position.set(c.x + ox * 0.3, c.y + 0.12, c.z + oz * 0.3);
    p.mesh.rotation.y = k * Math.PI * 6;
    p.mesh.rotation.z = Math.sin(k * Math.PI * 4) * 0.3;
  });
  const a = p.mesh.position.clone(), b = tokenTarget(p, to);
  await tween(0.2, k => p.mesh.position.lerpVectors(a, b, k));
  p.mesh.rotation.set(0, 0, 0);
  p.pos = to;
}

async function takeTurn(forced) {
  if (!state.mode || state.busy || state.winner) return false;
  clearTimeout(cpuTimer);
  state.busy = true; updateUI();
  const id = state.gameId;
  const stale = () => id !== state.gameId;
  const p = state.players[state.current];
  const v = Number.isInteger(forced) && forced >= 1 && forced <= 6 ? forced : 1 + Math.floor(Math.random() * 6);
  await rollDice(v);
  if (stale()) return false;
  log(`<b>${p.name}</b> rolled a ${v}`, p.css);
  const target = p.pos + v;
  if (target > 100) {
    log(`<b>${p.name}</b> needs exactly ${100 - p.pos} — stays on ${p.pos}`, p.css);
    showToast(`Need exactly ${100 - p.pos}!`, 'warn');
    sound.bonk();
  } else {
    for (let n = p.pos + 1, i = 0; n <= target; n++, i++) {
      await hop(p, n, i);
      if (stale()) return false;
    }
    if (LADDERS[p.pos]) {
      const to = LADDERS[p.pos];
      showToast(`🪜 Ladder! ${p.pos} → ${to}`, 'good');
      log(`<b>${p.name}</b> climbed a ladder ${p.pos} → ${to} 🪜`, p.css);
      await climb(p, to);
    } else if (SNAKES[p.pos]) {
      const to = SNAKES[p.pos];
      showToast(`🐍 Snake! ${p.pos} → ${to}`, 'bad');
      log(`<b>${p.name}</b> was bitten by a snake ${p.pos} → ${to} 🐍`, p.css);
      await slide(p, to);
    }
    if (stale()) return false;
  }
  state.turns++;
  if (p.pos === 100) {
    state.winner = p;
    log(`🏆 <b>${p.name}</b> wins in ${state.turns} turns!`, p.css);
    sound.win();
    burstConfetti(p.mesh.position);
    showToast(`🏆 ${p.name} wins!`, 'warn');
    winTimer = setTimeout(() => {
      if (stale()) return;
      ui.winText.innerHTML = `<span style="color:${p.css}">${p.name}</span> wins!`;
      ui.winSub.textContent = `Reached square 100 after ${state.turns} turns.`;
      ui.win.classList.remove('hidden');
    }, 1800 / speed);
  } else if (v === 6) {
    log(`<b>${p.name}</b> rolled a 6 — extra turn!`, p.css);
    showToast('🎲 Six! Roll again', 'warn');
    sound.six();
  } else {
    state.current = (state.current + 1) % state.players.length;
  }
  state.busy = false;
  updateUI();
  scheduleCpu();
  return true;
}

function scheduleCpu() {
  clearTimeout(cpuTimer);
  const cur = state.players[state.current];
  if (state.mode && !state.winner && cur && cur.cpu) cpuTimer = setTimeout(() => takeTurn(), 900 / speed);
}

// ---------------------------------------------------------------- controls
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.mode)));
ui.roll.addEventListener('click', () => takeTurn());
$('againBtn').addEventListener('click', () => { ui.win.classList.add('hidden'); ui.start.classList.remove('hidden'); });
$('btnNew').addEventListener('click', () => { sound.click(); abortGame(); ui.win.classList.add('hidden'); ui.start.classList.remove('hidden'); });
$('btnSound').addEventListener('click', e => { sound.sfxOn = !sound.sfxOn; e.currentTarget.classList.toggle('off', !sound.sfxOn); e.currentTarget.textContent = sound.sfxOn ? '🔊' : '🔇'; });
$('btnMusic').addEventListener('click', e => { sound.ensure(); sound.startMusic(); sound.musicOn = !sound.musicOn; e.currentTarget.classList.toggle('off', !sound.musicOn); });
function setSpeed(s) { speed = s; $('btnSpeed').textContent = `${s}×`; }
$('btnSpeed').addEventListener('click', () => { setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1); sound.click(); });
addEventListener('keydown', e => {
  if (e.target instanceof HTMLButtonElement && e.target !== ui.roll) return;
  if ((e.code === 'Space' || e.code === 'Enter') && !ui.roll.disabled) { e.preventDefault(); takeTurn(); }
});
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); frameCamera(); });

// Test hooks (used by the Playwright check)
window.__game = {
  start: startGame,
  roll: v => takeTurn(v),
  setSpeed,
  setPos(i, n) { const p = state.players[i]; p.pos = n; p.mesh.position.copy(tokenTarget(p, n)); updateUI(); },
  state: () => ({
    mode: state.mode, current: state.current, busy: state.busy, turns: state.turns,
    winner: state.winner ? state.winner.name : null,
    players: state.players.map(p => ({ name: p.name, pos: p.pos, cpu: p.cpu })),
  }),
  rules: { SNAKES, LADDERS },
  diceUp() {
    const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    let best = 0, bestY = -2;
    normals.forEach((n, i) => { const y = new V3(...n).applyQuaternion(dice.quaternion).y; if (y > bestY) { bestY = y; best = i; } });
    return FACE_VALUES[best];
  },
};

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;
renderer.setAnimationLoop(() => {
  const rdt = Math.min(clock.getDelta(), 0.05);
  elapsed += rdt;
  updateTweens(rdt * speed);
  updateSnakes(elapsed);
  updateParticles(rdt, elapsed);
  const cur = state.players[state.current];
  ring.visible = !!cur && !state.winner;
  if (cur) {
    ring.position.set(cur.mesh.position.x, cur.mesh.position.y + 0.02, cur.mesh.position.z);
    ring.material.color.setHex(cur.color);
    ring.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.12);
    ring.material.opacity = 0.55 + Math.sin(elapsed * 5) * 0.3;
  }
  if (!state.mode) controls.autoRotate = true, controls.autoRotateSpeed = 0.6;
  else controls.autoRotate = false;
  controls.update();
  renderer.render(scene, camera);
});
$('loading').classList.add('done');
window.__ready = true;
