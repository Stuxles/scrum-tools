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
 * Updates the rows in place instead of rebuilding the list. `room-state`
 * arrives on every vote, join, rename and reconnect from anyone, and throwing
 * the whole list away on each one cost more than the DOM work: the chip under
 * a hovered kick button disappeared mid-reach (the buttons are `:hover`-gated),
 * an expanded chip on a phone snapped shut, and on a presenter screen the
 * panel's `backdrop-filter` backdrop was invalidated several times a round for
 * nothing. Rows are keyed by participant id, so a vote now touches one chip's
 * text and leaves every other node — and its state — alone.
 *
 * @param {HTMLElement}                       participantsList
 * @param {object}                            room
 * @param {import('socket.io-client').Socket} socket
 * @param {{ canKick?: boolean, canTransfer?: boolean }} [caps]
 */
export function renderParticipants(participantsList, room, socket, caps = {}) {
  const { canKick = false, canTransfer = false } = caps;

  // Index what is already on screen so a row survives the update.
  /** @type {Map<string, HTMLElement>} */
  const existing = new Map();
  for (const li of participantsList.children) existing.set(li.dataset.id, li);

  let previous = null;

  for (const p of room.participants) {
    const li = existing.get(p.id) || createRow(participantsList, socket);
    existing.delete(p.id);

    updateRow(li, p, room, socket.id === p.id, { canKick, canTransfer });

    // Place in server order without disturbing a row already in the right
    // spot: assigning the same node to the same position is a no-op, where
    // an unconditional appendChild would move (and so re-layout) every row.
    const shouldFollow = previous ? previous.nextSibling : participantsList.firstChild;
    if (li !== shouldFollow) participantsList.insertBefore(li, shouldFollow);
    previous = li;
  }

  // Whatever is left in the map is no longer in the room.
  for (const li of existing.values()) li.remove();
}

/**
 * Build an empty row with its listeners attached once. Handlers deliberately
 * read the participant out of the row's own dataset rather than closing over
 * it, so a reused row never acts on the state it was created with.
 *
 * @param {HTMLElement}                       participantsList
 * @param {import('socket.io-client').Socket} socket
 * @returns {HTMLElement}
 */
function createRow(participantsList, socket) {
  const li = document.createElement('li');
  li.className = 'participant-item';

  const avatar = document.createElement('div');
  avatar.className = 'participant-avatar';
  avatar.setAttribute('aria-hidden', 'true');

  const info = document.createElement('div');
  info.className = 'participant-info';

  const nameRow = document.createElement('div');
  nameRow.className = 'participant-name';

  // Three spans rather than one innerHTML string: every update is then a
  // textContent write, which needs no escaping and cannot reintroduce the
  // markup-injection path a name interpolated into HTML always carries.
  const nameText = document.createElement('span');
  nameText.className = 'participant-name-text';
  const youText = document.createElement('span');
  youText.className = 'participant-name-you';
  youText.style.color = 'var(--purple-300)';
  const crown = document.createElement('span');
  crown.className = 'participant-name-crown';

  nameRow.append(nameText, youText, crown);

  const role = document.createElement('div');
  role.className = 'participant-role';
  info.append(nameRow, role);

  const status = document.createElement('div');
  status.className = 'participant-status';

  li.append(avatar, info, status);

  const transferBtn = document.createElement('button');
  transferBtn.className = 'btn btn-secondary btn-icon transfer-btn';
  transferBtn.textContent = '👑';
  transferBtn.addEventListener('click', () => {
    const { id, name, roomId } = li.dataset;
    if (confirm(t('confirm-transfer-sm', { name }))) {
      socket.emit('sm-transfer-master', { roomId, targetId: id });
    }
  });

  const kickBtn = document.createElement('button');
  kickBtn.className = 'btn btn-danger btn-icon kick-btn';
  kickBtn.textContent = '✕';
  kickBtn.addEventListener('click', () => {
    const { id, name, roomId } = li.dataset;
    if (confirm(t('confirm-kick', { name }))) {
      socket.emit('kick-user', { roomId, targetId: id });
      toast(t('toast-kicked-success', { name }), 'info');
    }
  });

  li._transferBtn = transferBtn;
  li._kickBtn     = kickBtn;

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

  return li;
}

/**
 * Write a participant's current state onto a row, touching only what changed.
 *
 * @param {HTMLElement} li
 * @param {object}      p
 * @param {object}      room
 * @param {boolean}     isSelf
 * @param {{ canKick: boolean, canTransfer: boolean }} caps
 */
function updateRow(li, p, room, isSelf, { canKick, canTransfer }) {
  const isAway = p.connected === false;
  const name   = p.name || '';

  li.dataset.id     = p.id;
  li.dataset.name   = name;
  li.dataset.roomId = room.id;
  li.classList.toggle('is-away', isAway);
  // Always name the row: on a phone the list collapses to initials only, so
  // this is what tells you who a chip belongs to.
  setAttr(li, 'title', isAway ? `${name} — ${t('participant-away-title')}` : name);

  // Two letters, not one: a row of bare initials has too many collisions on
  // a normal team. Split by code point so an emoji or accent isn't cut in
  // half. Falls back to '?' for a name that is somehow empty.
  const initials = [...(name || '?').trim()].slice(0, 2).join('').toUpperCase() || '?';
  setText(li.children[0], initials);

  const nameRow = li.querySelector('.participant-name');
  setText(nameRow.children[0], name);
  setText(nameRow.children[1], isSelf ? ` ${t('user-you')}` : '');
  setText(nameRow.children[2], p.isMaster ? ' 👑' : '');

  setText(
    li.querySelector('.participant-role'),
    p.isMaster ? 'Scrum Master' : (p.isSpectator ? t('role-spectator') : t('role-participant')),
  );

  // No special case for the host: they vote like everyone else now, and the
  // crown next to their name already marks the role. Showing a screen icon
  // here would hide whether they have actually voted.
  const status = li.querySelector('.participant-status');
  let statusClass;
  let statusText;
  let statusTitle;
  if (p.isSpectator) {
    statusClass = 'spectator-mode';
    statusText  = '👁️';
    statusTitle = t('role-spectator');
  } else if (room.revealed && p.hasVoted) {
    statusClass = 'revealed-vote';
    statusText  = p.vote || '—';
    statusTitle = t('participant-vote-title', { vote: p.vote }) || `Vote: ${p.vote}`;
  } else if (p.hasVoted) {
    statusClass = 'voted';
    statusText  = '✓';
    statusTitle = t('participant-voted-title') || 'Voted';
  } else {
    statusClass = 'not-voted';
    statusText  = '…';
    statusTitle = t('vote-status-text-init');
  }
  if (status.className !== `participant-status ${statusClass}`) {
    status.className = `participant-status ${statusClass}`;
  }
  setText(status, statusText);
  setAttr(status, 'title', statusTitle);

  // `isSelf` is what stops the host offering to kick themselves. On a
  // presenter screen the socket id is the display's and never matches a
  // participant, so every row gets its buttons there.
  const transferTitle = t('transfer-sm-title');
  const kickTitle     = t('btn-kick-title', { name });
  // Transfer before kick, whichever of the two arrives first: the host role
  // can be gained mid-session, and appending blindly would then park the
  // crown to the right of the ✕ on rows that already had one.
  toggleButton(li, li._transferBtn, canTransfer && !isSelf, transferTitle, li._kickBtn);
  toggleButton(li, li._kickBtn,     canKick     && !isSelf, kickTitle,     null);
}

/**
 * Attach or detach a row action, keeping the button (and its one listener)
 * for the next time the capability comes back — the host role can change
 * mid-session, so this toggles rather than rebuilds.
 *
 * @param {HTMLElement}      li
 * @param {HTMLElement}      btn
 * @param {boolean}          wanted
 * @param {string}           label
 * @param {HTMLElement|null} before  Node to stay in front of, when attached.
 */
function toggleButton(li, btn, wanted, label, before) {
  if (wanted) {
    setAttr(btn, 'title', label);
    setAttr(btn, 'aria-label', label);
    const anchor = before && before.parentNode === li ? before : null;
    if (btn.parentNode !== li || (anchor && btn.nextSibling !== anchor)) {
      li.insertBefore(btn, anchor);
    }
  } else if (btn.parentNode === li) {
    btn.remove();
  }
}

/** @param {HTMLElement} el @param {string} value */
function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

/** @param {HTMLElement} el @param {string} name @param {string} value */
function setAttr(el, name, value) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
