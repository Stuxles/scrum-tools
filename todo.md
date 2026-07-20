# 📋 TODO / Ideeënlijst

Backlog van ideeën en verbeterpunten die uit de codebase-review zijn gekomen.
Afgeronde items staan onderaan.

---

## 🎯 Functioneel

### 1. Ronde-historie + export
**Waarde: hoog.** Nu worden bij elke "nieuwe ronde" de resultaten gewist zonder dat er iets bewaard blijft. Een team dat 10 stories schat, houdt achteraf niets over.

- Log per ronde: `storyTitle`, individuele stemmen, gemiddelde/mediaan, tijdstip.
- Zichtbaar in een paneel of modal voor de Scrum Master.
- Knop "Kopieer als Markdown" / "Download als CSV" voor in de sprint-notulen.
- Sluit direct aan op de bestaande `storyTitle`-functie.
- Aandachtspunt: historie in-memory houden per room (verdwijnt bij herstart, zie #5).

### 2. Consensus- en outlier-indicatie
**Waarde: hoog.** De stats tonen gemiddelde/mediaan/verdeling, maar niet het meest bruikbare voor de facilitator: *is er onenigheid?*

- Toon expliciet "iedereen eens" versus "grote spreiding — bespreken".
- Markeer min/max outliers in de resultatengrid.
- Let op: de i18n-keys `stat-consensus`, `stat-most-picked` en `stat-total-votes` waren hiervoor ooit bedoeld maar nooit gebruikt; ze zijn inmiddels opgeruimd en moeten opnieuw toegevoegd worden als dit gebouwd wordt.

### 3. Timer per ronde
**Waarde: gemiddeld.** Klassieke planning-poker functie om discussies kort te houden.

- Optionele aftelklok die de SM start; zichtbaar voor iedereen.
- Eventueel automatisch onthullen bij 0 (combineert met auto-reveal).

---

## 🔧 Technisch

### 4. Rate limiting op de REST-endpoints
**Waarde: gemiddeld (hoog bij publieke deploy).** De sockets hebben een limiter (35 events/s), maar de REST-routes niet — en `/api/rooms/:id/qr` genereert een QR-code, wat relatief duur is.

- Simpele per-IP limiter voor `/api/*`.
- Relevant zodra de app buiten een vertrouwd LAN draait (net als de `CORS_ORIGIN: *` default).

### 5. State overleeft geen herstart
**Waarde: afhankelijk van gebruik.** Alles staat in-memory, dus elke Docker-redeploy wist actieve sessies.

- Optie: periodieke JSON-snapshot naar disk, inlezen bij opstarten.
- **Bewuste trade-off:** de README verkoopt "geen database nodig" als feature. Alleen oppakken als dit in de praktijk stoort.

### 6. Room-code alfabet verbeteren
**Waarde: laag.** `generateRoomId()` knipt een uuid-v4 af, dus codes bevatten alleen `0-9A-F` — nooit G t/m Z. De docs noemen het "alphanumeric", wat dus niet klopt.

- 16,7M combinaties is ruim voldoende, dus geen bug.
- Met een eigen alfabet krijg je meer entropie in minder tekens, en kun je verwarrende tekens (0/O, 1/I) weglaten — handig bij het voorlezen in een meeting.
- Docs (`file-structure.md`) meteen corrigeren.

### 7. Frontend-tests
**Waarde: laag/gemiddeld.** De renderers en helpers zijn onbetest; alleen i18n-pariteit wordt gecheckt.

- Denk aan `escHtml`, `sanitizeRoom`-rendering, de stats-berekening in `render-results.js`.
- Vereist een DOM-omgeving (jsdom) of het extraheren van pure functies.

---

## ✅ Afgerond

- **Socket-hardening** — safe dispatch, null-prototype store, `normalizeRoomId()` (PR #5).
- **Dependency-updates** — express 5, supertest 7 (PR #6).
- **Documentatie & diagram-correcties** (PR #7).
- **Deelnemer-knoppen alleen op hover**, met touch-fallback (PR #8).
- **CI draait de testsuite** op Node 22 & 24, blokkeert de Docker-build bij falen.
- **Dode i18n-keys opgeruimd** (`stat-consensus`, `stat-most-picked`, `stat-total-votes`).
- **Auto-reveal** — optioneel automatisch onthullen zodra iedereen gestemd heeft.
