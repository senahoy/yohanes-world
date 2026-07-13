import * as THREE from 'three';

// DESIGN.md palette, baked from OKLCH to sRGB hex (three.js can't parse oklch strings).
export const C = {
  spaceDeep: '#080924',
  spaceMid: '#2b2654',
  spaceHorizon: '#5d4980',
  brand: '#2a3c97',
  brandBright: '#959af4',
  accent: '#f49335',
  accentHot: '#ea5b1e',
  paper: '#f3f5fc',
  ink: '#161929',
  grass: '#5dc879',
  grassDark: '#389560',
  rock: '#55526a',
  rockLight: '#7f7d94',
  cliff: '#463c59',
  tree: '#51a556',
  treeDark: '#1d7d3e',
  trunk: '#6e4d32',
  bugGlitch: '#e068d8',
  bugDark: '#83297e',
  suit: '#e2e4eb',
  suitShade: '#a8adc1',
  visor: '#222741',
  skin: '#dbb597',
  hair: '#1f212b',
  cloud: '#d7d5eb',
  sand: '#b9a17a',
  soil: '#6f4c30',
  dirt: '#8a6a44',
  barn: '#b5583d',
  wheat: '#e9c86d',
  water: '#4fb2e3',
  crystal: '#ad87ed',
  alertSkyDeep: '#290105',
  alertSkyMid: '#651911',
  screenGreen: '#5edb81',
  metal: '#373a45',
};

// 3-step gradient map shared by every toon material — this is what makes the cel look.
let gradientMap = null;
export function getGradientMap() {
  if (!gradientMap) {
    const data = new Uint8Array([90, 180, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap(), ...opts });
}

// Materials that should not receive ink outlines (glows, skies, fx).
export function noOutline(material) {
  material.userData.outlineParameters = { visible: false };
  return material;
}

// Soft round blob-shadow texture (shared).
let blobTexture = null;
export function getBlobTexture() {
  if (!blobTexture) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(8, 9, 36, 0.45)');
    grad.addColorStop(1, 'rgba(8, 9, 36, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    blobTexture = new THREE.CanvasTexture(canvas);
  }
  return blobTexture;
}

export function makeBlobShadow(radius = 0.5) {
  const mat = noOutline(new THREE.MeshBasicMaterial({
    map: getBlobTexture(),
    transparent: true,
    depthWrite: false,
  }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

// Radial glow sprite texture (blackhole, beacons).
export function makeGlowTexture(inner, outer) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// "!" quest marker sprite texture — drawn with shapes (fonts may not be
// loaded yet when this canvas is baked).
let markerTexture = null;
export function getMarkerTexture() {
  if (!markerTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const drawMark = (grow) => {
      // tapered bar
      ctx.beginPath();
      ctx.moveTo(30 - grow, 12 - grow);
      ctx.lineTo(66 + grow, 12 - grow);
      ctx.lineTo(56 + grow, 84 + grow);
      ctx.lineTo(40 - grow, 84 + grow);
      ctx.closePath();
      ctx.fill();
      // dot
      ctx.beginPath();
      ctx.arc(48, 108, 10 + grow, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.fillStyle = C.ink;
    drawMark(7);
    ctx.fillStyle = C.accent;
    drawMark(0);
    markerTexture = new THREE.CanvasTexture(canvas);
  }
  return markerTexture;
}

export function makeMarker() {
  const mat = noOutline(new THREE.SpriteMaterial({
    map: getMarkerTexture(),
    transparent: true,
    depthWrite: false,
  }));
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.36, 0.48, 1);
  return sprite;
}

// Hand-lettered sign text (Patrick Hand is loaded by the boot screen long
// before the world builds).
export function makeTextTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 62px "Patrick Hand", "Comic Sans MS", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.strokeText(text, 256, 70);
  ctx.fillStyle = C.paper;
  ctx.fillText(text, 256, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// "…" speech bubble for idle NPCs (like the reference site's office worker).
let bubbleTexture = null;
export function makeSpeechBubble() {
  if (!bubbleTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    // rounded bubble + tail
    ctx.beginPath();
    ctx.roundRect(8, 8, 112, 60, 16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 66);
    ctx.lineTo(64, 90);
    ctx.lineTo(78, 66);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(52, 68);
    ctx.lineTo(64, 90);
    ctx.lineTo(78, 68);
    ctx.stroke();
    // dots
    ctx.fillStyle = C.ink;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(40 + i * 24, 38, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    bubbleTexture = new THREE.CanvasTexture(canvas);
  }
  const mat = noOutline(new THREE.SpriteMaterial({
    map: bubbleTexture,
    transparent: true,
    depthWrite: false,
  }));
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.62, 0.47, 1);
  return sprite;
}
