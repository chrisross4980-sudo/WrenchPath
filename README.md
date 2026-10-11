# WrenchPath ATL

> From Experience to Opportunity.

WrenchPath ATL is an AI career-navigation agent that operates inside **iMessage** using
[Photon's Spectrum SDK](https://github.com/photon-hq/spectrum-ts). It helps overlooked
automotive workers understand their skills, explore career pathways, and track their growth.

---

## Repository Structure

```
wrenchpath-atl/
├── apps/
│   ├── photon-backend/   # Photon/Spectrum iMessage backend (this repo, feature/backend)
│   └── ai-agent/         # AI career navigation service (feature/ai-agent)
├── packages/
│   └── shared/           # Shared TypeScript API contracts
├── docs/
│   ├── architecture.md
│   └── api-contract.md
├── .env.example          # Environment variable template
└── README.md
```

---

## Getting Started — Photon Backend

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.4 (`curl -fsSL https://bun.sh/install | bash`)
- A [Photon](https://app.photon.codes) account with a project created (for iMessage access)

### Setup

```bash
cd apps/photon-backend
cp ../../.env.example .env
# Edit .env with your PHOTON_PROJECT_ID, PHOTON_PROJECT_SECRET, etc.
bun install
```

### Run

```bash
bun run src/index.ts
```

Health check:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"wrenchpath-photon-backend","timestamp":"..."}
```

### Tests

```bash
cd apps/photon-backend
bun test
```

---

## Architecture

```
iMessage
   │
   ▼  (Photon Cloud routes iMessage to our process)
Spectrum SDK ──── app.photon.codes
   │
   ▼
apps/photon-backend   (PORT 3000)
   │  POST /api/chat
   ▼
apps/ai-agent         (PORT 4000)
   │  { reply: "..." }
   ▼
apps/photon-backend
   │
   ▼
iMessage reply
```

See [`docs/architecture.md`](docs/architecture.md) and [`docs/api-contract.md`](docs/api-contract.md)
for full details.

---

## Branch Rules

| Branch | Owner | Purpose |
|---|---|---|
| `feature/backend` | Backend / Photon Developer | Photon backend service |
| `feature/ai-agent` | AI Agent Developer | AI career navigation service |
| `main` | Team | Integration — merge via PR only, human approval required |

**Never force-push. Never push directly to `main`.**

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.

---

## Hackathon Challenges

- **Social Good** — Cox Automotive
- **Agents in iMessage** — Photon
