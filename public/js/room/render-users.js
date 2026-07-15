import { escHtml } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';
import { toast } from '../utils/toast.js';

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
    const roleText = p.isMaster ? 'Scrum Master' : (p.isSpectator ? t('role-spectator') : t('role-participant'));
    li.innerHTML  = `
      <div class="participant-avatar" aria-hidden="true">${initial}</div>
      <div class="participant-info">
        <div class="participant-name">${escHtml(p.name)}${p.id === socket.id ? ` <span style="color:var(--purple-300)">${t('user-you')}</span>` : ''}${p.isMaster ? ' 👑' : ''}</div>
        <div class="participant-role">${roleText}</div>
      </div>
    `;

    const statusEl = document.createElement('div');
    statusEl.className = 'participant-status';

    if (p.isMaster) {
      statusEl.className  += ' presenter-mode';
      statusEl.textContent = '🖥️';
      statusEl.title       = t('presenter-banner-title');
    } else if (p.isSpectator) {
      statusEl.className  += ' spectator-mode';
      statusEl.textContent = '👁️';
      statusEl.title       = t('role-spectator');
    } else if (room.revealed && p.hasVoted) {
      statusEl.className  += ' revealed-vote';
      statusEl.textContent = p.vote || '—';
      statusEl.title       = t('participant-vote-title', { vote: p.vote }) || `Vote: ${p.vote}`;
    } else if (p.hasVoted) {
      statusEl.className  += ' voted';
      statusEl.textContent = '✓';
      statusEl.title       = t('participant-voted-title') || 'Voted';
    } else {
      statusEl.className  += ' not-voted';
      statusEl.textContent = '…';
      statusEl.title       = t('vote-status-text-init');
    }

    li.appendChild(statusEl);

    if (isMaster && p.id !== socket.id) {
      const transferBtn = document.createElement('button');
      transferBtn.className = 'btn btn-secondary btn-icon transfer-btn';
      transferBtn.textContent = '👑';
      const transferTitle = t('transfer-sm-title');
      transferBtn.title = transferTitle;
      transferBtn.setAttribute('aria-label', transferTitle);
      transferBtn.addEventListener('click', () => {
        if (confirm(t('confirm-transfer-sm', { name: p.name }))) {
          socket.emit('sm-transfer-master', { roomId: room.id, targetId: p.id });
        }
      });
      li.appendChild(transferBtn);

      const kickBtn = document.createElement('button');
      kickBtn.className = 'btn btn-danger btn-icon kick-btn';
      kickBtn.textContent = '✕';
      const kickTitle = t('btn-kick-title', { name: p.name });
      kickBtn.title       = kickTitle;
      kickBtn.setAttribute('aria-label', kickTitle);
      kickBtn.addEventListener('click', () => {
        if (confirm(t('confirm-kick', { name: p.name }))) {
          socket.emit('kick-user', { roomId: room.id, targetId: p.id });
          toast(t('toast-kicked-success', { name: p.name }), 'info');
        }
      });
      li.appendChild(kickBtn);
    }

    participantsList.appendChild(li);
  }
}
