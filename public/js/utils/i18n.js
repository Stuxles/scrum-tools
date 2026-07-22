/**
 * Internationalization (i18n) helper for NL / EN bilingual support.
 * Persists language choice to localStorage ('scrum_lang').
 */

export const translations = {
  nl: {
    // ── Header / General ──
    'lang-toggle': 'NL',
    'theme-toggle-title': 'Wissel thema (light/dark)',
    'qr-btn-title': 'QR-code tonen / link delen',
    'deck-btn-title': 'Kaartdek wijzigen',
    'name-btn-title': 'Naam aanpassen',

    // ── Landing Page (index.html) ──
    'hero-subtitle': 'Maak een sessie aan of join via link of QR-code.<br>Stem samen, reveal tegelijk.',
    'tab-create': '✦ Maak Room',
    'tab-join': '→ Join Room',
    'label-name': 'Jouw naam',
    'label-deck': 'Kaartdek',
    'deck-standard': 'Standaard — 0 1 2 3 4 5 6 8 12 16 24 32 40 ♾️ ❓ ☕',
    'deck-fibonacci': 'Fibonacci — 0 1 2 3 5 8 13 21 34 55 89 ❓ ☕',
    'deck-tshirt': 'T-Shirt — XS S M L XL XXL ❓ ☕',
    'deck-custom': 'Aangepast…',
    'label-custom-cards': 'Kaarten (komma-gescheiden)',
    'placeholder-custom-cards': '1, 2, 4, 8, 16, ❓',
    'btn-create': '✦ Maak Room aan',
    'label-room-code': 'Room code',
    'placeholder-code': 'ABC123',
    'btn-join': '→ Meedoen',
    'footer-text': '🤝 Real-time • Geen account nodig • Gratis & Open',

    // ── Room Page (room.html) Modals ──
    'join-modal-title': 'Join de Room',
    'modal-join-btn': '🃏 Meedoen',
    'modal-back-btn': '← Terug naar home',
    'name-modal-title': 'Naam aanpassen',
    'name-modal-subtitle': 'Je nieuwe naam wordt direct zichtbaar voor iedereen in de room.',
    'name-modal-label': 'Nieuwe naam',
    'name-modal-save': 'Opslaan',
    'name-modal-cancel': 'Annuleer',
    'qr-modal-title': 'Uitnodigen',
    'qr-modal-subtitle': 'Scan de QR-code of deel de link.',
    'sm-qr-img-title': 'Klik om te vergroten',
    'qr-modal-img-title': 'Klik op de QR-code om te sluiten',
    'qr-copy-btn': '📋 Kopieer link',
    'qr-close-btn': 'Sluiten',
    'deck-modal-title': 'Kaartdek wijzigen',
    'deck-modal-subtitle': 'Het huidige deck wordt vervangen en alle stemmen worden gereset.',
    'deck-modal-label': 'Dek type',
    'deck-modal-custom-label': 'Kaarten (komma-gescheiden)',
    'deck-modal-save': 'Toepassen',
    'deck-modal-cancel': 'Annuleer',
    'options-btn-title': 'Opties & instellingen',
    'options-modal-title': 'Opties & Instellingen',
    'options-modal-subtitle': 'Beheer hier je rol, naam en weergave.',
    'options-label-name': 'Jouw naam',
    'options-label-role': 'Jouw rol',
    'options-label-claim': 'Scrum Master',
    'options-sub-claim': 'Neem het beheer over',
    'claim-sm-btn-text': 'Overnemen',
    'options-label-lang': 'Taal / Language',
    'options-label-theme': 'Thema',
    'options-sub-theme': 'Donkere of lichte modus',
    'options-theme-btn': 'Licht',

    // ── Room Page UI ──
    'panel-title-participants': 'Deelnemers',
    'voting-phase-title': 'Kies je schatting',
    'voting-phase-subtitle': 'Selecteer een kaart. Je stem is pas zichtbaar na de reveal.',
    'voting-phase-waiting': 'Wachten op stemmen…',
    'role-participant': 'Deelnemer',
    'role-spectator': 'Toeschouwer',
    'role-voter': 'Stemmer',
    'join-as-spectator': '👁️ Alleen meekijken / Toeschouwer (niet stemmen)',
    'spectator-banner-title': 'Je kijkt mee als Toeschouwer',
    'spectator-banner-sub': 'Je stemt niet mee en telt niet mee voor de voortgangsbalk.',
    'btn-switch-to-voter': '🃏 Word Stemmer',
    'btn-switch-to-spectator': '👁️ Word Toeschouwer',
    'toast-spectator-on': 'Je bent nu Toeschouwer 👁️',
    'toast-spectator-off': 'Je bent nu Stemmer 🃏',
    'user-you': '(jij)',
    'participant-away-title': 'Tijdelijk offline — kan terugkomen',
    'presenter-banner-title': 'Presenter-scherm',
    'presenter-banner-text': 'Kaarten zijn hier verborgen. Stem mee via je telefoon door de QR-code te scannen.',
    'vote-status-text-init': 'Nog niet gestemd',
    'results-phase-title': '🎉 Resultaten',
    'sm-section-progress': 'Voortgang',
    'sm-section-actions': 'Acties',
    'sm-reveal-btn': '🃏 Reveal',
    'sm-reset-btn': '🔄 Nieuwe ronde',
    'sm-auto-reveal': 'Auto-reveal',
    'sm-auto-reveal-title': 'Onthul automatisch zodra iedereen gestemd heeft',
    'toast-auto-reveal-on': 'Auto-reveal staat aan 🃏',
    'toast-auto-reveal-off': 'Auto-reveal staat uit',
    'sm-section-deck': 'Kaartdek',
    'sm-change-deck-btn': '🎴 Wijzig deck',
    'sm-section-invite': 'Uitnodigen',
    'qr-placeholder': 'Laden…',
    'sm-copy-link-btn': '📋 Kopieer link',

    // ── Dynamic & Toasts ──
    'toast-new-round': 'Nieuwe ronde gestart 🔄',
    'toast-code-copied': 'Code "{id}" gekopieerd!',
    'toast-min-cards': 'Voer minimaal 2 kaarten in',
    'toast-name-empty': 'Naam mag niet leeg zijn',
    'toast-name-updated': 'Naam bijgewerkt ✓',
    'toast-sm-promoted': 'Je bent nu de Scrum Master 👑',
    'toast-kicked': 'Je bent uit de room verwijderd.',
    'toast-kicked-success': '{name} is uit de room verwijderd.',
    'confirm-kick': 'Weet je zeker dat je "{name}" uit de room wilt verwijderen?',
    'btn-kick-title': '{name} uit de room verwijderen',
    'toast-disconnect': 'Verbinding verbroken — opnieuw verbinden…',
    'toast-reconnected': 'Opnieuw verbonden!',
    'toast-room-not-found': 'Room "{id}" bestaat niet.',
    'toast-room-not-found-generic': 'Room niet gevonden. Controleer de code.',
    'toast-enter-name': 'Voer je naam in',
    'toast-enter-code': 'Voer een room code in',
    'toast-qr-loading': 'QR code nog niet geladen…',
    'toast-link-not-ready': 'Link nog niet beschikbaar',
    'toast-link-copied': 'Link gekopieerd! 📋',
    'toast-server-offline': 'De server reageert niet of is offline.',
    'toast-rate-limit': 'Te veel acties achter elkaar. Wacht een seconde.',
    'toast-server-full': 'Kon geen unieke room-code genereren. Server zit vol.',
    'toast-generic-error': 'Er ging iets mis. Probeer het opnieuw.',

    // ── Stats & Dynamic texts ──
    'stat-average': 'Gemiddelde',
    'stat-median': 'Mediaan',
    'stat-other': 'Overig',
    'stat-distribution': 'Verdeling',
    'vote-status-picked': 'Kaart geselecteerd ✓',
    'progress-text': '{voted} / {total} gestemd',
    'story-label': 'Actueel Issue:',
    'story-empty': 'Geen issue ingevoerd',
    'story-placeholder': 'Bijv. Login refactor (#104)',
    'story-btn-save': 'Opslaan',
    'story-btn-edit': 'Bewerken',
    'leave-btn-title': 'Verlaat de room',
    'confirm-leave-room': 'Weet je zeker dat je deze room wilt verlaten?',
    'claim-sm-btn': '👑',
    'claim-sm-title': 'Scrum Master rol overnemen',
    'confirm-claim-sm': 'Wil je de rol van Scrum Master overnemen?',
    'transfer-sm-btn': '👑 Overdragen',
    'transfer-sm-title': 'Maak deze deelnemer Scrum Master',
    'confirm-transfer-sm': 'Wil je de rol van Scrum Master overdragen aan {name}?',
    'toast-sm-claimed': 'Je bent nu de Scrum Master 👑',
    'toast-sm-transferred': 'Scrum Master rol overgedragen aan {name} 👑',
    'btn-creating': 'Aanmaken…',
    'btn-continuing': 'Doorgaan…',
    'story-saved': 'Actueel issue opgeslagen ✓',
    'story-cleared': 'Actueel issue gewist ✓',
    'qr-not-available': 'QR niet beschikbaar',
    'theme-dark': 'Donker',
    'theme-light': 'Licht',
    'theme-mode-dark': 'Donkere modus',
    'theme-mode-light': 'Lichte modus',
    'prompt-copy-manual': 'Kopieer handmatig:',
    'participant-vote-title': 'Stem: {vote}',
    'participant-voted-title': 'Gestemd',
    'aria-vote-card': 'Stem {val}'
  },
  en: {
    // ── Header / General ──
    'lang-toggle': 'EN',
    'theme-toggle-title': 'Toggle theme (light/dark)',
    'qr-btn-title': 'Show QR code / share link',
    'deck-btn-title': 'Change card deck',
    'name-btn-title': 'Change name',

    // ── Landing Page (index.html) ──
    'hero-subtitle': 'Create a session or join via link or QR code.<br>Vote together, reveal simultaneously.',
    'tab-create': '✦ Create Room',
    'tab-join': '→ Join Room',
    'label-name': 'Your name',
    'label-deck': 'Card deck',
    'deck-standard': 'Standard — 0 1 2 3 4 5 6 8 12 16 24 32 40 ♾️ ❓ ☕',
    'deck-fibonacci': 'Fibonacci — 0 1 2 3 5 8 13 21 34 55 89 ❓ ☕',
    'deck-tshirt': 'T-Shirt — XS S M L XL XXL ❓ ☕',
    'deck-custom': 'Custom…',
    'label-custom-cards': 'Cards (comma-separated)',
    'placeholder-custom-cards': '1, 2, 4, 8, 16, ❓',
    'btn-create': '✦ Create Room',
    'label-room-code': 'Room code',
    'placeholder-code': 'ABC123',
    'btn-join': '→ Join Room',
    'footer-text': '🤝 Real-time • No account needed • Free & Open',

    // ── Room Page (room.html) Modals ──
    'join-modal-title': 'Join the Room',
    'modal-join-btn': '🃏 Join Room',
    'modal-back-btn': '← Back to home',
    'name-modal-title': 'Change Name',
    'name-modal-subtitle': 'Your new name will be instantly visible to everyone in the room.',
    'name-modal-label': 'New name',
    'name-modal-save': 'Save',
    'name-modal-cancel': 'Cancel',
    'qr-modal-title': 'Invite Others',
    'qr-modal-subtitle': 'Scan the QR code or share the link.',
    'sm-qr-img-title': 'Click to enlarge',
    'qr-modal-img-title': 'Click QR code to close',
    'qr-copy-btn': '📋 Copy link',
    'qr-close-btn': 'Close',
    'deck-modal-title': 'Change Deck',
    'deck-modal-subtitle': 'The current deck will be replaced and all votes will be reset.',
    'deck-modal-label': 'Deck type',
    'deck-modal-custom-label': 'Cards (comma-separated)',
    'deck-modal-save': 'Apply',
    'deck-modal-cancel': 'Cancel',
    'options-btn-title': 'Options & Settings',
    'options-modal-title': 'Options & Settings',
    'options-modal-subtitle': 'Manage your role, name and preferences here.',
    'options-label-name': 'Your name',
    'options-label-role': 'Your role',
    'options-label-claim': 'Scrum Master',
    'options-sub-claim': 'Take over room management',
    'claim-sm-btn-text': 'Take over',
    'options-label-lang': 'Language / Taal',
    'options-label-theme': 'Theme',
    'options-sub-theme': 'Dark or light mode',
    'options-theme-btn': 'Light',

    // ── Room Page UI ──
    'panel-title-participants': 'Participants',
    'voting-phase-title': 'Pick your estimate',
    'voting-phase-subtitle': 'Select a card. Your vote will only be visible after the reveal.',
    'voting-phase-waiting': 'Waiting for votes…',
    'role-participant': 'Participant',
    'role-spectator': 'Spectator',
    'role-voter': 'Voter',
    'join-as-spectator': '👁️ Join as spectator / viewer (no voting)',
    'spectator-banner-title': 'You are watching as Spectator',
    'spectator-banner-sub': 'You do not vote and are excluded from the progress count.',
    'btn-switch-to-voter': '🃏 Become Voter',
    'btn-switch-to-spectator': '👁️ Become Spectator',
    'toast-spectator-on': 'You are now a Spectator 👁️',
    'toast-spectator-off': 'You are now a Voter 🃏',
    'user-you': '(you)',
    'participant-away-title': 'Temporarily offline — may reconnect',
    'presenter-banner-title': 'Presenter Screen',
    'presenter-banner-text': 'Cards are hidden on this screen. Vote using your mobile device by scanning the QR code.',
    'vote-status-text-init': 'No card selected',
    'results-phase-title': '🎉 Results',
    'sm-section-progress': 'Progress',
    'sm-section-actions': 'Actions',
    'sm-reveal-btn': '🃏 Reveal',
    'sm-reset-btn': '🔄 New round',
    'sm-auto-reveal': 'Auto-reveal',
    'sm-auto-reveal-title': 'Reveal automatically once everyone has voted',
    'toast-auto-reveal-on': 'Auto-reveal is on 🃏',
    'toast-auto-reveal-off': 'Auto-reveal is off',
    'sm-section-deck': 'Card Deck',
    'sm-change-deck-btn': '🎴 Change deck',
    'sm-section-invite': 'Invite',
    'qr-placeholder': 'Loading…',
    'sm-copy-link-btn': '📋 Copy link',

    // ── Dynamic & Toasts ──
    'toast-new-round': 'New round started 🔄',
    'toast-code-copied': 'Code "{id}" copied!',
    'toast-min-cards': 'Please enter at least 2 cards',
    'toast-name-empty': 'Name cannot be empty',
    'toast-name-updated': 'Name updated ✓',
    'toast-sm-promoted': 'You are now the Scrum Master 👑',
    'toast-kicked': 'You have been removed from the room.',
    'toast-kicked-success': '{name} has been removed from the room.',
    'confirm-kick': 'Are you sure you want to remove "{name}" from the room?',
    'btn-kick-title': 'Remove {name} from the room',
    'toast-disconnect': 'Connection lost — reconnecting…',
    'toast-reconnected': 'Reconnected!',
    'toast-room-not-found': 'Room "{id}" does not exist.',
    'toast-room-not-found-generic': 'Room not found. Check the code.',
    'toast-enter-name': 'Please enter your name',
    'toast-enter-code': 'Please enter a room code',
    'toast-qr-loading': 'QR code not loaded yet…',
    'toast-link-not-ready': 'Link not ready yet',
    'toast-link-copied': 'Link copied! 📋',
    'toast-server-offline': 'Server is not responding or offline.',
    'toast-rate-limit': 'Too many actions. Please wait a second.',
    'toast-server-full': 'Could not generate unique room code. Server is full.',
    'toast-generic-error': 'Something went wrong. Please try again.',

    // ── Stats & Dynamic texts ──
    'stat-average': 'Average',
    'stat-median': 'Median',
    'stat-other': 'Other',
    'stat-distribution': 'Distribution',
    'vote-status-picked': 'Card selected ✓',
    'progress-text': '{voted} / {total} voted',
    'story-label': 'Current Issue:',
    'story-empty': 'No issue entered',
    'story-placeholder': 'e.g., Login refactor (#104)',
    'story-btn-save': 'Save',
    'story-btn-edit': 'Edit',
    'leave-btn-title': 'Leave room',
    'confirm-leave-room': 'Are you sure you want to leave this room?',
    'claim-sm-btn': '👑',
    'claim-sm-title': 'Take over Scrum Master role',
    'confirm-claim-sm': 'Do you want to take over the Scrum Master role?',
    'transfer-sm-btn': '👑 Transfer',
    'transfer-sm-title': 'Make this participant Scrum Master',
    'confirm-transfer-sm': 'Do you want to transfer the Scrum Master role to {name}?',
    'toast-sm-claimed': 'You are now the Scrum Master 👑',
    'toast-sm-transferred': 'Scrum Master role transferred to {name} 👑',
    'btn-creating': 'Creating…',
    'btn-continuing': 'Continuing…',
    'story-saved': 'Current issue saved ✓',
    'story-cleared': 'Current issue cleared ✓',
    'qr-not-available': 'QR not available',
    'theme-dark': 'Dark',
    'theme-light': 'Light',
    'theme-mode-dark': 'Dark mode',
    'theme-mode-light': 'Light mode',
    'prompt-copy-manual': 'Copy manually:',
    'participant-vote-title': 'Vote: {vote}',
    'participant-voted-title': 'Voted',
    'aria-vote-card': 'Vote {val}'
  }
};

/** @returns {'nl'|'en'} */
export function getLang() {
  return localStorage.getItem('scrum_lang') || 'nl';
}

/**
 * Get translation by key, replacing optional {param} placeholders.
 * @param {string} key
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const lang = getLang();
  let str = translations[lang]?.[key] || translations.nl[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

/**
 * Translate incoming server error string to local language if known.
 * @param {string} msg
 * @returns {string}
 */
export function translateServerMsg(msg) {
  if (msg.includes('Te veel acties') || msg.includes('Too many actions')) return t('toast-rate-limit');
  if (msg.includes('Voer minimaal 2 kaarten in')) return t('toast-min-cards');
  if (msg.includes('Kon geen unieke room-code') || msg.includes('Could not generate')) return t('toast-server-full');
  if (msg.includes('niet gevonden') || msg.includes('Controleer de code') || msg.includes('does not exist')) return t('toast-room-not-found-generic');
  if (msg.includes('Er ging iets mis') || msg.includes('Something went wrong')) return t('toast-generic-error');
  return msg;
}

/**
 * Apply translations to all DOM elements with data-i18n attributes.
 */
export function applyI18n() {
  const lang = getLang();
  document.documentElement.setAttribute('lang', lang);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.id === 'story-title-display' && el.classList.contains('has-title')) return;
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.innerHTML = val;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val) el.setAttribute('placeholder', val);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = t(key);
    if (val) el.setAttribute('title', val);
  });

  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.textContent = lang === 'nl' ? 'NL' : 'EN';
    langBtn.setAttribute('title', lang === 'nl' ? 'Taal: Nederlands (Klik voor Engels)' : 'Language: English (Click for Dutch)');
  }
}

/**
 * Initialize language toggle button and bind event listener.
 * @param {Function} [onLangChange] Optional callback triggered on language switch
 */
export function initI18n(onLangChange) {
  applyI18n();

  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const nextLang = getLang() === 'nl' ? 'en' : 'nl';
      localStorage.setItem('scrum_lang', nextLang);
      applyI18n();
      onLangChange?.();
      window.dispatchEvent(new CustomEvent('lang-changed', { detail: nextLang }));
    });
  }
}
