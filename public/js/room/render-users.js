import { escHtml } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';
import { toast } from '../utils/toast.js';

/**
 * Participants list renderer.
 *
 * Takes two separate capabilities rather than one `isMaster` flag, because the
 * two callers do not have the same rights. The server lets a presenter screen
 * kick (`canControlRoom()`), but `sm-transfer-master` insists the sender *is*
 * the host — a screen holds no seat, so it has nothing to hand over. One
 * boolean could only have been wrong in one direction or the other.
 *
 * @param {HTMLElement}                       participantsList
 * @param {object}                            room
 * @param {import('socket.io-client').Socket} socket
 * @param {{ canKick?: boolean, canTransfer?: boolean }} [caps]
 */
export function renderParticipants(participantsList, room, socket, caps = {}) {
  const { canKick = false, canTransfer = false } = caps;

  // The whole list is rebuilt on every room-state, which arrives on every vote
  // from anyone. Remember which chip was expanded first, or a teammate voting
  // would snap it shut under the finger of a host reaching for kick.
  const expandedId = participantsList.querySelector('.participant-item.is-expanded')?.dataset.id;

  participantsList.innerHTML = '';

  for (const p of room.participants) {
    const isAway = p.connected === false;

    const li = document.createElement('li');
    li.className  = 'participant-item'
      + (isAway ? ' is-away' : '')
      + (p.id === expandedId ? ' is-expanded' : '');
    li.dataset.id = p.id;
    // Always name the row: on a phone the list collapses to initials only, so
    // this is what tells you who a chip belongs to.
    li.title = isAway ? `${p.name} — ${t('participant-away-title')}` : p.name;

    // Two letters, not one: a row of bare initials has too many collisions on
    // a normal team. Split by code point so an emoji or accent isn't cut in
    // half. Falls back to '?' for a name that is somehow empty.
    const initials = escHtml([...(p.name || '?').trim()].slice(0, 2).join('').toUpperCase() || '?');
    const roleText = p.isMaster ? 'Scrum Master' : (p.isSpectator ? t('role-spectator') : t('role-participant'));
    li.innerHTML  = `
      <div class="participant-avatar" aria-hidden="true">${initials}</div>
      <div class="participant-info">
        <div class="participant-name">${escHtml(p.name)}${p.id === socket.id ? ` <span style="color:var(--purple-300)">${t('user-you')}</span>` : ''}${p.isMaster ? ' 👑' : ''}</div>
        <div class="participant-role">${roleText}</div>
      </div>
    `;

    const statusEl = document.createElement('div');
    statusEl.className = 'participant-status';

    // No special case for the host: they vote like everyone else now, and the
    // crown next to their name already marks the role. Showing a screen icon
    // here would hide whether they have actually voted.
    if (p.isSpectator) {
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

    // `p.id !== socket.id` is what stops the host offering to kick themselves.
    // On a presenter screen the socket id is the display's and never matches a
    // participant, so every row gets its buttons there.
    const isSelf = p.id === socket.id;

    if (canTransfer && !isSelf) {
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
    }

    if (canKick && !isSelf) {
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

    // Phone-only affordance: the chip collapses to initials there, so tapping
    // it expands that one row to show the full name and, for the host, the
    // transfer and kick buttons. Does nothing visible on desktop, where the
    // name and buttons are on screen anyway.
    li.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // let the action buttons act
      const wasOpen = li.classList.contains('is-expanded');
      participantsList.querySelectorAll('.is-expanded').forEach(el => el.classList.remove('is-expanded'));
      if (!wasOpen) li.classList.add('is-expanded');
    });

    participantsList.appendChild(li);
  }
}
