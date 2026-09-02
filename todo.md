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
- Aandachtspunt: historie in-memory houden per room (verdwijnt bij herstart, zie #4).

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

### 4. State overleeft geen herstart
**Waarde: afhankelijk van gebruik.** Alles staat in-memory, dus elke Docker-redeploy wist actieve sessies.

- Optie: periodieke JSON-snapshot naar disk, inlezen bij opstarten.
- **Bewuste trade-off:** de README verkoopt "geen database nodig" als feature. Alleen oppakken als dit in de praktijk stoort.

### 10. Installeerbaar maken als PWA
**Waarde: gemiddeld.** Sluit direct aan op de manier waarop de app gebruikt wordt: meestemmen vanaf je telefoon (zie #5). Levert een icoon op het beginscherm en een standalone weergave zonder browserbalk — dat scheelt schermruimte op een telefoon, en de wake lock (`requestWakeLock()` in `public/js/utils/helpers.js`) zit er al in.

**Wat het níét oplevert: offline werken.** Dit is een real-time app; zonder verbinding is er niets zinvols te tonen. De service worker cachet dus alleen de app-shell (HTML/CSS/JS), nooit room-state.

**Benodigd:**
- `public/manifest.webmanifest` plus echte PNG-iconen (192 en 512). Het huidige favicon is een inline SVG data-URI in de `<head>` van `index.html` en `room.html` — bruikbaar als tab-icoon, maar niet genoeg om installeerbaar te zijn. Voor iOS ook een `apple-touch-icon`.
- Service worker met de hand schrijven, geen Workbox: dit repo hand-rolt kleine utilities in plaats van er een package voor te trekken (zie `CLAUDE.md`).

**De belangrijkste val — cache versus versienummer.** `/api/config` voedt het versienummer in het opties-scherm. Een service worker die de shell cachet, serveert na een deploy de oude JS/HTML terwijl `/api/config` al de nieuwe versie meldt. Dat is precies het "versie staat stil"-faalgeval waar `CLAUDE.md` voor waarschuwt, alleen dan via de cache in plaats van via een gemiste version-bump.
- Nooit `/api/*` of Socket.IO-verkeer cachen.
- De shell-cache benoemen naar `APP_VERSION`, zodat een nieuwe versie de oude cache automatisch ongeldig maakt.

**HTTPS is een harde eis.** Service workers draaien alleen in een secure context. De deployment op een publiek domein voldoet daaraan; toegang via het LAN-adres (`http://192.168.x.x:3000`) niet. De README verkoopt LAN-gebruik juist als feature, en `copyToClipboard()` heeft al een expliciete fallback voor insecure contexts — installeerbaarheid wordt dus een extraatje voor de HTTPS-deployment, geen vervanging van de LAN-route.

**Aandachtspunten:**
- `start_url` wordt `/`. Joinen gaat via een QR-code of link, en die opent de browser, niet de geïnstalleerde app. Start je standalone op, dan land je dus op de homepagina en moet je de room-code intypen. Overweeg of dat acceptabel is, of dat een `share_target`/deeplink-oplossing nodig is.
- iOS heeft beperkte PWA-ondersteuning; in standalone modus kan de socket bij backgrounden sneuvelen. Dat valt onder het bestaande re-join-pad op `socket.on('connect')` in `public/js/room/room-page.js`.
- Docker vereist geen wijziging: `COPY public ./public` staat al in de `Dockerfile`, dus manifest, service worker en iconen liften automatisch mee.

### 11. Presenter-scherm: reveal-theater en grote-schermtest
**Waarde: laag.** Twee dingen die overbleven na code review van #5, geen van beide een bug.

- **Geen omgekeerde kaarten tijdens het stemmen.** `presenter.html` toont nu alleen een voortgangsbalk zolang er niet onthuld is. Klassieke planning-poker-schermen laten per deelnemer een omgekeerde kaart zien die bij reveal omdraait — dat maakt het moment zelf theatraler. Zou in `presenter-page.js` + `render-voting.js`-achtige component moeten, met een flip-animatie op `#results-cards-grid` zoals `render-results.js` al deels heeft (`animation: flipIn`).
- **Nooit getest op een echte 1920×1080-scherm.** Alleen 1400×900 en 1600×900 in de browser-pane geverifieerd. De resultaatkaarten hebben een `clamp()`-bovengrens van 132px breed (`public/style.css`, `.presenter-page .result-card-face`) — op een grotere/verdere TV kunnen ze relatief klein ogen. Bovengrens optrekken of schalen op `vw` in plaats van een vast plafond, ná een echte test op zo'n scherm.

---

## ✅ Afgerond

- **Socket-hardening** — safe dispatch, null-prototype store, `normalizeRoomId()` (PR #5).
- **Dependency-updates** — express 5, supertest 7 (PR #6).
- **Documentatie & diagram-correcties** (PR #7).
- **Deelnemer-knoppen alleen op hover**, met touch-fallback (PR #8).
- **CI draait de testsuite** op Node 26, blokkeert de Docker-build bij falen.
- **Alles op de nieuwste versies** — Node 26 (Dockerfile, CI, `engines`), `actions/setup-node@v7`.
- **Dode i18n-keys opgeruimd** (`stat-consensus`, `stat-most-picked`, `stat-total-votes`).
- **Auto-reveal** — optioneel automatisch onthullen zodra iedereen gestemd heeft.
- **Rate limiting op de REST-endpoints** — per-IP limiter (60 req/min) op `/api/*`; `/health` blijft uitgezonderd zodat de Docker-healthcheck nooit geraakt wordt.
- **Room-code alfabet verbeterd** — Crockford Base32 (32 tekens, geen I/L/O/U), crypto-random zonder modulo-bias, ~64x meer combinaties dan het oude hex-only alfabet. De `uuid`-dependency is niet meer nodig en verwijderd.
- **Frontend-tests** — `computeVoteStats` (uit `render-results.js`), `escHtml`, `generateRoomId`/`normalizeRoomId` en de rate limiter zijn nu allemaal los getest als pure functies (geen jsdom nodig).
- **Persoonlijke reconnect-grace** — een deelnemer die disconnect (bijv. scherm uit) wordt niet meer direct verwijderd, maar 10 minuten (override via `PARTICIPANT_GRACE_MINUTES`) als "afwezig" bewaard met stem/rol intact; reconnect met dezelfde naam herstelt de plek direct. SM kan een afwezige alsnog meteen kicken; master-overdracht naar een afwezige wordt geweigerd.
- **Versienummer in het opties-scherm** — uit `package.json`, via `/api/config`.
- **Consensus-animatie bij unanieme stem** — confetti-burst (dependency-vrij, CSS+JS) wanneer alle stemmers exact hetzelfde kaartje kiezen; respecteert `prefers-reduced-motion`, vuurt precies één keer per reveal. Persoonlijke "no fun mode"-toggle in het opties-scherm (localStorage, per apparaat) om 'm uit te zetten.
- **Geen `join-room` meer bij elke tab-focus** *(was #6)* — de `visibilitychange`-handler brengt alleen nog een gevallen verbinding omhoog. Zolang de socket verbonden is, heeft de server de stoel nog, dus viel er niets te herstellen. Het opnieuw joinen zit nu op één plek: `socket.on('connect')` in `room-page.js`, dat zowel de automatische reconnect als een handmatige `.connect()` afvangt — waar het oude `socket.io.on('reconnect')` alleen de eerste dekte.
- **Log laat nu zien of er geschat is** *(was #7)* — `[reveal]` met aantal stemmers, `[reset]`, `[change-deck]` met dektype, en `[auto-reveal]` vanuit `applyAutoReveal()` zelf zodat alle vijf de aanroeppaden erin zitten. `[join]` toont hoeveel mensen er in de room zitten en `[disconnect]` toont de naam plus of het de SM was. Individuele stemmen worden bewust niet gelogd.
- **Socket alleen nog waar hij nodig is** *(was #8)* — de indexpagina verbindt pas als je daadwerkelijk een room aanmaakt (`autoConnect: isRoomPage`), niet meer bij elke pageload. Scheelt een stroom connect/disconnect-paren in het log van bezoekers die alleen even kijken.
- **Presenter-scherm als eigen ingang** *(was #5)* — een presenter-scherm is geen deelnemer meer maar een *display*: het joint met `watch-room`, komt in `room.displays` in plaats van `room.participants`, en valt daardoor automatisch buiten elke stemberekening. Het bedient de room wél (reveal, nieuwe ronde, deck, story-titel, auto-reveal, kick) via één predicaat `canControlRoom()` — dat is immers de plek waar de facilitator staat. Een room aanmaken vraagt geen naam meer en opent direct `presenter.html`; de eerste die joint wordt host. Nieuwe derde tab "Presenteer" opent een scherm voor een bestaande room op code. Meerdere schermen op één room mogen, want een display bezit geen state. De host is voortaan een gewone stemmer — wie niet wil stemmen zet zichzelf op spectator.
- **Onbeheerde room leeft 30 minuten** *(was #9)* — `RECONNECT_GRACE_PERIOD_MS` van 15 naar 30 minuten, en de timer start pas als er niets meer aan hangt: geen verbonden deelnemer én geen presenter-scherm. Een team dat gaat lunchen met het scherm aan raakt de room dus niet kwijt. `deleteRoom()` lichtte niemand in; `closeRoom()` stuurt nu eerst `room-closed` naar de schermen die nog kijken.
