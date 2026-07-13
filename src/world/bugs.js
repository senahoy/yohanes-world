import * as THREE from 'three';
import { C, toon, noOutline, makeBlobShadow, makeMarker } from './materials.js';

// Glitchy magenta critters. Magenta appears nowhere else in the world —
// it's the anomaly color. Each bug jitters, hops, and occasionally
// position-snaps (a small "glitch") until caught.
export function createBug(position, upDir = new THREE.Vector3(0, 1, 0)) {
  const root = new THREE.Group();
  root.position.copy(position);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upDir.clone().normalize());

  const inner = new THREE.Group(); // jitters/hops relative to root
  root.add(inner);

  const bodyMat = toon(C.bugGlitch, { emissive: C.bugGlitch, emissiveIntensity: 0.15 });
  const darkMat = toon(C.bugDark);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  body.position.y = 0.26;
  body.scale.y = 0.85;
  inner.add(body);

  const headBump = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
  headBump.position.set(0, 0.34, 0.16);
  inner.add(headBump);

  // eyes
  const eyeWhite = toon(C.paper);
  const eyeInk = toon(C.ink);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeWhite);
    eye.position.set(side * 0.08, 0.38, 0.26);
    inner.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), eyeInk);
    pupil.position.set(side * 0.08, 0.38, 0.3);
    inner.add(pupil);
  }

  // antennae
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 5), darkMat);
    stalk.position.set(side * 0.08, 0.52, 0.06);
    stalk.rotation.z = -side * 0.4;
    inner.add(stalk);
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), bodyMat);
    tipBall.position.set(side * 0.13, 0.64, 0.06);
    inner.add(tipBall);
  }

  // stub legs
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5), darkMat);
      leg.position.set(side * 0.18, 0.08, (i - 1) * 0.12);
      leg.rotation.z = side * 0.5;
      inner.add(leg);
    }
  }

  const shadow = makeBlobShadow(0.32);
  shadow.position.y = 0.02;
  root.add(shadow);

  const marker = makeMarker();
  marker.position.y = 1.05;
  root.add(marker);

  // interaction-range ground ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 24),
    noOutline(new THREE.MeshBasicMaterial({
      color: C.accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    }))
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);

  const glitchOffset = new THREE.Vector3();
  let nextGlitch = 1 + Math.random() * 3;
  let glitchTimer = 0;
  let caught = false;
  let catchAnim = 0;
  const phase = Math.random() * Math.PI * 2;

  return {
    root,
    marker,
    isCaught: () => caught,
    catch() {
      caught = true;
      catchAnim = 0.001;
      marker.visible = false;
      ring.visible = false;
    },
    // restore path: already-caught bugs vanish without the squash-pop
    catchInstant() {
      caught = true;
      marker.visible = false;
      ring.visible = false;
      root.visible = false;
    },
    setNear(near) {
      ring.material.opacity += ((near ? 0.85 : 0) - ring.material.opacity) * 0.3;
    },
    update(dt, t) {
      if (caught) {
        // squash-pop
        catchAnim += dt * 3.2;
        const k = Math.min(1, catchAnim);
        inner.scale.set(1 + k * 0.9, Math.max(0.01, 1 - k), 1 + k * 0.9);
        shadow.material.opacity = 1 - k;
        if (k >= 1) root.visible = false;
        return;
      }
      // idle: hop + wobble
      inner.position.y = Math.abs(Math.sin(t * 3 + phase)) * 0.06;
      inner.rotation.y = Math.sin(t * 0.8 + phase) * 0.5;
      // the glitch: brief small-amplitude position snap
      glitchTimer -= dt;
      nextGlitch -= dt;
      if (nextGlitch <= 0) {
        nextGlitch = 1.5 + Math.random() * 3.5;
        glitchTimer = 0.12;
        glitchOffset.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);
      }
      if (glitchTimer > 0) {
        inner.position.x = glitchOffset.x;
        inner.position.z = glitchOffset.z;
        body.material.emissiveIntensity = 0.6;
      } else {
        inner.position.x *= 0.7;
        inner.position.z *= 0.7;
        body.material.emissiveIntensity = 0.15;
      }
      // marker bob
      marker.position.y = 1.05 + Math.sin(t * 2.2 + phase) * 0.08;
      ring.rotation.z = t * 0.8;
    },
  };
}

// Confetti burst for the 100%-coverage celebration (and bug catches).
export function createConfetti(scene) {
  const pieces = [];
  const colors = [C.accent, C.bugGlitch, C.brandBright, C.paper, C.grass];
  const geo = new THREE.PlaneGeometry(0.09, 0.14);

  function burst(center, count = 26, spread = 2.2, up = new THREE.Vector3(0, 1, 0)) {
    const upN = up.clone().normalize();
    for (let i = 0; i < count; i++) {
      const mat = noOutline(new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide,
        transparent: true,
      }));
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(center).addScaledVector(upN, 0.4);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread
      );
      vel.addScaledVector(upN, -vel.dot(upN)); // tangential scatter
      vel.addScaledVector(upN, 1.8 + Math.random() * 2.4);
      pieces.push({
        mesh: m,
        vel,
        up: upN,
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 1.6 + Math.random() * 0.8,
        age: 0,
      });
      scene.add(m);
    }
  }

  return {
    burst,
    update(dt) {
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.age += dt;
        p.vel.addScaledVector(p.up, -5.4 * dt);
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.material.opacity = Math.max(0, 1 - p.age / p.life);
        if (p.age >= p.life) {
          scene.remove(p.mesh);
          p.mesh.material.dispose();
          pieces.splice(i, 1);
        }
      }
    },
  };
}
