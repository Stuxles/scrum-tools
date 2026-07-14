# 🃏 Scrum Poker

A modern, interactive, and real-time **Scrum Poker web application** designed for seamless collaboration among Agile development teams. Specially optimized for local network use, hybrid meetings, and quick mobile participation via QR codes.

> **💡 Centralized Application Name:**  
> The application name is defined in **one single place**: `public/js/config.js` (`export const APP_NAME = 'Scrum Poker';`). If you ever wish to rename the app in the future, simply update `APP_NAME` in that file or via the `APP_NAME` environment variable, and all UI titles, headers, brand icons, console logs, and API endpoints will update automatically!

---

## ✨ Features & Highlights

- **⚡ Real-Time Collaboration**: Instant updates powered by **Socket.IO**. No polling, zero latency.
- **📱 QR-Code Join & Zoom**: The Scrum Master or presenter sees a live QR code on their dashboard. Click it to open a **full-screen modal** suitable for large displays or projectors. Team members scan the code with their smartphone camera to join the exact room instantly!
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
- **👑 Scrum Master Controls**:
  - Progress bar with live voting status (*e.g., 4/5 voted*).
  - **Reveal** (one-time action per round to prevent accidental double-clicks).
  - **New Round / Reset** (clears votes for all participants).
  - Participant management (kick members or transfer the Scrum Master role).
- **🪶 Lightweight & Fast**: No database required! State is kept in-memory with automatic cleanup timers (`disconnectTimer`) for inactive rooms.

---

## 🚀 Quick Start (Local / Node.js)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
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
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated if restricted). |

---

## 📚 Architecture & Technical Wiki (with Mermaid Diagrams)

For deep-dive documentation on system design, state management, security (`sanitizeRoom`), and real-time WebSockets interactions, check out our in-repo **Technical Wiki**:

| Guide / Diagram Page | Description |
| :--- | :--- |
| [**🏠 Wiki Index & System Overview**](./docs/wiki/index.md) | High-level system topology (`graph TD`) connecting Express, Socket.IO, ES Modules, and `localStorage`. |
| [**🧩 Modular Components & Security**](./docs/wiki/architecture.md) | ES Module breakdown (`graph LR`) and unrevealed vote protection (`sanitizeRoom` flowchart). |
| [**🔄 Room Lifecycle & Timers**](./docs/wiki/lifecycle.md) | State transitions (`stateDiagram-v2`) showing the **15-minute empty room grace period** and **24-hour cleanup**. |
| [**⚡ Socket.IO Sequence Flows**](./docs/wiki/socket-flows.md) | Sequence diagrams (`sequenceDiagram`) for voting rounds (`join → vote → reveal → reset`) and user kicks (`handleKickUser`). |
| [**👑 Roles & Permissions Matrix**](./docs/wiki/roles.md) | Detailed capability matrix and progress bar calculations filtering out non-voters (`isMaster` / `isSpectator`). |
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
│   ├── style.css            # Styling, themes & animations
│   └── js/                  # Client-side ES Modules (room, i18n, utils)
├── src/
│   ├── config.js            # Ports, network detection & deck definitions
│   ├── store/rooms.js       # In-memory room state management
│   ├── socket/              # Socket.IO handlers (room, sm, vote, chat)
│   └── routes/              # RESTful API endpoints (/api/rooms, /health)
├── Dockerfile               # Alpine Node.js image configuration
├── docker-compose.yml       # Docker deployment config with healthcheck
└── server.js                # Main server entrypoint
```

---

## 🤝 Human-Developer & AI Collaboration

### 🧑‍💻 Why This Codebase is 100% Human-Friendly
While advanced AI assistants aided in architecting and expanding this application, the codebase is meticulously engineered to be **simple, transparent, and effortlessly maintainable by real human developers**:
1. **Zero-Build Vanilla ES Modules**: No complex bundlers (`Webpack`, `Vite`), no transpilers (`Babel`, `TypeScript`), and no confusing sourcemaps. You can open any client-side JavaScript file inside `public/js/`, edit a line of code or CSS, refresh your browser (`F5`), and see your changes instantly.
2. **Single-Responsibility Modularity**: Instead of monolithic multi-thousand-line files, functionality is cleanly segregated (`render-users.js` for the sidebar, `render-voting.js` for cards, `render-results.js` for analytics, and `connectionHandlers.js` for socket resilience). A developer debugging or enhancing a specific feature knows exactly which file to open immediately.
3. **Transparent In-Memory State**: Without external SQL/NoSQL database dependencies or ORM boilerplate, the entire state model (`src/store/rooms.js`) can be inspected, logged, and understood in minutes.
4. **Comprehensive Technical Wiki**: All internal workflows, state machines, and socket packet definitions are documented right here inside the repo (`docs/wiki/`) with visual Mermaid diagrams.

### 🤖 AI Co-Creation Credits
This project is a showcase of modern collaborative pair-programming between human intuition and cutting-edge agentic AI assistants:
- **Google DeepMind Antigravity (Gemini)** — *Agentic Architecture, Socket Resilience, UI Polish & Documentation Wiki*
- **Anthropic Claude Code / Claude 3.5 Sonnet** — *Core Feature Iteration, Caveman-Mode Token Efficiency & Workflow Automation*

---

## 📄 License

This project is developed as an open, collaborative tool for Scrum & Agile teams. Happy planning and accurate estimating! 🎯
