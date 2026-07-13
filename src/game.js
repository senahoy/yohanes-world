import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { createSky } from './world/sky.js';
import { createIsland } from './world/island.js';
import { loadAssets } from './world/assets.js';
import { createPlayer, createFollowCamera } from './systems/player.js';
import { createInput } from './systems/input.js';
import { createDialog } from './ui/dialog.js';
import { createHud, createContactPanel } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createPiano } from './ui/piano.js';
import { createQuests } from './quests.js';
import { initForcedLandscape, viewSize } from './systems/viewport.js';
import { motionReduced, setMotionReduced, osPrefersReduced, motionOverridden } from './systems/motion.js';
import { initAudio, startMusic, setMuted, getMuted, duckMusic, audioState } from './systems/sfx.js';
import { BUGS } from './content.js';
import { C } from './world/materials.js';

const NULL_INPUT = { getMove: () => ({ x: 0, z: 0 }) };

export async function startGame({ reducedMotion = false, onProgress = null } = {}) {
  // CC0 models make the world; if the fetch fails we fall back to the
  // procedural props — the site never breaks over an asset.
  // (?noassets exercises that fallback deliberately — the smoke test uses it.)
  let assets = null;
  if (!new URLSearchParams(window.location.search).has('noassets')) {
    try {
      assets = await loadAssets(onProgress);
    } catch (err) {
      console.warn('Asset load failed — using procedural props', err);
    }
  }

  const container = document.getElementById('app');

  // ——— renderer + outline pass ———
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const v0 = viewSize();
  renderer.setSize(v0.w, v0.h);
  container.appendChild(renderer.domElement);

  const ink = new THREE.Color(C.ink);
  const effect = new OutlineEffect(renderer, {
    defaultThickness: 0.0032,
    defaultColor: [ink.r, ink.g, ink.b],
    defaultAlpha: 1,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, v0.w / v0.h, 0.1, 400);

  // ——— resize (viewSize swaps dimensions while forced-landscape) ———
  const applySize = () => {
    const { w, h } = viewSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', applySize);


  // ——— lights: the day/night cycle drives color, intensity and direction
  // (sky.update moves the key light with whichever body is up) ———
  const hemi = new THREE.HemisphereLight('#9a9ce0', '#3a2d5c', 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffe3b8', 1.5);
  key.position.set(-30, 42, -38);
  scene.add(key);
  const ambient = new THREE.AmbientLight('#ffffff', 0.38);
  scene.add(ambient);

  // ——— world ———
  const sky = createSky();
  sky.bindLights({ hemi, key, ambient });
  scene.add(sky.group);
  const world = createIsland(assets);
  scene.add(world.group);

  const input = createInput();
  const player = createPlayer(scene, world.spots.spawn, world.colliders, assets);
  const followCam = createFollowCamera(camera, player);

  // desktop look-around: drag with the mouse to swing the camera
  let dragX = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') dragX = e.clientX;
  });
  window.addEventListener('pointermove', (e) => {
    if (dragX === null || e.pointerType !== 'mouse') return;
    followCam.orbit((e.clientX - dragX) * -0.006);
    dragX = e.clientX;
  });
  window.addEventListener('pointerup', () => { dragX = null; });

  const hud = createHud();
  const dialog = createDialog();
  const contact = createContactPanel();
  const piano = createPiano();
  const minimap = createMinimap();
  hud.setBugs(0, BUGS.length); // baseline BEFORE quests — restore may raise it
  const quests = createQuests({ scene, world, player, dialog, hud, contact, piano, assets });

  hud.show();
  if (input.isTouch) {
    hud.setTouchHints();
    // touch portrait: the page CSS-rotates to landscape and the game plays
    // immediately — a hint invites the player to turn the phone, then fades
    const rotateHint = document.getElementById('rotate-overlay');
    let hintTimer = null;
    initForcedLandscape((rotated) => {
      applySize();
      clearTimeout(hintTimer);
      if (rotated) {
        rotateHint.hidden = false;
        hintTimer = setTimeout(() => { rotateHint.hidden = true; }, 3500);
      } else {
        rotateHint.hidden = true;
      }
    });
  }
  input.setFirstMoveCallback(() => hud.fadeHint());

  // audio: the ENTER click (or first key) unlocks the context, then the
  // generative lo-fi loop plays under everything. 🔊 chip mutes it all.
  initAudio();
  startMusic();
  hud.setMuted(getMuted());
  hud.onMute(() => {
    const m = !getMuted();
    setMuted(m);
    hud.setMuted(m);
  });

  // motion: the OS reduce-motion signal (or Android battery saver) parks
  // the ambience by default — the 🍃 chip makes that visible and reversible
  if (osPrefersReduced || motionOverridden()) {
    hud.showMotionChip();
    hud.setMotion(motionReduced());
    hud.onMotion(() => {
      const reduced = !motionReduced();
      setMotionReduced(reduced);
      hud.setMotion(reduced);
      hud.toast(reduced ? '🍃 ambient animation minimized' : '✨ full animation on');
    });
    if (motionReduced()) {
      setTimeout(() => hud.toast('🍃 reduced-motion mode — tap 🍃 for full animation', 4200), 3000);
    }
  }
  setTimeout(() => hud.toast('🛤 follow the paths — they link every district', 3800), 2200);
  hud.onTextMode(() => {
    window.location.search = '?mode=text';
  });

  // ——— loop ———
  const clock = new THREE.Clock();
  let t = 0;
  let lastDuck = 1;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    const uiOpen = dialog.isOpen() || contact.isOpen() || piano.isOpen();
    // while a panel is open the game input is dead — the keystroke that
    // closes a dialog must never fall through and re-trigger the world
    input.setEnabled(!uiOpen);
    // the background loop steps aside while the player plays the piano
    const wantDuck = piano.isOpen() ? 0.06 : 1;
    if (wantDuck !== lastDuck) {
      lastDuck = wantDuck;
      duckMusic(wantDuck);
    }
    if (input.consumeInteract() && !uiOpen) quests.tryInteract();
    const wantJump = input.consumeJump() && !uiOpen;

    player.update(dt, uiOpen ? NULL_INPUT : input, t, followCam.frame, wantJump);
    quests.update(dt, t);
    minimap.update(t, player, quests.getMapMarkers());

    // incident sky: gentle crossfade
    const alert = sky.getAlert();
    const target = quests.getAlertTarget();
    sky.setAlert(alert + (target - alert) * Math.min(1, dt / 1.2));

    sky.update(t, dt);
    world.update(t, dt, player.position);
    followCam.update(dt);
    effect.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // dev/testing handle (harmless in prod; enables scripted playthroughs)
  window.__world = { player, camera, followCam, quests, dialog, world, sky, audioState, motion: { reduced: motionReduced, set: setMotionReduced } };
}
