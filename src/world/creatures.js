import * as THREE from 'three';
import { C, toon, noOutline, makeGlowTexture, makeBlobShadow } from './materials.js';
import { motionReduced } from '../systems/motion.js';

// The island's small residents: chickens in the farmyard, a dog by the barn,
// butterflies over the meadow flowers, birds circling overhead, fish in the
// pond, fireflies in the server graveyard. All procedural, all cheap — they
// exist so the world never holds still.

export function createCreatures({ group, heightAt, colliders = [], yard, dogHome, pond, dark, flowerPts = [] }) {
  const inkMat = toon(C.ink);

  // ground the creatures respect: no wandering into props or the pond
  function blockedAt(x, z, pad = 0.3) {
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 0.6) return true;
    for (const c of colliders) {
      if (c.water) continue;
      if (Math.hypot(x - c.pos.x, z - c.pos.z) < c.r + pad) return true;
    }
    return false;
  }
  function pickTarget(cx, cz, r, target) {
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!blockedAt(x, z)) {
        target.set(x, 0, z);
        return;
      }
    }
    target.set(cx, 0, cz); // yard centers are always clear
  }

  // ——— chickens ———
  const chickens = [];
  function makeChicken(scale = 1) {
    const root = new THREE.Group();
    const bodyMat = toon('#f6f1e7');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat);
    body.position.y = 0.3;
    body.scale.set(1, 0.9, 1.2);
    root.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 6), bodyMat);
    tail.position.set(0, 0.42, -0.24);
    tail.rotation.x = -0.9;
    root.add(tail);
    const head = new THREE.Group();
    head.position.set(0, 0.52, 0.16);
    const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
    head.add(headBall);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), toon(C.accent));
    beak.position.set(0, -0.01, 0.16);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.12), toon(C.accentHot));
    comb.position.y = 0.14;
    head.add(comb);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), inkMat);
      eye.position.set(side * 0.09, 0.03, 0.1);
      head.add(eye);
    }
    root.add(head);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), toon(C.accent));
      leg.position.set(side * 0.08, 0.1, 0);
      root.add(leg);
    }
    root.scale.setScalar(scale);
    return { root, head };
  }
  const flockSizes = [1, 1, 1, 1, 1, 0.62]; // five hens and a chick
  flockSizes.forEach((scale, i) => {
    const c = makeChicken(scale);
    const a = (i / flockSizes.length) * Math.PI * 2;
    const x = yard.x + Math.cos(a) * yard.r * 0.6;
    const z = yard.z + Math.sin(a) * yard.r * 0.6;
    c.root.position.set(x, heightAt(x, z), z);
    c.root.rotation.y = Math.random() * 6;
    group.add(c.root);
    chickens.push({
      ...c,
      target: new THREE.Vector3(x, 0, z),
      wait: Math.random() * 3,
      peck: 0,
      phase: Math.random() * 6,
      speed: 1.1 * (scale < 1 ? 1.4 : 1), // the chick scrambles to keep up
    });
  });

  // ——— the dog (his name is Bug) ———
  const dog = (() => {
    const root = new THREE.Group();
    const furMat = toon('#c98d54');
    const darkFur = toon('#96602f');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 6, 10), furMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.34;
    root.add(body);
    const head = new THREE.Group();
    head.position.set(0, 0.52, 0.3);
    const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), furMat);
    head.add(headBall);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), darkFur);
    snout.position.set(0, -0.04, 0.15);
    head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), inkMat);
    nose.position.set(0, -0.02, 0.23);
    head.add(nose);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 5), darkFur);
      ear.position.set(side * 0.11, 0.17, 0);
      ear.rotation.z = -side * 0.35;
      head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), inkMat);
      eye.position.set(side * 0.07, 0.04, 0.14);
      head.add(eye);
    }
    root.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), furMat);
    tail.position.set(0, 0.46, -0.34);
    tail.rotation.x = 0.9;
    root.add(tail);
    for (const [lx, lz] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.18], [0.12, -0.18]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6), furMat);
      leg.position.set(lx, 0.12, lz);
      root.add(leg);
    }
    const shadow = makeBlobShadow(0.35);
    shadow.position.y = 0.02;
    root.add(shadow);
    root.position.set(dogHome.x, heightAt(dogHome.x, dogHome.z), dogHome.z);
    group.add(root);
    return {
      root,
      head,
      tail,
      target: new THREE.Vector3(dogHome.x, 0, dogHome.z),
      wait: 1,
      excited: 0,
      hop: 0,
      excite() { this.excited = 2.4; },
    };
  })();

  // ——— butterflies over the flowers ———
  // (always built; under reduced motion they hide per-frame so the 🍃 chip
  // can bring them back without a reload)
  const butterflies = [];
  {
    const wingGeo = new THREE.CircleGeometry(0.09, 6);
    const colors = [C.bugGlitch, C.accent, C.brandBright, C.paper];
    const anchors = flowerPts.length ? flowerPts : [new THREE.Vector3(0, 0, 20)];
    for (let i = 0; i < 10; i++) {
      const holder = new THREE.Group();
      const mat = noOutline(toon(colors[i % colors.length], { side: THREE.DoubleSide }));
      const wingL = new THREE.Mesh(wingGeo, mat);
      const wingR = new THREE.Mesh(wingGeo, mat);
      wingL.position.x = -0.07;
      wingR.position.x = 0.07;
      holder.add(wingL, wingR);
      const anchor = anchors[Math.floor(Math.random() * anchors.length)].clone();
      holder.position.copy(anchor);
      group.add(holder);
      butterflies.push({
        holder, wingL, wingR, anchor,
        orbit: 0.6 + Math.random() * 1.6,
        speed: 0.5 + Math.random() * 0.8,
        phase: Math.random() * 6.28,
        hop: 8 + Math.random() * 14, // seconds between flower changes
        anchors,
      });
    }
  }

  // ——— birds circling overhead ———
  const birds = [];
  {
    const bodyMat = toon('#5a6c96');
    const wingMat = toon('#48587e');
    for (let f = 0; f < 2; f++) {
      const center = f === 0 ? { x: -8, z: 2, r: 26, y: 14 } : { x: 14, z: -12, r: 20, y: 17 };
      for (let i = 0; i < 4; i++) {
        const bird = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), bodyMat);
        body.scale.set(1, 0.8, 1.6);
        bird.add(body);
        const wl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.16), wingMat);
        wl.position.x = -0.28;
        const wr = wl.clone();
        wr.position.x = 0.28;
        bird.add(wl, wr);
        group.add(bird);
        birds.push({
          bird, wl, wr, center,
          angle: (i / 4) * 0.8 + f * 3,
          speed: (0.14 + Math.random() * 0.05) * (f === 0 ? 1 : -1),
          bobPhase: Math.random() * 6,
        });
      }
    }
  }

  // ——— pond fish: circling shadows + the occasional jumper ———
  const fishes = [];
  {
    const shadowMat = noOutline(new THREE.MeshBasicMaterial({ color: '#27415f', transparent: true, opacity: 0.55 }));
    const fishMat = toon('#7fb6d9');
    for (let i = 0; i < 3; i++) {
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), shadowMat);
      shadow.scale.set(1, 0.45, 1);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = pond.y + 0.03;
      group.add(shadow);
      const jumper = new THREE.Group();
      const fbody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fishMat);
      fbody.scale.set(0.7, 0.8, 1.6);
      jumper.add(fbody);
      const ftail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), fishMat);
      ftail.position.z = -0.26;
      ftail.rotation.x = -Math.PI / 2;
      jumper.add(ftail);
      jumper.visible = false;
      group.add(jumper);
      fishes.push({
        shadow, jumper,
        angle: Math.random() * 6.28,
        r: 2 + Math.random() * 3.5,
        speed: 0.25 + Math.random() * 0.3,
        jumpAt: 4 + Math.random() * 10,
        jumpT: -1,
      });
    }
  }

  // ——— fireflies in the graveyard gloom ———
  const fireflies = [];
  {
    const tex = makeGlowTexture('rgba(244, 200, 90, 0.9)', 'rgba(244, 147, 53, 0.25)');
    for (let i = 0; i < 12; i++) {
      const sp = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({
        map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })));
      sp.scale.setScalar(0.34);
      const a = Math.random() * 6.28;
      const r = Math.random() * dark.r;
      sp.position.set(dark.x + Math.cos(a) * r, 0, dark.z + Math.sin(a) * r);
      sp.position.y = heightAt(sp.position.x, sp.position.z) + 0.6 + Math.random() * 1.4;
      group.add(sp);
      fireflies.push({ sp, baseY: sp.position.y, phase: Math.random() * 6.28, drift: Math.random() * 6.28 });
    }
  }

  const tmp = new THREE.Vector3();

  function update(t, dt, playerPos = null) {
    const reduced = motionReduced();

    // chickens: waddle toward the target, peck, pick a new spot
    for (const c of chickens) {
      if (c.peck > 0) {
        c.peck -= dt;
        c.head.rotation.x = Math.max(0, Math.sin((0.8 - c.peck) * 8)) * 0.9;
        continue;
      }
      c.head.rotation.x *= 0.8;
      if (c.wait > 0) {
        c.wait -= dt;
        if (c.wait <= 0) pickTarget(yard.x, yard.z, yard.r, c.target);
        continue;
      }
      const p = c.root.position;
      const dx = c.target.x - p.x;
      const dz = c.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        if (Math.random() < 0.5) c.peck = 0.8;
        c.wait = 1 + Math.random() * 3;
        p.y = heightAt(p.x, p.z);
        continue;
      }
      const step = Math.min(d, c.speed * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      p.y = heightAt(p.x, p.z) + Math.abs(Math.sin(t * 9 + c.phase)) * 0.04;
      c.root.rotation.y = Math.atan2(dx, dz);
    }

    // the dog: wanders near the barn, runs to greet you, wags
    {
      const p = dog.root.position;
      const nearPlayer = playerPos && p.distanceTo(playerPos) < 7;
      if (dog.excited > 0) dog.excited -= dt;
      const wag = dog.excited > 0 ? 14 : nearPlayer ? 9 : 4;
      dog.tail.rotation.z = Math.sin(t * wag) * 0.5;
      if (nearPlayer && playerPos) {
        tmp.copy(playerPos).sub(p);
        const d = Math.hypot(tmp.x, tmp.z);
        if (d > 1.6) {
          const step = Math.min(d - 1.5, 3.4 * dt);
          const nx = p.x + (tmp.x / d) * step;
          const nz = p.z + (tmp.z / d) * step;
          // a good dog sits at the water's edge instead of swimming after you
          if (!blockedAt(nx, nz, 0.1)) {
            p.x = nx;
            p.z = nz;
          }
        }
        dog.root.rotation.y = Math.atan2(tmp.x, tmp.z);
        dog.hop += dt;
        p.y = heightAt(p.x, p.z) + (dog.excited > 0 ? Math.abs(Math.sin(t * 8)) * 0.14 : Math.abs(Math.sin(dog.hop * 6)) * 0.05);
      } else {
        if (dog.wait > 0) {
          dog.wait -= dt;
          if (dog.wait <= 0) pickTarget(dogHome.x, dogHome.z, 3, dog.target);
          p.y = heightAt(p.x, p.z);
        } else {
          const dx = dog.target.x - p.x;
          const dz = dog.target.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.2) {
            dog.wait = 2 + Math.random() * 4;
          } else {
            const step = Math.min(d, 1.6 * dt);
            const nx = p.x + (dx / d) * step;
            const nz = p.z + (dz / d) * step;
            if (blockedAt(nx, nz, 0.1)) {
              dog.wait = 1; // something's in the way — sniff, pick a new spot
            } else {
              p.x = nx;
              p.z = nz;
            }
            p.y = heightAt(p.x, p.z) + Math.abs(Math.sin(t * 7)) * 0.04;
            dog.root.rotation.y = Math.atan2(dx, dz);
          }
        }
      }
    }

    // butterflies: flutter in loose orbits, hop between flowers
    for (const b of butterflies) {
      b.holder.visible = !reduced;
      if (reduced) continue;
      const flap = Math.sin(t * 14 + b.phase) * 0.9;
      b.wingL.rotation.y = flap;
      b.wingR.rotation.y = -flap;
      b.hop -= dt;
      if (b.hop <= 0) {
        b.hop = 8 + Math.random() * 14;
        b.anchor.copy(b.anchors[Math.floor(Math.random() * b.anchors.length)]);
      }
      const a = t * b.speed + b.phase;
      tmp.set(
        b.anchor.x + Math.cos(a) * b.orbit,
        b.anchor.y + 0.7 + Math.sin(t * 1.7 + b.phase) * 0.3,
        b.anchor.z + Math.sin(a * 1.3) * b.orbit
      );
      b.holder.position.lerp(tmp, Math.min(1, dt * 2));
      b.holder.rotation.y = a + Math.PI / 2;
    }

    // birds: bank around their circuits
    for (const b of birds) {
      b.bird.visible = !reduced;
      if (reduced) continue;
      b.angle += b.speed * dt;
      const x = b.center.x + Math.cos(b.angle) * b.center.r;
      const z = b.center.z + Math.sin(b.angle) * b.center.r;
      b.bird.position.set(x, b.center.y + Math.sin(t * 0.7 + b.bobPhase) * 0.8, z);
      const heading = b.angle + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      b.bird.rotation.y = -heading;
      const flap = Math.sin(t * 6 + b.bobPhase) * 0.5;
      b.wl.rotation.z = flap;
      b.wr.rotation.z = -flap;
    }

    // fish: shadows circle; sometimes one leaps (never under reduced motion)
    for (const f of fishes) {
      if (reduced) {
        f.jumper.visible = false;
        if (f.jumpT >= 0) {
          f.jumpT = -1;
          f.jumpAt = 6 + Math.random() * 14;
        }
        continue; // shadows freeze in place
      }
      f.angle += f.speed * dt;
      const fx = pond.x + Math.cos(f.angle) * f.r;
      const fz = pond.z + Math.sin(f.angle) * f.r;
      f.shadow.position.x = fx;
      f.shadow.position.z = fz;
      f.shadow.rotation.z = -f.angle;
      if (f.jumpT < 0) {
        f.jumpAt -= dt;
        if (f.jumpAt <= 0) {
          f.jumpT = 0;
          f.jumper.visible = true;
        }
      } else {
        f.jumpT += dt;
        const k = f.jumpT / 0.9;
        if (k >= 1) {
          f.jumpT = -1;
          f.jumpAt = 6 + Math.random() * 14;
          f.jumper.visible = false;
        } else {
          const arcY = Math.sin(k * Math.PI) * 1.1;
          f.jumper.position.set(fx, pond.y + arcY, fz);
          f.jumper.rotation.x = (k - 0.5) * 2.4;
          f.jumper.rotation.y = -f.angle;
        }
      }
    }

    // fireflies: drift and pulse (steady glow under reduced motion)
    for (const ff of fireflies) {
      if (reduced) {
        ff.sp.material.opacity = 0.55;
        continue;
      }
      ff.drift += dt * 0.3;
      ff.sp.position.x += Math.sin(ff.drift + ff.phase) * dt * 0.4;
      ff.sp.position.z += Math.cos(ff.drift * 1.3 + ff.phase) * dt * 0.4;
      ff.sp.position.y = ff.baseY + Math.sin(t * 0.9 + ff.phase) * 0.3;
      ff.sp.material.opacity = 0.35 + Math.max(0, Math.sin(t * 2.2 + ff.phase)) * 0.65;
    }
  }

  return { update, dog };
}
