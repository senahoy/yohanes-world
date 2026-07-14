import * as THREE from 'three';
import { BUGS, ALL_BUGS_DONE, INCIDENT, DISH_DIALOG, MAILBOX_DIALOG, CITY, FISH, FISH_RARE, GOLDEN_FISH_DIALOG, HARVEST_DONE_DIALOG, TUTORIAL } from './content.js';
import { createBug, createConfetti } from './world/bugs.js';
import { createCharacter } from './world/character.js';
import { heightAt } from './world/island.js';
import { motionReduced } from './systems/motion.js';
import { C, makeMarker, makeSpeechBubble } from './world/materials.js';
import { sfx } from './systems/sfx.js';

// Incident state machine
const IDLE = 0, TRIGGERED = 1, BRIEFED = 2, INVESTIGATED = 3, RESOLVED = 4;

// progress survives a refresh (add ?reset to the URL to start over)
const SAVE_KEY = 'yohanes-world-save-v1';
function loadSave() {
  try {
    if (new URLSearchParams(window.location.search).has('reset')) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function createQuests({ scene, world, player, dialog, hud, contact, piano, assets = null }) {
  const confetti = createConfetti(scene);
  const interactables = [];
  const spots = world.spots;

  let bugsCaught = 0;
  let bugsFiled = 0;
  let pmIntroduced = false;
  let ciIntroduced = false;
  let ciDone = false;
  let incident = IDLE;
  let alertTarget = 0;
  const caughtIds = [];
  const filedIds = [];

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        caught: caughtIds,
        filed: filedIds,
        ci: ciDone,
        incidentResolved: incident === RESOLVED,
      }));
    } catch { /* storage unavailable (private mode) — play on without saving */ }
  }

  // standalone marker floating above a world spot
  function spotMarker(pos, height) {
    const holder = new THREE.Group();
    holder.position.copy(pos);
    const marker = makeMarker();
    marker.position.y = height;
    marker.userData.baseY = height;
    holder.add(marker);
    scene.add(holder);
    return marker;
  }

  // an NPC standing on the ground, facing a nearby point of interest.
  // With assets loaded, `model` picks an animated KayKit character; the
  // procedural chibi rig remains the fallback (and Ops Bot's actual body).
  function spawnNpc(colors, pos, faceTarget, model = null) {
    let root, update, play = null;
    if (model && assets) {
      const char = assets.character(model, 1.6);
      char.play('Idle');
      root = char.root;
      update = (dt) => char.mixer.update(dt);
      play = char.play;
    } else {
      const npc = createCharacter(colors);
      npc.root.scale.setScalar(1.18); // same stature as the cast
      root = npc.root;
      update = (dt, t) => npc.update(dt, 0, t);
    }
    root.position.copy(pos);
    root.lookAt(faceTarget.x, pos.y, faceTarget.z);
    scene.add(root);
    const bubble = makeSpeechBubble();
    bubble.position.y = model && assets ? 2.15 : 1.95;
    root.add(bubble);
    // greet the visitor: a one-shot wave when they first come close
    return { root, update, bubble, play, waveT: 0, waveCd: 0, baseClip: 'Idle' };
  }

  // ——— the six bugs ———
  const bugEntities = new Map();
  const caughtUnfiled = [];
  for (const bugDef of BUGS) {
    const bug = createBug(spots.bugs[bugDef.id]);
    scene.add(bug.root);
    bugEntities.set(bugDef.id, bug);
    interactables.push({
      pos: bug.root.position,
      radius: 2.0,
      label: 'Catch bug',
      enabled: () => !bug.isCaught(),
      near: (isNear) => bug.setNear(isNear),
      onInteract() {
        if (bug.isCaught()) return; // never catch (and count) twice
        dialog.show(bugDef.lines, () => {
          if (bug.isCaught()) return;
          bug.catch();
          sfx.pop();
          confetti.burst(bug.root.position, 20, 1.8);
          bugsCaught++;
          caughtIds.push(bugDef.id);
          caughtUnfiled.push(bugDef);
          persist();
          hud.setBugs(bugsCaught, BUGS.length);
          hud.toast(`${bugDef.name} squashed · ${bugDef.chapter} unlocked`);
          if (tutorial === 'catch') {
            tutorial = 'file';
            setTimeout(() => dialog.show(TUTORIAL.afterCatch), 900);
          }
          if (bugsCaught === BUGS.length) {
            setTimeout(() => {
              confetti.burst(player.position, 70, 4);
              dialog.show(ALL_BUGS_DONE);
            }, 700);
          }
        });
      },
    });
  }

  // ——— Ops Bot (plaza) — incident companion ———
  const opsBot = spawnNpc(
    { suit: C.rockLight, suitShade: C.metal, accent: C.accent, isBot: true },
    spots.opsBot,
    spots.pad
  );
  const opsMarker = makeMarker();
  opsMarker.position.y = 2.0;
  opsMarker.visible = false;
  opsBot.root.add(opsMarker);

  // ——— the QA workplace cast (city) ———
  const pm = spawnNpc(
    { suit: '#8f7ad6', suitShade: '#5b4a9e', accent: C.accent },
    spots.pm,
    spots.kanban,
    'charHooded' // the hooded oracle who foresees every deadline
  );
  const engineer = spawnNpc(
    { suit: '#66b98a', suitShade: '#2f7d55', accent: C.accentHot },
    spots.engineer,
    spots.ciDesk,
    'charBarbarian'
  );
  const designer = spawnNpc(
    { suit: '#e0a04e', suitShade: '#a86a28', accent: C.bugGlitch },
    spots.designer,
    spots.easel,
    'charMage'
  );

  // the PM paces the plateau between the kanban and the easel corner
  const pmPatrol = { targets: spots.pmPatrol || [spots.pm], i: 0, mode: 'idle', t: 3 };

  // the intern jogs endless laps of the loop trail (cardio is QA for the body)
  let jogger = null;
  if (assets) {
    const char = assets.character('charBarbarian', 1.55);
    char.play('Running_A');
    scene.add(char.root);
    jogger = { char, u: 0.4, ahead: new THREE.Vector3() };
  }

  const terminalMarker = spotMarker(spots.terminal, 2.3);
  terminalMarker.visible = false;
  const rackMarker = spotMarker(spots.rack, 2.3);
  rackMarker.visible = false;
  const dishMarker = spotMarker(spots.dish, 3.6);

  function startIncident() {
    incident = TRIGGERED;
    alertTarget = 1;
    hud.setAlert(true);
    hud.toast('NEW MISSION: production incident!');
    opsMarker.visible = true;
    opsBot.bubble.visible = false;
    world.beacon.material.opacity = 0.95;
    for (const light of world.rackLights) {
      light.material.color.set(C.accentHot);
      light.material.emissive.set(C.accentHot);
    }
  }

  function resolveIncident() {
    incident = RESOLVED;
    persist();
    alertTarget = 0;
    hud.setAlert(false);
    hud.setBadge(true);
    hud.toast('Badge earned: INCIDENT COMMANDER');
    confetti.burst(player.position, 50, 3);
    rackMarker.visible = false;
    world.beacon.material.opacity = 0;
    for (const light of world.rackLights) {
      light.material.color.set(C.screenGreen);
      light.material.emissive.set(C.screenGreen);
    }
  }

  interactables.push({
    pos: spots.opsBot,
    radius: 2.2,
    label: 'Talk',
    enabled: () => true,
    onInteract() {
      if (incident === TRIGGERED) {
        dialog.show(INCIDENT.briefing, () => {
          incident = BRIEFED;
          opsMarker.visible = false;
          terminalMarker.visible = true;
          hud.toast('Check the LOGS TERMINAL (city district)');
        });
      } else if (incident === BRIEFED) {
        dialog.show(INCIDENT.npcWaitInvestigate);
      } else if (incident === INVESTIGATED) {
        dialog.show(INCIDENT.npcWaitResolve);
      } else {
        dialog.show(INCIDENT.npcIdle);
      }
    },
  });

  // ——— PROD rack (server-graveyard easter egg) ———
  interactables.push({
    pos: spots.rack,
    radius: 1.9,
    label: 'Inspect',
    enabled: () => true,
    onInteract() {
      if (incident === IDLE) {
        dialog.show(INCIDENT.trigger, startIncident);
      } else if (incident === TRIGGERED || incident === BRIEFED) {
        dialog.show(INCIDENT.rackWaiting);
      } else if (incident === INVESTIGATED) {
        dialog.show(INCIDENT.resolve, resolveIncident);
      } else {
        dialog.show(INCIDENT.rackResolved);
      }
    },
  });

  // ——— logs terminal (city) ———
  interactables.push({
    pos: spots.terminal,
    radius: 1.9,
    label: 'Read logs',
    enabled: () => true,
    onInteract() {
      if (incident === BRIEFED) {
        dialog.show(INCIDENT.investigate, () => {
          incident = INVESTIGATED;
          terminalMarker.visible = false;
          rackMarker.visible = true;
          hud.toast('Root cause found. Back to the PROD rack in the server graveyard!');
        });
      } else {
        dialog.show(INCIDENT.terminalIdle);
      }
    },
  });

  // ——— PM + kanban: file your bug reports ———
  interactables.push({
    pos: pm.root.position, // live — the PM paces around
    radius: 2.2,
    label: 'Talk',
    enabled: () => true,
    onInteract() {
      pm.bubble.visible = false;
      // stop pacing, face the visitor
      pmPatrol.mode = 'idle';
      pmPatrol.t = 6;
      if (pm.play) pm.play('Idle');
      pm.root.lookAt(player.position.x, pm.root.position.y, player.position.z);
      if (!pmIntroduced) {
        pmIntroduced = true;
        dialog.show(CITY.pmIntro);
      } else if (bugsFiled === BUGS.length) {
        dialog.show(CITY.pmAllFiled);
      } else {
        dialog.show(CITY.pmWaiting);
      }
    },
  });

  // filing is one FULL report per visit — ticket, evidence, root cause —
  // because "repro steps ✓" is what a junior files, not a lead
  const kanbanIt = {
    pos: spots.kanban,
    radius: 2.0,
    label: 'File report',
    enabled: () => true,
    onInteract() {
      if (caughtUnfiled.length === 0) {
        dialog.show(bugsFiled === BUGS.length ? CITY.kanbanAllDone : CITY.kanbanEmpty);
        return;
      }
      const bugDef = caughtUnfiled.shift();
      dialog.show(bugDef.report, () => {
        if (world.todoStickies[bugsFiled]) world.todoStickies[bugsFiled].visible = false;
        if (world.doneStickies[bugsFiled]) world.doneStickies[bugsFiled].visible = true;
        bugsFiled++;
        filedIds.push(bugDef.id);
        persist();
        sfx.pop();
        const left = caughtUnfiled.length;
        hud.toast(left > 0
          ? `${bugDef.name} filed · ${bugsFiled}/${BUGS.length} · ${left} more to file`
          : `${bugDef.name} filed · ${bugsFiled}/${BUGS.length}`);
        if (bugsFiled === BUGS.length) {
          confetti.burst(spots.kanban, 30, 2.5);
        }
        if (tutorial === 'file') {
          tutorial = 'done';
          setTimeout(() => dialog.show(TUTORIAL.done), 900);
        }
      });
    },
  };
  interactables.push(kanbanIt);

  // ——— engineer + CI terminal: automate the regression suite ———
  interactables.push({
    pos: spots.engineer,
    radius: 2.2,
    label: 'Talk',
    enabled: () => true,
    onInteract() {
      engineer.bubble.visible = false;
      if (!ciIntroduced) {
        ciIntroduced = true;
        dialog.show(CITY.engineerIntro, () => {
          hud.toast('NEW TASK: automate the regression suite (CI desk)');
        });
      } else if (ciDone) {
        dialog.show(CITY.engineerDone);
      } else {
        dialog.show(CITY.engineerWaiting);
      }
    },
  });

  interactables.push({
    pos: spots.ciDesk,
    radius: 1.9,
    label: 'Use terminal',
    enabled: () => true,
    onInteract() {
      if (ciDone) {
        dialog.show(CITY.ciAfter);
        return;
      }
      dialog.show(CITY.ciRun, () => {
        ciDone = true;
        persist();
        world.ciScreen.mat.color.set(C.screenGreen);
        world.ciScreen.mat.emissive.set(C.screenGreen);
        world.ciScreen.mat.emissiveIntensity = 0.6;
        hud.toast('Regression suite automated. Pipeline GREEN');
        confetti.burst(spots.ciDesk, 24, 2);
      });
    },
  });

  // ——— designer ———
  interactables.push({
    pos: spots.designer,
    radius: 2.2,
    label: 'Talk',
    enabled: () => true,
    onInteract() {
      designer.bubble.visible = false;
      dialog.show(CITY.designer);
    },
  });

  // ——— coffee machine ———
  interactables.push({
    pos: spots.coffee,
    radius: 1.6,
    label: 'Brew coffee',
    enabled: () => true,
    onInteract() {
      hud.toast(CITY.coffeeToast);
    },
  });

  // ——— the pond piano ———
  interactables.push({
    pos: spots.piano,
    radius: 2.2,
    label: 'Play piano',
    enabled: () => true,
    onInteract() {
      piano.open();
    },
  });

  // ——— satellite dish → contact ———
  interactables.push({
    pos: spots.dish,
    radius: 2.4,
    label: 'Transmit',
    enabled: () => true,
    onInteract() {
      dialog.show(DISH_DIALOG, () => contact.open());
    },
  });

  // ——— mailbox → contact, the cozy way ———
  interactables.push({
    pos: spots.mailbox,
    radius: 1.6,
    label: 'Check mailbox',
    enabled: () => true,
    onInteract() {
      dialog.show(MAILBOX_DIALOG, () => contact.open());
    },
  });

  // ——— fishing off the dock ———
  const bobber = world.bobber;
  const bobberBaseY = bobber.position.y;
  const biteWindow = () => (motionReduced() ? 2.2 : 1.2); // live, gentler timing
  let fishState = 'idle'; // idle | waiting | bite
  let fishTimer = 0;
  let fishCount = 0;
  let goldenCaught = false;
  const fishingIt = {
    pos: spots.fishing,
    radius: 1.8,
    label: 'Fish',
    enabled: () => true,
    onInteract() {
      if (fishState === 'idle') {
        fishState = 'waiting';
        fishTimer = 2 + Math.random() * 3.5;
        bobber.visible = true;
        fishingIt.label = 'Reel in';
        sfx.cast();
        hud.toast('line cast… wait for the tug');
      } else if (fishState === 'waiting') {
        fishState = 'idle';
        bobber.visible = false;
        fishingIt.label = 'Fish';
        sfx.miss();
        hud.toast('too eager. patience is a QA virtue');
      } else {
        fishState = 'idle';
        bobber.visible = false;
        fishingIt.label = 'Fish';
        fishCount++;
        sfx.catch();
        // the rare one carries a war story — every toy pays out content
        const rare = !goldenCaught && (Math.random() < 0.08 || fishCount === 7);
        const name = rare ? FISH_RARE : FISH[Math.floor(Math.random() * FISH.length)];
        hud.toast(`caught ${name}! · ${fishCount} landed`, 3200);
        confetti.burst(bobber.position, rare ? 40 : 16, 2);
        if (rare) {
          goldenCaught = true;
          dialog.show(GOLDEN_FISH_DIALOG);
        }
      }
    },
  };
  interactables.push(fishingIt);

  // ——— the farm: harvest the ripe gourds (they grow back) ———
  let harvested = 0;
  let harvestStoryTold = false;
  for (const g of world.gourds) {
    g.timer = 0;
    interactables.push({
      pos: g.pos,
      radius: 1.4,
      label: 'Harvest',
      enabled: () => g.fruit.visible,
      onInteract() {
        g.fruit.visible = false;
        g.timer = 45; // it regrows — regressions always do
        harvested++;
        sfx.pop();
        hud.toast(`ripe test case harvested · ${harvested} in the basket`);
        confetti.burst(g.pos, 8, 1);
        // clearing the whole row earns the regression-testing story
        if (!harvestStoryTold && world.gourds.every((gg) => !gg.fruit.visible)) {
          harvestStoryTold = true;
          setTimeout(() => dialog.show(HARVEST_DONE_DIALOG), 400);
        }
      },
    });
  }

  // ——— Bug the dog ———
  const dog = world.dog;
  interactables.push({
    pos: dog.root.position, // live — he follows you around
    radius: 1.7,
    label: 'Pet the dog',
    enabled: () => true,
    onInteract() {
      dog.excite();
      sfx.pet();
      hud.toast('Bug the dog approves. Morale fully restored.');
      confetti.burst(dog.root.position, 10, 1.2);
    },
  });

  // ——— restore saved progress (caught bugs, filed reports, CI, badge) ———
  {
    const save = loadSave();
    if (save) {
      for (const id of save.caught || []) {
        const bug = bugEntities.get(id);
        const def = BUGS.find((b) => b.id === id);
        if (!bug || !def || bug.isCaught()) continue;
        bug.catchInstant();
        bugsCaught++;
        caughtIds.push(id);
        if ((save.filed || []).includes(id)) filedIds.push(id);
        else caughtUnfiled.push(def);
      }
      bugsFiled = filedIds.length;
      for (let i = 0; i < bugsFiled; i++) {
        if (world.todoStickies[i]) world.todoStickies[i].visible = false;
        if (world.doneStickies[i]) world.doneStickies[i].visible = true;
      }
      hud.setBugs(bugsCaught, BUGS.length);
      if (save.ci) {
        ciDone = true;
        ciIntroduced = true;
        world.ciScreen.mat.color.set(C.screenGreen);
        world.ciScreen.mat.emissive.set(C.screenGreen);
        world.ciScreen.mat.emissiveIntensity = 0.6;
      }
      if (save.incidentResolved) {
        incident = RESOLVED;
        hud.setBadge(true);
      }
      if (bugsCaught > 0 || save.ci || save.incidentResolved) {
        setTimeout(() => hud.toast('progress restored, welcome back'), 1200);
      }
    }
  }

  // ——— first-run tutorial: derive the step from (restored) progress ———
  let tutorial = bugsFiled > 0 ? 'done' : bugsCaught > 0 ? 'file' : 'catch';
  if (tutorial === 'catch') {
    setTimeout(() => {
      if (tutorial === 'catch' && !dialog.isOpen()) dialog.show(TUTORIAL.intro);
    }, 1600);
  }

  // ——— per-frame ———
  let current = null;
  const npcRigs = [opsBot, pm, engineer, designer];
  const waveable = [pm, engineer, designer];
  const tmpAhead = new THREE.Vector3();

  return {
    getAlertTarget: () => alertTarget,
    getObjective() {
      if (tutorial === 'catch') return { label: 'catch the escaped bug', pos: spots.bugs.nullpointer };
      if (tutorial === 'file') return { label: 'file the report at the kanban', pos: spots.kanban };
      return null;
    },
    getMapMarkers() {
      const markers = [];
      for (const bug of bugEntities.values()) {
        if (!bug.isCaught()) {
          markers.push({ x: bug.root.position.x, z: bug.root.position.z, color: '#e068d8', pulse: true });
        }
      }
      if (dishMarker.visible) markers.push({ x: spots.dish.x, z: spots.dish.z, color: '#959af4' });
      if (opsMarker.visible) markers.push({ x: opsBot.root.position.x, z: opsBot.root.position.z, color: '#f49335', big: true, pulse: true });
      if (terminalMarker.visible) markers.push({ x: spots.terminal.x, z: spots.terminal.z, color: '#f49335', big: true, pulse: true });
      if (rackMarker.visible) markers.push({ x: spots.rack.x, z: spots.rack.z, color: '#f49335', big: true, pulse: true });
      return markers;
    },
    update(dt, t) {
      for (const bug of bugEntities.values()) bug.update(dt, t);
      confetti.update(dt);
      for (const npc of npcRigs) npc.update(dt, t);

      // fishing: the wait, the bite, the getaway
      if (fishState !== 'idle') {
        if (player.position.distanceTo(spots.fishing) > 3.2) {
          fishState = 'idle';
          bobber.visible = false;
          fishingIt.label = 'Fish';
        } else {
          fishTimer -= dt;
          bobber.position.y = fishState === 'bite'
            ? bobberBaseY - 0.16 + Math.sin(t * 24) * 0.03
            : bobberBaseY + Math.sin(t * 2.1) * 0.03;
          if (fishState === 'waiting' && fishTimer <= 0) {
            fishState = 'bite';
            fishTimer = biteWindow();
            fishingIt.label = 'Reel in!';
            sfx.bite();
            hud.toast('BITE! reel it in!', biteWindow() * 1000);
          } else if (fishState === 'bite' && fishTimer <= 0) {
            fishState = 'idle';
            bobber.visible = false;
            fishingIt.label = 'Fish';
            sfx.miss();
            hud.toast('it got away… they always repro eventually');
          }
        }
      }

      // the kanban prompt shows the filing queue
      kanbanIt.label = caughtUnfiled.length > 1
        ? `File report (${caughtUnfiled.length} queued)`
        : 'File report';

      // gourds regrow
      for (const g of world.gourds) {
        if (!g.fruit.visible) {
          g.timer -= dt;
          if (g.timer <= 0) g.fruit.visible = true;
        }
      }

      // the PM paces
      if (pm.play && pm.waveT <= 0 && !dialog.isOpen()) {
        if (pmPatrol.mode === 'idle') {
          pmPatrol.t -= dt;
          if (pmPatrol.t <= 0) {
            pmPatrol.i = 1 - pmPatrol.i;
            pmPatrol.mode = 'walk';
            pm.play('Walking_A');
            pm.baseClip = 'Walking_A';
          }
        } else {
          const target = pmPatrol.targets[pmPatrol.i];
          const p = pm.root.position;
          const dx = target.x - p.x;
          const dz = target.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.25) {
            pmPatrol.mode = 'idle';
            pmPatrol.t = 3 + Math.random() * 4;
            pm.play('Idle');
            pm.baseClip = 'Idle';
            pm.root.lookAt(spots.kanban.x, p.y, spots.kanban.z);
          } else {
            const step = Math.min(d, 1.5 * dt);
            p.x += (dx / d) * step;
            p.z += (dz / d) * step;
            p.y = heightAt(p.x, p.z); // stay on the ground while pacing
            pm.root.lookAt(target.x, p.y, target.z);
          }
        }
      }

      // the jogging intern laps the trail
      if (jogger) {
        jogger.u = (jogger.u + (dt * 4.4) / world.loopLength) % 1;
        world.loopPointAt(jogger.u, jogger.char.root.position);
        world.loopPointAt(jogger.u + 0.004, tmpAhead);
        jogger.char.root.lookAt(tmpAhead.x, jogger.char.root.position.y, tmpAhead.z);
        jogger.char.mixer.update(dt);
      }

      // a friendly cheer the first time you come close (the packs ship no
      // Wave clip — Cheer is the greeting we actually have)
      for (const npc of waveable) {
        if (!npc.play) continue;
        if (npc.waveT > 0) {
          npc.waveT -= dt;
          if (npc.waveT <= 0) npc.play(npc.baseClip);
        } else if (npc.waveCd > 0) {
          npc.waveCd -= dt;
        } else if (player.position.distanceTo(npc.root.position) < 3.8) {
          npc.play('Cheer');
          npc.waveT = 1.3;
          npc.waveCd = 24;
          npc.root.lookAt(player.position.x, npc.root.position.y, player.position.z);
        }
      }

      // markers bob
      const bob = Math.sin(t * 2.2) * 0.08;
      opsMarker.position.y = 2.0 + bob;
      terminalMarker.position.y = terminalMarker.userData.baseY + bob;
      rackMarker.position.y = rackMarker.userData.baseY + bob;
      dishMarker.position.y = dishMarker.userData.baseY + bob;

      // nearest enabled interactable in range
      current = null;
      let best = Infinity;
      for (const it of interactables) {
        if (!it.enabled()) { if (it.near) it.near(false); continue; }
        const d = player.position.distanceTo(it.pos);
        const isNear = d < it.radius;
        if (it.near) it.near(isNear);
        if (isNear && d < best) { best = d; current = it; }
      }
      const uiOpen = dialog.isOpen() || contact.isOpen() || piano.isOpen();
      hud.setPrompt(current && !uiOpen ? current.label : null);
    },
    tryInteract() {
      if (dialog.isOpen() || contact.isOpen() || piano.isOpen() || !current) return;
      if (!current.enabled()) return; // `current` may be a frame stale
      current.onInteract();
    },
  };
}
