/**
 * api.ts
 *
 * Shared TypeScript interfaces for the WrenchPath ATL API contract.
 *
 * This contract is agreed between:
 *   - apps/photon-backend  (sends ChatRequest, receives ChatResponse)
 *   - apps/ai-agent        (receives ChatRequest, sends ChatResponse)
 *
 * DO NOT change this file without coordinating with both developers.
 * See docs/api-contract.md for the full specification.
 */

/** Sent by the Photon backend to the AI Agent service. */
export interface ChatRequest {
  /** Stable identifier for the conversation (space.id from Spectrum). */
  conversationId: string;
  /** Stable identifier for the sending user (message.sender.id from Spectrum). */
  senderId: string;
  /** The plain-text message body from the user. */
  message: string;
}

/** Returned by the AI Agent service to the Photon backend. */
export interface ChatResponse {
  /** The AI-generated reply to send back to the user via iMessage. */
  reply: string;
}

/** Type guard — validates that an unknown value is a valid ChatResponse. */
export function isChatResponse(value: unknown): value is ChatResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "reply" in value &&
    typeof (value as Record<string, unknown>)["reply"] === "string" &&
    (value as ChatResponse).reply.trim().length > 0
  );
}
