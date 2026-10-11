/**
 * messageHandler.ts
 *
 * Core Spectrum message loop for WrenchPath ATL.
 *
 * Behaviour:
 *   1. Receives every inbound message from the Spectrum SDK.
 *   2. Ignores non-text content (reactions, reads, membership events, etc.).
 *   3. Ignores outbound messages to prevent reply loops.
 *   4. Sends a welcome greeting on the first message in each new conversation.
 *   5. Forwards all text messages to the AI Agent service via aiClient.
 *   6. Sends the AI reply back to the same iMessage conversation.
 *   7. Falls back to a safe error message if the AI service is unavailable.
 *   8. Uses space.responding() so Spectrum serialises replies per-conversation,
 *      preventing interleaved responses.
 *
 * Deduplication:
 *   Tracks processed message IDs in a bounded in-memory Set so that
 *   accidental re-deliveries don't produce duplicate replies.
 */

import { text } from "spectrum-ts";
import type { Message } from "spectrum-ts";
import type { Space } from "spectrum-ts";
import { callAiService, AiServiceError } from "../services/aiClient.ts";
import { logger } from "../utils/logger.ts";
import type { Env } from "../utils/env.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE =
  "Hey! I'm WrenchPath ATL 🔧. Tell me about your automotive experience and where you want to go next.";

const FALLBACK_MESSAGE =
  "I'm having trouble connecting right now. Please try again in a moment.";

/**
 * Maximum number of message IDs to keep in the deduplication set.
 * Prevents unbounded memory growth during long-running sessions.
 */
const MAX_SEEN_IDS = 1000;

// ── Handler factory ───────────────────────────────────────────────────────────

export type AiClientFn = typeof import("../services/aiClient.ts").callAiService;

export interface MessageHandlerConfig {
  env: Env;
  /** Injectable AI client — defaults to the real HTTP client. Pass a mock in tests. */
  aiClient?: AiClientFn;
}

/**
 * Creates and returns a message handler bound to the provided config.
 * Call the returned function inside the Spectrum `for await` loop.
 */
export function createMessageHandler(config: MessageHandlerConfig) {
  const { env } = config;

  /** Conversations that have already received the welcome greeting. */
  const greetedConversations = new Set<string>();

  /** Recently-processed message IDs for deduplication. */
  const seenMessageIds = new Set<string>();

  return async function handleMessage(
    space: Space,
    message: Message
  ): Promise<void> {
    // ── 1. Skip outbound messages (agent's own replies) ───────────────────────
    if (message.direction === "outbound") {
      return;
    }

    // ── 2. Skip non-text content ──────────────────────────────────────────────
    if (message.content.type !== "text") {
      logger.debug("Skipping non-text message", {
        conversationId: space.id,
        contentType: message.content.type,
      });
      return;
    }

    // ── 3. Deduplicate ────────────────────────────────────────────────────────
    if (seenMessageIds.has(message.id)) {
      logger.warn("Duplicate message received, skipping", {
        messageId: message.id,
        conversationId: space.id,
      });
      return;
    }
    seenMessageIds.add(message.id);
    if (seenMessageIds.size > MAX_SEEN_IDS) {
      // Drop the oldest entry (first inserted) to keep the set bounded.
      const oldest = seenMessageIds.values().next().value;
      if (oldest !== undefined) seenMessageIds.delete(oldest);
    }

    // ── 4. Extract text ───────────────────────────────────────────────────────
    const userText = message.content.text.trim();
    if (userText.length === 0) {
      logger.debug("Ignoring empty message", { conversationId: space.id });
      return;
    }

    const conversationId = space.id;
    const senderId = message.sender?.id ?? "unknown";

    logger.info("Received message", { conversationId, senderId });

    // ── 5. Handle inside space.responding() to serialise per-conversation ─────
    await space.responding(async () => {
      // ── 5a. Welcome greeting on first contact ───────────────────────────────
      if (!greetedConversations.has(conversationId)) {
        greetedConversations.add(conversationId);
        await space.send(text(WELCOME_MESSAGE));
        logger.info("Sent welcome greeting", { conversationId });
        // Continue to also process the user's opening message.
      }

      // ── 5b. Forward message to AI Agent service ─────────────────────────────
      const aiCall = config.aiClient ?? callAiService;
      let reply: string;
      try {
        const response = await aiCall(env.AI_SERVICE_URL, env.AI_TIMEOUT_MS, {
          conversationId,
          senderId,
          message: userText,
        });
        reply = response.reply;
      } catch (err) {
        if (err instanceof AiServiceError) {
          logger.error("AI service error, sending fallback", {
            conversationId,
            error: err.message,
          });
        } else {
          logger.error("Unexpected error calling AI service", {
            conversationId,
            error: String(err),
          });
        }
        reply = FALLBACK_MESSAGE;
      }

      // ── 5c. Send reply ──────────────────────────────────────────────────────
      await space.send(text(reply));
      logger.info("Sent reply", { conversationId });
    });
  };
}
