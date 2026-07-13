import './style.css';
import { showFallback } from './ui/fallback.js';

const boot = document.getElementById('boot');
const enterBtn = document.getElementById('boot-enter');
const textBtn = document.getElementById('boot-text');
const controlsHint = document.getElementById('boot-controls');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const mode = new URLSearchParams(window.location.search).get('mode');

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
const canRun3d = webglAvailable();

if (isTouch) controlsHint.textContent = 'left thumb: move · right thumb: look · ACT / JUMP buttons';

function dismissBoot() {
  boot.classList.add('leaving');
  setTimeout(() => { boot.hidden = true; }, 550);
}

let gameStarted = false;
async function enterWorld() {
  if (gameStarted) return;
  gameStarted = true;
  // touch devices: go fullscreen + lock landscape while we still hold the
  // tap's user activation (Android honors this; iOS falls back to the
  // in-game rotate gate)
  if (isTouch && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen()
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => { /* unsupported — the rotate overlay covers it */ });
  }
  enterBtn.disabled = true;
  enterBtn.textContent = '… BOOTING WORLD';
  const { startGame } = await import('./game.js');
  document.getElementById('fallback').hidden = true;
  await startGame({
    reducedMotion,
    onProgress: (p) => {
      enterBtn.textContent = `… LOADING WORLD ${Math.round(p * 100)}%`;
    },
  });
  dismissBoot();
}

function enterText() {
  dismissBoot();
  showFallback({ canRun3d, onEnterWorld: enterWorld });
}

if (!canRun3d) {
  enterBtn.hidden = true;
  textBtn.textContent = 'read the portfolio (3D needs WebGL, which this browser lacks)';
}

enterBtn.addEventListener('click', enterWorld);
textBtn.addEventListener('click', enterText);

// Deep links + reduced-motion default
if (mode === 'text' || (!mode && reducedMotion) || (!mode && !canRun3d)) {
  boot.hidden = true;
  showFallback({ canRun3d, onEnterWorld: enterWorld });
} else if (mode === 'world' && canRun3d) {
  enterWorld();
}
