// End-to-end smoke test: boots the world and plays the entire portfolio —
// bugs, kanban, CI, the incident, fishing, jumping, persistence, and both
// fallback paths. A QA engineer's site ships with its own regression suite.
//
// Usage: npm test   (starts vite itself if :5180 isn't already serving)

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5180';
const results = [];
let failed = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function serverUp() {
  try {
    const res = await fetch(BASE);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  let vite = null;
  if (!(await serverUp())) {
    console.log('starting vite…');
    vite = spawn('npx', ['vite'], { stdio: 'ignore', detached: true });
    for (let i = 0; i < 60 && !(await serverUp()); i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!(await serverUp())) throw new Error('vite did not start');
  }

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    browser = await chromium.launch(); // fall back to the bundled build
  }
  const page = await (await browser.newContext()).newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const world = () => page.waitForFunction(() => window.__world, null, { timeout: 30000 });
  const teleport = (spotExpr, dx = 0, dz = 0) =>
    page.evaluate(({ s, dx, dz }) => {
      const w = window.__world;
      const p = new Function('w', `return ${s}`)(w);
      w.player.position.set(p.x + dx, p.y, p.z + dz);
    }, { s: spotExpr, dx, dz });
  const settle = () => page.waitForTimeout(450);
  const dialogOpen = () => page.evaluate(() => !document.getElementById('dialog').hidden);
  const clickThroughDialog = async () => {
    for (let i = 0; i < 10; i++) {
      if (!(await dialogOpen())) return;
      await page.evaluate(() => document.getElementById('dialog-next').click());
      await page.waitForTimeout(220);
    }
  };
  const bugsHud = () => page.evaluate(() => document.getElementById('hud-bugs').textContent);
  // fresh worlds open the tutorial intro dialog ~1.6s after boot
  const dismissDialog = async (p = page) => {
    await p.waitForTimeout(2000);
    for (let i = 0; i < 10; i++) {
      const open = await p.evaluate(() => !document.getElementById('dialog').hidden);
      if (!open) break;
      await p.evaluate(() => document.getElementById('dialog-next').click());
      await p.waitForTimeout(200);
    }
  };

  // ——— text fallback ———
  console.log('text fallback');
  await page.goto(`${BASE}/?mode=text`);
  await page.waitForTimeout(800);
  const panels = await page.evaluate(() => document.querySelectorAll('.fb-panel').length);
  check('fallback renders all panels', panels >= 9, `${panels} panels`);

  // ——— world boot ———
  console.log('world');
  await page.goto(`${BASE}/?mode=world&reset`);
  await world();
  await page.waitForTimeout(2000);
  check('world boots without page errors', pageErrors.length === 0, pageErrors[0] || '');
  check('bug counter starts at 0/6', (await bugsHud()) === '🐛 0/6', await bugsHud());
  await dismissDialog();
  const obj1 = await page.evaluate(() =>
    document.getElementById('hud-objective').hidden ? null : document.getElementById('hud-obj-label').textContent);
  check('tutorial mission 1: catch', !!obj1 && obj1.includes('catch'), obj1 || 'banner hidden');

  // ——— audio: context unlocks, mute toggles + persists ———
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(600);
  const audioRunning = await page.evaluate(() => window.__world.audioState());
  check('audio context is running', audioRunning === 'running', audioRunning);
  await page.click('#hud-mute');
  await page.waitForTimeout(200);
  const mutedIcon = await page.evaluate(() => document.getElementById('hud-mute').textContent);
  const mutedStored = await page.evaluate(() => localStorage.getItem('yohanes-world-muted'));
  await page.click('#hud-mute'); // back on for the rest of the run
  check('mute toggles and persists', mutedIcon === '🔇' && mutedStored === '1');

  // ——— fullscreen chip + F key ———
  const fsSupported = await page.evaluate(() => !!document.documentElement.requestFullscreen);
  if (fsSupported) {
    await page.click('#hud-fullscreen');
    await page.waitForTimeout(500);
    const fsOn = await page.evaluate(() => !!document.fullscreenElement);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(500);
    const fsOff = await page.evaluate(() => !document.fullscreenElement);
    check('fullscreen toggles via chip and F key', fsOn && fsOff, JSON.stringify({ fsOn, fsOff }));
  } else {
    check('fullscreen chip hidden without API', await page.evaluate(() => document.getElementById('hud-fullscreen').hidden));
  }

  // ——— day/night cycle drives the sky + lights ———
  const cycle = await page.evaluate(async () => {
    const w = window.__world;
    w.sky.setPhase(0.25); // noon
    await new Promise((r) => setTimeout(r, 300));
    const day = w.sky.getDay();
    w.sky.setPhase(0.75); // midnight
    await new Promise((r) => setTimeout(r, 300));
    const night = w.sky.getDay();
    w.sky.clearPhase();
    return { day, night };
  });
  check('day/night cycle drives the sky', cycle.day > 0.9 && cycle.night < 0.1, JSON.stringify(cycle));

  // ——— jump ———
  const y0 = await page.evaluate(() => window.__world.player.position.y);
  await page.keyboard.press('Space');
  await page.waitForTimeout(220);
  const yMid = await page.evaluate(() => window.__world.player.position.y);
  await page.waitForTimeout(900);
  check('jump rises and lands', yMid > y0 + 0.5, `apex sample +${(yMid - y0).toFixed(2)}`);

  // ——— dialog close via E must not reopen (regression: double-interact) ———
  await teleport('w.world.spots.opsBot', 1, 1);
  await settle();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  const opened = await dialogOpen();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(220);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(600);
  check('E-closed dialog stays closed', opened && !(await dialogOpen()));

  // ——— catch a bug entirely via the E key (regression: double count) ———
  await teleport('w.world.spots.bugs.nullpointer');
  await settle();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(250);
  }
  check('bug caught exactly once', (await bugsHud()) === '🐛 1/6', await bugsHud());
  await dismissDialog();
  const obj2 = await page.evaluate(() =>
    document.getElementById('hud-objective').hidden ? null : document.getElementById('hud-obj-label').textContent);
  check('tutorial mission 2: file', !!obj2 && obj2.includes('file'), obj2 || 'banner hidden');

  // ——— file the report (approach from the north — the PM paces just south) ———
  await teleport('w.world.spots.kanban', 0, 1.7);
  await settle();
  await page.evaluate(() => window.__world.quests.tryInteract());
  await page.waitForTimeout(300);
  await clickThroughDialog();
  const stickyFlipped = await page.evaluate(() =>
    !window.__world.world.todoStickies[0].visible && window.__world.world.doneStickies[0].visible);
  check('kanban filing flips a sticky', stickyFlipped);
  await dismissDialog();
  const objDone = await page.evaluate(() => document.getElementById('hud-objective').hidden);
  check('tutorial complete: mission banner clears', objDone);

  // ——— automate the CI ———
  await teleport('w.world.spots.ciDesk', -1.3, 0);
  await settle();
  await page.evaluate(() => window.__world.quests.tryInteract());
  await page.waitForTimeout(300);
  await clickThroughDialog();
  const ciGreen = await page.evaluate(() => window.__world.world.ciScreen.mat.color.getHexString());
  check('CI pipeline goes green', ciGreen === '5edb81', ciGreen);

  // ——— the production incident ———
  const runStep = async (spotExpr, dx = 0, dz = 0) => {
    await teleport(spotExpr, dx, dz);
    await settle();
    await page.evaluate(() => window.__world.quests.tryInteract());
    await page.waitForTimeout(300);
    await clickThroughDialog();
  };
  await runStep('w.world.spots.rack', 0, 1.2);      // trigger
  await runStep('w.world.spots.opsBot', 1, 1);      // briefing
  await runStep('w.world.spots.terminal', -1.3, 0); // investigate
  await runStep('w.world.spots.rack', 0, 1.2);      // resolve
  const badge = await page.evaluate(() => !document.getElementById('hud-badge').hidden);
  check('incident resolved, badge earned', badge);

  // ——— fishing: cast arms the reel ———
  await teleport('w.world.spots.fishing');
  await settle();
  await page.evaluate(() => window.__world.quests.tryInteract());
  await page.waitForTimeout(300);
  const bobberVisible = await page.evaluate(() => window.__world.world.bobber.visible);
  check('fishing cast shows the bobber', bobberVisible);

  // ——— mobile: landscape gate, labeled controls, mid-run multi-touch jump ———
  {
    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    const mp = await mctx.newPage();
    await mp.goto(`${BASE}/?mode=world&reset`);
    await mp.waitForFunction(() => window.__world, null, { timeout: 30000 });
    await mp.waitForTimeout(1200);
    // portrait: page is CSS-rotated, canvas renders landscape, hint shows,
    // and the joystick already steers in the rotated coordinate space
    const portrait = await mp.evaluate(() => {
      const c = document.querySelector('#app canvas');
      return {
        rotated: document.body.classList.contains('rotated'),
        hint: !document.getElementById('rotate-overlay').hidden,
        canvas: [c.width, c.height],
      };
    });
    await dismissDialog(mp); // clear the tutorial intro before driving input
    const portraitMove = await mp.evaluate(async () => {
      const w = window.__world;
      const mk = (id, target, x, y) => new Touch({ identifier: id, target, clientX: x, clientY: y });
      const fire = (target, type, touches, changed) => target.dispatchEvent(new TouchEvent(type, {
        touches, targetTouches: [], changedTouches: changed, bubbles: true, cancelable: true,
      }));
      const t1 = mk(1, document.body, 200, 400);
      fire(window, 'touchstart', [t1], [t1]);
      const t2 = mk(1, document.body, 260, 400); // physical +x = rotated forward
      fire(window, 'touchmove', [t2], [t2]);
      await new Promise((r) => setTimeout(r, 400));
      const speed = +w.player.velocity.length().toFixed(1);
      fire(window, 'touchend', [], [t2]);
      return speed;
    });
    check('portrait: forced landscape, playable immediately',
      portrait.rotated && portrait.hint && portrait.canvas[0] === 844 && portrait.canvas[1] === 390 && portraitMove > 1,
      JSON.stringify({ ...portrait, portraitMove }));
    await mp.setViewportSize({ width: 844, height: 390 });
    await mp.waitForTimeout(500);
    const landscape = await mp.evaluate(() => ({
      rotated: document.body.classList.contains('rotated'),
      hintHidden: document.getElementById('rotate-overlay').hidden,
      act: document.getElementById('action-btn').textContent,
      jump: document.getElementById('jump-btn').textContent,
    }));
    check('landscape: rotation removed, labeled controls',
      !landscape.rotated && landscape.hintHidden && landscape.act === 'ACT' && landscape.jump === 'JUMP',
      JSON.stringify(landscape));
    const multi = await mp.evaluate(async () => {
      const w = window.__world;
      const mkTouch = (id, target, x, y) => new Touch({ identifier: id, target, clientX: x, clientY: y });
      const fire = (target, type, touches, changed) => target.dispatchEvent(new TouchEvent(type, {
        touches, targetTouches: touches.filter((t) => t.target === target), changedTouches: changed,
        bubbles: true, cancelable: true,
      }));
      const t1 = mkTouch(1, document.body, 150, 250);
      fire(window, 'touchstart', [t1], [t1]);
      const t1move = mkTouch(1, document.body, 150, 190);
      fire(window, 'touchmove', [t1move], [t1move]);
      await new Promise((r) => setTimeout(r, 500));
      const jumpBtn = document.getElementById('jump-btn');
      const rect = jumpBtn.getBoundingClientRect();
      const t2 = mkTouch(2, jumpBtn, rect.x + 20, rect.y + 20);
      fire(jumpBtn, 'touchstart', [t1move, t2], [t2]);
      await new Promise((r) => setTimeout(r, 200));
      const result = { airborne: w.player.isAirborne(), moving: w.player.velocity.length() > 1 };
      fire(jumpBtn, 'touchend', [t1move], [t2]);
      fire(window, 'touchend', [], [t1move]);
      return result;
    });
    check('multi-touch: jump fires mid-run without stopping', multi.airborne && multi.moving, JSON.stringify(multi));
    // right half of the screen orbits the camera
    const camTurn = await mp.evaluate(async () => {
      const w = window.__world;
      const heading = () => Math.atan2(w.followCam.frame.forward.x, w.followCam.frame.forward.z);
      const h0 = heading();
      const mk = (id, target, x, y) => new Touch({ identifier: id, target, clientX: x, clientY: y });
      const fire = (target, type, touches, changed) => target.dispatchEvent(new TouchEvent(type, {
        touches, targetTouches: [], changedTouches: changed, bubbles: true, cancelable: true,
      }));
      const t1 = mk(9, document.body, 700, 300);
      fire(window, 'touchstart', [t1], [t1]);
      const t2 = mk(9, document.body, 600, 300);
      fire(window, 'touchmove', [t2], [t2]);
      await new Promise((r) => setTimeout(r, 300));
      fire(window, 'touchend', [], [t2]);
      const d = Math.abs(heading() - h0);
      return +Math.min(d, Math.PI * 2 - d).toFixed(2); // normalize the wrap
    });
    check('right-side drag orbits the camera', camTurn > 0.2, `turned ${camTurn} rad`);
    await mctx.close();
  }

  // ——— reduced-motion: ambience parks, 🍃 chip overrides and persists ———
  {
    const rctx = await browser.newContext({ reducedMotion: 'reduce' });
    const rp = await rctx.newPage();
    await rp.goto(`${BASE}/?mode=world&reset`);
    await rp.waitForFunction(() => window.__world, null, { timeout: 30000 });
    await dismissDialog(rp);
    const before = await rp.evaluate(() => ({
      reduced: window.__world.motion.reduced(),
      chipVisible: !document.getElementById('hud-motion').hidden,
      chip: document.getElementById('hud-motion').textContent,
    }));
    await rp.click('#hud-motion');
    await rp.waitForTimeout(300);
    const after = await rp.evaluate(() => ({
      reduced: window.__world.motion.reduced(),
      chip: document.getElementById('hud-motion').textContent,
      stored: localStorage.getItem('yohanes-world-motion'),
    }));
    await rp.reload();
    await rp.waitForFunction(() => window.__world, null, { timeout: 30000 });
    await rp.waitForTimeout(800);
    const persisted = await rp.evaluate(() => window.__world.motion.reduced());
    check('reduce-motion parks ambience; 🍃 chip overrides and persists',
      before.reduced && before.chipVisible && before.chip === '🍃'
        && !after.reduced && after.chip === '✨' && after.stored === 'full' && persisted === false,
      JSON.stringify({ before, after, persisted }));
    await rctx.close();
  }

  // ——— persistence across reload ———
  await page.goto(`${BASE}/?mode=world`);
  await world();
  await page.waitForTimeout(2500);
  const restored = await page.evaluate(() => ({
    bugs: document.getElementById('hud-bugs').textContent,
    ci: window.__world.world.ciScreen.mat.color.getHexString(),
    badge: !document.getElementById('hud-badge').hidden,
  }));
  check('progress restored after reload', restored.bugs === '🐛 1/6' && restored.ci === '5edb81' && restored.badge,
    JSON.stringify(restored));

  // ——— procedural fallback world (no assets) ———
  pageErrors.length = 0;
  await page.goto(`${BASE}/?mode=world&noassets&reset`);
  await world();
  await page.waitForTimeout(1500);
  check('no-asset world boots clean', pageErrors.length === 0, pageErrors[0] || '');

  await browser.close();
  if (vite) process.kill(-vite.pid);

  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
