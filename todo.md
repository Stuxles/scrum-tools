# 📋 TODO / Ideeënlijst

Backlog van ideeën en verbeterpunten uit de codebase-reviews.
**Gesorteerd op prioriteit:** eerst functionaliteit op waarde, daarna
technisch onderhoud, en binnen elk blok het zwaarste bovenaan. Elk item zegt
zelf wat die prioriteit is en waarom. Afgeronde items staan onderaan.

> De zeven punten uit de audit van 22 oktober 2026 zijn opgelost en staan
> onderaan bij **Afgerond**. De vier bugs uit de review van 3 september 2026
> daarvóór ook, elk met een regressietest in `tests/bugfixes.test.js`.

---

## 🎯 Functioneel

### 1. Ronde-historie + export
**Waarde: hoog.** Nu worden bij elke "nieuwe ronde" de resultaten gewist zonder dat er iets bewaard blijft. Een team dat 10 stories schat, houdt achteraf niets over.

- Log per ronde: `storyTitle`, individuele stemmen, gemiddelde/mediaan, tijdstip.
- Zichtbaar in een paneel of modal voor de Scrum Master.
- Knop "Kopieer als Markdown" / "Download als CSV" voor in de sprint-notulen.
- Sluit direct aan op de bestaande `storyTitle`-functie.
- Aandachtspunt: historie in-memory houden per room (verdwijnt bij herstart, zie #6).

### 2. Consensus- en outlier-indicatie
**Waarde: hoog.** De stats tonen gemiddelde/mediaan/verdeling, maar niet het meest bruikbare voor de facilitator: *is er onenigheid?*

- Toon expliciet "iedereen eens" versus "grote spreiding — bespreken".
- Markeer min/max outliers in de resultatengrid.
- Let op: de i18n-keys `stat-consensus`, `stat-most-picked` en `stat-total-votes` waren hiervoor ooit bedoeld maar nooit gebruikt; ze zijn inmiddels opgeruimd en moeten opnieuw toegevoegd worden als dit gebouwd wordt.

### 3. Timer per ronde
**Waarde: gemiddeld.** Klassieke planning-poker functie om discussies kort te houden.

- Optionele aftelklok die de SM start; zichtbaar voor iedereen.
- Eventueel automatisch onthullen bij 0 (combineert met auto-reveal).

### 4. Installeerbaar maken als PWA
**Waarde: gemiddeld.** Sluit direct aan op de manier waarop de app gebruikt wordt: meestemmen vanaf je telefoon terwijl het presenter-scherm op de tv staat. Levert een icoon op het beginscherm en een standalone weergave zonder browserbalk — dat scheelt schermruimte op een telefoon, en de wake lock (`requestWakeLock()` in `public/js/utils/helpers.js`) zit er al in.

**Wat het níét oplevert: offline werken.** Dit is een real-time app; zonder verbinding is er niets zinvols te tonen. De service worker cachet dus alleen de app-shell (HTML/CSS/JS), nooit room-state.

**Benodigd:**
- `public/manifest.webmanifest` plus echte PNG-iconen (192 en 512). Het huidige favicon is een inline SVG data-URI in de `<head>` van `index.html`, `room.html` en `presenter.html` — bruikbaar als tab-icoon, maar niet genoeg om installeerbaar te zijn. Voor iOS ook een `apple-touch-icon`.
- Service worker met de hand schrijven, geen Workbox: dit repo hand-rolt kleine utilities in plaats van er een package voor te trekken (zie `CLAUDE.md`).

**De belangrijkste val — cache versus versienummer.** `/api/config` voedt het versienummer in het opties-scherm. Een service worker die de shell cachet, serveert na een deploy de oude JS/HTML terwijl `/api/config` al de nieuwe versie meldt. Dat is precies het "versie staat stil"-faalgeval waar `CLAUDE.md` voor waarschuwt, alleen dan via de cache in plaats van via een gemiste version-bump.
- Nooit `/api/*` of Socket.IO-verkeer cachen.
- De shell-cache benoemen naar `APP_VERSION`, zodat een nieuwe versie de oude cache automatisch ongeldig maakt.

**HTTPS is een harde eis.** Service workers draaien alleen in een secure context. De deployment op een publiek domein voldoet daaraan; toegang via het LAN-adres (`http://192.168.x.x:3000`) niet. De README verkoopt LAN-gebruik juist als feature, en `copyToClipboard()` heeft al een expliciete fallback voor insecure contexts — installeerbaarheid wordt dus een extraatje voor de HTTPS-deployment, geen vervanging van de LAN-route.

**Aandachtspunten:**
- `start_url` wordt `/`. Joinen gaat via een QR-code of link, en die opent de browser, niet de geïnstalleerde app. Start je standalone op, dan land je dus op de homepagina en moet je de room-code intypen. Overweeg of dat acceptabel is, of dat een `share_target`/deeplink-oplossing nodig is.
- iOS heeft beperkte PWA-ondersteuning; in standalone modus kan de socket bij backgrounden sneuvelen. Dat valt onder het bestaande re-join-pad op `socket.on('connect')` in `public/js/room/room-page.js`.
- Docker vereist geen wijziging: `COPY public ./public` staat al in de `Dockerfile`, dus manifest, service worker en iconen liften automatisch mee.

---

## 🔧 Technisch

### 5. Geen plafond op rooms en deelnemers
**Prioriteit: hangt af van blootstelling.** Op een LAN met het eigen team
onschuldig; achter de nginx-opstelling uit de README, op een publiek domein, is
dit het enige dat de server nog plat kan krijgen.

- `create-room` vraagt niets: geen naam, geen login, geen bestaande room. Sinds
  de audit leeft een room die niemand joint nog 30 minuten in plaats van 24 uur,
  maar een stroom berichten kan nog altijd een vol grace-venster aan rooms
  vasthouden. Het `shortcut:`-commentaar bij `scheduleEmptyRoomCleanup()` in
  `src/utils/broadcast.js` benoemt precies dit.
- Ook geen plafond op het aantal deelnemers per room. Minder dringend: daarvoor
  is de room-code nodig, en die is 32^6.
- Als dit opgepakt wordt: tellen per IP, niet één globaal maximum — een globaal
  maximum laat één bezoeker iedereen buitensluiten. De socket-limiter (35/s)
  helpt hier niet, want die telt per socket en een client opent er gewoon meer.
- `CORS_ORIGIN` staat standaard op `*`, dus elke willekeurige webpagina kan dit
  ook vanuit de browser van een teamlid doen.

### 6. State overleeft geen herstart
**Waarde: afhankelijk van gebruik.** Alles staat in-memory, dus elke Docker-redeploy wist actieve sessies.

- Optie: periodieke JSON-snapshot naar disk, inlezen bij opstarten.
- **Bewuste trade-off:** de README verkoopt "geen database nodig" als feature. Alleen oppakken als dit in de praktijk stoort.

### 7. Testdekking voor het stemmen zelf
**Prioriteit: laag** — het gat dat de kaartdek-bug liet ontstaan is gedicht
(`tests/bugfixes.test.js` dekt nu elk dektype, aangepaste dekken, een onbekend
dektype en de ondergrens van 2 kaarten). Wat er nog niet los getest is:

- `handleVote` — een kaart die niet in het dek zit wordt genegeerd, stemmen na
  een reveal doet niets, en opnieuw op dezelfde kaart klikken haalt de stem weg.
- `handleToggleSpectator` — de stem wordt gewist bij het omzetten naar
  toeschouwer, en de resterende stemmers kunnen daardoor compleet zijn.
- Deze paden gaan via `applyAutoReveal()` en delen dus het predicaat dat bij
  bug 2 is rechtgezet; ze zijn nu alleen indirect gedekt.

### 8. Kleine inconsistenties uit de flikker-review
**Prioriteit: laag.** Niets hiervan is zichtbaar voor een gebruiker vandaag,
maar het zijn wel plekken waar twee stukken code het niet met elkaar eens zijn.

- **De rol "Scrum Master" staat hardcoded in `render-users.js`.** Naast
  `role-spectator` en `role-participant`, die netjes door `t()` gaan. Er is geen
  `role-master`-key; die moet er eerst bij in beide talen.
- **De REST-endpoints normaliseren de room-code niet.** `/api/rooms/:id` en
  `/api/rooms/:id/qr` doen `rooms[req.params.id]` rechtstreeks, waar elke
  socket-handler eerst `normalizeRoomId()` aanroept. Nu onschuldig, want
  `main.js` zet de code uit de URL altijd al in kapitalen; wie het endpoint
  direct met kleine letters aanroept krijgt een 404 op een room die wél bestaat.
- **`#header-spectator-btn` staat niet in de header.** Hij verhuisde naar het
  optiesmenu maar hield zijn naam, wat bij het zoeken naar de knop (en bij het
  schrijven van een test) de verkeerde kant op wijst.

### 9. Dode i18n-keys en CSS opruimen
**Prioriteit: laag.** Puur onderhoud, geen zichtbaar effect.

- Ongebruikte i18n-keys (in beide talen aanwezig, nergens aangeroepen):
  `footer-text`, `voting-phase-waiting`, `btn-switch-to-spectator`,
  `toast-room-not-found-generic`, `toast-rate-limit`, `toast-server-full`,
  `toast-generic-error`, `story-btn-edit`, `claim-sm-btn`, `transfer-sm-btn`,
  `toast-sm-claimed`, `toast-sm-transferred`, `options-theme-btn`.
- Ongebruikte CSS-klassen: `badge`, `badge-amber`, `badge-green`, `badge-purple`,
  `field-row`, `my-name-btn`, `spinner`, `sr-only`, `waiting-overlay`.
- Positief punt uit dezelfde controle: `nl` en `en` hebben allebei exact 169
  keys en lopen niet uit de pas, en elke `getElementById` in de frontend heeft
  een bestaand element. Geen dubbele id's op enige pagina.

### 10. Presenter-scherm: reveal-theater en grote-schermtest
**Prioriteit: laag.** Twee dingen die overbleven na de code review van het presenter-scherm, geen van beide een bug.

- **Geen omgekeerde kaarten tijdens het stemmen.** `presenter.html` toont nu alleen een voortgangsbalk zolang er niet onthuld is. Klassieke planning-poker-schermen laten per deelnemer een omgekeerde kaart zien die bij reveal omdraait — dat maakt het moment zelf theatraler. Zou in `presenter-page.js` + `render-voting.js`-achtige component moeten, met een flip-animatie op `#results-cards-grid` zoals `render-results.js` al deels heeft (`flipIn`, aangezet via de klasse `is-flipping-in` die de grid bij een verse reveal krijgt).
- **Nooit getest op een echt 1920×1080-scherm.** Alleen 1100×800, 1500×850 en 1600×900 in de browser-pane geverifieerd. De resultaatkaarten hebben een `clamp()`-bovengrens van 132px breed (`public/style.css`, `.presenter-page .result-card-face`) — op een grotere/verdere TV kunnen ze relatief klein ogen. Bovengrens optrekken of schalen op `vw` in plaats van een vast plafond, ná een echte test op zo'n scherm.
- **Lege kolom bij een lege room.** De deelnemerskolom krijgt `hidden` zolang er niemand is, maar houdt zijn baan in het grid bezet. Bewust: zo verspringt er niets zodra de eerste deelnemer binnenkomt. Alleen aanpakken als die lege strook echt stoort.

---

## ✅ Afgerond

### De zeven punten uit de audit van 22 oktober 2026

Audit van de hele repo (PR #30). Vier bugs, daarna de duplicatie die er twee
van had laten passeren. De vier bugs zijn eerst tegen echte sockets
gereproduceerd en daarna opnieuw gedraaid; zes nieuwe tests, 143 → 149.

- ✅ **Een verlaten room bleef 24 uur in het geheugen staan.** De
  30-minutentimer bestond al, maar werd alleen bij een disconnect opgezet — en
  een room die niemand joint heeft niemand die hem verlaat. Een aangemaakte en
  daarna in de steek gelaten room viel dus door naar de 24-uursopruiming.
  `create-room` vraagt geen enkele vorm van authenticatie, dus dat was een dag
  geheugen per bericht. De timer en zijn `isRoomUnattended()` staan nu in
  `utils/broadcast.js`, naast de twee andere room-timers, en `handleCreateRoom`
  zet hem op; joinen of er een scherm op richten wist hem al. Het restrisico
  staat als `shortcut:` in de code en als #5 hierboven.
- ✅ **De room openen in een tweede tabblad zei tegen het eerste dat het
  gekickt was.** Het reconnect-token staat in localStorage, en dat delen alle
  tabbladen van één browser. Het pad voor een token-botsing wordt daardoor veel
  vaker bereikt door een tweede tabblad dan door de haperende reconnect waar het
  voor geschreven is. Dat de stoel meeverhuist klopt; het rode "je bent uit de
  room verwijderd" niet. Dat pad stuurt nu `reason: 'superseded'` en de client
  toont een neutrale melding. Een echte kick stuurt nog steeds geen reason en
  leest precies als voorheen.
- ✅ **Een eigen kaart met de naam `toString` sloopte de hele
  verdelingsgrafiek.** Kaartwaarden zijn sleutels in de telling, en op een gewone
  `{}` vindt `dist['toString'] || 0` de geërfde functie in plaats van 0. De telling
  wordt een string, `Math.max` over de waarden wordt `NaN`, en dat bepaalde de
  breedte van *élke* balk, niet alleen die ene. Een kaart `__proto__` verdween
  juist helemaal uit de grafiek. Beide tellingen zijn nu `Object.create(null)`,
  net als `src/store/rooms.js` al was.
- ✅ **`update-name` struikelde over een naam die geen tekst was.**
  `(name || '').trim()` dwingt niets af, dus `{ name: 42 }` gooide een
  `TypeError` die de safe dispatch tot "er ging iets mis" maakte. `cleanText()`
  is nu geëxporteerd en wordt door `update-name` én `update-story-title`
  gebruikt: drie schrijfwijzen van één regel teruggebracht tot één.
- ✅ **De regel voor wie een ronde tegenhoudt stond twee keer**, één keer per
  kant, allebei met een commentaar dat de twee het eens moesten blijven. Precies
  zo kwam de offline-check indertijd in maar één van de twee terecht. De
  serverkopie is weg: `autoReveal.js` importeert `eligibleVoters()` uit
  `public/js/utils/stats.js`, zoals `config.js` al uit `public/` importeerde.
- ✅ **Disconnect liep de roomlijst twee keer af**, één keer voor schermen en
  één keer voor stoelen. Nu één keer, waarbij `Set.delete` meteen de test is of
  de socket überhaupt een scherm was. Met een test voor het enige geval dat
  daardoor stuk kon: een socket die zowel scherm als stoel is.
- ✅ **Ongebruikte import** (`releaseWakeLock` in `room-page.js`) verwijderd.

### De vier bugs uit de review van 3 september 2026

Alle vier eerst gereproduceerd, daarna opgelost, en vastgezet met 13
regressietests in `tests/bugfixes.test.js`.

- ✅ **Aangepast kaartdek werd genegeerd bij het aanmaken van een room.** `DECKS`
  heeft geen `custom`-sleutel — dat is een markering voor "gebruik de kaarten uit
  deze payload" — maar `handleCreateRoom` deed de `DECKS`-lookup vóór de test op
  `custom`, en schreef `custom` dus om naar `standard`. De ingevoerde kaarten
  verdwenen zonder melding. Nu dezelfde volgorde als in `handleChangeDeck`, dat
  het altijd al goed deed; vandaar dat het via **Wijzig deck** wél werkte.
- ✅ **Een offline deelnemer blokkeerde auto-reveal en de voortgangsteller.**
  `eligibleVoters()` filterde op toeschouwer maar niet op verbinding, dus een
  telefoon die op slot ging hield de ronde tien minuten tegen. Het predicaat is
  nu: geen toeschouwer, én niet offline-zonder-stem. Wie stemde en dáárna wegviel
  telt gewoon mee — zijn stem hoort bij de ronde. De frontend bouwde datzelfde
  filter op vier plekken met de hand na; die delen nu één `eligibleVoters()` in
  `public/js/utils/stats.js`, zodat de balk en de reveal elkaar niet meer kunnen
  tegenspreken. Meteen de dode `applyAutoReveal()`-aanroep in `handleDisconnect`
  hersteld: die kon zijn eigen commentaar nooit waarmaken.
- ✅ **De host kicken liet de room zonder host achter.** `handleKickUser` liet
  `masterId` naar een verwijderde stoel wijzen en `masterToken` op de gekickte
  persoon staan — waardoor die bij opnieuw joinen de rol meteen terugkreeg. Een
  kick is bewust en definitief, dus anders dan bij een disconnect volgt er geen
  grace-periode: de rol gaat direct naar de eerste verbonden achterblijver, of
  wordt leeggemaakt als er niemand meer is.
- ✅ **Presenter-scherm mocht kicken maar had er geen knop voor.** De server stond
  het toe en `roles.md` beloofde het; alleen gaf `presenter-page.js` een harde
  `false` mee als `isMaster`. `renderParticipants()` neemt nu twee losse rechten
  (`canKick`, `canTransfer`) in plaats van één vlag, want de twee aanroepers
  hebben niet dezelfde rechten: `sm-transfer-master` eist dat de afzender de
  stoel zelf bezit, en een scherm heeft er geen. Eén boolean kon alleen maar naar
  één kant fout staan.

### Eerder

- **De version-bump kon per ongeluk een major-bump doen** — het patroon
  `'^[a-zA-Z]+(\([^)]*\))?!:|BREAKING CHANGE'` leest in ERE als
  *`^…!:` óf `BREAKING CHANGE` ergens*, want `|` bindt het zwakst. De losse
  woorden werden dus op elke regel van elke commit-body gematcht: een commit
  die ze alleen nóemde ("dit is expliciet geen BREAKING CHANGE") of een
  docs-commit die de conventie uitlegt, sprong van 1.6.1 naar 2.0.0. Beide
  alternatieven staan nu geankerd en de footer eist zijn dubbele punt
  (`BREAKING-CHANGE:` is het door de spec toegestane synoniem). Doorgerekend
  over acht commit-vormen voordat het de deur uit ging.
- **Aangepast dek accepteerde dubbele kaarten** — `['5', '5', '8']` leverde
  twee knoppen met dezelfde `data-val`, en omdat `selectVoteCard()` op de
  waarde matcht lichtte één klik ze allebei op. Nu ontdubbeld aan de poort,
  vóór de ondergrens van 2 wordt gecontroleerd, dus een dek van één kaart
  twee keer wordt netjes afgewezen. Die validatie stond trouwens twee keer
  uitgeschreven (aanmaken én wijzigen) — precies het paar dat eerder al uit
  elkaar was gelopen — en zit nu in één `parseCustomDeck()` in `config.js`,
  samen met de limieten 10/30/2 die daar volgens dat bestand zelf al hadden
  moeten staan.

- **De host verloor zijn rol aan wie het eerst terugverbond** — uit een echte
  log van 21 oktober: één blip haalde binnen dezelfde seconde alle telefoons
  én het presenter-scherm weg, en de room lag 61 seconden stil. Het
  30-seconden claim-venster (`masterGraceTimer`) ging af terwijl er niemand
  online was, vond niemand om de rol aan te geven en gaf hem op. Vanaf dat
  moment pakte de eerste telefoon die terugkwam de rol — en omdat dat ook
  `masterToken` overschrijft, was de echte host, drie seconden later terug mét
  die token, definitief gedegradeerd. Twee keer in één sessie. Het venster
  wordt nu opnieuw opgezet zolang er niemand is om aan over te dragen, zodat
  een reconnect-race niet meer bepaalt wie de sessie leidt. Het gat dat dat
  achterlaat is ook gedicht: loopt de stoel van een afwezige host alsnog af,
  dan gaat de rol direct naar de eerste verbonden achterblijver, net als bij
  een kick. Gereproduceerd, daarna opgelost, met drie regressietests in
  `tests/participantGrace.test.js` (via een geëxporteerde `runMasterHandover()`,
  zodat de echte 30 seconden niet uitgezeten hoeven te worden).
- **`[grace]` logde een socket-id in plaats van een naam** — `[disconnect]`
  toont al wie wegging, maar bij het verlopen van een stoel tien minuten later
  stond er alleen `eOw2bITUb4GNNe67AACw verwijderd uit room …`, wat betekende
  terugscrollen naar de bijbehorende `[connect]` om te zien wie dat was.

- **Presenter-scherm knipperde bij elke room-state** — gereproduceerd in een
  echte browser: `renderResults()` gooide de resultaatkaarten weg en bouwde ze
  opnieuw op bij *elke* `room-state`, en een nieuwe `.result-card` begint zijn
  `flipIn` op `opacity: 0`. Een rename, een join, een telefoon die
  terugverbindt — gebeurtenissen die niets aan de stemmen veranderen — lieten
  de hele grid dus uitdoven en terugklappen, gemeten 0,00 opacity gedurende
  twee frames en daarna een halve seconde animatie. Hoe meer mensen in de room,
  hoe meer van die room-states, vandaar dat het bij vier man opvalt. Drie dingen
  aangepast: de kaarten en de deelnemerslijst worden nu op hun id bijgewerkt in
  plaats van herbouwd, de flip hangt aan een klasse die de grid alleen bij een
  *verse* reveal krijgt (het reveal-theater zelf blijft dus, ook in ronde twee),
  en `watch-room` broadcast niet meer naar de hele room — een scherm bezit geen
  state, dus er viel niets te melden. Datzelfde herbouwen zat ook op het
  kaartdek van de deelnemers: elke stem van een teamgenoot verving je kaarten
  terwijl je ernaar reikte.
- **Deelnemerslijst verloor zijn eigen state** — door hetzelfde herbouwen
  verdween de kick-knop onder een hoverende muis (hij staat op `:hover`) en
  klapte een uitgeklapte chip op een telefoon dicht zodra iemand stemde.
- **Animaties op een groot scherm** — de drie drijvende, 80px geblurde orbs
  staan stil op het presenter-scherm: elke `.glass`-panel erboven heeft een
  `backdrop-filter`, en een bewegende achtergrond moet per frame voor elk
  paneel opnieuw geblurd worden. Verder respecteert de app nu
  `prefers-reduced-motion` voor alles wat oneindig doorloopt.
- **Stagger van de resultaatkaarten liep na tien kaarten dood** — tien
  handgeschreven `nth-child`-regels; kaart elf en verder klapten zonder
  vertraging in. De index gaat nu als custom property mee, afgetopt op 600ms.
- **Toeschouwer-voorkeur was globaal** — één `scrum_is_spectator` in
  localStorage volgde je naar de volgende room, en omdat de reconnect die waarde
  terugstuurt kon een blijven-hangen `true` de stem wissen die de grace-periode
  net had teruggegeven. Nu per room, net als het sessietoken.

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
- **Persoonlijke reconnect-grace** — een deelnemer die disconnect (bijv. scherm uit) wordt niet meer direct verwijderd, maar 10 minuten (override via `PARTICIPANT_GRACE_MINUTES`) als "afwezig" bewaard met stem/rol intact; reconnect herstelt de plek direct. SM kan een afwezige alsnog meteen kicken; master-overdracht naar een afwezige wordt geweigerd.
- **Identiteit via sessietoken** — herkennen op naam is vervangen door een 128-bits token per browser per room (`src/utils/sessionToken.js`). Dat sloot twee gaten tegelijk: twee mensen die "Jan" heetten werden als één persoon behandeld, en de SM-rol was over te nemen door simpelweg de naam van de SM in te typen.
- **Versienummer in het opties-scherm** — uit `package.json`, via `/api/config`.
- **Consensus-animatie bij unanieme stem** — confetti-burst (dependency-vrij, CSS+JS) wanneer alle stemmers exact hetzelfde kaartje kiezen; respecteert `prefers-reduced-motion`, vuurt precies één keer per reveal. Persoonlijke "no fun mode"-toggle in het opties-scherm (localStorage, per apparaat) om 'm uit te zetten.
- **Geen `join-room` meer bij elke tab-focus** — de `visibilitychange`-handler brengt alleen nog een gevallen verbinding omhoog. Zolang de socket verbonden is, heeft de server de stoel nog, dus viel er niets te herstellen. Het opnieuw joinen zit nu op één plek: `socket.on('connect')` in `room-page.js`, dat zowel de automatische reconnect als een handmatige `.connect()` afvangt — waar het oude `socket.io.on('reconnect')` alleen de eerste dekte.
- **Log laat nu zien of er geschat is** — `[reveal]` met aantal stemmers, `[reset]`, `[change-deck]` met dektype, en `[auto-reveal]` vanuit `applyAutoReveal()` zelf zodat alle vijf de aanroeppaden erin zitten. `[join]` toont hoeveel mensen er in de room zitten en `[disconnect]` toont de naam plus of het de SM was. Individuele stemmen worden bewust niet gelogd.
- **Socket alleen nog waar hij nodig is** — de indexpagina verbindt pas als je daadwerkelijk een room aanmaakt (`autoConnect: isRoomPage || isPresenterPage`), niet meer bij elke pageload. Scheelt een stroom connect/disconnect-paren in het log van bezoekers die alleen even kijken.
- **Presenter-scherm als eigen ingang** — een presenter-scherm is geen deelnemer meer maar een *display*: het joint met `watch-room`, komt in `room.displays` in plaats van `room.participants`, en valt daardoor automatisch buiten elke stemberekening. Het bedient de room wél (reveal, nieuwe ronde, deck, story-titel, auto-reveal) via één predicaat `canControlRoom()` — dat is immers de plek waar de facilitator staat. Nieuwe derde tab "Presenteer" opent een scherm voor een bestaande room op code. Meerdere schermen op één room mogen, want een display bezit geen state. De host is voortaan een gewone stemmer — wie niet wil stemmen zet zichzelf op spectator.
- **Room aanmaken vraagt waar je zelf meedoet** — "op mijn telefoon of ander apparaat" (standaard) maakt van dit scherm het presenter-scherm; "op dit apparaat" vraagt om een naam en zet je meteen in de room via `room.html?id=…&autojoin=1`. Een URL-parameter in plaats van een opgeslagen vlag, zodat hij niet kan blijven hangen en later op een onverwacht bezoek opnieuw afgaat.
- **Onbeheerde room leeft 30 minuten** — `RECONNECT_GRACE_PERIOD_MS` van 15 naar 30 minuten, en de timer start pas als er niets meer aan hangt: geen verbonden deelnemer én geen presenter-scherm. Een team dat gaat lunchen met het scherm aan raakt de room dus niet kwijt. `deleteRoom()` lichtte niemand in; `closeRoom()` stuurt nu eerst `room-closed` naar de schermen die nog kijken.
- **Presenter-indeling rechtgetrokken** (PR #27) — de QR klapte zichzelf dicht zodra iemand joinde, waarna een `:has()`-regel de hele zijkolom van 260px naar 180px kneep, inclusief de knoppen die daar toevallig ook stonden: scheve uitlijning, een overlopende deck-rij en een scrollbalk eronder. Kolommen liggen nu vast en worden expliciet geplaatst (een verborgen deelnemerspaneel schoof anders de kaarten in zijn baan). Deelnemers staan links en de bediening rechts, net als op de room-pagina.
- **Presenter-bediening geordend op hoe vaak je iets aanraakt** (PR #27) — reveal en nieuwe ronde staan in de header naast het tandwiel en blijven dus altijd op hun plek; auto-reveal en kaartdek verhuisden naar het optiesmenu (het dek wist alle stemmen, dat hoort niet naast de kaarten); de zijbalk houdt alleen nog de uitnodiging over en klapt met de hand helemaal weg. Niets vouwt zichzelf meer op op basis van het aantal deelnemers.
