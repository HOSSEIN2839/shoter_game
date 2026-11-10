# OPERATION: STRIKE

A browser-based, real-time multiplayer first-person shooter prototype.

## Current build

- Username/password registration and sign-in (bcrypt password hashing, signed 7-day sessions).
- Multiplayer rooms, host controls, team selection, ready checks and a 10-minute match timer.
- 15 operator identities (5 selectable in this prototype; the rest are locked).
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

This is an initial playable foundation, not yet a production-ready competitive FPS. Operator bodies and the arena are currently generated procedurally; licensed GLB character and environment assets, animation rigs, sound, collision/physics, robust authoritative movement validation, anti-cheat, persistent player statistics, HTTPS deployment, rate limiting and load testing are follow-up work. Five operators are selectable in this first build; ten are deliberately locked. The server currently stores accounts in SQLite under \`data/\`.

Never deploy with the fallback JWT secret. Use HTTPS and a persistent writable data volume in production.
