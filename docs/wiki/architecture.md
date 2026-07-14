# 🏛️ System Architecture & Components

The Scrum Poker application is built around a **Zero-Latency In-Memory Architecture**. By eliminating external database bottlenecks (such as SQL or MongoDB) in the hot-path of real-time voting rounds, the application achieves instantaneous responsiveness and runs effortlessly on lightweight hardware, Docker, or Unraid instances via a single Node.js process.

---

## 🧩 Modular Frontend (ES Modules)

The frontend relies entirely on **native ES Modules (`type="module"`)** and browser DOM APIs without any heavy external UI frameworks (like React or Vue). This guarantees zero bundler overhead, instant cold starts, and maximum flexibility.

```mermaid
graph LR
    subgraph Core["Entrypoints"]
        Main["public/js/main.js<br/>(Global Socket Init)"]
        IndexPage["public/js/pages/index-page.js<br/>(Landing Controller)"]
        RoomPage["public/js/room/room-page.js<br/>(Room Coordinator)"]
    end

    subgraph Renderers["Room View Renderers"]
        RUsers["render-users.js<br/>• Sidebar Participants<br/>• Status Icons (👑, 🖥️, 👁️, ✓)<br/>• SM Kick Button"]
        RVoting["render-voting.js<br/>• Card Deck Generation<br/>• Vote Deselection Logic<br/>• Spectator Notice Banner"]
        RResults["render-results.js<br/>• Revealed Cards Grid<br/>• Auto Score Analysis<br/>• Average, Median & Bar Chart"]
    end

    subgraph Utilities["Shared Utilities & State"]
        I18n["utils/i18n.js<br/>• Bilingual EN/NL Dictionary<br/>• DOM Auto-Translator"]
        Helpers["utils/helpers.js<br/>• escHtml (XSS Prevention)<br/>• LocalStorage Sync"]
        Toast["utils/toast.js<br/>• Dynamic Alert Notifications"]
        QR["room/qr-module.js<br/>• Full-Screen QR Modal"]
    end

    RoomPage --> RUsers & RVoting & RResults & QR
    IndexPage & RoomPage --> I18n & Helpers & Toast
```

---

## 🔒 Security & Data Filtering (`sanitizeRoom`)

A fundamental security principle in the backend is that **unrevealed votes must never leak across client packets**. Even if a user opens browser dev tools or connects via a custom script, the server strictly filters out all real vote values from other participants while the room is unrevealed (`room.revealed === false`).

```mermaid
flowchart TD
    RawStore[("In-Memory Room Object<br/>room.participants = { id, name, vote: '13', isSpectator: false }")]
    
    SanitizeCall["sanitizeRoom(room, viewerSocketId)"]
    RawStore --> SanitizeCall

    CheckRevealed{"Is room.revealed == true<br/>OR<br/>p.id == viewerSocketId?"}
    SanitizeCall --> CheckRevealed

    CheckRevealed -->|YES| ShowVote["vote: p.vote (e.g., '13')"]
    CheckRevealed -->|NO| MaskVote["vote: null<br/>(Only hasVoted: true/false is sent)"]

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
