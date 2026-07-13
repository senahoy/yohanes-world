// Paper dialog panel with typewriter reveal. Lines are [{ tone, name, text }].
const TYPE_MS = 16;

export function createDialog({ reducedMotion = false } = {}) {
  const panel = document.getElementById('dialog');
  const nameEl = document.getElementById('dialog-name');
  const textEl = document.getElementById('dialog-text');
  const nextBtn = document.getElementById('dialog-next');

  let lines = [];
  let index = 0;
  let typing = null; // interval id while typewriting
  let onDone = null;
  let openedAt = 0;

  function renderLine() {
    const line = lines[index];
    nameEl.textContent = line.name;
    nameEl.className = `dialog-name tone-${line.tone || 'me'}`;
    nextBtn.textContent = index === lines.length - 1 ? '✕' : '▶';
    clearInterval(typing);
    typing = null;
    if (reducedMotion) {
      textEl.textContent = line.text;
      return;
    }
    textEl.textContent = '';
    let i = 0;
    typing = setInterval(() => {
      i++;
      textEl.textContent = line.text.slice(0, i);
      if (i >= line.text.length) {
        clearInterval(typing);
        typing = null;
      }
    }, TYPE_MS);
  }

  function advance() {
    if (Date.now() - openedAt < 150) return;
    if (typing) {
      // first press completes the line
      clearInterval(typing);
      typing = null;
      textEl.textContent = lines[index].text;
      return;
    }
    index++;
    if (index < lines.length) {
      renderLine();
    } else {
      close();
    }
  }

  function close() {
    panel.hidden = true;
    clearInterval(typing);
    typing = null;
    const cb = onDone;
    onDone = null;
    lines = [];
    if (cb) cb();
  }

  nextBtn.addEventListener('click', advance);
  panel.addEventListener('click', (e) => {
    if (e.target !== nextBtn) advance();
  });
  window.addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      advance();
    }
  });

  return {
    isOpen: () => !panel.hidden,
    show(newLines, doneCb) {
      lines = newLines;
      index = 0;
      onDone = doneCb || null;
      openedAt = Date.now();
      panel.hidden = false;
      renderLine();
      nextBtn.focus({ preventScroll: true });
    },
  };
}
