import * as THREE from 'three';
import { C, noOutline, makeGlowTexture } from './materials.js';

// Sky dome + stars + cartoon cloud sprites + a looping day/night cycle.
// A toon sun and the brand blackhole (now an eclipse-style moon) trade
// places on a great arc every CYCLE seconds; the sky palette, stars,
// clouds and scene lights all follow. `alert` (0..1) tints everything
// incident-red on top of whatever time of day it is.

const CYCLE = 300;        // full day + night loop, seconds
const START_PHASE = 0.17; // boot into mid-morning

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, v) => a + (b - a) * v;

// ——— billboard art: the sun and the blackhole moon ———
// Flat stepped circles drawn to canvas — always camera-facing, so neither
// body ever shows an ugly side profile.
function makeSunTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const cx = s / 2;
  const halo = ctx.createRadialGradient(cx, cx, 40, cx, cx, 126);
  halo.addColorStop(0, 'rgba(255, 214, 130, 0.55)');
  halo.addColorStop(0.55, 'rgba(255, 190, 100, 0.16)');
  halo.addColorStop(1, 'rgba(255, 190, 100, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, s, s);
  // stepped toon disc
  for (const [r, color] of [[58, '#ffb640'], [47, '#ffd166'], [34, '#fff3c4']]) {
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function makeMoonTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const cx = s / 2;
  // corona
  const halo = ctx.createRadialGradient(cx, cx, 42, cx, cx, 122);
  halo.addColorStop(0, 'rgba(244, 147, 53, 0.5)');
  halo.addColorStop(0.5, 'rgba(180, 120, 220, 0.14)');
  halo.addColorStop(1, 'rgba(180, 120, 220, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, s, s);
  // thin accretion ring → hot inner rim → the void
  for (const [r, color] of [[52, '#f49335'], [46, '#ffd98d'], [42, '#07071a']]) {
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

// puffy flat-bottomed cartoon clouds with a soft under-shadow
function makeCloudTexture(variant) {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const puffSets = [
    [[70, 78, 30], [118, 62, 42], [170, 74, 32], [96, 84, 26], [148, 86, 28]],
    [[62, 80, 26], [104, 66, 36], [152, 60, 38], [196, 76, 26], [128, 84, 30]],
    [[84, 76, 34], [136, 64, 40], [184, 78, 28]],
  ][variant % 3];
  const drawPuffs = (dy, color) => {
    ctx.fillStyle = color;
    for (const [x, y, r] of puffSets) {
      ctx.beginPath();
      ctx.arc(x, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // flat cartoon base
    ctx.beginPath();
    ctx.roundRect(puffSets[0][0] - 30, 78 + dy, puffSets[puffSets.length - 1][0] - puffSets[0][0] + 60, 26, 13);
    ctx.fill();
  };
  drawPuffs(7, 'rgba(148, 148, 194, 0.55)'); // under-shadow
  drawPuffs(0, '#ffffff');
  return new THREE.CanvasTexture(canvas);
}

export function createSky() {
  const group = new THREE.Group();

  const uniforms = {
    uAlert: { value: 0 },
    uDay: { value: 0 },
    uDusk: { value: 0 },
    // night palette (the original cosmos)
    uDeepN: { value: new THREE.Color(C.spaceDeep) },
    uMidN: { value: new THREE.Color('#3b3474') },
    uHorizonN: { value: new THREE.Color('#7c62a8') },
    // day palette (bright indigo-lavender — still space, never baby blue)
    uDeepD: { value: new THREE.Color('#4353b8') },
    uMidD: { value: new THREE.Color('#7d8ae4') },
    uHorizonD: { value: new THREE.Color('#cbb8ec') },
    uDuskWarm: { value: new THREE.Color('#e8895a') },
    uAlertDeep: { value: new THREE.Color(C.alertSkyDeep) },
    uAlertMid: { value: new THREE.Color(C.alertSkyMid) },
  };

  const skyMat = noOutline(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlert, uDay, uDusk;
      uniform vec3 uDeepN, uMidN, uHorizonN, uDeepD, uMidD, uHorizonD;
      uniform vec3 uDuskWarm, uAlertDeep, uAlertMid;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        vec3 deep = mix(uDeepN, uDeepD, uDay);
        vec3 mid = mix(uMidN, uMidD, uDay);
        vec3 horizon = mix(uHorizonN, uHorizonD, uDay);
        // dawn/dusk warms the horizon band
        horizon = mix(horizon, uDuskWarm, uDusk);
        mid = mix(mid, uDuskWarm, uDusk * 0.25);
        // incident alert overrides everything
        deep = mix(deep, uAlertDeep, uAlert);
        mid = mix(mid, uAlertMid, uAlert);
        horizon = mix(horizon, uAlertMid, uAlert * 0.7);
        vec3 col = mix(horizon, mid, smoothstep(0.42, 0.62, h));
        col = mix(col, deep, smoothstep(0.62, 0.92, h));
        // below the island: fade into the deep
        col = mix(deep * 0.75, col, smoothstep(0.0, 0.4, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 24), skyMat);
  group.add(sky);

  // ——— stars (fade out for the day) ———
  const starCount = 650;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const starColor = new THREE.Color();
  for (let i = 0; i < starCount; i++) {
    const r = 120 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = Math.random();
    starColor.set(tint > 0.92 ? C.accent : tint > 0.84 ? C.bugGlitch : '#dfe2f4');
    starColor.multiplyScalar(0.55 + Math.random() * 0.45);
    colors[i * 3] = starColor.r;
    colors[i * 3 + 1] = starColor.g;
    colors[i * 3 + 2] = starColor.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starMat = noOutline(new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  }));
  group.add(new THREE.Points(starGeo, starMat));

  // ——— the two celestial bodies on their arc ———
  const sun = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({
    map: makeSunTexture(),
    transparent: true,
    depthWrite: false,
  })));
  sun.scale.setScalar(30);
  group.add(sun);

  const moon = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({
    map: makeMoonTexture(),
    transparent: true,
    depthWrite: false,
  })));
  moon.scale.setScalar(22);
  group.add(moon);

  // ——— cartoon clouds: drifting billboards ———
  const cloudTextures = [makeCloudTexture(0), makeCloudTexture(1), makeCloudTexture(2)];
  const clouds = [];
  for (let i = 0; i < 11; i++) {
    const mat = noOutline(new THREE.SpriteMaterial({
      map: cloudTextures[i % 3],
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    }));
    const sp = new THREE.Sprite(mat);
    const scale = 16 + Math.random() * 16;
    sp.scale.set(scale, scale * 0.5, 1);
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 45;
    sp.position.set(
      Math.cos(angle) * radius,
      20 + Math.random() * 26,
      Math.sin(angle) * radius
    );
    group.add(sp);
    clouds.push({ sp, mat, speed: 0.5 + Math.random() * 0.9 });
  }
  const cloudDay = new THREE.Color('#ffffff');
  const cloudNight = new THREE.Color('#9c9ecb');

  // ——— meteors: night-time shooting stars arcing overhead ———
  const meteorTex = makeGlowTexture('rgba(255, 240, 210, 0.95)', 'rgba(180, 160, 255, 0.35)');
  const TRAIL = 9;
  const meteors = [];
  function makeMeteor() {
    const holder = new THREE.Group();
    const sprites = [];
    for (let i = 0; i <= TRAIL; i++) {
      const sp = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({
        map: meteorTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      })));
      const headScale = i === 0 ? 1.6 : 1.25 * (1 - i / (TRAIL + 2));
      sp.scale.setScalar(headScale);
      holder.add(sp);
      sprites.push(sp);
    }
    group.add(holder);
    return { sprites, axis: new THREE.Vector3(), start: new THREE.Vector3(), speed: 0, radius: 0, age: 0, life: 0, delay: 0 };
  }
  function resetMeteor(m, first = false) {
    m.axis.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    const ref = Math.abs(m.axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    m.start.crossVectors(m.axis, ref).normalize();
    m.speed = 0.06 + Math.random() * 0.06;
    m.radius = 68 + Math.random() * 30;
    m.life = 9 + Math.random() * 7;
    m.age = 0;
    m.delay = first ? Math.random() * 6 : 2 + Math.random() * 8;
  }
  for (let i = 0; i < 3; i++) {
    const m = makeMeteor();
    resetMeteor(m, true);
    meteors.push(m);
  }
  const mPos = new THREE.Vector3();

  // ——— scene lights (bound by game.js; the cycle drives them) ———
  let lights = null;
  const keyDay = new THREE.Color('#fff1cf');
  const keyNight = new THREE.Color('#aab4ff');
  const keyDusk = new THREE.Color('#ff9d5c');
  const hemiDay = new THREE.Color('#bdc8ff');
  const hemiNight = new THREE.Color('#7d84d6');
  const groundDay = new THREE.Color('#8583b5');
  const groundNight = new THREE.Color('#2f2a52');
  const keyCol = new THREE.Color();

  let phaseOverride = null;

  return {
    group,
    setAlert(v) { uniforms.uAlert.value = v; },
    getAlert() { return uniforms.uAlert.value; },
    bindLights(l) { lights = l; },
    // debug/testing: pin the time of day (0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight)
    setPhase(p) { phaseOverride = p; },
    clearPhase() { phaseOverride = null; },
    getDay() { return uniforms.uDay.value; },
    update(t, dt) {
      const p = phaseOverride ?? (START_PHASE + t / CYCLE) % 1;
      const theta = p * Math.PI * 2;
      const elev = Math.sin(theta);
      const day = smooth((elev + 0.06) / 0.34);
      const alert = uniforms.uAlert.value;
      const dusk = Math.pow(Math.max(0, 1 - Math.abs(elev) / 0.26), 2) * (1 - alert);
      uniforms.uDay.value = day;
      uniforms.uDusk.value = dusk;

      // the arc: rises east, peaks high in the northern sky, sets west
      sun.position.set(Math.cos(theta) * 110, elev * 72, -28);
      moon.position.set(-Math.cos(theta) * 110, -elev * 72, -28);
      sun.material.opacity = clamp01(elev * 6 + 0.4);
      moon.material.opacity = clamp01(-elev * 6 + 0.4);

      starMat.opacity = 0.9 * (1 - day);

      for (const c of clouds) {
        c.sp.position.x += c.speed * dt;
        if (c.sp.position.x > 135) c.sp.position.x = -135;
        c.mat.color.copy(cloudNight).lerp(cloudDay, day);
      }

      if (lights) {
        // key light tracks whichever body is up; shading flips with it
        lights.key.position.copy(elev >= 0 ? sun.position : moon.position);
        lights.key.intensity = lerp(0.55, 1.6, day);
        keyCol.copy(keyNight).lerp(keyDay, day).lerp(keyDusk, dusk * 0.6);
        lights.key.color.copy(keyCol);
        lights.hemi.intensity = lerp(0.5, 0.95, day);
        lights.hemi.color.copy(hemiNight).lerp(hemiDay, day);
        lights.hemi.groundColor.copy(groundNight).lerp(groundDay, day);
        lights.ambient.intensity = lerp(0.22, 0.42, day);
      }

      // meteors belong to the night
      const meteorDim = 1 - day * 0.85;
      for (const m of meteors) {
        if (m.delay > 0) {
          m.delay -= dt;
          continue;
        }
        m.age += dt;
        if (m.age >= m.life) {
          resetMeteor(m);
          for (const sp of m.sprites) sp.material.opacity = 0;
          continue;
        }
        const env = Math.min(1, m.age / 1.5, (m.life - m.age) / 1.5) * meteorDim;
        const angle = m.age * m.speed;
        for (let i = 0; i < m.sprites.length; i++) {
          mPos.copy(m.start).applyAxisAngle(m.axis, angle - i * 0.012).multiplyScalar(m.radius);
          m.sprites[i].position.copy(mPos);
          m.sprites[i].material.opacity = env * (i === 0 ? 0.95 : 0.55 * (1 - i / (TRAIL + 1)));
        }
      }
    },
  };
}
