// A real playable piano: one octave, WebAudio oscillator voices,
// mouse/touch + keyboard (A–K white keys, W E T Y U black keys).

const WHITE = [
  { note: 'C4', freq: 261.63, key: 'KeyA', label: 'A' },
  { note: 'D4', freq: 293.66, key: 'KeyS', label: 'S' },
  { note: 'E4', freq: 329.63, key: 'KeyD', label: 'D' },
  { note: 'F4', freq: 349.23, key: 'KeyF', label: 'F' },
  { note: 'G4', freq: 392.0, key: 'KeyG', label: 'G' },
  { note: 'A4', freq: 440.0, key: 'KeyH', label: 'H' },
  { note: 'B4', freq: 493.88, key: 'KeyJ', label: 'J' },
  { note: 'C5', freq: 523.25, key: 'KeyK', label: 'K' },
];
// black keys sit after the white key at `after` (index into WHITE)
const BLACK = [
  { note: 'C#4', freq: 277.18, key: 'KeyW', label: 'W', after: 0 },
  { note: 'D#4', freq: 311.13, key: 'KeyE', label: 'E', after: 1 },
  { note: 'F#4', freq: 369.99, key: 'KeyT', label: 'T', after: 3 },
  { note: 'G#4', freq: 415.3, key: 'KeyY', label: 'Y', after: 4 },
  { note: 'A#4', freq: 466.16, key: 'KeyU', label: 'U', after: 5 },
];

export function createPiano() {
  const panel = document.getElementById('piano-panel');
  const keysEl = document.getElementById('piano-keys');
  const closeBtn = document.getElementById('piano-close');

  let audio = null;
  let master = null;
  const keyEls = new Map(); // KeyboardEvent.code -> element

  function ensureAudio() {
    if (audio) {
      if (audio.state === 'suspended') audio.resume();
      return;
    }
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.gain.value = 0.5;
    master.connect(audio.destination);
  }

  function play(freq, el) {
    ensureAudio();
    const t0 = audio.currentTime;
    const osc = audio.createOscillator();
    const osc2 = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const g2 = audio.createGain();
    g2.gain.value = 0.18;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.9, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
    osc.connect(gain);
    osc2.connect(g2).connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc2.start(t0);
    osc.stop(t0 + 1.5);
    osc2.stop(t0 + 1.5);
    if (el) {
      el.classList.add('down');
      setTimeout(() => el.classList.remove('down'), 140);
    }
  }

  // build the keyboard DOM
  const whiteWidth = 100 / WHITE.length;
  WHITE.forEach((k, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'piano-key white';
    el.style.left = `${i * whiteWidth}%`;
    el.style.width = `${whiteWidth}%`;
    el.innerHTML = `<span>${k.label}</span>`;
    el.setAttribute('aria-label', `piano key ${k.note}`);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); play(k.freq, el); });
    keysEl.appendChild(el);
    keyEls.set(k.key, { el, freq: k.freq });
  });
  BLACK.forEach((k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'piano-key black';
    el.style.left = `${(k.after + 1) * whiteWidth - whiteWidth * 0.3}%`;
    el.style.width = `${whiteWidth * 0.6}%`;
    el.innerHTML = `<span>${k.label}</span>`;
    el.setAttribute('aria-label', `piano key ${k.note}`);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); play(k.freq, el); });
    keysEl.appendChild(el);
    keyEls.set(k.key, { el, freq: k.freq });
  });

  let onClose = null;
  function close() {
    panel.hidden = true;
    if (onClose) onClose();
  }
  closeBtn.addEventListener('click', close);

  window.addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.code === 'Escape') { close(); return; }
    const hit = keyEls.get(e.code);
    if (hit && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      play(hit.freq, hit.el);
    }
  }, true); // capture: piano eats keys before the game does

  return {
    isOpen: () => !panel.hidden,
    open(closeCb) {
      onClose = closeCb || null;
      panel.hidden = false;
      ensureAudio();
      closeBtn.focus({ preventScroll: true });
    },
  };
}
