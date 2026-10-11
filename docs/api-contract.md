# WrenchPath ATL — API Contract

## Overview

The Photon backend (`apps/photon-backend`) and the AI Agent service (`apps/ai-agent`)
communicate via a single HTTP endpoint.

**This contract is agreed by both developer teams. Do not change it unilaterally.**

---

## Endpoint

```
POST http://localhost:4000/api/chat
```

The AI service URL is configurable via the `AI_SERVICE_URL` environment variable
(default: `http://localhost:4000`).

---

## Request

**Method:** `POST`  
**Content-Type:** `application/json`

### Body

```json
{
  "conversationId": "string",
  "senderId": "string",
  "message": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `conversationId` | `string` | Stable identifier for the conversation. Derived from `space.id` in the Spectrum SDK. Consistent across all messages in the same iMessage thread. |
| `senderId` | `string` | Stable identifier for the sending user. Derived from `message.sender.id` in the Spectrum SDK. Falls back to `"unknown"` if the sender is not available. |
| `message` | `string` | The plain-text body of the user's iMessage. Always non-empty (empty messages are filtered before reaching the AI service). |

### Example Request

```json
{
  "conversationId": "imessage-space-abc123",
  "senderId": "imessage-user-xyz456",
  "message": "I've worked at a tire shop for two years. I want to become an EV technician."
}
```

---

## Response

**Content-Type:** `application/json`  
**Status:** `200 OK`

### Body

```json
{
  "reply": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `reply` | `string` | The AI-generated response to send back to the user via iMessage. Must be a non-empty string. |

### Example Response

```json
{
  "reply": "Your automotive experience gives you a useful foundation. Let's identify your current skills and map a practical path toward becoming an EV technician. What certifications or training have you completed so far?"
}
```

---

## Error Handling

The Photon backend handles these failure modes gracefully:

| Scenario | Photon Backend Behaviour |
|---|---|
| AI service unreachable (ECONNREFUSED) | Sends fallback message to user; logs error |
| AI service timeout (default 5 s, configurable) | Sends fallback message to user; logs error |
| AI service returns non-2xx HTTP status | Sends fallback message to user; logs error |
| AI service returns invalid JSON | Sends fallback message to user; logs error |
| AI service response missing `reply` field | Sends fallback message to user; logs error |
| AI service returns empty `reply` string | Sends fallback message to user; logs error |

The fallback message shown to users:  
> *"I'm having trouble connecting right now. Please try again in a moment."*

---

## TypeScript Types

Shared types live in [`packages/shared/api-contract.ts`](../packages/shared/api-contract.ts)
and are mirrored in [`apps/photon-backend/src/types/api.ts`](../apps/photon-backend/src/types/api.ts).

```typescript
interface ChatRequest {
  conversationId: string;
  senderId: string;
  message: string;
}

interface ChatResponse {
  reply: string;
}
```

---

## Integration Notes

- The `conversationId` is stable for the lifetime of an iMessage thread. The AI Agent service should use it to maintain conversation history.
- The `senderId` is stable per user per platform. It can be used for user-level state, but it is **not** a phone number or Apple ID — it is an opaque Spectrum SDK identifier.
- The Photon backend does **not** store conversation history. That is the AI Agent service's responsibility.
- The Photon backend calls this endpoint **once per inbound user message**, after filtering out reactions, reads, empty messages, and duplicate deliveries.
