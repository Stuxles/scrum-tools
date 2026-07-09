/**
 * QR code sidebar widget and share modal.
 *
 * @param {object}                            els      DOM element references
 * @param {import('socket.io-client').Socket} socket   (unused here, kept for consistency)
 * @param {string}                            roomId
 * @returns {{ loadQR: Function, openQrModal: Function, getQrUrl: Function }}
 */

import { toast }           from '../utils/toast.js';
import { copyToClipboard } from '../utils/helpers.js';

export function initQrModule(els, _socket, roomId) {
  const {
    smQrImg, smQrPlaceholder, smQrUrl, smCopyLinkBtn,
    qrModal, qrModalImg, qrModalUrl, qrCopyBtn, qrCloseBtn,
    headerQrBtn, mobileQrBtn,
  } = els;

  let qrUrl = null;

  // ── Load QR from server ───────────────────────────────────────────────────
  async function loadQR() {
    try {
      const baseUrl = encodeURIComponent(window.location.origin);
      const theme   = document.documentElement.getAttribute('data-theme') || 'dark';
      const res     = await fetch(`/api/rooms/${roomId}/qr?baseUrl=${baseUrl}&theme=${theme}`);
      const data    = await res.json();
      qrUrl = data.url;

      smQrImg.src = data.qr;
      smQrImg.classList.remove('hidden');
      smQrPlaceholder.classList.add('hidden');
      smQrUrl.textContent = data.url;
    } catch {
      smQrPlaceholder.textContent = 'QR niet beschikbaar';
    }
  }

  // ── Share modal ───────────────────────────────────────────────────────────
  function openQrModal() {
    if (!qrUrl) { toast('QR code nog niet geladen…', 'info'); return; }
    qrModalImg.src       = smQrImg.src;
    qrModalUrl.textContent = qrUrl;
    qrModal.classList.remove('hidden');
  }

  const closeQrModal = () => qrModal.classList.add('hidden');

  headerQrBtn.addEventListener('click', openQrModal);
  mobileQrBtn.addEventListener('click', openQrModal);
  qrCloseBtn.addEventListener('click',  closeQrModal);
  qrModal.addEventListener('click', e => { if (e.target === qrModal) closeQrModal(); });

  // ── Copy link ─────────────────────────────────────────────────────────────
  function copyLink() {
    if (!qrUrl) { toast('Link nog niet beschikbaar', 'error'); return; }
    copyToClipboard(
      qrUrl,
      () => toast('Link gekopieerd! 📋', 'success'),
    );
  }

  smCopyLinkBtn.addEventListener('click', copyLink);
  qrCopyBtn.addEventListener('click',    copyLink);

  return {
    loadQR,
    openQrModal,
    getQrUrl: () => qrUrl,
  };
}
