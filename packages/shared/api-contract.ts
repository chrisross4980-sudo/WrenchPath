/**
 * packages/shared/api-contract.ts
 *
 * Shared API contract between apps/photon-backend and apps/ai-agent.
 *
 * BOTH services must agree on these types.
 * Do not change this file without coordinating with both developer teams.
 *
 * See docs/api-contract.md for the full specification.
 */

/** Sent by apps/photon-backend → apps/ai-agent via POST /api/chat */
export interface ChatRequest {
  /** Stable conversation identifier (space.id from Spectrum SDK). */
  conversationId: string;
  /** Stable user identifier (message.sender.id from Spectrum SDK). */
  senderId: string;
  /** Plain-text message body. Always non-empty. */
  message: string;
}

/** Returned by apps/ai-agent → apps/photon-backend */
export interface ChatResponse {
  /** AI-generated reply to send back to the user via iMessage. */
  reply: string;
}
