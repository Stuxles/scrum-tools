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

    // ── Room Page UI ──
    'panel-title-participants': 'Deelnemers',
    'voting-phase-title': 'Kies je schatting',
    'voting-phase-subtitle': 'Selecteer een kaart. Je stem is pas zichtbaar na de reveal.',
    'voting-phase-waiting': 'Wachten op stemmen…',
    'role-participant': 'Deelnemer',
    'user-you': '(jij)',
    'presenter-banner-title': 'Presenter-scherm',
    'presenter-banner-text': 'Kaarten zijn hier verborgen. Stem mee via je telefoon door de QR-code te scannen.',
    'vote-status-text-init': 'Nog niet gestemd',
    'results-phase-title': '🎉 Resultaten',
    'sm-section-progress': 'Voortgang',
    'sm-section-actions': 'Acties',
    'sm-reveal-btn': '🃏 Reveal',
    'sm-reset-btn': '🔄 Nieuwe ronde',
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
    'toast-disconnect': 'Verbinding verbroken — opnieuw verbinden…',
    'toast-reconnected': 'Opnieuw verbonden!',
    'toast-room-not-found': 'Room "{id}" bestaat niet.',
    'toast-enter-name': 'Voer je naam in',
    'toast-enter-code': 'Voer een room code in',
    'toast-qr-loading': 'QR code nog niet geladen…',
    'toast-link-not-ready': 'Link nog niet beschikbaar',
    'toast-link-copied': 'Link gekopieerd! 📋',
    'toast-server-offline': 'De server reageert niet of is offline.',
    'toast-rate-limit': 'Te veel acties achter elkaar. Wacht een seconde.',
    'toast-server-full': 'Kon geen unieke room-code genereren. Server zit vol.',

    // ── Stats & Dynamic texts ──
    'stat-average': 'Gemiddelde',
    'stat-median': 'Mediaan',
    'stat-other': 'Overig',
    'stat-distribution': 'Verdeling',
    'stat-most-picked': 'Meest gekozen',
    'stat-consensus': 'Overeenstemming',
    'stat-total-votes': 'Stemmen',
    'vote-status-picked': 'Je hebt {card} gekozen ✓',
    'progress-text': '{voted} / {total} gestemd',
    'story-label': 'Actueel Ticket',
    'story-empty': 'Geen issue ingevoerd',
    'story-placeholder': 'Bijv. Bananen weer rechttrekken',
    'story-btn-save': 'Opslaan',
    'story-btn-edit': 'Bewerken'
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

    // ── Room Page UI ──
    'panel-title-participants': 'Participants',
    'voting-phase-title': 'Pick your estimate',
    'voting-phase-subtitle': 'Select a card. Your vote will only be visible after the reveal.',
    'voting-phase-waiting': 'Waiting for votes…',
    'role-participant': 'Participant',
    'user-you': '(you)',
    'presenter-banner-title': 'Presenter Screen',
    'presenter-banner-text': 'Cards are hidden on this screen. Vote using your mobile device by scanning the QR code.',
    'vote-status-text-init': 'No card selected',
    'results-phase-title': '🎉 Results',
    'sm-section-progress': 'Progress',
    'sm-section-actions': 'Actions',
    'sm-reveal-btn': '🃏 Reveal',
    'sm-reset-btn': '🔄 New round',
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
    'toast-disconnect': 'Connection lost — reconnecting…',
    'toast-reconnected': 'Reconnected!',
    'toast-room-not-found': 'Room "{id}" does not exist.',
    'toast-enter-name': 'Please enter your name',
    'toast-enter-code': 'Please enter a room code',
    'toast-qr-loading': 'QR code not loaded yet…',
    'toast-link-not-ready': 'Link not ready yet',
    'toast-link-copied': 'Link copied! 📋',
    'toast-server-offline': 'Server is not responding or offline.',
    'toast-rate-limit': 'Too many actions. Please wait a second.',
    'toast-server-full': 'Could not generate unique room code. Server is full.',

    // ── Stats & Dynamic texts ──
    'stat-average': 'Average',
    'stat-median': 'Median',
    'stat-other': 'Other',
    'stat-distribution': 'Distribution',
    'stat-most-picked': 'Most picked',
    'stat-consensus': 'Consensus',
    'stat-total-votes': 'Votes',
    'vote-status-picked': 'You picked {card} ✓',
    'progress-text': '{voted} / {total} voted',
    'story-label': 'Current Ticket',
    'story-empty': 'No ticket / story selected',
    'story-placeholder': 'e.g., PROJ-204: Login page refactor',
    'story-btn-save': 'Save',
    'story-btn-edit': 'Edit'
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
  if (msg.includes('niet gevonden') || msg.includes('Controleer de code') || msg.includes('does not exist')) return t('toast-room-not-found', { id: '' });
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
