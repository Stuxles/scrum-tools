# 🏛️ System Architecture & Components

The Scrum Poker application is built around a **Zero-Latency In-Memory Architecture**. By eliminating external database bottlenecks (such as SQL or MongoDB) in the hot-path of real-time voting rounds, the application achieves instantaneous responsiveness and runs effortlessly on lightweight hardware, Docker, or Unraid instances via a single Node.js process.

---

## 🧩 Modular Frontend (ES Modules)

The frontend relies entirely on **native ES Modules (`type="module"`)** and browser DOM APIs without any heavy external UI frameworks (like React or Vue). This guarantees zero bundler overhead, instant cold starts, and maximum flexibility.

```mermaid
graph LR
    subgraph Core["Entrypoints"]
        Main["public/js/main.js (Global Socket Init)"]
        IndexPage["public/js/pages/index-page.js (Landing Controller)"]
        RoomPage["public/js/room/room-page.js (Room Coordinator)"]
    end

    subgraph Renderers["Room View Renderers"]
        RUsers["render-users.js (Sidebar Participants, Status Icons, SM Kick Button)"]
        RVoting["render-voting.js (Card Deck Generation, Vote Deselection Logic, Spectator Notice)"]
        RResults["render-results.js (Revealed Cards Grid, Auto Score Analysis, Average, Median, Bar Chart)"]
    end

    subgraph Utilities["Shared Utilities & State"]
        I18n["utils/i18n.js (Bilingual EN/NL Dictionary, DOM Auto-Translator)"]
        Helpers["utils/helpers.js (escHtml XSS Prevention, LocalStorage Sync)"]
        Toast["utils/toast.js (Dynamic Alert Notifications)"]
        QR["room/qr-module.js (Full-Screen QR Modal)"]
    end

    RoomPage --> RUsers & RVoting & RResults & QR
    IndexPage & RoomPage --> I18n & Helpers & Toast
```

---

## 🔒 Security & Data Filtering (`sanitizeRoom`)

A fundamental security principle in the backend is that **unrevealed votes must never leak across client packets**. Even if a user opens browser dev tools or connects via a custom script, the server strictly filters out all real vote values from other participants while the room is unrevealed (`room.revealed === false`).

```mermaid
flowchart TD
    RawStore["In-Memory Room Object (room.participants = id, name, vote: 13, isSpectator: false)"]
    
    SanitizeCall["sanitizeRoom(room, viewerSocketId)"]
    RawStore --> SanitizeCall

    CheckRevealed{"Is room.revealed == true OR p.id == viewerSocketId?"}
    SanitizeCall --> CheckRevealed

    CheckRevealed -->|YES| ShowVote["vote: p.vote (e.g., 13)"]
    CheckRevealed -->|NO| MaskVote["vote: null (Only hasVoted: true or false is sent)"]

    ShowVote & MaskVote --> ClientPacket["Sanitized Payload emitted to viewer socket"]
```

---

## 🛡️ Rate Limiting & Denial of Service Protection

To guard against rogue clients or scripts flooding the server with thousands of socket emissions per second, the Socket.IO connection pipeline includes a **per-socket token-bucket rate limiter** (`src/socket/index.js`).

```javascript
// Maximum 35 events per second per socket connection
let eventCount = 0;
let lastReset  = Date.now();

socket.use((_packet, next) => {
  const now = Date.now();
  if (now - lastReset > 1000) { eventCount = 0; lastReset = now; }
  if (++eventCount > 35) {
    socket.emit('error', { message: 'Too many actions. Please wait a second.' });
    return;
  }
  next();
});
```

---

## 🧯 Malformed Input & Crash Hardening

Beyond rate limiting, every inbound socket event passes through a **safe dispatch layer** (`src/socket/index.js`) so that a single malformed message from any client can never throw an uncaught exception and crash the Node process (which would wipe **every** active room, not just the offender's).

- **Payload defaulting** — a missing or `null` event payload is coerced to `{}` before it reaches a handler, so destructuring `{ roomId }` never throws.
- **Error isolation** — each handler runs inside a `try/catch`; a thrown error is logged server-side and a generic error toast is returned to the offending socket instead of propagating.
- **Prototype-safe store** — the rooms dictionary is created with `Object.create(null)` (`src/store/rooms.js`), so attacker-supplied room IDs such as `__proto__` or `constructor` resolve to `undefined` rather than a truthy prototype value that would slip past the `if (!room)` guard.
- **Canonical room IDs** — every handler normalizes the client-supplied `roomId` (trim + uppercase) via `normalizeRoomId()` (`src/utils/roomId.js`), removing silent no-ops from case differences and narrowing the lookup surface.

```javascript
// src/socket/index.js — safe dispatch wrapper wired to every event
const on = (event, handler) => {
  socket.on(event, (data = {}) => {
    try {
      handler(data || {});
    } catch (err) {
      console.error(`[handler:${event}] ${socket.id}`, err);
      socket.emit('error', { message: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });
};
```

> These guarantees are locked in by the `tests/robustness.test.js` suite, which fires every event with missing, `null`, and prototype-key payloads and asserts the server stays alive.
