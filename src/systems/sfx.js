// Procedural audio: synth SFX + a generative lo-fi background loop.
// Everything is WebAudio — no files, no licenses, a few kilobytes of code.
//
// Graph:  sfxBus ──┐
//                  ├── master ── destination      (master = mute switch)
//   bgmBus ── duck ┘                              (duck = piano overlay)

let ctx = null;
let master = null;
let sfxBus = null;
let bgmBus = null;
let bgmDuck = null;
let musicStarted = false;

const MUTE_KEY = 'yohanes-world-muted';
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch { /* storage unavailable — default to sound on */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    bgmDuck = ctx.createGain();
    bgmDuck.gain.value = 1;
    bgmDuck.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0.17;
    bgmBus.connect(bgmDuck);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Arm the context on the first real gesture (Safari refuses anything else;
// Chrome usually accepts the sticky activation from the ENTER click).
export function initAudio() {
  ac();
  const arm = () => ac();
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, arm, { once: true, passive: true });
  }
  // don't serenade background tabs
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!document.hidden) ctx.resume();
  });
}

export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch { /* fine */ }
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
}

export function getMuted() {
  return muted;
}

// piano overlay: the world's music steps aside for the player's
export function duckMusic(level) {
  if (ctx && bgmDuck) bgmDuck.gain.setTargetAtTime(level, ctx.currentTime, 0.25);
}

export function audioState() {
  return ctx ? ctx.state : 'none';
}

// ——— sound effects ———
function tone({ f0, f1 = null, dur = 0.12, type = 'sine', gain = 0.09, at = 0 }) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  hop() { tone({ f0: 220, f1: 460, dur: 0.15, type: 'square', gain: 0.05 }); },
  cast() { tone({ f0: 700, f1: 210, dur: 0.2, gain: 0.11 }); },
  bite() { tone({ f0: 880, dur: 0.07, gain: 0.12 }); tone({ f0: 880, dur: 0.07, gain: 0.12, at: 0.1 }); },
  catch() {
    tone({ f0: 660, dur: 0.09, gain: 0.11 });
    tone({ f0: 880, dur: 0.09, gain: 0.11, at: 0.09 });
    tone({ f0: 1100, dur: 0.16, gain: 0.11, at: 0.18 });
  },
  miss() { tone({ f0: 320, f1: 140, dur: 0.25, type: 'triangle', gain: 0.1 }); },
  pop() { tone({ f0: 480, f1: 900, dur: 0.09, type: 'triangle', gain: 0.12 }); },
  pet() { tone({ f0: 520, dur: 0.08, gain: 0.1 }); tone({ f0: 660, dur: 0.1, gain: 0.1, at: 0.09 }); },
};

// ——— generative background loop ———
// A-minor lo-fi: warm pad chords, a soft bass root, and a sparse plucked
// pentatonic melody that never repeats exactly. Cozy, quiet, endless.
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  { root: 45, notes: [57, 60, 64] }, // Am
  { root: 41, notes: [53, 57, 60] }, // F
  { root: 48, notes: [55, 60, 64] }, // C
  { root: 43, notes: [55, 59, 62] }, // G
];
const PENTA = [69, 72, 74, 76, 79, 81];
const BAR = 3.2; // seconds per chord

function pad(freq, t, dur) {
  const a = ctx;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.055, t + 1.1);
  g.gain.setValueAtTime(0.055, t + dur - 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 780;
  for (const detune of [-4, 4]) {
    const osc = a.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(lp);
    osc.start(t);
    osc.stop(t + dur + 0.8);
  }
  lp.connect(g).connect(bgmBus);
}

function bass(freq, t, dur) {
  const a = ctx;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bgmBus);
  osc.start(t);
  osc.stop(t + dur + 0.1);
}

function pluck(freq, t, vel) {
  const a = ctx;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  osc.connect(g).connect(bgmBus);
  osc.start(t);
  osc.stop(t + 0.6);
}

function playBar(chord, t, barIdx) {
  bass(midi(chord.root - 12), t, BAR);
  for (const n of chord.notes) pad(midi(n), t, BAR);
  // sparse eighth-note melody; every 4th bar breathes
  const steps = 8;
  const density = barIdx % 4 === 3 ? 0.22 : 0.42;
  for (let i = 0; i < steps; i++) {
    if (Math.random() > density) continue;
    const n = PENTA[Math.floor(Math.random() * PENTA.length)];
    pluck(midi(n), t + i * (BAR / steps) + Math.random() * 0.012, 0.09 + Math.random() * 0.05);
  }
  // the occasional distant star-ping
  if (Math.random() < 0.25) {
    pluck(midi(PENTA[Math.floor(Math.random() * PENTA.length)] + 12), t + Math.random() * BAR, 0.03);
  }
}

export function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  let bar = 0;
  let nextT = 0;
  const tick = () => {
    // wait out suspended contexts — never pile bars onto a frozen clock
    if (!ac() || ctx.state !== 'running') {
      setTimeout(tick, 400);
      return;
    }
    if (!nextT) nextT = ctx.currentTime + 0.15;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.15; // resumed after a gap
    while (nextT < ctx.currentTime + BAR * 1.6) {
      playBar(CHORDS[bar % CHORDS.length], nextT, bar);
      bar++;
      nextT += BAR;
    }
    setTimeout(tick, 600);
  };
  tick();
}
