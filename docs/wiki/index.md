# 🃏 Scrum Poker — Architecture & System Wiki

Welcome to the official technical wiki of **Scrum Poker**. This documentation details the internal system architecture, real-time communication flows, state management, and resilience mechanisms (such as Spectator Mode and session lifecycles) of the application.

---

## 📚 Wiki Pages & Diagrams

1. [**System Architecture & Components**](./architecture.md)  
   *High-level overview of the Node.js / Socket.IO backend, in-memory state store, and modular ES Module frontend.*
2. [**Room Lifecycle & State Transitions**](./lifecycle.md)  
   *How a room is created, transitions between voting and revealed phases, and gets cleaned up via the 15-minute empty grace period and 24-hour timers.*
3. [**Real-time Socket.IO Sequence Flows**](./socket-flows.md)  
   *Detailed socket interaction sequences between the Scrum Master, Voters, Spectators, and the Server during voting rounds and kick actions.*
4. [**Roles & Permissions (SM vs. Voter vs. Spectator)**](./roles.md)  
   *Permission matrix and detailed behavior of the progress bar, vote counting exclusions, and live role toggling.*
5. [**Complete Repository File Structure & Modules**](./file-structure.md)  
   *Exhaustive directory and file tree with module responsibilities and dependency graph across backend and frontend.*

---

## 🏗️ High-Level Architecture Overview

```mermaid
graph TD
    subgraph Clients["Frontend Clients (Browser / ES Modules)"]
        Landing["landing_page / main.js"]
        RoomUI["room-page.js (Controller)"]
        RenderUsers["render-users.js (Sidebar & Roles)"]
        RenderVoting["render-voting.js (Deck & Spectator Notice)"]
        RenderResults["render-results.js (Grid & Stats Analysis)"]
        I18n["i18n.js (NL / EN Translations)"]
        LocalStore["localStorage (name, lang, isSpectator)"]
    end

    subgraph Backend["Node.js / Express / Socket.IO Server"]
        RestApi["src/routes/api.js (REST: /api/rooms/:id, /qr, /health)"]
        ServerEntry["server.js / src/socket/index.js (Safe Dispatch + Rate Limiter: 35 req/s)"]
        RoomHandlers["roomHandlers.js (create, join, vote, toggle-spectator, claim/transfer-master)"]
        SMHandlers["smHandlers.js (reveal, reset, change-deck, update-story)"]
        ConnHandlers["connectionHandlers.js (kick-user, 10m participant grace, 15m empty-room grace)"]
        Broadcast["broadcast.js (broadcastRoomState, 24h Cleanup)"]
        RoomsStore["src/store/rooms.js (Null-Prototype Rooms Dictionary & sanitizeRoom)"]
    end

    Landing -->|"REST: verify room code"| RestApi
    Landing -->|"Socket: create / join"| ServerEntry
    RoomUI -->|"REST: QR code / room info"| RestApi
    RoomUI -->|"Socket Events"| ServerEntry
    RoomUI --- RenderUsers & RenderVoting & RenderResults
    RoomUI -.- LocalStore & I18n

    RestApi -->|"read-only lookup"| RoomsStore
    ServerEntry --> RoomHandlers & SMHandlers & ConnHandlers
    RoomHandlers & SMHandlers & ConnHandlers --> RoomsStore
    RoomHandlers & SMHandlers & ConnHandlers --> Broadcast
    Broadcast -->|"room-state (sanitized per viewer)"| RoomUI
```
