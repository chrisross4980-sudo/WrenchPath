# WrenchPath ATL — Architecture

## Overview

WrenchPath ATL is an AI career-navigation agent that operates inside **iMessage**.
Users text a phone number and receive career guidance from an AI — no app install, no web browser, no friction.

The system is composed of two independent Node.js services that communicate over HTTP on localhost.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         User Device                         │
│                                                             │
│   "I've worked at a tire shop for 2 years.                  │
│    I want to become an EV technician."                      │
└───────────────────────┬─────────────────────────────────────┘
                        │  iMessage
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Photon Cloud  (app.photon.codes)               │
│         Routes iMessage ↔ Spectrum gRPC endpoint           │
└───────────────────────┬─────────────────────────────────────┘
                        │  Spectrum SDK (gRPC / WebSocket)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          apps/photon-backend   (PORT 3000)                  │
│                                                             │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────┐  │
│  │  server.ts   │   │ messageHandler   │   │ aiClient   │  │
│  │  GET /health │   │ Spectrum loop    │   │ POST /chat │  │
│  └──────────────┘   └────────┬─────────┘   └─────┬──────┘  │
│                              │                   │         │
│                       receive msg          call AI svc     │
└──────────────────────────────┼───────────────────┼─────────┘
                               │  POST /api/chat   │
                               ▼                   │
┌─────────────────────────────────────────────────────────────┐
│          apps/ai-agent         (PORT 4000)                  │
│                                                             │
│   Receives { conversationId, senderId, message }           │
│   Returns  { reply: "..." }                                 │
│                                                             │
│   Owns: skills assessment, career roadmap,                  │
│         training recommendations, skills passport           │
└─────────────────────────────────────────────────────────────┘
                               │  { reply }
                               ▼
                    apps/photon-backend
                               │  space.send(text(reply))
                               ▼
                        Photon Cloud
                               │  iMessage
                               ▼
                          User Device
```

---

## Service Responsibilities

### `apps/photon-backend` — Photon / Backend Developer

| Responsibility | Implementation |
|---|---|
| Spectrum SDK initialization | `src/index.ts` — `Spectrum({ projectId, projectSecret, providers: [imessage.config()] })` |
| iMessage message reception | `src/handlers/messageHandler.ts` — `for await (const [space, message] of app.messages)` |
| Content filtering | Skips non-text (reactions, reads, membership events), skips outbound, skips empty |
| Deduplication | In-memory Set of `message.id` values (bounded to 1000 entries) |
| Conversation isolation | Each `space.id` is independent; `space.responding()` serialises replies per conversation |
| Welcome greeting | Sent once per `space.id` on first contact |
| AI forwarding | `src/services/aiClient.ts` — `POST {AI_SERVICE_URL}/api/chat` |
| Reply routing | `space.send(text(aiReply))` back to the originating conversation |
| Fallback on AI error | Returns safe user-facing message if AI service is unavailable |
| HTTP health check | `src/server.ts` — `GET /health → { status, service, timestamp }` |
| Environment validation | `src/utils/env.ts` — fails fast on startup with clear error listing all missing vars |
| Structured logging | `src/utils/logger.ts` — JSON lines, LOG_LEVEL aware, no credentials in logs |

### `apps/ai-agent` — AI Agent Developer

| Responsibility | Note |
|---|---|
| Career conversation reasoning | LLM integration |
| Skills assessment | From user's automotive experience |
| Career roadmap generation | EV tech, diagnostics, service advisor, etc. |
| Training recommendations | Local programs, certifications |
| Skills passport | Progress tracking |

---

## Communication Protocol

The two services communicate via **HTTP + JSON** on localhost.
See [`docs/api-contract.md`](./api-contract.md) for the full specification.

---

## Data Flow — Message Lifecycle

```
1.  User sends iMessage text
2.  Photon Cloud delivers to Spectrum SDK via gRPC
3.  SDK yields (space, message) from app.messages iterator
4.  messageHandler filters: outbound? non-text? empty? → skip
5.  messageHandler deduplicates by message.id
6.  First message in space.id? → send welcome greeting
7.  space.responding() acquires per-conversation lock
8.  aiClient.callAiService() → POST /api/chat with conversationId, senderId, message
9.  AI service responds with { reply }
10. space.send(text(reply)) → Photon Cloud → iMessage
```

---

## Environment Variables

See [`.env.example`](../.env.example) for the full list.

| Variable | Service | Required | Default |
|---|---|---|---|
| `PHOTON_PROJECT_ID` | photon-backend | ✅ | — |
| `PHOTON_PROJECT_SECRET` | photon-backend | ✅ | — |
| `PORT` | photon-backend | — | `3000` |
| `AI_SERVICE_URL` | photon-backend | — | `http://localhost:4000` |
| `AI_TIMEOUT_MS` | photon-backend | — | `5000` |
| `LOG_LEVEL` | photon-backend | — | `info` |
| `NODE_ENV` | photon-backend | — | `development` |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) ≥ 1.4 |
| Language | TypeScript 5+ |
| Messaging SDK | [spectrum-ts](https://github.com/photon-hq/spectrum-ts) v12.10.1 |
| iMessage Provider | `@spectrum-ts/imessage` (bundled in `spectrum-ts`) |
| HTTP server | `Bun.serve` (built-in) |
| Test runner | `bun test` (built-in) |
| Hosting (iMessage) | [Photon Cloud](https://app.photon.codes) |

---

## Deployment Requirements

### Photon Cloud

1. Create an account at [app.photon.codes](https://app.photon.codes)
2. Create a project — obtain `PROJECT_ID` and `PROJECT_SECRET`
3. Enable the iMessage provider in the Photon dashboard
4. Follow Photon's iMessage onboarding to link an Apple ID / phone number

### Running the Backend

```bash
cd apps/photon-backend
cp ../../.env.example .env
# Edit .env with real PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET
bun install
bun run src/index.ts
```

The process connects to Photon Cloud on startup. Real iMessages arrive immediately once the provider is configured in the dashboard.

### Running Both Services Together

```bash
# Terminal 1 — AI Agent
cd apps/ai-agent
bun run src/index.ts   # (or node src/index.js — depends on ai-agent implementation)

# Terminal 2 — Photon Backend
cd apps/photon-backend
bun run src/index.ts
```

Both must be running for full end-to-end message flow.
