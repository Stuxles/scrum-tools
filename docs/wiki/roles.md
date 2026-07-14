# 👑 Roles & Permissions (SM vs. Voter vs. Spectator)

Scrum Poker categorizes participants into three distinct operational roles. Each role determines which dashboard controls, status icons, and voting interfaces are rendered, as well as how statistical consensus is calculated upon card reveal.

---

## 📊 Role & Permission Matrix

| Capability / Feature | 👑 Scrum Master | 🃏 Voter (Participant) | 👁️ Spectator |
| :--- | :---: | :---: | :---: |
| **Select / Deselect Estimation Cards** | ❌ (Presenter mode) | ✅ Yes | ❌ (View only) |
| **Reveal All Votes (`reveal`)** | ✅ Yes | ❌ No | ❌ No |
| **Start New Round (`reset`)** | ✅ Yes | ❌ No | ❌ No |
| **Update Current Ticket / Story Title** | ✅ Yes (Live input) | ❌ Read-only banner | ❌ Read-only banner |
| **Change Card Deck (`change-deck`)** | ✅ Yes | ❌ No | ❌ No |
| **Kick Participants (`kick-user`)** | ✅ Yes | ❌ No | ❌ No |
| **Enlarge Full-Screen QR Code Modal** | ✅ Yes | ❌ No | ❌ No |
| **Counted in Voting Progress Bar (%)** | ❌ Excluded | ✅ **Included** | ❌ **Excluded** |
| **Included in Average / Median / Chart** | ❌ Excluded | ✅ **Included** | ❌ **Excluded** |
| **Toggle Spectator Role Live** | ❌ No | ✅ Can become Spectator | ✅ Can become Voter |

---

## 🎯 Progress Bar & Statistics Calculation Logic

To ensure accurate Agile story sizing, any participant marked as `isMaster: true` or `isSpectator: true` is automatically excluded from both the live voting denominator (`voters.length`) and post-reveal score analytics.

```mermaid
flowchart LR
    AllParticipants["All Room Participants<br/>room.participants"] --> FilterVoters["Filter: !p.isMaster && !p.isSpectator"]
    
    FilterVoters --> VotersPool["Active Voters Pool<br/>(Only true estimation participants)"]
    
    VotersPool --> CalcProgress["Live Voting Progress Bar<br/>votedCount / VotersPool.length"]
    VotersPool --> CalcStats["Post-Reveal Analytics<br/>Average, Median, Most Picked & Bar Chart"]
```

### Code Implementation (`room-page.js` & `render-results.js`)

```javascript
// Filter only active estimation voters
const voters = room.participants.filter(p => !p.isMaster && !p.isSpectator);
const voted  = voters.filter(p => p.hasVoted).length;
const total  = voters.length;

// Calculate progress percentage accurately
const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
smProgressFill.style.width = `${pct}%`;
smProgressText.textContent = t('progress-text', { voted, total });
```
