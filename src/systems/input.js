// Keyboard (WASD/arrows + E + Space) and touch (virtual joystick + buttons).
export function createInput() {
  const keys = new Set();
  let interactQueued = false;
  let jumpQueued = false;
  let enabled = true;
  let onFirstMove = null;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const dir = KEYMAP[e.code];
    if (dir) {
      keys.add(dir);
      if (onFirstMove) { onFirstMove(); onFirstMove = null; }
      e.preventDefault();
    }
    if ((e.code === 'KeyE' || e.code === 'Enter') && enabled) {
      interactQueued = true;
      e.preventDefault();
    }
    if (e.code === 'Space' && enabled) {
      jumpQueued = true;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.add('sprint');
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEYMAP[e.code];
    if (dir) keys.delete(dir);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.delete('sprint');
  });
  window.addEventListener('blur', () => keys.clear());

  // ——— touch joystick ———
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const joyEl = document.getElementById('joystick');
  const knobEl = document.getElementById('joystick-knob');
  const actionEl = document.getElementById('action-btn');
  const jumpEl = document.getElementById('jump-btn');
  const joy = { active: false, id: null, baseX: 0, baseY: 0, x: 0, y: 0 };

  if (isTouch) {
    actionEl.hidden = false;
    jumpEl.hidden = false;
    const MAX = 48;

    window.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        // left 60% of the screen steers; ignore touches on buttons/dialogs
        if (joy.active || t.clientX > window.innerWidth * 0.6) continue;
        if (t.target.closest('button, #dialog, #contact-panel, #boot, #fallback')) continue;
        joy.active = true;
        joy.id = t.identifier;
        joy.baseX = t.clientX;
        joy.baseY = t.clientY;
        joyEl.hidden = false;
        joyEl.style.left = `${t.clientX - 64}px`;
        joyEl.style.top = `${t.clientY - 64}px`;
        if (onFirstMove) { onFirstMove(); onFirstMove = null; }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!joy.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== joy.id) continue;
        const dx = t.clientX - joy.baseX;
        const dy = t.clientY - joy.baseY;
        const len = Math.hypot(dx, dy) || 1;
        const clamped = Math.min(len, MAX);
        joy.x = (dx / len) * (clamped / MAX);
        joy.y = (dy / len) * (clamped / MAX);
        knobEl.style.transform = `translate(${(dx / len) * clamped}px, ${(dy / len) * clamped}px)`;
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joy.id) continue;
        joy.active = false;
        joy.x = joy.y = 0;
        joyEl.hidden = true;
        knobEl.style.transform = '';
      }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    // buttons react on touchstart, NOT click: browsers suppress synthetic
    // clicks for secondary fingers during an active touch (the joystick),
    // which forced players to stop walking before they could jump/interact.
    // preventDefault stops the ghost click from double-firing.
    actionEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (enabled) interactQueued = true;
    }, { passive: false });
    jumpEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (enabled) jumpQueued = true;
    }, { passive: false });
    // mouse fallback for touch-capable laptops
    actionEl.addEventListener('click', () => {
      if (enabled) interactQueued = true;
    });
    jumpEl.addEventListener('click', () => {
      if (enabled) jumpQueued = true;
    });
  }

  return {
    isTouch,
    setEnabled(v) { enabled = v; },
    setFirstMoveCallback(fn) { onFirstMove = fn; },
    consumeInteract() {
      const v = interactQueued;
      interactQueued = false;
      return v;
    },
    consumeJump() {
      const v = jumpQueued;
      jumpQueued = false;
      return v;
    },
    isSprinting() {
      return keys.has('sprint');
    },
    getMove() {
      let x = 0, z = 0;
      if (keys.has('up')) z -= 1;
      if (keys.has('down')) z += 1;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      if (joy.active) { x += joy.x; z += joy.y; }
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    },
  };
}
