# 🃏 Scrum Poker

A modern, interactive, and real-time **Scrum Poker web application** designed for seamless collaboration among Agile development teams. Specially optimized for local network use, hybrid meetings, and quick mobile participation via QR codes.

> **💡 Centralized Application Name:**  
> The application name is defined in **one single place**: `public/js/config.js` (`export const APP_NAME = 'Scrum Poker';`). If you ever wish to rename the app in the future, simply update `APP_NAME` in that file or via the `APP_NAME` environment variable, and all UI titles, headers, brand icons, console logs, and API endpoints will update automatically!

---

## ✨ Features & Highlights

- **⚡ Real-Time Collaboration**: Instant updates powered by **Socket.IO**. No polling, zero latency.
- **📺 Dedicated Presenter Screen**: Put the session on a TV or projector without taking a seat in it. Creating a room opens a presenter screen straight away — it shows the room code, a large QR code, live progress and the results, and you can reveal, start a new round and change the deck right from it. It is **not** a participant, so it never appears in the list, never blocks a vote and never skews the average. Meanwhile you join from your own phone and estimate like everyone else. Already have a room? The **Present** tab opens a screen for it by code, and several screens on one room are fine (handy for hybrid meetings).
- **📱 QR-Code Join & Zoom**: The presenter screen shows a live QR code permanently; the host has one on their dashboard too, which opens a **full-screen modal** suitable for large displays. Team members scan it with their smartphone camera to join the exact room instantly!
- **🃏 Configurable Card Decks**:
  - **Standard**: `0, 1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 40, ♾️, ❓, ☕`
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ❓, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ❓, ☕`
  - **Custom**: Enter your own custom card values dynamically during the session.
- **🌐 Bilingual UI (EN 🇬🇧 / NL 🇳🇱)**: Fully multilingual interface with instant language switching (no page reloads required) across the home page and inside poker rooms.
- **🔋 Smart Mobile & Power Management**:
  - **Screen Wake Lock API**: Automatically prevents smartphone screens from turning off or going into standby during an active planning session.
  - **Auto-Reconnect & Rejoin**: Switched momentarily to another app (like Slack or WhatsApp) or suffered a brief Wi-Fi drop? When returning to the browser tab, the application automatically reconnects and re-joins the active round.
  - **Card Deselection**: Click an already selected card again to easily deselect or change your vote prior to the reveal.
- **👑 Facilitator Controls** — from the presenter screen *and* from the host's own device:
  - Progress bar with live voting status (*e.g., 4/5 voted*).
  - **Reveal** (one-time action per round to prevent accidental double-clicks).
  - **New Round / Reset** (clears votes for all participants).
  - Deck changes, the current ticket title and auto-reveal.
  - Participant management (kick members, or hand the host role to someone else).
  - The host is an **ordinary voter**: running the session no longer means sitting it out. Don't want to estimate? Toggle spectator, same as anyone else.
- **🪶 Lightweight & Fast**: No database required! State is kept in-memory with automatic cleanup timers (`disconnectTimer`) for inactive rooms.
- **🛡️ Hardened & Resilient**: Per-socket rate limiting (35 events/s) and a two-layer REST rate limiter (a 300/min per-IP ceiling plus a 120/min per-room budget, so a shared office connection or reverse proxy doesn't collapse everyone into one bucket) plus a safe-dispatch layer that defaults missing payloads, isolates handler errors, and rejects prototype-polluting room IDs — a single malformed client message can never crash the server.

---

## 🚀 Quick Start (Local / Node.js)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v26 or higher)
- npm

### 2. Installation & Running

```bash
# Clone or download the repository
cd scrum-poker

# Install dependencies
npm install

# Start the server
npm start
```

The server runs by default at `http://localhost:3000`. 
*(For live development with auto-restart upon file changes, run `npm run dev`).*

---

## 🐳 Docker & Unraid Deployment

The project is fully ready for deployment via Docker and Unraid:

### Using Docker Compose

```bash
docker-compose up -d --build
```

### Key Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port on which the Express / Socket.IO server listens. |
| `PUBLIC_URL` | *(Auto-detected LAN IP)* | The base URL embedded inside generated QR codes. **Note**: When deploying inside Docker/Unraid on your network, set this explicitly to your server's address, e.g., `http://192.168.1.100:3000` or custom domain. |
| `APP_NAME` | `Scrum Poker` | Overrides the app name everywhere — page titles, header logo, hero title, API responses, console logs. Mirrors `public/js/config.js`. |
| `CORS_ORIGIN` | `*` | Allowed CORS origins for the Socket.IO server (comma-separated if restricted). |
| `TRUST_PROXY` | *(off)* | Express `trust proxy` setting. Set this when the app sits behind a reverse proxy you control (nginx, Traefik, Cloudflare Tunnel) so the REST rate limiter sees each client's real IP instead of the proxy's. **Only** enable this if that proxy strips/overwrites client-supplied `X-Forwarded-For` — otherwise a client can spoof its IP and bypass rate limiting. Accepts `true`, a hop count (`1`, `2`, …), or an [Express-recognized value](https://expressjs.com/en/guide/behind-proxies.html) like `loopback`. |
| `PARTICIPANT_GRACE_MINUTES` | `10` | How long a disconnected participant's seat (vote, role, spectator state) is kept before being fully removed from a room. Covers brief network drops — e.g. a phone locking its screen — so reconnecting within this window restores everything instead of starting over. Identity is proven by a per-session reconnect token stored in the browser, not by the display name. |
| `NODE_ENV` | *(unset)* | Standard Node/Express environment flag. Set to `production` in Docker (see `Dockerfile`/`docker-compose.yml`); not required for local development. |

---

## 🧪 Automated Testing (`npm test`)

The project includes a blazing fast, zero-configuration automated test suite powered by Node's native **Test Runner (`node:test`) and Assert (`node:assert`)**.

### Running the tests
To execute all unit and integration test suites locally or in CI:
```bash
npm test
```

### Test Suites (`tests/`)
| Suite | Scope | What it tests |
| :--- | :--- | :--- |
| `tests/store.test.js` | **State & Security** | In-memory room store, timer leak prevention (`deleteRoom`), unrevealed vote protection (`sanitizeRoom`), role differentiation, and issue title tracking. |
| `tests/config.test.js` | **Decks & Translations** | Verification of all deck arrays (`standard`, `fibonacci`, `tshirt`), special cards (`❓`, `☕`), and 100% bilingual parity check between NL and EN dictionaries in `i18n.js`. |
| `tests/api.test.js` | **REST API** | HTTP integration testing of Express routes via `supertest`: `GET /api/config`, `GET /api/rooms/:id`, Base64 PNG QR code generation (`/api/rooms/:id/qr`), and Docker health check (`/health`). |
| `tests/socket.test.js` | **Real-time WebSockets** | End-to-end Socket.IO integration testing (`socket.io-client`) simulating full room lifecycles: `create-room` → `join-room` → `vote` → `reveal` → `reset` → `kick-user` → `update-story-title`, plus `claim-master`, `sm-transfer-master`, and the 30s Scrum Master reconnect grace. |
| `tests/presenter.test.js` | **Presenter screens** | `watch-room` attaches a display without seating anyone, displays stay out of `room.participants`, see no votes before the reveal, and may still drive the room (`canControlRoom`) while a plain participant may not. Also covers multiple screens on one room, `room-closed`, and a screen keeping the room alive after the last participant leaves. |
| `tests/robustness.test.js` | **Resilience / Hardening** | Malformed & missing socket payloads, prototype-key room IDs (`__proto__`, `constructor`, …) and `roomId` case-normalization — proving a single bad client message can never crash the server. |
| `tests/rateLimiter.test.js` | **REST Rate Limiting** | Per-IP fixed-window limiter: requests under quota pass, exceeding it returns `429` with `Retry-After`, the window resets, and separate IPs are tracked independently. |
| `tests/roomId.test.js` | **Room Codes** | `generateRoomId` only emits the curated Crockford Base32 alphabet (no ambiguous `I`/`L`/`O`/`U`), is always uppercase, and produces distinct codes; `normalizeRoomId` trims/uppercases correctly. |
| `tests/stats.test.js` | **Vote Statistics** | `computeVoteStats` (extracted, DOM-free from `render-results.js`): average/median for odd & even vote counts, non-numeric vote handling, and distribution-bar scaling. |
| `tests/helpers.test.js` | **XSS Prevention** | `escHtml` escapes all special characters, neutralizes script-tag and attribute-breakout injection attempts, and leaves plain text unchanged. |

---

## 📚 Architecture & Technical Wiki (with Mermaid Diagrams)

For deep-dive documentation on system design, state management, security (`sanitizeRoom`), and real-time WebSockets interactions, check out our in-repo **Technical Wiki**:

| Guide / Diagram Page | Description |
| :--- | :--- |
| [**🏠 Wiki Index & System Overview**](./docs/wiki/index.md) | High-level system topology (`graph TD`) connecting Express, Socket.IO, ES Modules, and `localStorage`. |
| [**🧩 Modular Components & Security**](./docs/wiki/architecture.md) | ES Module breakdown (`graph LR`) and unrevealed vote protection (`sanitizeRoom` flowchart). |
| [**🔄 Room Lifecycle & Timers**](./docs/wiki/lifecycle.md) | State transitions (`stateDiagram-v2`) showing the **30-minute unattended room grace period** (no participant *and* no presenter screen) and **24-hour cleanup**. |
| [**⚡ Socket.IO Sequence Flows**](./docs/wiki/socket-flows.md) | Sequence diagrams (`sequenceDiagram`) for voting rounds (`watch-room` / `join → vote → reveal → reset`) and user kicks (`handleKickUser`). |
| [**👑 Roles & Permissions Matrix**](./docs/wiki/roles.md) | Capability matrix for host, voter, spectator and presenter screen, plus who counts as a voter (`isSpectator`) and who may drive the room (`canControlRoom`). |
| [**📂 Complete File Structure & Modules**](./docs/wiki/file-structure.md) | Exhaustive directory and file tree with module responsibilities and dependency graph (`graph TD`). |

---

## 🛠️ Technology Stack & Project Structure

- **Backend**: Node.js, Express, Socket.IO (`server.js`, `src/`)
- **Frontend**: Vanilla ES Modules, CSS Variables (Dark/Light mode), Native DOM APIs (`public/`)
- **QR Generation**: `qrcode` library on the backend, full-screen DOM modal on the frontend (`public/js/room/qr-module.js`).
- **Documentation**: Markdown + Native GitHub Mermaid Diagrams (`docs/wiki/`)

```text
├── docs/wiki/               # 📚 Technical Wiki & Mermaid Diagrams
│   ├── index.md             # Wiki Home & System Topology
│   ├── architecture.md      # Modular ES Components & sanitizeRoom security
│   ├── lifecycle.md         # State machines & cleanup timers
│   ├── socket-flows.md      # Real-time WebSockets sequence flows
│   ├── roles.md             # SM vs Voter vs Spectator permission matrix
│   └── file-structure.md    # Exhaustive repository & module directory breakdown
├── public/
│   ├── index.html           # Home / Landing page
│   ├── room.html            # Active poker room
│   ├── presenter.html       # Presenter screen (display, not a participant)
│   ├── style.css            # Styling, themes & animations
│   └── js/                  # Client-side ES Modules (room, i18n, utils)
├── src/
│   ├── config.js            # ALL server settings in one place: env vars, rate limits, timers, decks
│   ├── store/rooms.js       # In-memory room state management
│   ├── socket/              # Socket.IO handlers (room, sm, vote, chat)
│   └── routes/              # RESTful API endpoints (/api/rooms, /health)
├── tests/
│   ├── store.test.js        # Unit tests for rooms store & sanitizeRoom security
│   ├── config.test.js       # Unit tests for deck validity & i18n dictionary parity
│   ├── api.test.js          # HTTP integration tests for Express routes (/api, /health)
│   ├── socket.test.js       # E2E Socket.IO real-time room lifecycle & voting tests
│   ├── robustness.test.js   # Malformed-payload & prototype-key crash hardening tests
│   ├── rateLimiter.test.js  # Per-IP REST rate limiter tests
│   ├── roomId.test.js       # Room code alphabet & normalization tests
│   ├── stats.test.js        # Pure vote-statistics calculation tests
│   └── helpers.test.js      # escHtml XSS-prevention tests
├── Dockerfile               # Alpine Node.js image configuration
├── docker-compose.yml       # Docker deployment config with healthcheck
└── server.js                # Main server entrypoint
```

---

### 🤖 Developed with the following AI models
This project is a showcase of modern collaborative pair-programming between human intuition and cutting-edge agentic AI assistants:
- **Google DeepMind Antigravity (Gemini)** — *Agentic Architecture, Socket Resilience, UI Polish & Documentation Wiki*
- **Anthropic Claude Code / Claude 3.5 Sonnet** — *Core Feature Iteration, Caveman-Mode Token Efficiency & Workflow Automation*

---

## 📄 License

This project is developed as an open, collaborative tool for Scrum & Agile teams. Happy planning and accurate estimating! 🎯
