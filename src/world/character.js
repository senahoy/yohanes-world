import * as THREE from 'three';
import { C, toon, makeBlobShadow } from './materials.js';

// Procedural chibi astronaut-engineer. Returns the rig + an update fn that
// drives a walk cycle (limb swing, bob, lean) from the current speed.
export function createCharacter({
  suit = C.suit,
  suitShade = C.suitShade,
  visor = C.visor,
  accent = C.accent,
  isBot = false,
} = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that bobs
  root.add(body);

  const suitMat = toon(suit);
  const shadeMat = toon(suitShade);
  const visorMat = toon(visor);
  const accentMat = toon(accent, { emissive: accent, emissiveIntensity: 0.25 });

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.3, 6, 12), suitMat);
  torso.position.y = 0.62;
  body.add(torso);

  // chest badge
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), accentMat);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.1, 0.72, 0.24);
  body.add(badge);

  // head: big helmet + visor
  const head = new THREE.Group();
  head.position.y = 1.18;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), suitMat);
  head.add(helmet);
  if (isBot) {
    // single wide bot-visor
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), toon(accent, { emissive: accent, emissiveIntensity: 0.8 }));
    eye.position.set(0, 0.03, 0.28);
    head.add(eye);
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), shadeMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.36, 0.02, 0);
    head.add(earL);
    const earR = earL.clone();
    earR.position.x = 0.36;
    head.add(earR);
  } else {
    // glass visor with a face behind it
    const visorGlass = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), visorMat);
    visorGlass.scale.set(0.92, 0.74, 0.72);
    visorGlass.position.set(0, 0.02, 0.17);
    head.add(visorGlass);
    const eyeMat = toon(C.paper);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eye.position.set(side * 0.09, 0.04, 0.4);
      head.add(eye);
    }
  }
  body.add(head);

  // backpack + antenna
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), shadeMat);
  pack.position.set(0, 0.72, -0.28);
  body.add(pack);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), shadeMat);
  antenna.position.set(0.12, 1.05, -0.3);
  body.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), accentMat);
  antennaTip.position.set(0.12, 1.28, -0.3);
  body.add(antennaTip);

  // limbs: pivot groups at shoulder/hip so they swing
  function limb(x, y, len, radius, mat) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, 8), mat);
    seg.position.y = -(len / 2 + radius);
    pivot.add(seg);
    body.add(pivot);
    return pivot;
  }
  const armL = limb(-0.36, 0.86, 0.28, 0.09, suitMat);
  const armR = limb(0.36, 0.86, 0.28, 0.09, suitMat);
  const legL = limb(-0.14, 0.32, 0.2, 0.1, shadeMat);
  const legR = limb(0.14, 0.32, 0.2, 0.1, shadeMat);

  const shadow = makeBlobShadow(0.55);
  shadow.position.y = 0.02;
  root.add(shadow);

  let phase = 0;
  return {
    root,
    head,
    update(dt, speed, t) {
      if (isBot) {
        // idle sway only
        body.position.y = Math.sin(t * 1.6) * 0.03;
        body.rotation.z = Math.sin(t * 0.9) * 0.03;
        armL.rotation.x = Math.sin(t * 1.2) * 0.15;
        armR.rotation.x = -Math.sin(t * 1.2) * 0.15;
        return;
      }
      const walking = speed > 0.1;
      phase += dt * (walking ? speed * 2.4 : 3);
      const swing = walking ? Math.min(1, speed / 5) : 0;
      armL.rotation.x = Math.sin(phase) * 0.9 * swing;
      armR.rotation.x = -Math.sin(phase) * 0.9 * swing;
      legL.rotation.x = -Math.sin(phase) * 1.0 * swing;
      legR.rotation.x = Math.sin(phase) * 1.0 * swing;
      body.position.y = walking
        ? Math.abs(Math.sin(phase)) * 0.07
        : Math.sin(t * 1.8) * 0.025; // idle breathing
      body.rotation.x = walking ? 0.08 * swing : 0;
    },
  };
}
