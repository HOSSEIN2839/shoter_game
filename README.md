# OPERATION: STRIKE

A browser-based, real-time multiplayer first-person shooter prototype.

## Current build

- Username/password registration and sign-in (bcrypt password hashing, signed 7-day sessions).
- Multiplayer rooms, host controls, team selection, ready checks and a 10-minute match timer.
- 15 selectable operator identities; one operator can be selected by only one player in a room.
- A procedural 3D training-yard arena rendered with Three.js.
- Four weapon classes: assault rifle, sniper, shotgun and pistol.
- Server-side fire-rate, ammo, damage, elimination, respawn and team-score handling.
- Live room and score updates over Socket.IO.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

\`\`\`bash
npm install
\`\`\`

Set a strong secret before starting:

\`\`\`bash
# Linux/macOS
export JWT_SECRET="$(openssl rand -hex 32)"
npm start
\`\`\`

PowerShell:

\`\`\`powershell
$env:JWT_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npm start
\`\`\`

Open http://localhost:3000 in two or more browser sessions to test multiplayer.

## Important prototype notes

This is an initial playable foundation, not yet a production-ready competitive FPS. Operator bodies and the arena are currently generated procedurally; licensed GLB character and environment assets, animation rigs, sound, collision/physics, robust authoritative movement validation, anti-cheat, persistent player statistics, HTTPS deployment, rate limiting and load testing are follow-up work. All 15 operator slots are selectable in this first build. Their current visual models are procedural placeholders, not imported GLB assets. The server currently stores accounts in SQLite under \`data/\`.

Never deploy with the fallback JWT secret. Use HTTPS and a persistent writable data volume in production.


## Current prototype update (build 0.4.0)

Recent improvements:
- Fifteen selectable operator identities with varied procedural tactical gear, headwear, uniform palettes and blue/red team armbands; manifest-driven GLB loading is integrated with safe skinned-mesh cloning, automatic scale normalization, team armbands, idle/walk/run animation playback and procedural fallback. No third-party GLB binaries are committed yet.
- First-person procedural weapon models, muzzle flashes, hold-to-fire automatic weapons and a hold-right-click sniper scope.
- Live minimap player markers, compass heading and elimination feed.
- Arena obstacle collision on both client and server.
- Per-weapon ammunition is retained when switching weapons and reloads update the correct weapon.
- Server-side input bounds, obstacle checks, fire-rate/aim validation, authentication throttling, one active socket per account, balanced team selection, and a production JWT secret guard.
- GitHub Actions syntax, HTTP/authentication and two-player Socket.IO smoke tests (room creation/join, character exclusivity, team balance, ready/start, firing/reload, private profile/stats API and server-side aim validation).
- Verified `/api/me` session restoration, `/api/me/stats` and public leaderboard displayed in the lobby.
- Live scoreboard overlay (hold Tab), remote-player interpolation, and client position correction after server collision/speed rejection.
- Aim direction is checked against the last server-replicated yaw/pitch; yaw is normalized to avoid long-session drift. CI also verifies that impossible client positions are corrected by the server.
- Training arena detail additions are documented in `docs/ASSET_PIPELINE.md`.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run check
```

Set a strong secret before exposing the server publicly:

```bash
# Linux/macOS
export JWT_SECRET="$(openssl rand -hex 32)"
npm start
```

PowerShell:

```powershell
$env:JWT_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npm start
```

Open `http://localhost:3000` in two separate browsers or devices to test two accounts. The current match state and rooms are in memory; only account credentials persist in SQLite. Use HTTPS/reverse proxy, backups, monitoring and a production-grade anti-cheat review before public launch.

**Not yet production complete:** the operators are procedural meshes, not imported GLB models; the arena is still procedural; physics/collision, animation, sound, persistent match statistics, lag compensation, authoritative movement simulation and load testing remain outstanding. The browser prototype has not been represented as tested until CI and a real multiplayer session pass.
