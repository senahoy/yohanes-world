import { PROFILE, BUGS, FALLBACK_INCIDENT, FALLBACK_CITY, FALLBACK_REPORT } from '../content.js';
import { contactActionsHtml } from './hud.js';

// The text version: every chapter the bugs deliver, as comic-paper panels.
export function showFallback({ canRun3d = false, onEnterWorld = null } = {}) {
  const el = document.getElementById('fallback');

  const panels = BUGS.map((bug) => `
    <section class="fb-panel">
      <span class="fb-tag">${bug.name}</span>
      <h2>${bug.fallbackTitle}</h2>
      <p>${bug.fallbackBody}</p>
      ${bug.tags ? `<ul>${bug.tags.map((tag) => `<li>${tag}</li>`).join('')}</ul>` : ''}
    </section>
  `).join('');

  el.innerHTML = `
    <div class="fb-wrap">
      <div class="fb-stars" aria-hidden="true"></div>
      <header class="fb-header">
        <p class="boot-kicker">a playable portfolio · text version</p>
        <h1>${PROFILE.name}</h1>
        <p class="fb-role">${PROFILE.role}</p>
        ${canRun3d ? '<p class="fb-enter"><button type="button" class="boot-link" id="fb-enter">play the 3D version instead</button></p>' : ''}
      </header>
      ${panels}
      <section class="fb-panel">
        <span class="fb-tag">city district</span>
        <h2>${FALLBACK_CITY.title}</h2>
        <p>${FALLBACK_CITY.body}</p>
      </section>
      <section class="fb-panel">
        <span class="fb-tag">kanban board</span>
        <h2>${FALLBACK_REPORT.title}</h2>
        <p>${FALLBACK_REPORT.body}</p>
      </section>
      <section class="fb-panel">
        <span class="fb-tag">easter egg</span>
        <h2>${FALLBACK_INCIDENT.title}</h2>
        <p>${FALLBACK_INCIDENT.body}</p>
      </section>
      <section class="fb-panel fb-contact">
        <span class="fb-tag">satellite dish</span>
        <h2>◆ SEND A SIGNAL ◆</h2>
        <p>Open to work · Remote · Hybrid · Willing to relocate.<br />Every great project starts with a simple conversation.</p>
        <div class="contact-actions">${contactActionsHtml()}</div>
      </section>
      <footer class="fb-footer">
        In the 3D world, six bugs escaped the test suite across a little floating island.<br />
        visitors catch them to unlock these chapters, file the reports, automate the CI,<br />
        and play a piano by the pond. Quality is not by chance. It is engineered.<br /><br />
        3D models by KayKit (CC0) · built with Three.js
      </footer>
    </div>
  `;
  el.hidden = false;

  const enterBtn = document.getElementById('fb-enter');
  if (enterBtn && onEnterWorld) {
    enterBtn.addEventListener('click', () => {
      el.hidden = true;
      onEnterWorld();
    });
  }
}
