// Motion preference with an explicit override.
//
// The OS `prefers-reduced-motion` signal is the DEFAULT — but it's a blunt
// one (Android Chrome reports it whenever Battery Saver is on), so a player
// who deliberately entered the 3D world can flip the 🍃 HUD chip to get the
// full ambience back. The explicit choice persists and always wins.

const KEY = 'yohanes-world-motion';

export const osPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let stored = null;
try {
  stored = localStorage.getItem(KEY);
} catch { /* storage unavailable — fall back to the OS signal */ }

let reduced = stored === 'full' ? false : stored === 'reduced' ? true : osPrefersReduced;

export function motionReduced() {
  return reduced;
}

export function motionOverridden() {
  return stored === 'full' || stored === 'reduced';
}

export function setMotionReduced(v) {
  reduced = v;
  try {
    localStorage.setItem(KEY, v ? 'reduced' : 'full');
    stored = v ? 'reduced' : 'full';
  } catch { /* fine — applies for this session only */ }
}
