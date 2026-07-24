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

### 5. Presenter-scherm loskoppelen van de Scrum Master-rol
**Waarde: hoog.** De SM-rol bundelt nu drie losse dingen in één socket: *rechten* (reveal, reset, deck, kick, story-titel, auto-reveal), *presenter-weergave* (eigen dek verbergen, QR-paneel, `is-presenter` op de body) en *structureel niet mogen stemmen*.

Dat botst met de manier waarop de app in de praktijk gebruikt wordt: de facilitator zet de sessie op een groot scherm én doet mee vanaf zijn telefoon. Nu kan dat niet goed — geeft de telefoon de rechten, dan verliest het grote scherm zijn presenter-weergave (kaarten verschijnen, QR verdwijnt); houdt het grote scherm de rol, dan moet je er fysiek heen om te revealen. Bovendien sta je dan als twee losse rijen met dezelfde naam in de deelnemerslijst.

**Gekozen aanpak: het presenter-scherm is helemaal geen deelnemer.**

- Join met een `presenter`-modus: wel `socket.join(roomId)` voor de broadcasts, géén entry in `room.participants`.
- Werkt omdat `sanitizeRoom(room, null)` al bestaat — zonder viewer-id krijg je precies de "alleen onthulde stemmen"-weergave die een presenter-scherm nodig heeft (`src/store/rooms.js`).
- `broadcastRoomState()` itereert nu over `room.participants` om per socket te emitten; er moet een `room.displays` (Set van socket-ids) bij die de `sanitizeRoom(room, null)`-versie krijgt (`src/utils/broadcast.js`).
- Het presenter-scherm heeft dan **nul rechten**; de telefoon houdt de host-rol én stemt gewoon mee.
- Client: QR-paneel en `is-presenter` loskoppelen van `showSMControls()` in `public/js/room/room-page.js` — splitsen in host-controls en presenter-weergave.

**Grootste risico:** `masterId` fungeert op vier plekken als "de niet-stemmer"-markering — `src/utils/autoReveal.js` (`p.id !== room.masterId`), de voortgangsbalk, de resultatengrid en de stats. Bij deze aanpak hoef je die niet te *vervangen* maar te *verwijderen*: een presenter is geen deelnemer, dus valt automatisch buiten alle stem-berekeningen. Wel de auto-reveal-tests nalopen — daar zit de bestaande dekking op.

**Gevolg dat een keuze is, geen bug:** de opruimlogica verwijdert een room zodra er geen verbonden deelnemers meer zijn. Een room waar alleen nog een presenter-scherm aan hangt, wordt dus na `RECONNECT_GRACE_PERIOD_MS` opgeruimd.

**Wat de transfer-knop hierna betekent:** nu sleept `sm-transfer-master` alle drie de dingen tegelijk mee, inclusief de weergave — daarom voelt hij verkeerd. Na de splitsing verhuist alleen de bevoegdheid ("iemand anders faciliteert nu"), en blijft het grote scherm staan waar het staat.

**Overwogen en afgevallen:**
- *Presenter als gewone deelnemer met een `isPresenter`-vlag* — werkt, maar je staat dan nog steeds dubbel in de lijst en `masterId` moet overal vervangen worden door een presenter/spectator-filter.
- *Eén gebruiker met meerdere verbindingen* (`sockets: Set`, één stem, presenter-vlag per verbinding) — conceptueel het netst, maar ontkoppelt deelnemer-identiteit van socket-id door de hele codebase (kick, transfer, grace-timers, broadcast, sanitize) en vereist een apart koppel-mechanisme. De QR is niet herbruikbaar: dat is de join-link die iedereen scant. Botst bovendien met de eviction-regel uit PR #20 — dezelfde token op twee apparaten betekent per definitie "iemand is teruggekomen", niet "iemand heeft een tweede scherm".

**Bijvangst:** lost meteen de dubbelzinnigheid op dat twee gelijknamige deelnemers (of jouw eigen twee apparaten) als identieke rijen in de lijst staan — sinds PR #20 houden die wel elk hun eigen stoel, maar de SM ziet bij kicken en rol-overdracht niet wélke "Jan" hij te pakken heeft.

### 6. Overbodige `join-room` bij elke tab-focus
**Waarde: hoog.** Kleinste ingreep van deze lijst met het grootste effect. Uit een productielog:

```
21:06:40.749 INFO [join] 2 → ER5H1Z
21:07:07.053 INFO [join] 2 → ER5H1Z
21:07:19.174 INFO [join] 2 → ER5H1Z
21:07:29.361 INFO [join] 2 → ER5H1Z
21:08:16.500 INFO [join] 2 → ER5H1Z
```

Vijf joins in 96 seconden, **dezelfde socket, geen disconnect ertussen**. Oorzaak: de `visibilitychange`-handler onderaan `public/js/utils/helpers.js` vuurt een volledige `join-room` af zodra het tabblad weer zichtbaar wordt.

Elke join draait de complete `handleJoinRoom` en eindigt in `broadcastRoomState()`, die individueel naar iedere deelnemer emit. Eén iemand die alt-tabt veroorzaakt dus een volledige state-broadcast naar de hele room.

**De re-join is overbodig.** Is de socket nog verbonden, dan heeft de server de stoel nog: de grace-timer start pas bij een disconnect, en een room wordt pas opgeruimd als iedereen weg is. Een echte reconnect wordt al afgevangen door `socket.io.on('reconnect')` in `public/js/room/room-page.js`, en een server-herstart verbreekt de socket, dus die valt ook onder dat pad.

- Aanpak: de `else`-tak in de `visibilitychange`-handler weghalen; `requestWakeLock()` en de `connect()`-tak blijven staan.
- Bijkomend: dit was ook het pad dat de naamgenoten-bug uit PR #20 in normaal gebruik bereikbaar maakte, niet alleen in theorie.

### 7. Observability: je ziet niet of er geschat is
**Waarde: gemiddeld.** Het log kent `connect`, `join`, `reconnect`, `grace`, `cleanup` en `disconnect`, maar niets voor `reveal`, `reset` of `change-deck`. Een room waarin een uur lang gewerkt is, is in het log niet te onderscheiden van een lege room.

- Voeg een `[reveal]`- en `[reset]`-regel toe in `src/socket/handlers/smHandlers.js`, met room-id en aantal stemmers.
- **Stemmen zelf niet loggen** — dat is precies de informatie die de app tot na de reveal verborgen houdt.
- Overweeg het aantal deelnemers mee te loggen bij `[join]`; nu moet je terugscrollen om te weten hoe vol een room is.
- Kleiner punt: `[connect]`/`[disconnect]` loggen alleen een socket-id, geen naam. Bij een disconnect is de naam wél bekend (de deelnemer staat nog in `room.participants`), dus die kan erbij.

### 8. Socket wordt geopend op elke pageload
**Waarde: laag.** `public/js/main.js` opent bij iedere pageload een Socket.IO-verbinding, ook op de indexpagina waar hij pas nodig is als je daadwerkelijk een room aanmaakt. In het log zie je daardoor een stroom connect/disconnect-paren zonder enige room-activiteit.

- Geen bug, wel ruis: het maakt logs lastiger te lezen en houdt verbindingen open voor bezoekers die alleen even kijken.
- Optie: de socket pas opzetten bij de eerste actie die hem nodig heeft (`create-room`), of op de indexpagina helemaal achterwege laten en pas op `room.html` verbinden.

### 9. Een room bestaat 5 minuten zonder deelnemers
**Waarde: laag.** `PARTICIPANT_GRACE_MS` staat op 10 minuten, `RECONNECT_GRACE_PERIOD_MS` op 15. Uit het log:

```
21:22:30.095 INFO [disconnect] oJyTd...
21:32:30.095 INFO [grace]      oJyTd... verwijderd na 10m zonder reconnect.
21:37:30.094 INFO [cleanup]    Room R1CCWW deleted after 15m inactivity.
```

De laatste stoel verdwijnt op minuut 10, de room pas op minuut 15. In dat gat bestaat de room nog wél: kom je op minuut 12 terug, dan krijg je de room maar een verse stoel — je stem is weg, en je wordt Scrum Master omdat er niemand anders is.

- Verdedigbaar gedrag (de room-code blijft geldig), maar het staat nergens beschreven en de twee timers overlappen zonder dat de relatie ergens expliciet is.
- Keuze: ofwel de room meteen opruimen zodra `expireParticipantGrace()` de laatste deelnemer verwijdert, ofwel de verhouding tussen beide timers documenteren in `docs/wiki/lifecycle.md`.

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
