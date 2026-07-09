# 🃏 Scrum Poker Collab

Een moderne, interactieve en realtime **Scrum Poker webapplicatie** ontworpen voor naadloze samenwerking binnen Agile development teams. Speciaal geoptimaliseerd voor lokaal gebruik, hybride meetings en snelle mobiele deelname via QR-codes.

---

## ✨ Kenmerken & Features

- **⚡ Real-time Samenwerking**: Directe updates via **Socket.IO**. Geen polling, geen vertraging.
- **📱 QR-Code Join & Zoom**: De Scrum Master of presenter ziet live een QR-code. Klik erop om deze **full-screen** te tonen op een groot scherm of projector. Teamleden scannen met hun telefoon en zitten direct in de juiste room!
- **🃏 Configureerbare Kaartdekken**:
  - **Standard**: `0, 1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 40, ♾️, ❓, ☕`
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ❓, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ❓, ☕`
  - **Custom**: Zelf kaarten en waarden invoeren tijdens de sessie.
- **🌐 Tweetalig (NL 🇳🇱 / EN 🇬🇧)**: Volledig meertalige interface met directe taalschakelaar (zonder paginaherlaad) op zowel de homepagina als in de pokerooms.
- **🔋 Slim Mobiel & Energiebeheer**:
  - **Screen Wake Lock API**: Voorkomt automatisch dat het scherm van telefoons op standby of screensaver gaat tijdens een actieve pokersessie.
  - **Auto-Reconnect & Rejoin**: Schakel je even naar een andere app (zoals Slack of WhatsApp) of verlies je kort de wifi-verbinding? Bij terugkeer verbindt de app automatisch opnieuw en re-joinet je direct de actieve ronde.
  - **Deselecteren**: Klik simpelweg nogmaals op een geselecteerde kaart om je stem te wissen of te wijzigen voor de onthulling.
- **👑 Scrum Master Controls**:
  - Voortgangsbalk met live stemstatus (*bijv. 4/5 gestemd*).
  - **Reveal** (eenmalig per ronde te openen om dubbelklikken te voorkomen).
  - **Nieuwe ronde / Reset** (reset stemmen voor alle deelnemers).
  - Deelnemers beheren (kicken of rol overdragen).
- **🪶 Licht & Snel**: Geen database nodig! State wordt slim in-geheugen bijgehouden met automatische opschoning (`disconnectTimer`) voor lege rooms.

---

## 🚀 Snel Starten (Lokaal / Node.js)

### 1. Vereisten
- [Node.js](https://nodejs.org/) (v18 of hoger)
- npm

### 2. Installatie & Starten

```bash
# Clone of download de repository
cd "scrum poker collab"

# Installeer de afhankelijkheden
npm install

# Start de server
npm start
```

De server draait nu standaard op `http://localhost:3000`. 
*(Voor live ontwikkeling met automatische herstart kun je `npm run dev` gebruiken).*

---

## 🐳 Docker & Unraid Deployment

Het project is volledig voorbereid op deployment via Docker en Unraid:

### Met Docker Compose

```bash
docker-compose up -d --build
```

### Belangrijke Omgevingsvariabelen (`Environment Variables`)

| Variabele | Standaard | Beschrijving |
| :--- | :--- | :--- |
| `PORT` | `3000` | Poort waarop de Express / Socket.IO server luistert. |
| `PUBLIC_URL` | *(Automatisch LAN-IP)* | De URL die wordt verwerkt in de gegenereerde QR-codes. **Let op**: Bij gebruik in Docker/Unraid op je netwerk zet je deze op bijv. `http://192.168.1.100:3000` of je domeinnaam. |
| `CORS_ORIGIN` | `*` | Toegestane CORS origins (komma-gescheiden indien beperkt). |

---

## 🛠️ Technologieën & Projectstructuur

- **Backend**: Node.js, Express, Socket.IO (`server.js`, `src/`)
- **Frontend**: Vanilla ES Modules, CSS Variables (Dark/Light mode), Native DOM APIs (`public/`)
- **QR-Generatie**: `qrcode` library op de backend, full-screen DOM modal in de frontend (`public/js/room/qr-module.js`).

```text
├── public/
│   ├── index.html           # Home / Landing page
│   ├── room.html            # De actieve pokeroom
│   ├── style.css            # Styling, thema's & animaties
│   └── js/                  # Client-side ES Modules (room, i18n, utils)
├── src/
│   ├── config.js            # Poorten, netwerk-detectie & dek-definities
│   ├── store/rooms.js       # In-memory room state management
│   ├── socket/              # Socket.IO handlers (room, sm, vote, chat)
│   └── routes/              # RESTful API endpoints (/api/rooms, /health)
├── Dockerfile               # Alpine Node.js image config
├── docker-compose.yml       # Docker deployment config met healthcheck
└── server.js                # Hoofd-instappunt server
```

---

## 📄 Licentie

Dit project is ontwikkeld als open en collaboratieve tool voor Scrum & Agile teams. Veel plan- en pokersucces! 🎯
