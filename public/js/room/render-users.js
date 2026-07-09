import { escHtml } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';

/**
 * Participants list renderer.
 *
 * @param {HTMLElement}                       participantsList
 * @param {object}                            room
 * @param {boolean}                           isMaster
 * @param {import('socket.io-client').Socket} socket
 */
export function renderParticipants(participantsList, room, isMaster, socket) {
  participantsList.innerHTML = '';

  for (const p of room.participants) {
    const li = document.createElement('li');
    li.className  = 'participant-item';
    li.dataset.id = p.id;

    const initial = (p.name || '?')[0].toUpperCase();
    li.innerHTML  = `
      <div class="participant-avatar" aria-hidden="true">${initial}</div>
      <div class="participant-info">
        <div class="participant-name">${escHtml(p.name)}${p.id === socket.id ? ` <span style="color:var(--purple-300)">${t('user-you')}</span>` : ''}${p.isMaster ? ' 👑' : ''}</div>
        <div class="participant-role">${p.isMaster ? 'Scrum Master' : t('role-participant')}</div>
      </div>
    `;

    const statusEl = document.createElement('div');
    statusEl.className = 'participant-status';

    if (p.isMaster) {
      statusEl.className  += ' presenter-mode';
      statusEl.textContent = '🖥️';
      statusEl.title       = t('presenter-banner-title');
    } else if (room.revealed && p.hasVoted) {
      statusEl.className  += ' revealed-vote';
      statusEl.textContent = p.vote || '—';
      statusEl.title       = `Vote: ${p.vote}`;
    } else if (p.hasVoted) {
      statusEl.className  += ' voted';
      statusEl.textContent = '✓';
      statusEl.title       = 'Voted';
    } else {
      statusEl.className  += ' not-voted';
      statusEl.textContent = '…';
      statusEl.title       = t('vote-status-text-init');
    }

    li.appendChild(statusEl);

    if (isMaster && p.id !== socket.id) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'btn btn-danger btn-icon kick-btn';
      kickBtn.textContent = '✕';
      kickBtn.title       = `${p.name} verwijderen`;
      kickBtn.setAttribute('aria-label', `${p.name} verwijderen`);
      kickBtn.addEventListener('click', () => {
        socket.emit('kick-user', { roomId: room.id, targetId: p.id });
      });
      li.appendChild(kickBtn);
    }

    participantsList.appendChild(li);
  }
}
