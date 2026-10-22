# 📋 TODO / Ideas

Backlog of ideas and improvements from the codebase reviews.
**Sorted by priority:** features by value first, then technical maintenance,
and within each block the heaviest on top. Every item states its own priority
and why. Completed items are at the bottom.

> The seven points from the audit of 22 October 2026 are fixed and listed at
> the bottom under **Done**. So are the four bugs from the review of
> 3 September 2026 before it, each with a regression test in
> `tests/bugfixes.test.js`.

---

## 🎯 Features

### 1. Round history + export
**Value: high.** Today every "new round" wipes the results without keeping
anything. A team that estimates 10 stories has nothing to show afterwards.

- Log per round: `storyTitle`, individual votes, average/median, timestamp.
- Visible in a panel or modal for the Scrum Master.
- A "Copy as Markdown" / "Download as CSV" button, for the sprint notes.
- Builds directly on the existing `storyTitle` feature.
- Watch out: keeping history in memory per room means it disappears on a
  restart (see #6).

### 2. Consensus and outlier indication
**Value: high.** The stats show average/median/distribution, but not the thing
a facilitator actually needs: *is there disagreement?*

- Say it outright: "everyone agrees" versus "wide spread — discuss this".
- Mark the min/max outliers in the results grid.
- Note: the i18n keys `stat-consensus`, `stat-most-picked` and
  `stat-total-votes` were once meant for this but never used; they have since
  been cleaned up and will have to be added again if this gets built.

### 3. Per-round timer
**Value: medium.** The classic planning-poker feature for keeping discussions
short.

- An optional countdown the SM starts, visible to everyone.
- Possibly auto-reveal at 0 (combines with auto-reveal).

### 4. Make it installable as a PWA
**Value: medium.** It fits how the app is actually used: voting from your phone
while the presenter screen is on the TV. It gives you an icon on the home
screen and a standalone view with no browser chrome — which saves screen space
on a phone — and the wake lock (`requestWakeLock()` in
`public/js/utils/helpers.js`) is already there.

**What it does not buy you: working offline.** This is a real-time app; with no
connection there is nothing meaningful to show. So the service worker caches
only the app shell (HTML/CSS/JS), never room state.

**Needed:**
- `public/manifest.webmanifest` plus real PNG icons (192 and 512). The current
  favicon is an inline SVG data URI in the `<head>` of `index.html`,
  `room.html` and `presenter.html` — fine as a tab icon, not enough to be
  installable. For iOS, an `apple-touch-icon` as well.
- Write the service worker by hand, no Workbox: this repo hand-rolls small
  utilities rather than pulling in a package (see `CLAUDE.md`).

**The main trap — cache versus version number.** `/api/config` feeds the
version number in the options modal. A service worker that caches the shell
serves the old JS/HTML after a deploy while `/api/config` already reports the
new version. That is exactly the "the version goes stale" failure `CLAUDE.md`
warns about, only through the cache instead of through a missed version bump.
- Never cache `/api/*` or Socket.IO traffic.
- Name the shell cache after `APP_VERSION`, so a new version invalidates the
  old cache by itself.

**HTTPS is a hard requirement.** Service workers only run in a secure context.
The deployment on a public domain qualifies; reaching it on the LAN address
(`http://192.168.x.x:3000`) does not. The README sells LAN use as a feature,
and `copyToClipboard()` already has an explicit fallback for insecure contexts
— so installability is a bonus for the HTTPS deployment, not a replacement for
the LAN route.

**Things to watch:**
- `start_url` becomes `/`. Joining happens through a QR code or a link, and
  those open the browser, not the installed app. Launch it standalone and you
  land on the home page and have to type the room code. Decide whether that is
  acceptable, or whether a `share_target`/deeplink solution is needed.
- iOS has limited PWA support; in standalone mode the socket can die when
  backgrounded. That falls under the existing re-join path on
  `socket.on('connect')` in `public/js/room/room-page.js`.
- Docker needs no change: `COPY public ./public` is already in the
  `Dockerfile`, so the manifest, service worker and icons come along.

---

## 🔧 Technical

### 5. No ceiling on rooms or participants
**Priority: depends on exposure.** Harmless on a LAN with your own team; behind
the nginx setup from the README, on a public domain, this is the only thing
left that can take the server down.

- `create-room` asks for nothing: no name, no login, no existing room. Since
  the audit, a room nobody joins lives 30 minutes instead of 24 hours, but a
  stream of messages can still hold a full grace window's worth of rooms. The
  `shortcut:` comment on `scheduleEmptyRoomCleanup()` in
  `src/utils/broadcast.js` names exactly this.
- There is no ceiling on participants per room either. Less urgent: that needs
  the room code, and the code space is 32^6.
- If this gets picked up: count per IP, not one global maximum — a global
  maximum lets a single visitor lock everyone else out. The socket limiter
  (35/s) does not help here, because it counts per socket and a client simply
  opens more of them.
- `CORS_ORIGIN` defaults to `*`, so any web page at all can do this from a team
  member's browser too.

### 6. State does not survive a restart
**Value: depends on use.** Everything is in memory, so every Docker redeploy
wipes active sessions.

- Option: a periodic JSON snapshot to disk, read back on startup.
- **Deliberate trade-off:** the README sells "no database needed" as a feature.
  Only pick this up if it actually gets in the way in practice.

### 7. Test coverage for voting itself
**Priority: low** — the gap that let the card-deck bug through is closed
(`tests/bugfixes.test.js` now covers every deck type, custom decks, an unknown
deck type and the lower bound of 2 cards). What is still not tested on its own:

- `handleVote` — a card that is not in the deck is ignored, voting after a
  reveal does nothing, and clicking the same card again clears the vote.
- `handleToggleSpectator` — the vote is cleared when switching to spectator,
  and the remaining voters may be complete because of it.
- These paths go through `applyAutoReveal()` and so share the predicate that
  bug 2 corrected; right now they are only covered indirectly.

### 8. Small inconsistencies from the flicker review
**Priority: low.** None of this is visible to a user today, but these are
places where two pieces of code disagree with each other.

- **The role "Scrum Master" is hardcoded in `render-users.js`.** Next to
  `role-spectator` and `role-participant`, which go through `t()` properly.
  There is no `role-master` key; that has to be added in both languages first.
- **The REST endpoints do not normalize the room code.** `/api/rooms/:id` and
  `/api/rooms/:id/qr` do `rooms[req.params.id]` directly, where every socket
  handler calls `normalizeRoomId()` first. Harmless today, because `main.js`
  always uppercases the code from the URL; call the endpoint directly in
  lowercase and you get a 404 on a room that does exist.
- **`#header-spectator-btn` is not in the header.** It moved to the options
  modal but kept its name, which points the wrong way when you go looking for
  the button (and when writing a test).

### 9. Clean up dead i18n keys and CSS
**Priority: low.** Pure maintenance, no visible effect.

- Unused i18n keys (present in both languages, called nowhere):
  `footer-text`, `voting-phase-waiting`, `btn-switch-to-spectator`,
  `story-btn-edit`, `claim-sm-btn`, `transfer-sm-btn`, `toast-sm-claimed`,
  `toast-sm-transferred`, `options-theme-btn`.
- **Not** dead, though this list said they were until 22 October 2026:
  `toast-rate-limit`, `toast-server-full`, `toast-generic-error` and
  `toast-room-not-found-generic`. All four are called by
  `translateServerMsg()` at the bottom of `i18n.js`, which is the one place
  that resolves a key the page never names. Delete them and `t()` falls back
  to returning the key, so an error toast would read `toast-rate-limit` at
  the user. Grep `i18n.js` itself before removing anything from the list
  above, not just the pages.
- Unused CSS classes: `badge`, `badge-amber`, `badge-green`, `badge-purple`,
  `field-row`, `my-name-btn`, `spinner`, `sr-only`, `waiting-overlay`.
- Good news from the same sweep: `nl` and `en` both have exactly 169 keys and
  have not drifted apart, and every `getElementById` in the frontend has an
  element that exists. No duplicate ids on any page.

### 10. The error strings the server sends are still Dutch
**Priority: low.** Deliberately left when the logs were translated on
22 October 2026. Nothing is broken; this is about the seam being fragile
rather than about the language.

These are the messages in `socket.emit('error', { message })` and the `error`
field of a REST response — not log output, which is English now.
`translateServerMsg()` in `public/js/utils/i18n.js` matches them by
**substring** to pick an i18n key, so the Dutch text is a source string for
the bilingual UI rather than something a user reads raw.

- The fragile part: reword one of those strings in `src/` and its matcher
  stops matching silently. The toast then shows the raw Dutch to an English
  user, and nothing fails. There is no test that pins a server string to its
  key.
- Four of the five matchers already accept an English variant next to the
  Dutch one (`Too many actions`, `Could not generate`, `does not exist`,
  `Something went wrong`), so most of the groundwork for switching the source
  strings to English is already there. Only `Voer minimaal 2 kaarten in` has
  no English alternative.
- If this is picked up, the two halves have to move together: the strings in
  `src/` and the matchers in `translateServerMsg()`. Five assertions across
  four test files match on the Dutch as well — `tests/api.test.js` (×2),
  `tests/bugfixes.test.js`, `tests/presenter.test.js` and
  `tests/socketRateLimit.test.js`.
- Worth considering instead of translating: send a key rather than a sentence
  (`{ error: 'room-not-found' }`) and let the client look it up. That removes
  the substring matching altogether, which is the actual weak point, and is
  roughly the same amount of work.

### 11. Presenter screen: reveal theatre and a large-screen test
**Priority: low.** Two things left over after the code review of the presenter
screen, neither of them a bug.

- **No face-down cards while voting.** `presenter.html` currently shows only a
  progress bar until the reveal. Classic planning-poker screens show a
  face-down card per participant that flips over on reveal — which makes the
  moment itself more theatrical. It would want a `presenter-page.js` +
  `render-voting.js`-style component, with a flip animation on
  `#results-cards-grid` the way `render-results.js` already partly has
  (`flipIn`, switched on by the `is-flipping-in` class the grid gets on a fresh
  reveal).
- **Never tested on a real 1920×1080 screen.** Only 1100×800, 1500×850 and
  1600×900 verified in the browser pane. The result cards have a `clamp()`
  upper bound of 132px wide (`public/style.css`,
  `.presenter-page .result-card-face`) — on a bigger or more distant TV they
  may look relatively small. Raise the bound, or scale on `vw` instead of a
  fixed ceiling, after an actual test on such a screen.
- **Empty column on an empty room.** The participants column gets `hidden`
  while nobody is there, but keeps its track in the grid. Deliberate: nothing
  jumps when the first participant arrives. Only worth addressing if that empty
  strip actually bothers someone.

---

## ✅ Done

### The seven points from the audit of 22 October 2026

Audit of the whole repo (PR #30). Four bugs, then the duplication that had let
two of them through. The four bugs were reproduced against real sockets first
and re-run afterwards; six new tests, 143 → 149.

- ✅ **An abandoned room stayed in memory for 24 hours.** The 30-minute timer
  already existed, but was only ever armed on a disconnect — and a room nobody
  joins has nobody to leave it. So a room that was created and then abandoned
  fell through to the 24-hour cleanup. `create-room` asks for no authentication
  whatsoever, which made that a day of memory per message. The timer and its
  `isRoomUnattended()` now live in `utils/broadcast.js`, next to the other two
  room timers, and `handleCreateRoom` arms it; joining or pointing a screen at
  the room already cleared it. The residual risk is marked `shortcut:` in the
  code and listed as #5 above.
- ✅ **Opening the room in a second tab told the first one it had been
  kicked.** The reconnect token lives in localStorage, which every tab of one
  browser shares. The token-collision path is therefore reached far more often
  by a second tab than by the flaky reconnect it was written for. The seat
  moving across is correct; the red "you have been removed from the room"
  (`toast-kicked`) was not. That path now sends `reason: 'superseded'` and the
  client shows a neutral notice. A real kick still sends no reason and reads
  exactly as before.
- ✅ **A custom card named `toString` broke the whole distribution chart.**
  Card values are keys in the tally, and on a plain `{}` `dist['toString'] || 0`
  finds the inherited function instead of 0. The count becomes a string,
  `Math.max` over the values becomes `NaN`, and that sized *every* bar, not
  just that one. A card called `__proto__` disappeared from the chart
  altogether instead. Both tallies are now `Object.create(null)`, as
  `src/store/rooms.js` already was.
- ✅ **`update-name` tripped over a name that was not text.**
  `(name || '').trim()` coerces nothing, so `{ name: 42 }` threw a `TypeError`
  that the safe dispatch turned into "something went wrong". `cleanText()` is
  now exported and used by both `update-name` and `update-story-title`: three
  spellings of one rule reduced to one.
- ✅ **The rule for who a round is waiting on existed twice**, once per side,
  both carrying a comment saying the two had to stay in agreement. That is
  precisely how the offline check once ended up in only one of them. The server
  copy is gone: `autoReveal.js` imports `eligibleVoters()` from
  `public/js/utils/stats.js`, the way `config.js` already imported from
  `public/`.
- ✅ **Disconnect walked the room list twice**, once for screens and once for
  seats. One pass now, with `Set.delete` doubling as the test for whether the
  socket was a screen at all. With a test for the one case that could have
  broken: a socket that is both a screen and a seat.
- ✅ **Unused import** (`releaseWakeLock` in `room-page.js`) removed.

### The four bugs from the review of 3 September 2026

All four reproduced first, then fixed, and pinned down with 13 regression tests
in `tests/bugfixes.test.js`.

- ✅ **A custom card deck was ignored when creating a room.** `DECKS` has no
  `custom` key — that is a marker for "use the cards in this payload" — but
  `handleCreateRoom` did the `DECKS` lookup before testing for `custom`, and so
  rewrote `custom` to `standard`. The cards you entered vanished without a
  word. Now in the same order as `handleChangeDeck`, which always did it right;
  hence it did work through **Change deck**.
- ✅ **An offline participant blocked auto-reveal and the progress counter.**
  `eligibleVoters()` filtered on spectator but not on connection, so a phone
  that locked its screen held the round up for ten minutes. The predicate is
  now: not a spectator, and not offline-without-a-vote. Someone who voted and
  *then* dropped off still counts — their vote belongs to the round. The
  frontend rebuilt that same filter by hand in four places; those now share one
  `eligibleVoters()` in `public/js/utils/stats.js`, so the bar and the reveal
  can no longer contradict each other. The dead `applyAutoReveal()` call in
  `handleDisconnect` was restored at the same time: it could never live up to
  its own comment.
- ✅ **Kicking the host left the room without one.** `handleKickUser` left
  `masterId` pointing at a deleted seat and `masterToken` on the person just
  kicked — so they got the role straight back on rejoining. A kick is
  deliberate and final, so unlike a disconnect it gets no grace period: the
  role goes straight to the first connected survivor, or is cleared if there is
  nobody left.
- ✅ **The presenter screen was allowed to kick but had no button for it.** The
  server permitted it and `roles.md` promised it; only `presenter-page.js`
  passed a hard `false` as `isMaster`. `renderParticipants()` now takes two
  separate capabilities (`canKick`, `canTransfer`) instead of one flag, because
  the two callers do not have the same rights: `sm-transfer-master` requires
  the sender to hold the seat being handed over, and a screen holds none. One
  boolean could only ever be wrong in one direction or the other.

### Earlier

- **The version bump could accidentally do a major bump** — the pattern
  `'^[a-zA-Z]+(\([^)]*\))?!:|BREAKING CHANGE'` reads in ERE as
  *`^…!:` or `BREAKING CHANGE` anywhere*, because `|` binds loosest. The bare
  words were therefore matched on every line of every commit body: a commit
  that merely mentioned them ("this is explicitly not a BREAKING CHANGE"), or a
  docs commit explaining the convention, jumped from 1.6.1 to 2.0.0. Both
  alternatives are anchored now and the footer requires its colon
  (`BREAKING-CHANGE:` is the synonym the spec allows). Worked through eight
  commit shapes before it went out.
- **A custom deck accepted duplicate cards** — `['5', '5', '8']` produced two
  buttons with the same `data-val`, and because `selectVoteCard()` matches on
  the value, one click lit up both. Now deduped at the door, before the lower
  bound of 2 is checked, so a deck of one card twice is rejected properly. That
  validation was written out twice, by the way (create and change) — exactly
  the pair that had already drifted apart once — and now lives in a single
  `parseCustomDeck()` in `config.js`, together with the 10/30/2 limits that by
  that file's own account should have been there all along.

- **The host lost the role to whoever reconnected first** — from a real log of
  21 October: one blip took out every phone *and* the presenter screen within
  the same second, and the room sat still for 61 seconds. The 30-second claim
  window (`masterGraceTimer`) fired while nobody was online, found nobody to
  hand the role to, and gave it up. From that moment the first phone back took
  the role — and because that also overwrites `masterToken`, the real host,
  back three seconds later holding that token, was demoted for good. Twice in
  one session. The window is now re-armed as long as there is nobody to hand
  over to, so a reconnect race no longer decides who runs the session. The gap
  that leaves is closed too: if an absent host's seat does expire, the role
  goes straight to the first connected survivor, same as on a kick. Reproduced,
  then fixed, with three regression tests in `tests/participantGrace.test.js`
  (through an exported `runMasterHandover()`, so the real 30 seconds need not
  be waited out).
- **`[grace]` logged a socket id instead of a name** — `[disconnect]` already
  shows who left, but when a seat expired ten minutes later all it said was
  `eOw2bITUb4GNNe67AACw verwijderd uit room …`, which meant scrolling back to
  the matching `[connect]` to work out who that was.

- **The presenter screen blinked on every room-state** — reproduced in a real
  browser: `renderResults()` threw the result cards away and rebuilt them on
  *every* `room-state`, and a new `.result-card` starts its `flipIn` at
  `opacity: 0`. A rename, a join, a phone reconnecting — events that change
  nothing about the votes — made the whole grid fade out and flip back in,
  measured at 0.00 opacity for two frames followed by half a second of
  animation. The more people in the room, the more of those room-states, which
  is why it stands out at four people. Three things changed: the cards and the
  participants list are now updated by id instead of rebuilt, the flip hangs on
  a class the grid only gets on a *fresh* reveal (so the reveal theatre itself
  survives, round two included), and `watch-room` no longer broadcasts to the
  whole room — a screen owns no state, so there was nothing to report. That
  same rebuilding was on the participants' card deck too: every vote by a
  teammate replaced your cards while you were reaching for them.
- **The participants list lost its own state** — through the same rebuilding,
  the kick button vanished from under a hovering mouse (it is on `:hover`) and
  an expanded chip on a phone snapped shut as soon as anyone voted.
- **Animations on a large screen** — the three drifting, 80px-blurred orbs are
  held still on the presenter screen: every `.glass` panel above them has a
  `backdrop-filter`, and a moving background has to be re-blurred for each
  panel every frame. Beyond that, the app now respects `prefers-reduced-motion`
  for everything that loops forever.
- **The result cards' stagger died after ten cards** — ten hand-written
  `nth-child` rules; card eleven and beyond flipped in with no delay at all.
  The index now travels as a custom property, capped at 600ms.
- **The spectator preference was global** — one `scrum_is_spectator` in
  localStorage followed you into the next room, and because the reconnect
  replays that value, a stale `true` could wipe the vote the grace period had
  just handed back. Now per room, like the session token.

- **Socket hardening** — safe dispatch, null-prototype store,
  `normalizeRoomId()` (PR #5).
- **Dependency updates** — express 5, supertest 7 (PR #6).
- **Documentation and diagram corrections** (PR #7).
- **Participant buttons on hover only**, with a touch fallback (PR #8).
- **CI runs the test suite** on Node 26, and blocks the Docker build on a
  failure.
- **Everything on the latest versions** — Node 26 (Dockerfile, CI, `engines`),
  `actions/setup-node@v7`.
- **Dead i18n keys cleaned up** (`stat-consensus`, `stat-most-picked`,
  `stat-total-votes`).
- **Auto-reveal** — optionally reveal automatically once everyone has voted.
- **Rate limiting on the REST endpoints** — per-IP limiter (60 req/min) on
  `/api/*`; `/health` stays exempt so the Docker healthcheck is never hit.
- **Better room-code alphabet** — Crockford Base32 (32 characters, no I/L/O/U),
  crypto-random with no modulo bias, ~64x more combinations than the old
  hex-only alphabet. The `uuid` dependency is no longer needed and was removed.
- **Frontend tests** — `computeVoteStats` (out of `render-results.js`),
  `escHtml`, `generateRoomId`/`normalizeRoomId` and the rate limiter are now
  all tested on their own as pure functions (no jsdom needed).
- **Personal reconnect grace** — a participant who disconnects (screen off, for
  instance) is no longer removed immediately, but kept as "away" for 10 minutes
  (override with `PARTICIPANT_GRACE_MINUTES`) with vote and role intact;
  reconnecting restores the seat at once. The SM can still kick an away
  participant immediately; transferring master to an away participant is
  refused.
- **Identity through a session token** — recognising people by name was
  replaced by a 128-bit token per browser per room
  (`src/utils/sessionToken.js`). That closed two holes at once: two people
  called "Jan" were treated as one person, and the SM role could be taken over
  by simply typing the SM's name.
- **Version number in the options modal** — from `package.json`, via
  `/api/config`.
- **Consensus animation on a unanimous vote** — a confetti burst
  (dependency-free, CSS+JS) when every voter picks exactly the same card;
  respects `prefers-reduced-motion` and fires exactly once per reveal. A
  personal "no fun mode" toggle in the options modal (localStorage, per device)
  turns it off.
- **No more `join-room` on every tab focus** — the `visibilitychange` handler
  now only brings a dropped connection back up. While the socket is connected
  the server still holds the seat, so there was nothing to restore. Re-joining
  lives in one place now: `socket.on('connect')` in `room-page.js`, which
  catches both the automatic reconnect and a manual `.connect()` — where the
  old `socket.io.on('reconnect')` covered only the first.
- **The log now shows whether anything was estimated** — `[reveal]` with the
  number of voters, `[reset]`, `[change-deck]` with the deck type, and
  `[auto-reveal]` from `applyAutoReveal()` itself so all five call paths are
  covered. `[join]` shows how many people are in the room and `[disconnect]`
  shows the name plus whether it was the SM. Individual votes are deliberately
  not logged.
- **A socket only where one is needed** — the index page connects only when you
  actually create a room (`autoConnect: isRoomPage || isPresenterPage`), no
  longer on every page load. Saves a stream of connect/disconnect pairs in the
  log from visitors who only had a look.
- **The presenter screen as its own entry point** — a presenter screen is no
  longer a participant but a *display*: it joins with `watch-room`, lands in
  `room.displays` instead of `room.participants`, and so falls outside every
  vote calculation automatically. It does drive the room (reveal, new round,
  deck, story title, auto-reveal) through one predicate, `canControlRoom()` —
  that is where the facilitator stands, after all. A new third tab, "Present",
  opens a screen for an existing room by code. Several screens on one room are
  fine, because a display owns no state. The host is an ordinary voter from now
  on — anyone who does not want to vote switches themselves to spectator.
- **Creating a room asks where you are taking part** — "on my phone or another
  device" (the default) turns this screen into the presenter screen; "on this
  device" asks for a name and seats you straight away through
  `room.html?id=…&autojoin=1`. A URL parameter rather than a stored flag, so it
  cannot linger and fire again on an unrelated visit later.
- **An unattended room lives 30 minutes** — `RECONNECT_GRACE_PERIOD_MS` from 15
  to 30 minutes, and the timer only starts once nothing is attached any more:
  no connected participant *and* no presenter screen. So a team going to lunch
  with the screen still up does not lose the room. `deleteRoom()` told nobody;
  `closeRoom()` now sends `room-closed` to the screens still watching first.
- **Presenter layout straightened out** (PR #27) — the QR folded itself away as
  soon as anyone joined, after which a `:has()` rule squeezed the entire side
  column from 260px to 180px, including the buttons that happened to live there
  too: crooked alignment, an overflowing deck row and a scrollbar underneath.
  The columns are fixed now and placed explicitly (a hidden participants panel
  otherwise pushed the cards into its track). Participants on the left and the
  controls on the right, same as on the room page.
- **Presenter controls ordered by how often you touch them** (PR #27) — reveal
  and new round sit in the header next to the gear and so always stay put;
  auto-reveal and the card deck moved into the options modal (changing the deck
  wipes every vote, which does not belong next to the cards); the sidebar keeps
  only the invitation and folds away entirely by hand. Nothing collapses itself
  based on the number of participants any more.
