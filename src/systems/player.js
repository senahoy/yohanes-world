import * as THREE from 'three';
import { createCharacter } from '../world/character.js';
import { makeBlobShadow } from '../world/materials.js';
import { heightAt, clampToIsland, PLATFORMS } from '../world/island.js';
import { sfx } from './sfx.js';

// Flat-ground controller for the limited island world: Y is always up, the
// character sticks to the heightfield (or a dock platform above it), can
// jump low obstacles, and the island edge keeps them in.

const SPEED = 6.2;
const SPRINT_MULT = 1.5;
const PLAYER_RADIUS = 0.42;
const JUMP_V = 8.2;
const GRAVITY = 22;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function platformAt(x, z) {
  for (const pf of PLATFORMS) {
    if (x >= pf.x0 && x <= pf.x1 && z >= pf.z0 && z <= pf.z1) return pf;
  }
  return null;
}

export function createPlayer(scene, spawnPos, colliders, assets = null) {
  // The Guardian of Quality — an animated Knight when assets are loaded,
  // the procedural chibi rig as fallback.
  let rig;
  if (assets) {
    const knight = assets.character('charKnight', 1.6);
    knight.play('Idle');
    const shadow = makeBlobShadow(0.6);
    shadow.position.y = 0.02;
    knight.root.add(shadow);
    let moving = false;
    rig = {
      root: knight.root,
      update(dt, speed) {
        const nowMoving = speed > 0.1;
        if (nowMoving !== moving) {
          moving = nowMoving;
          knight.play(moving ? 'Running_A' : 'Idle');
        }
        knight.mixer.update(dt);
      },
    };
  } else {
    const proc = createCharacter();
    proc.root.scale.setScalar(1.18);
    rig = proc;
  }
  rig.root.position.set(spawnPos.x, heightAt(spawnPos.x, spawnPos.z), spawnPos.z);
  scene.add(rig.root);

  const velocity = new THREE.Vector3();
  const facing = new THREE.Vector3(0, 0, 1); // greet the camera at spawn
  const lookTarget = new THREE.Vector3();
  let vy = 0;
  let airborne = false;

  const player = {
    rig,
    position: rig.root.position,
    velocity,
    facing,
    isAirborne: () => airborne,
    update(dt, input, t, camFrame, wantJump = false) {
      const move = input.getMove();
      velocity.set(0, 0, 0);
      velocity.addScaledVector(camFrame.forward, -move.z);
      velocity.addScaledVector(camFrame.right, move.x);
      velocity.y = 0;
      // analog: partial stick deflection walks; Shift (or full tilt) sprints
      const mag = Math.min(1, velocity.length());
      if (mag > 0) {
        const sprint = input.isSprinting?.() ? SPRINT_MULT : 1;
        velocity.normalize().multiplyScalar(SPEED * mag * sprint);
      }
      const speed = velocity.length();

      const p = rig.root.position;
      p.addScaledVector(velocity, dt);

      const platform = platformAt(p.x, p.z);

      // slide around props: horizontal push-out. Skip far-off ledges, water
      // barriers under the dock, and low obstacles the player has jumped
      // above (`h` colliders — fences and rocks are hoppable).
      for (const c of colliders) {
        if (c.water && platform) continue;
        if (c.h !== undefined && p.y > c.pos.y + c.h) continue;
        if (Math.abs(p.y - c.pos.y) > 3) continue;
        tmp.subVectors(p, c.pos);
        tmp.y = 0;
        const d = tmp.length();
        const minD = c.r + PLAYER_RADIUS;
        if (d < minD && d > 0.0001) {
          p.addScaledVector(tmp.normalize(), minD - d);
        }
      }

      // stay on the island
      clampToIsland(p);

      // ground = heightfield, or a plank platform when it is higher
      let groundY = heightAt(p.x, p.z);
      const pf = platformAt(p.x, p.z);
      if (pf && pf.y > groundY) groundY = pf.y;

      // jumping
      if (wantJump && !airborne) {
        vy = JUMP_V;
        airborne = true;
        sfx.hop();
      }
      if (airborne) {
        vy -= GRAVITY * dt;
        p.y += vy * dt;
        if (p.y <= groundY && vy <= 0) {
          p.y = groundY;
          vy = 0;
          airborne = false;
        }
      } else {
        p.y = groundY;
      }

      // face the walk direction
      if (speed > 0.1) {
        tmp.copy(velocity).normalize();
        facing.lerp(tmp, Math.min(1, dt * 10));
      }
      facing.y = 0;
      if (facing.lengthSq() < 0.0001) facing.copy(camFrame.forward);
      facing.normalize();
      lookTarget.copy(p).add(facing);
      rig.root.lookAt(lookTarget);

      rig.update(dt, speed, t);
      return speed;
    },
  };
  return player;
}

// Third-person follow camera. Keeps its own smoothed heading (swings behind
// sustained movement) and exposes the movement frame (forward/right) that the
// controller steers by. Low and close, almost level with the character —
// street-level framing where the world towers around you.
const CAM_UP = 2.6;
const CAM_BACK = 6.4;
const LOOK_UP = 1.8;

export function createFollowCamera(camera, player) {
  const heading = new THREE.Vector3(0, 0, -1);
  const right = new THREE.Vector3();
  const camPosTarget = new THREE.Vector3();
  const lookCurrent = new THREE.Vector3().copy(player.position);
  lookCurrent.y += LOOK_UP;
  const lookTarget = new THREE.Vector3();

  const frame = { forward: heading, right };

  function refreshFrame() {
    heading.y = 0;
    if (heading.lengthSq() < 0.0001) heading.set(0, 0, -1);
    heading.normalize();
    right.crossVectors(heading, UP).normalize();
  }
  refreshFrame();

  camera.position.copy(player.position).addScaledVector(heading, -CAM_BACK);
  camera.position.y += CAM_UP;
  camera.up.copy(UP);

  return {
    frame,
    // mouse-drag look-around: spin the heading about the player
    orbit(angle) {
      heading.applyAxisAngle(UP, angle);
      refreshFrame();
    },
    update(dt) {
      // heading gently follows sustained movement so the camera swings
      // around behind you
      if (player.velocity.lengthSq() > 1) {
        tmp2.copy(player.velocity).normalize();
        heading.lerp(tmp2, 1 - Math.exp(-dt * 1.6));
        refreshFrame();
      }

      camPosTarget.copy(player.position).addScaledVector(heading, -CAM_BACK);
      camPosTarget.y += CAM_UP;
      // never let the low camera dip into a ledge behind the player
      const minY = heightAt(camPosTarget.x, camPosTarget.z) + 1.1;
      if (camPosTarget.y < minY) camPosTarget.y = minY;
      camera.position.lerp(camPosTarget, 1 - Math.exp(-dt * 4.2));

      lookTarget.copy(player.position).addScaledVector(player.velocity, 0.28);
      lookTarget.y = player.position.y + LOOK_UP;
      lookCurrent.lerp(lookTarget, 1 - Math.exp(-dt * 5.5));
      camera.lookAt(lookCurrent);
    },
  };
}
