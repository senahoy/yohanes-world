import { PROFILE } from '../content.js';

export function createHud() {
  const hud = document.getElementById('hud');
  const bugsEl = document.getElementById('hud-bugs');
  const badgeEl = document.getElementById('hud-badge');
  const alertEl = document.getElementById('hud-alert');
  const promptEl = document.getElementById('hud-prompt');
  const promptLabel = document.getElementById('hud-prompt-label');
  const hintEl = document.getElementById('hud-hint');
  const toastsEl = document.getElementById('toasts');
  const actionBtn = document.getElementById('action-btn');
  const textBtn = document.getElementById('hud-text-mode');
  const muteBtn = document.getElementById('hud-mute');
  const motionBtn = document.getElementById('hud-motion');
  const fsBtn = document.getElementById('hud-fullscreen');

  // fullscreen: ⛶ chip + F key (hidden where the API doesn't exist, e.g. iPhone)
  const fsRoot = document.documentElement;
  if (!fsRoot.requestFullscreen) {
    fsBtn.hidden = true;
  } else {
    const toggleFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else fsRoot.requestFullscreen();
    };
    fsBtn.addEventListener('click', toggleFullscreen);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !e.repeat) toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      fsBtn.title = on ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
    });
  }

  return {
    show() { hud.hidden = false; },
    hide() { hud.hidden = true; },
    setTouchHints() {
      hintEl.innerHTML = 'left: move &nbsp;·&nbsp; right: look around &nbsp;·&nbsp; <span class="key">JUMP</span> &nbsp;·&nbsp; <span class="key">ACT</span> interact';
    },
    onTextMode(fn) { textBtn.addEventListener('click', fn); },
    onMute(fn) { muteBtn.addEventListener('click', fn); },
    setMuted(m) { muteBtn.textContent = m ? '🔇' : '🔊'; },
    showMotionChip() { motionBtn.hidden = false; },
    onMotion(fn) { motionBtn.addEventListener('click', fn); },
    setMotion(reduced) {
      motionBtn.textContent = reduced ? '🍃' : '✨';
      motionBtn.title = reduced ? 'Enable full animation' : 'Reduce animation';
      motionBtn.setAttribute('aria-pressed', reduced ? 'true' : 'false');
    },
    setBugs(n, total) { bugsEl.textContent = `🐛 ${n}/${total}`; },
    setBadge(visible) { badgeEl.hidden = !visible; },
    setAlert(visible) { alertEl.hidden = !visible; },
    fadeHint() { hintEl.classList.add('faded'); },
    setPrompt(label) {
      if (label) {
        promptLabel.textContent = label;
        promptEl.hidden = false;
        actionBtn.classList.add('armed');
      } else {
        promptEl.hidden = true;
        actionBtn.classList.remove('armed');
      }
    },
    toast(text, ms = 2600) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = text;
      toastsEl.appendChild(el);
      setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 450);
      }, ms);
    },
  };
}

// Contact panel ("send a signal") — shared by the dish dialog and fallback page.
export function contactActionsHtml() {
  const actions = [
    `<a class="primary" href="mailto:${PROFILE.email}">✉ EMAIL ME — ${PROFILE.email}</a>`,
    ...PROFILE.socials.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`),
  ];
  return actions.join('');
}

export function createContactPanel() {
  const panel = document.getElementById('contact-panel');
  const actionsEl = document.getElementById('contact-actions');
  const closeBtn = document.getElementById('contact-close');
  actionsEl.innerHTML = contactActionsHtml();

  let onClose = null;
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    if (onClose) onClose();
  });
  window.addEventListener('keydown', (e) => {
    if (!panel.hidden && e.code === 'Escape') {
      panel.hidden = true;
      if (onClose) onClose();
    }
  });

  return {
    isOpen: () => !panel.hidden,
    open(closeCb) {
      onClose = closeCb || null;
      panel.hidden = false;
      closeBtn.focus({ preventScroll: true });
    },
  };
}
