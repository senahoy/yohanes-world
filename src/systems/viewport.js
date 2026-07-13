// Forced-landscape viewport: on touch devices in portrait we rotate the
// whole page 90° with CSS and swap the render dimensions, so the game is
// ALWAYS landscape — playable immediately, no waiting for the user to
// rotate or fight their orientation lock. A transient hint invites them
// to turn the phone; when the browser itself reports landscape the
// rotation is removed and everything is native again.

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const portraitMq = window.matchMedia('(orientation: portrait)');

export function isRotated() {
  return document.body.classList.contains('rotated');
}

// game-space size: what the renderer and camera should use
export function viewSize() {
  return isRotated()
    ? { w: window.innerHeight, h: window.innerWidth }
    : { w: window.innerWidth, h: window.innerHeight };
}

// map a physical touch point into rotated game space
// (rotate(90deg) translateY(-100%) ⇒ x' = clientY, y' = innerWidth − clientX)
export function gameX(clientX, clientY) {
  return isRotated() ? clientY : clientX;
}
export function gameY(clientX, clientY) {
  return isRotated() ? window.innerWidth - clientX : clientY;
}

export function initForcedLandscape(onChange) {
  if (!isTouch) return;
  const sync = () => {
    const rotate = portraitMq.matches;
    document.body.classList.toggle('rotated', rotate);
    onChange?.(rotate);
  };
  portraitMq.addEventListener('change', sync);
  sync();
}
