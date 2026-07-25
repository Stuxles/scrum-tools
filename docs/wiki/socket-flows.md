# ⚡ Real-Time Socket.IO Sequence Flows

All communication during active planning rounds happens over bi-directional **Socket.IO** WebSockets. This document breaks down the exact interaction sequences for creating, joining, voting, revealing, kicking, spectator toggling, and Scrum Master handoff.

---

## 🃏 Voting Round Sequence (Join → Vote → Reveal → Reset)

The sequence below traces the journey of a presenter screen (`P`), a Host (`SM`), a Voter (`Voter B`), and the `Server` during a standard planning estimation cycle.

```mermaid
sequenceDiagram
    autonumber
    participant P as Presenter screen 📺
    actor SM as Host 👑
    actor B as Voter B 🃏
    participant S as Node.js Server (`rooms.js`)

    Note over P,S: Room Creation — no display name, nobody is seated
    P->>S: emit('create-room', { deckType, customCards, roomName })
    S-->>P: emit('room-created', { roomId })
    Note over P: Browser navigates to /presenter.html?id=roomId

    Note over P,S: The screen attaches as a display, not a participant
    P->>S: emit('watch-room', { roomId })
    S-->>P: emit('room-watched', sanitizeRoom(room, null))
    Note over S: socket.join(roomId) + room.displays.add(socket.id)
    Note over P: The screen may still drive the room — canControlRoom()

    Note over SM,S: Joining the Room (first joiner claims the vacant host role)
    SM->>S: emit('join-room', { roomId, name, isSpectator: false })
    S-->>SM: emit('room-joined', { room, isMaster: true, sessionToken })
    S-->>P: broadcast('room-state', sanitizeRoom(room, null))

    B->>S: emit('join-room', { roomId, name: 'Bob', isSpectator: false })
    S-->>B: emit('room-joined', { room, isMaster: false, sessionToken })
    S-->>SM: broadcast('room-state', sanitizedRoom)
    S-->>P: broadcast('room-state', sanitizeRoom(room, null))

    Note over SM,S: Live Ticket Title Broadcast
    SM->>S: emit('update-story-title', { roomId, title: 'JIRA-204: Login Refactor' })
    S-->>SM: broadcast('room-state', { storyTitle: 'JIRA-204: Login Refactor' })
    S-->>A: broadcast('room-state', { storyTitle: 'JIRA-204: Login Refactor' })
    S-->>B: broadcast('room-state', { storyTitle: 'JIRA-204: Login Refactor' })

    Note over SM,S: Secret Estimation Voting Phase
    A->>S: emit('vote', { roomId, vote: '8' })
    Note over S: Sanitize: A sees '8', SM & B see `vote: null, hasVoted: true`
    S-->>A: emit('room-state', { A.vote: '8' })
    S-->>SM: emit('room-state', { A.vote: null, hasVoted: true })
    S-->>B: emit('room-state', { A.vote: null, hasVoted: true })

    B->>S: emit('vote', { roomId, vote: '13' })
    S-->>B: emit('room-state', { B.vote: '13' })
    S-->>SM: emit('room-state', { B.vote: null, hasVoted: true })
    S-->>A: emit('room-state', { B.vote: null, hasVoted: true })

    Note over SM,S: Simultaneous Reveal Phase
    SM->>S: emit('reveal', { roomId })
    Note over S: room.revealed = true → unmask all votes!
    S-->>SM: emit('room-state', { A.vote: '8', B.vote: '13', revealed: true })
    S-->>A: emit('room-state', { A.vote: '8', B.vote: '13', revealed: true })
    S-->>B: emit('room-state', { A.vote: '8', B.vote: '13', revealed: true })

    Note over SM,S: New Round Reset
    SM->>S: emit('reset', { roomId })
    Note over S: Clear all p.vote = null, p.hasVoted = false, revealed = false
    S-->>SM: broadcast('room-state', resetRoom)
    S-->>A: broadcast('room-state', resetRoom)
    S-->>B: broadcast('room-state', resetRoom)
```

---

## 🚫 User Kick Sequence (`handleKickUser`)

When a Scrum Master needs to remove an unwanted, duplicate, or glitching participant from the room, the following sequence executes.

```mermaid
sequenceDiagram
    autonumber
    actor SM as Scrum Master 👑
    participant S as Node.js Server (`connectionHandlers.js`)
    actor Target as Target Participant ❌
    actor Other as Other Participants 👥

    SM->>SM: Click ✕ button on Target's sidebar row
    SM->>SM: Browser confirms: "Are you sure you want to remove Target?"
    SM->>S: emit('kick-user', { roomId, targetId: Target.id })
    
    Note over S: Verify: room.masterId == SM.socket.id && targetId != SM.socket.id
    S->>Target: emit('kicked', {})
    S->>Target: Target.leave(roomId)
    Note over S: delete room.participants[targetId]

    S-->>SM: broadcast('room-state', updatedRoom)
    S-->>Other: broadcast('room-state', updatedRoom)

    Note over Target: Target handles 'kicked' event
    Target->>Target: _isInScrumRoom = false, currentRoom = null
    Target->>Target: Show Toast: "You have been removed from the room."
    Target->>Target: setTimeout(redirect to '/', 2000ms)
```

---

## 👁️ Spectator Toggle Sequence (`toggle-spectator`)

Any non-master participant can switch between **Voter** and **Spectator** dynamically without leaving or reloading the page.

```mermaid
sequenceDiagram
    autonumber
    actor P as Participant (Current: Voter 🃏)
    participant S as Node.js Server (`roomHandlers.js`)
    actor SM as Scrum Master 👑

    P->>P: Click Header Toggle Button ("Spectator 👁️")
    P->>P: Save preference to localStorage ('scrum_is_spectator' = true)
    P->>S: emit('toggle-spectator', { roomId, isSpectator: true })

    Note over S: p.isSpectator = true<br/>If p had voted, p.vote is cleared (`hasVoted = false`)
    S-->>P: emit('room-state', { isSpectator: true })
    S-->>SM: emit('room-state', { isSpectator: true })

    Note over SM: SM UI recalculates progress bar excluding P (`!p.isSpectator`)
    Note over P: P UI replaces card deck with Spectator Banner ("You are observing as a Spectator")
```

---

## 👑 Scrum Master Handoff (`sm-transfer-master`, `claim-master`, disconnect grace)

The Scrum Master role can change hands three ways. Note that `claim-master` is intentionally **open to any participant** — the room code is the trust boundary, not the role. See [Roles & Permissions](./roles.md) for the full trust model.

```mermaid
sequenceDiagram
    autonumber
    actor SM as Scrum Master 👑
    actor P as Participant 🃏
    participant S as Node.js Server (`roomHandlers.js` / `connectionHandlers.js`)

    Note over SM,S: Path 1 — Explicit Transfer (SM hands off)
    SM->>S: emit('sm-transfer-master', { roomId, targetId: P.id })
    Note over S: Verify room.masterId == SM.id && P is a participant
    S->>P: emit('became-master', {})
    S-->>SM: broadcast('room-state', { P.isMaster: true })
    S-->>P: broadcast('room-state', { P.isMaster: true })

    Note over P,S: Path 2 — Claim (any participant may take over)
    P->>S: emit('claim-master', { roomId })
    Note over S: Clears masterGraceTimer if pending; no ownership check
    S->>P: emit('became-master', {})
    S-->>P: broadcast('room-state', { P.isMaster: true })

    Note over SM,S: Path 3 — Disconnect Grace (SM drops unexpectedly)
    SM--xS: socket 'disconnect' (other participants remain)
    Note over S: Start masterGraceTimer = setTimeout(30s)
    alt Original SM rejoins with their session token within 30s
        SM->>S: emit('join-room', { roomId, name, sessionToken })
        Note over S: token matches masterToken → reclaim role, cancel timer
        S-->>SM: emit('room-joined', { room, isMaster: true, sessionToken })
    else 30 seconds elapse
        Note over S: masterId = first remaining connected participant
        S->>P: emit('became-master', {})
        S-->>P: broadcast('room-state', updatedRoom)
    end
```
