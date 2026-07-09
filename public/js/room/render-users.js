/**
 * Participants list renderer.
 *
 * @param {HTMLElement}                       participantsList
 * @param {object}                            room
 * @param {boolean}                           isMaster
 * @param {import('socket.io-client').Socket} socket
 * @param {Function}                          escHtml
 */
export function renderParticipants(participantsList, room, isMaster, socket, escHtml) {
  participantsList.innerHTML = '';

  for (const p of room.participants) {
    const li = document.createElement('li');
    li.className  = 'participant-item';
    li.dataset.id = p.id;

    const initial  = (p.name || '?')[0].toUpperCase();
    const statusEl = document.createElement('div');
    statusEl.className = 'participant-status';

    if (p.isMaster) {
      statusEl.className  += ' presenter-mode';
      statusEl.textContent = '🖥️';
      statusEl.title       = 'Presenter-scherm (stemt via telefoon)';
    } else if (room.revealed && p.hasVoted) {
      statusEl.className  += ' revealed-vote';
      statusEl.textContent = p.vote || '—';
      statusEl.title       = `Stem: ${p.vote}`;
    } else if (p.hasVoted) {
      statusEl.className  += ' voted';
      statusEl.textContent = '✓';
      statusEl.title       = 'Gestemd';
    } else {
      statusEl.className  += ' not-voted';
      statusEl.textContent = '…';
      statusEl.title       = 'Nog niet gestemd';
    }

    li.innerHTML = `
      <div class="participant-avatar" aria-hidden="true">${initial}</div>
      <div class="participant-info">
        <div class="participant-name">${escHtml(p.name)}${p.id === socket.id ? ' <span style="color:var(--purple-300)">(jij)</span>' : ''}${p.isMaster ? ' 👑' : ''}</div>
        <div class="participant-role">${p.isMaster ? 'Scrum Master' : 'Deelnemer'}</div>
      </div>
    `;
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
